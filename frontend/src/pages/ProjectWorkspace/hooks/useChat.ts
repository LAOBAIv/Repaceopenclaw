/**
 * useChat — 聊天逻辑 Hook
 *
 * 职责：管理消息发送、键盘事件、粘贴图片、消息时间格式化、滚动逻辑。
 * 从原 ProjectWorkspace.tsx 中提取聊天相关的状态和回调。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useConversationStore } from '@/stores/conversation';
import { useAgentStore } from '@/stores/agentStore';
import { useTaskStore } from '@/stores/taskStore';

export function useChat() {
  const { openPanels, sendMessage } = useConversationStore();
  const { agents } = useAgentStore();
  const { addTaskFromChat } = useTaskStore();

  // 输入框内容
  const [inputValue, setInputValue] = useState('');
  // 粘贴图片状态
  const [pastedImages, setPastedImages] = useState<{ file: File; preview: string; uploading: boolean; url?: string }[]>([]);
  // 消息折叠：记录已展开的 panel ID
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set());

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const welcomeAreaRef = useRef<HTMLDivElement>(null);
  // 已自动建任务的 panelId 集合，避免同一会话重复创建
  const createdTaskPanels = useRef<Set<string>>(new Set());
  const prevMsgCountRef = useRef(0);
  const lastScrollHeightRef = useRef(0);

  // 当前激活的 panel
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const activePanel = (activePanelId ? openPanels.find(p => p.id === activePanelId) : null) ?? openPanels[0] ?? null;

  /** 消息时间格式化 */
  const formatMessageTime = useCallback((value?: string) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }, []);

  /** 发送消息 */
  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    const uploadedImages = pastedImages.filter(img => img.url && !img.uploading);
    if (!text && uploadedImages.length === 0) return;

    // 拼接图片 URL 到消息内容
    let content = text;
    if (uploadedImages.length > 0) {
      const imageMarkdown = uploadedImages.map(img => `![image](${img.url})`).join('\n');
      content = content ? `${content}\n${imageMarkdown}` : imageMarkdown;
    }
    // 清理粘贴图片状态
    pastedImages.forEach(img => URL.revokeObjectURL(img.preview));
    setPastedImages([]);

    let panelId: string | undefined;
    let agentName = '';
    let agentColor = '#9ca3af';

    if (activePanel && !activePanel.id.startsWith('local-')) {
      // 已有有效会话 panel，直接发消息
      sendMessage(activePanel.id, content);
      panelId = activePanel.id;
      agentName = activePanel.agentName;
      agentColor = activePanel.agentColor ?? '#9ca3af';
    } else if (!activePanel || activePanel.id.startsWith('local-')) {
      // 没有 panel 或 panel 是本地临时面板：必须通过 createSessionTabFn 建会话
      const defaultAgent = agents[0];
      if (defaultAgent) {
        const createSessionTabFn = useConversationStore.getState().createSessionTab;
        const newTabId = await createSessionTabFn({
          agentId: defaultAgent.id,
          agentName: defaultAgent.name,
          agentColor: defaultAgent.color,
          title: defaultAgent.name,
        });
        const state = useConversationStore.getState();
        const hitTab = state.sessionTabs.find(t => t.id === newTabId);
        const freshPanel = hitTab?.panelId
          ? state.openPanels.find(p => p.id === hitTab.panelId)
          : state.openPanels[0];
        if (freshPanel) {
          setActivePanelId(freshPanel.id);
          sendMessage(freshPanel.id, content);
          panelId = freshPanel.id;
        }
        agentName = defaultAgent.name;
        agentColor = defaultAgent.color ?? '#9ca3af';
      }
    }

    // 每个会话只自动建一次任务（第一条消息触发）
    if (panelId && !createdTaskPanels.current.has(panelId)) {
      createdTaskPanels.current.add(panelId);
      addTaskFromChat({
        title: text,
        agentName: agentName || '智能体',
        agentColor,
        panelId,
      });
    }

    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [inputValue, pastedImages, activePanel, agents, sendMessage, addTaskFromChat]);

  /** 键盘事件：Enter 发送，Ctrl+Enter 换行 */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  /** 粘贴图片处理：从剪贴板读取图片并上传 */
  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length === 0) return;
    e.preventDefault();

    // 添加预览并上传
    for (const file of imageFiles) {
      const preview = URL.createObjectURL(file);
      const idx = pastedImages.length;
      setPastedImages(prev => [...prev, { file, preview, uploading: true }]);

      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        const token = localStorage.getItem('token');
        const res = await fetch('/api/files/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            fileName: file.name || `paste-${Date.now()}.png`,
            mimeType: file.type,
            base64,
            conversationId: activePanel?.conversationId || '',
          }),
        });
        const json = await res.json();
        const url = json.data?.url || json.data?.storagePath;
        setPastedImages(prev => prev.map((img, i) => i === idx ? { ...img, uploading: false, url } : img));
      } catch {
        setPastedImages(prev => prev.map((img, i) => i === idx ? { ...img, uploading: false } : img));
      }
    }
  }, [pastedImages.length, activePanel?.conversationId]);

  /** 移除已粘贴的图片 */
  const removePastedImage = useCallback((idx: number) => {
    setPastedImages(prev => { URL.revokeObjectURL(prev[idx]?.preview); return prev.filter((_, i) => i !== idx); });
  }, []);

  /** 展开面板回调 */
  const handleExpandPanel = useCallback((panelId: string) => {
    setExpandedPanels(prev => { const s = new Set(prev); s.add(panelId); return s; });
  }, []);

  /* ── 消息列表滚动到底部 ── */
  useEffect(() => {
    const msgCount = activePanel?.messages?.length || 0;
    const isStreaming = activePanel?.isStreaming;
    const scrollContainer = welcomeAreaRef.current;

    // 流式输出时：持续跟随到底部
    if (isStreaming && scrollContainer) {
      const currentScrollHeight = scrollContainer.scrollHeight;
      if (currentScrollHeight > lastScrollHeightRef.current + 20) {
        scrollContainer.scrollTop = currentScrollHeight;
        lastScrollHeightRef.current = currentScrollHeight;
      }
    }

    // 新消息完成时：平滑滚动到底部
    if (msgCount > prevMsgCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      if (scrollContainer) lastScrollHeightRef.current = scrollContainer.scrollHeight;
    } else if (msgCount < prevMsgCountRef.current) {
      // 消息减少时瞬间滚动
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      if (scrollContainer) lastScrollHeightRef.current = scrollContainer.scrollHeight;
    }

    prevMsgCountRef.current = msgCount;
  }, [activePanel?.messages, activePanel?.isStreaming]);

  // 切换 tab 时立即滚到底部（无动画）
  useEffect(() => {
    if (activePanel?.id) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        const scrollContainer = welcomeAreaRef.current;
        if (scrollContainer) lastScrollHeightRef.current = scrollContainer.scrollHeight;
      });
    }
  }, [activePanel?.id]);

  return {
    inputValue, setInputValue,
    pastedImages, setPastedImages,
    expandedPanels, setExpandedPanels,
    textareaRef,
    messagesEndRef,
    welcomeAreaRef,
    activePanel,
    activePanelId, setActivePanelId,
    formatMessageTime,
    handleSend,
    handleKeyDown,
    handlePaste,
    removePastedImage,
    handleExpandPanel,
  };
}
