import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';

import { useProjectStore } from '@/stores/projectStore';
import { useConversationStore } from '@/stores/conversationStore';
import { useAgentStore } from '@/stores/agentStore';
import { useTaskStore } from '@/stores/taskStore';
import { useProjectKanbanStore, type ProjectPriority } from '@/stores/projectKanbanStore';
import { showToast } from '@/components/Toast';
import { SessionAgentBar } from '@/components/SessionAgentBar';
import { NewTabModal } from '@/components/NewTabModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { conversationsApi } from '@/api/conversations';
import filesApi, { type FileAsset } from '@/api/files';
import { FileHistoryModal } from '@/components/workspace/FileHistoryModal';

/* ── 浏览器标签页类型（与会话绑定） ── */
interface BrowserTab {
  key: string;
  title: string;
  conversationId?: string;  // 绑定的会话 ID（有则表示此标签有活跃会话）
  agentId?: string;         // 主智能体 ID
  agentName?: string;       // 智能体名称（标题显示用）
  color?: string;           // 智能体颜色
}

/** 可用的模型列表（用于 Tab 模型切换） */
const AVAILABLE_MODELS: { id: string; label: string; provider: string }[] = [];
import {
  SkillPanel,
  SchedulePanel,
  ShortcutPanel,
  TaskTagPanel,
  AgentPanel,
  TabPanel,
  PriorityModal,
  ChannelConfigModal,
  makeFlowNode,
  type FlowNode,
  FUNCTION_TABS,
  CHANNEL_LIST,
  PRIORITY_OPTIONS,
  TAB_META,
  CHANNEL_TABS,
  CHANNEL_LABELS,
  getProgressColor,
  getTagColor,
  type ChannelType,
} from '@/components/workspace';

export function ProjectWorkspace() {
  const location = useLocation();
  type NavState = { projectName?: string; projectId?: string; taskId?: string; agentNames?: string[]; sessionId?: string; precreatedTabId?: string; navNonce?: number } | null;
  const navState = location.state as NavState;
  /** 从项目协作页跳转时携带的项目名（任务/项目通用） */
  const incomingProjectName = navState?.projectName;
  /** 从项目看板卡片跳转时携带的项目 id */
  const incomingProjectId = navState?.projectId;
  /** 从任务看板卡片跳转时携带的任务 id */
  const incomingTaskId = navState?.taskId;
  /**
   * 从任务/项目看板卡片点击跳转时携带的智能体名称列表
   * 用于 AgentPanel 只展示该任务/项目关联的智能体
   * 若为空/未传入，则 AgentPanel 展示所有智能体
   */
  const incomingAgentNames = navState?.agentNames;

  /* ── Store 接入 ─────────────────────────────────────────── */
  const { currentProject, projects, fetchProjects } = useProjectStore();
  const { openPanels, openPanel, sendMessage, connect, closePanel, wsConnected, restoreFromPersist,
    sessionTabs: storeSessionTabs, activeTabId: storeActiveTabId } = useConversationStore();
  // 统一 Tab 管理（方案 A：sessionTabs 作为唯一数据源）
  const rawSessionTabs = useConversationStore(s => s.sessionTabs);
  const getTabs = useConversationStore(s => s.getTabs);
  const storeActiveId = useConversationStore(s => s.activeTabId);
  const switchTab = useConversationStore(s => s.switchTab);
  const closeTabFn = useConversationStore(s => s.closeTab);
  const renameTab = useConversationStore(s => s.renameTab);
  const createSessionTabFn = useConversationStore(s => s.createSessionTab);
  const switchAgentFn = useConversationStore(s => s.switchAgent);
  const allTabs = React.useMemo(() => getTabs(), [rawSessionTabs, getTabs]);
  const activeTab = allTabs.find(t => t.id === storeActiveId);
  const { agents, fetchAgents } = useAgentStore();
  const { addTaskFromChat, tasks, updateTask } = useTaskStore();
  const { projects: kanbanProjects, updateProject: updateKanbanProject, addProject: addKanbanProject } = useProjectKanbanStore();

  /* ── 本地状态 ────────────────────────────────────────────── */
  const [activeSideTab, setActiveSideTab] = useState<string | null>(null);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [inputValue, setInputValue] = useState('');
  // [2026-05-16] 粘贴图片上传状态
  const [pastedImages, setPastedImages] = useState<{ file: File; preview: string; uploading: boolean; url?: string }[]>([]);
  // [2026-05-16] 消息折叠：记录已展开的 panel ID
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set());
  /** 当前激活的对话 panel id（用于智能体面板高亮显示） */
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  /** 协作流程节点（提升到顶层，防止 TabPanel 关闭时丢失） */
  const [collabNodes, setCollabNodes] = useState<FlowNode[]>(() => [makeFlowNode(0)]);
  /** 当前是否为项目模式（可动态升级/降级） */
  const [isProjectMode, setIsProjectMode] = useState<boolean>(() => !!incomingProjectId);
  /** 当前参与会话的智能体名称列表（项目模式下可增删，任务模式下只有1个） */
  const [participatingAgentNames, setParticipatingAgentNames] = useState<string[]>(
    () => incomingAgentNames ?? []
  );
  /** 顶部优先级下拉是否展开 */
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** 已自动建任务的 panelId 集合，避免同一会话重复创建 */
  const createdTaskPanels = useRef<Set<string>>(new Set());

  /** 浏览器网络是否在线 */
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /** 顶部状态徽标：离线 > 忙碌 > 运行中 */
  const isAnyStreaming = openPanels.some(p => p.isStreaming);
  type AppStatus = 'running' | 'offline' | 'busy';
  const appStatus: AppStatus = !isOnline || !wsConnected ? 'offline' : isAnyStreaming ? 'busy' : 'running';
  const STATUS_CONFIG: Record<AppStatus, { label: string; bg: string; color?: string; border: string; dotColor: string }> = {
    running: { label: '运行中', bg: '#e8f5e9', color: '#2e7d32', border: '#dcedc8', dotColor: '#22c55e' },
    offline: { label: '离线',   bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', dotColor: '#ef4444' },
    busy:    { label: '忙碌',   bg: '#fffbeb', color: '#b45309', border: '#fde68a', dotColor: '#f59e0b' },
  };

  /* ── 取当前工作台的会话 panel（按 activePanelId 查找，兜底取第一个） ── */
  const activePanel = (activePanelId ? openPanels.find(p => p.id === activePanelId) : null) ?? openPanels[0] ?? null;

  /* ── 动态数据：优先用跳转传入的项目名 > currentProject > 第一个项目 ── */
  const taskName = incomingProjectName ?? currentProject?.title ?? (projects[0]?.title ?? 'WorkBuddy');

  /* ── 标签页重命名状态 ── */
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabTitle, setEditingTabTitle] = useState('');

  /** 新建标签页弹窗状态 */
  const [showNewTabModal, setShowNewTabModal] = useState(false);
  const [restoreReady, setRestoreReady] = useState(false);

  /** 模型切换下拉状态 */
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [modelDropdownTabId, setModelDropdownTabId] = useState<string | null>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const [availableModels, setAvailableModels] = useState<{ id: string; label: string; provider: string }[]>([]);

  // 动态加载模型列表
  useEffect(() => {
    (async () => {
      try {
        const authRaw = sessionStorage.getItem('repaceclaw-auth') || localStorage.getItem('repaceclaw-auth');
        const token = authRaw ? JSON.parse(authRaw)?.state?.token : '';
        const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
        const [mRes, pRes] = await Promise.all([fetch('/api/models', { headers }).then(r => r.json()), fetch('/api/model-providers', { headers }).then(r => r.json())]);
        const provs = pRes.data || [];
        const models = (mRes.data || []).filter((m: any) => m.enabled).map((m: any) => {
          const prov = provs.find((p: any) => p.id === m.providerId);
          return { id: m.name, label: `${m.name} · ${prov?.name || ''}`, provider: prov?.name || '' };
        });
        setAvailableModels([{ id: 'auto', label: '自动选择', provider: 'auto' }, ...models]);
      } catch { setAvailableModels([{ id: 'auto', label: '自动选择', provider: 'auto' }]); }
    })();
  }, []);

  /** 点击外部关闭模型切换下拉 */
  useEffect(() => {
    if (!showModelDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
        setModelDropdownTabId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showModelDropdown]);

  const taskProgress = 68; // 真实进度字段后端暂无，保留占位

  /* ── 上下文使用量计算（仅前端估算，不代表模型真实 usage） ── */
  const activeAgent = activePanel?.agentId ? agents.find(a => a.id === activePanel.agentId) : null;
  const activeModelName = activeAgent?.modelName || 'GLM-5';
  const panelMessages = activePanel?.messages || [];
  const totalChars = panelMessages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
  const messageCount = panelMessages.length;
  const draftChars = inputValue.length;
  // 改为按实际字符长度粗估：
  // - 中文/混合文本按约 1~1.2 char/token 做保守估算
  // - 每条消息补少量结构开销
  // - 再加一小段系统提示/路由开销
  const estimatedTokens = Math.max(
    1000,
    Math.round(totalChars * 1.1 + draftChars * 1.1 + messageCount * 80 + 1500)
  );
  const contextLimit = 200000; // 默认 200k
  const contextUsedK = estimatedTokens >= 1000 ? (estimatedTokens / 1000).toFixed(1).replace(/\.0$/, '') : '1';
  const contextMaxK = Math.round(contextLimit / 1000);
  const contextPct = Math.min(100, Math.max(1, Math.round((estimatedTokens / contextLimit) * 100)));

  const formatMessageTime = (value?: string) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  /* ── 找到 kanban 中对应的项目（项目模式用来读写 tags/priority）── */
  const allKanbanProjects = [...kanbanProjects.progress, ...kanbanProjects.done];
  const matchedKanbanProject =
    (incomingProjectId ? allKanbanProjects.find(p => p.id === incomingProjectId) : undefined)
    ?? (incomingProjectName && !incomingTaskId ? allKanbanProjects.find(p => p.title === incomingProjectName) : undefined)
    ?? null;

  /* ── 找到 taskStore 中对应的任务（任务模式用来读写 tags/priority）── */
  const allTasks = [...tasks.progress, ...tasks.done];
  const matchedTask = incomingTaskId ? allTasks.find(t => t.id === incomingTaskId) ?? null : null;

  /* ── 统一的 tags / priority 数据源：任务模式用 taskStore，项目模式用 kanbanStore ── */
  const currentTags: string[] = matchedTask?.tags ?? matchedKanbanProject?.tags ?? [];
  const currentPriority: ProjectPriority | null = (matchedTask?.priority as ProjectPriority | undefined) ?? matchedKanbanProject?.priority ?? null;

  /* ── 优先级读写 ──────────────────────────────────────────── */
  function setPriority(p: ProjectPriority) {
    if (matchedTask) {
      updateTask(matchedTask.id, { priority: p as 'high' | 'mid' | 'low' });
    } else if (matchedKanbanProject) {
      updateKanbanProject(matchedKanbanProject.id, { priority: p });
    }
  }

  /* ── 任务升级为项目 ─────────────────────────────────────── */
  function upgradeToProject(newAgentNames: string[]) {
    // 将新增的智能体 Panel 打开
    const allNames = [...new Set([...participatingAgentNames, ...newAgentNames])];
    setParticipatingAgentNames(allNames);
    setIsProjectMode(true);
    // 在看板 store 新建一条项目记录（如果还没有匹配项目）
    if (!matchedKanbanProject || matchedKanbanProject.agents.length < 2) {
      const participantAgents = agents
        .filter(a => allNames.includes(a.name))
        .map(a => ({ name: a.name, color: a.color ?? '#6366f1' }));
      const dueDate30 = new Date(Date.now() + 30 * 86400000);
      const mm = String(dueDate30.getMonth() + 1).padStart(2, '0');
      const dd = String(dueDate30.getDate()).padStart(2, '0');
      addKanbanProject({
        id: matchedKanbanProject?.id ?? `proj_upgrade_${Date.now()}`,
        title: taskName,
        description: '',
        tags: currentTags,
        priority: currentPriority ?? 'low',
        agent: participantAgents[0]?.name ?? '策划助手',
        agentColor: participantAgents[0]?.color ?? '#6366f1',
        agents: participantAgents.length >= 2 ? participantAgents : [
          ...(participantAgents.length > 0 ? participantAgents : [{ name: '策划助手', color: '#6366f1' }]),
          { name: allNames[1] ?? allNames[0] ?? '研究员', color: '#3b82f6' },
        ],
        progress: 0,
        dueDate: `${mm}/${dd}`,
        updatedAt: '刚刚',
        taskCount: collabNodes.length,
        memberCount: allNames.length,
      }, 'progress');
    } else {
      // 已有项目记录则只更新 agents 列表
      const participantAgents = agents
        .filter(a => allNames.includes(a.name))
        .map(a => ({ name: a.name, color: a.color ?? '#6366f1' }));
      updateKanbanProject(matchedKanbanProject.id, { agents: participantAgents, memberCount: allNames.length });
    }
  }

  /* ── 项目降级为任务 ─────────────────────────────────────── */
  function downgradeToTask(keptAgentName: string) {
    setParticipatingAgentNames([keptAgentName]);
    setIsProjectMode(false);
    // 关闭非保留智能体的所有 Panel
    openPanels.forEach(p => {
      if (p.agentName !== keptAgentName) closePanel(p.id);
    });
    setActivePanelId(prev => {
      const kept = openPanels.find(p => p.agentName === keptAgentName);
      return kept ? kept.id : prev;
    });
    // 清空协作节点，回到初始单节点
    setCollabNodes([makeFlowNode(0)]);
  }

  /* ── 点击空白处关闭优先级下拉 ──────────────────────────── */
  useEffect(() => {
    if (!showPriorityDropdown) return;
    function handleClickOutside(e: MouseEvent) {
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(e.target as Node)) {
        setShowPriorityDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPriorityDropdown]);

  /* ── 初始化：加载项目 + 智能体列表 + WS 连接 + 恢复会话 ── */
  // Day 2 修复:taskStore 和 projectKanbanStore 的 restoreFromPersist() 此前从未被调用，
  // 导致任务看板/项目看板刷新后始终为空（数据源只靠 addTask/addProject 局部写入，不拉后端存量数据）。
  // 现在在 conversationStore 恢复完成后，链式触发任务和项目看板的数据恢复。
  useEffect(() => {
    fetchProjects();
    fetchAgents();
    connect();
    restoreFromPersist().then(async () => {
      const panels = useConversationStore.getState().openPanels;
      const tabs = useConversationStore.getState().sessionTabs;
      const activeTabId = useConversationStore.getState().activeTabId;

      // 🔧 关键修复 (2026-05-12): 刷新后 Tab 激活与面板显示治理
      // 根因: restoreFromPersist 恢复后, activeTabId 可能指向 panelId=null 的 Tab
      //      (如微信助手 Tab 未被点击过), 导致 activePanelId 为 null,
      //      所有面板 display:none, 内容区空白。
      // 方案: 1) 确保 activeTabId 始终指向一个有 panelId 的 Tab
      //       2) 如果当前 activeTab 没有 panelId, 自动切换到第一个有 panelId 的 Tab
      //       3) 如果没有任何 Tab 有 panelId, 确保 activeTabId 至少指向第一个 Tab
      //       4) activePanelId 必须与 activeTab.panelId 严格同步
      const freshPanels = useConversationStore.getState().openPanels;
      const freshTabs = useConversationStore.getState().sessionTabs;
      const freshActiveTabId = useConversationStore.getState().activeTabId;


      // 步骤 1: 检查当前 activeTab 是否有 panelId
      let targetTabId = freshActiveTabId;
      let targetPanelId: string | null = null;

      if (targetTabId) {
        const currentActiveTab = freshTabs.find(t => t.id === targetTabId);
        if (currentActiveTab?.panelId) {
          // 当前 Tab 有面板, 直接使用
          targetPanelId = currentActiveTab.panelId;
        } else if (currentActiveTab?.id === 'wechat') {
          // [2026-05-18] 微信助手 panelId 必然存在，直接使用
          targetPanelId = currentActiveTab.panelId;
        } else {
          // 当前 Tab 没有面板, 需要切换到第一个有面板的 Tab
          const firstTabWithPanel = freshTabs.find(t => t.panelId && freshPanels.some(p => p.id === t.panelId));
          if (firstTabWithPanel) {
            targetTabId = firstTabWithPanel.id;
            targetPanelId = firstTabWithPanel.panelId;
            // 同步更新 store 中的 activeTabId
            useConversationStore.setState({ activeTabId: targetTabId });
          } else {
            // 没有任何 Tab 有面板, 但至少确保 activeTabId 指向第一个 Tab
            const firstTab = freshTabs[0];
            if (firstTab && !targetTabId) {
              targetTabId = firstTab.id;
              useConversationStore.setState({ activeTabId: targetTabId });
            }
          }
        }
      } else {
        // 没有 activeTabId, 自动激活第一个有面板的 Tab
        const firstTabWithPanel = freshTabs.find(t => t.panelId && freshPanels.some(p => p.id === t.panelId));
        if (firstTabWithPanel) {
          targetTabId = firstTabWithPanel.id;
          targetPanelId = firstTabWithPanel.panelId;
          useConversationStore.setState({ activeTabId: targetTabId });
        } else if (freshTabs.length > 0) {
          // 没有任何 Tab 有面板, 但至少激活第一个 Tab
          targetTabId = freshTabs[0].id;
          useConversationStore.setState({ activeTabId: targetTabId });
        }
      }

      // 步骤 2: 设置 activePanelId
      if (targetPanelId) {
        setActivePanelId(targetPanelId);
      } else if (freshPanels.length > 0) {
        // 没有 panelId 但有面板(可能是未被 Tab 引用的面板), 激活第一个
        setActivePanelId(freshPanels[0].id);
      } else {
        // 完全没有面板, 清空 activePanelId
        setActivePanelId(null);
      }

      setRestoreReady(true);
    }).catch(() => {
      setRestoreReady(true);
    });

    // Day 2: 任务看板恢复（此前从未调用，刷新后任务列表丢失）
    useTaskStore.getState().restoreFromPersist().catch(() => {});
    // Day 2: 项目看板恢复（此前从未调用，刷新后项目看板为空）
    useProjectKanbanStore.getState().restoreFromPersist().catch(() => {});

    // [2026-05-19] 页面卸载前缓存当前 active 会话消息快照
    const handleBeforeUnload = () => {
      const state = useConversationStore.getState();
      const activeTab = state.sessionTabs.find(t => t.id === state.activeTabId);
      const convId = activeTab?.panelId || activeTab?.conversationId;
      if (convId) {
        const panel = state.openPanels.find(p => p.id === convId);
        if (panel && panel.messages.length > 0) {
          try {
            sessionStorage.setItem(`rc:msg-cache:${convId}`, JSON.stringify({
              messages: panel.messages.slice(-50),
              agentId: panel.agentId,
              agentName: panel.agentName,
              agentColor: panel.agentColor,
              sessionCode: panel.sessionCode,
            }));
          } catch {}
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 从会话列表/kanban 进入工作区：会话列表页已创建 tab，这里只负责激活它 ── */
  const handledNavKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!restoreReady || !navState?.sessionId) return;

    const navKey = `${location.key}:${navState.sessionId}:${navState.precreatedTabId || ''}:${navState.navNonce || ''}`;
    if (handledNavKeyRef.current === navKey) return;
    handledNavKeyRef.current = navKey;

    if (navState.precreatedTabId) {
      switchTab(navState.precreatedTabId);
      const tabs = useConversationStore.getState().sessionTabs;
      const hitTab = tabs.find(t => t.id === navState.precreatedTabId);
      if (hitTab?.panelId) {
        setActivePanelId(hitTab.panelId);
      }
      return;
    }

    // 兜底：其他来源未预创建 tab，仍允许在 workspace 内创建
    conversationsApi.list().then(convList => {
      const conv = convList.find(c => c.id === navState.sessionId);
      const agentId = conv?.currentAgentId || conv?.agentId || conv?.agentIds?.[0] || '';
      const agentName = conv?.title || navState.projectName || '会话';
      createSessionTabFn({
        agentId,
        agentName,
        agentColor: '#6366f1',
        title: agentName,
        conversationId: navState.sessionId!,
        forceNewTab: true,
      }).then((newTabId) => {
        const tabs = useConversationStore.getState().sessionTabs;
        const hitTab = tabs.find(t => t.id === newTabId);
        if (hitTab?.panelId) {
          setActivePanelId(hitTab.panelId);
        }
        switchTab(newTabId);
      });
    }).catch(() => {});
  }, [restoreReady, location.key, navState?.sessionId, navState?.projectName, navState?.precreatedTabId, navState?.navNonce, createSessionTabFn, switchTab]);

  /* ── activeTab 变化时同步 activePanel，避免标签切换后仍指向旧面板 ──
   * 🔧 关键修复 (2026-05-12):
   * 当 activeTab 没有 panelId 时(如微信助手 Tab 未被点击),
   * 不能保留旧的 activePanelId, 否则内容区会显示错误的面板。
   * 正确行为: 如果当前 Tab 无 panelId, 清空 activePanelId,
   *          让内容区显示空状态(欢迎页)。
   */
  useEffect(() => {
    const tab = allTabs.find(t => t.id === storeActiveId);
    if (tab?.panelId) {
      setActivePanelId(tab.panelId);
    }
    // 如果 storeActiveId 为 null/空 且 allTabs 为空, 不做任何操作
  }, [allTabs, storeActiveId]);

  /* ── 消息列表滚动到底部 ─────────────────────────────────── */
  const welcomeAreaRef = useRef<HTMLDivElement | null>(null);
  const prevMsgCountRef = useRef(0);
  const lastScrollHeightRef = useRef(0);

  useEffect(() => {
    const msgCount = activePanel?.messages?.length || 0;
    const isStreaming = activePanel?.isStreaming;
    const scrollContainer = welcomeAreaRef.current;

    // 流式输出时：持续跟随到底部（用 scrollTop 直接设置，避免 smooth scroll 与内容增长打架）
    // 每次内容增长最多只触发一次滚动，不会高频抖动
    if (isStreaming && scrollContainer) {
      const currentScrollHeight = scrollContainer.scrollHeight;
      // 只在 scrollHeight 真正增长时滚动，避免无意义重复调用
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
      // 消息减少（如清除/重新加载）时瞬间滚动
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      if (scrollContainer) lastScrollHeightRef.current = scrollContainer.scrollHeight;
    }

    prevMsgCountRef.current = msgCount;
  }, [activePanel?.messages, activePanel?.isStreaming]);

  // [2026-05-16] 切换 tab 时立即滚到底部（无动画），避免闪现
  useEffect(() => {
    if (activePanel?.id) {
      // 用 requestAnimationFrame 确保 DOM 已渲染
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        const scrollContainer = welcomeAreaRef.current;
        if (scrollContainer) lastScrollHeightRef.current = scrollContainer.scrollHeight;
      });
    }
  }, [activePanel?.id]);

  /* ── 微信助手 Tab 点击：使用专用 API 获取/创建会话 ──
   * 
   * 改造日期：2026-05-12
   * 背景：微信助手从「跳转到管理页」改为「工作台内会话 Tab」
   * 核心问题：zustand persist 恢复旧 sessionTabs 后，id='wechat' 的 Tab 可能丢失
   * 修复方案：点击时动态检测并补种 wechat Tab
   * 
   * 完整参数链路：
   *   1. Tab 配置 → sessionTabs: { id:'wechat', agentId:'rc-wechat-agent', ... }
   *   2. API 调用 → GET /api/conversations/wechat-assistant
   *   3. 后端创建 → ConversationService.create + bindOpenClawSession
   *   4. 面板创建 → openPanels: { agentId:'rc-wechat-agent', conversationId:conv.id, ... }
   *   5. Gateway 调用 → model=openclaw/rc-wechat-agent, sessionKey=agent:rc-wechat-agent:rc:{convId}
   *   6. 智能体参数 → systemPrompt, temperature=0.7, maxTokens=4096, visibility=public
   */
  const handleWechatTabClick = useCallback(async () => {
    const { sessionTabs, openPanels, bindPanelToTab, loadMessages } = useConversationStore.getState();

    // 2. 查找微信助手 Tab，如果不存在则创建
    let wechatTab = sessionTabs.find(t => t.id === 'wechat');
    
    if (!wechatTab) {
      console.warn('[WechatTab] 未找到 wechat Tab，尝试补种');
      // 如果当前 sessionTabs 中没有微信助手 Tab，需要添加
      const exists = useConversationStore.getState().sessionTabs.some(t => t.id === 'wechat');
      if (!exists) {
        useConversationStore.setState((state) => ({
          sessionTabs: [
            {
              id: 'wechat',
              type: 'wechat',
              title: '微信助手',
              panelId: null,
              conversationId: 'wechat-assistant',
              agentId: 'rc-wechat-agent',
              agentName: '微信助手',
              agentColor: '#2563eb',
            },
            ...state.sessionTabs,
          ],
        }));
      }
      // 重新获取 wechatTab
      wechatTab = useConversationStore.getState().sessionTabs.find(t => t.id === 'wechat');
    }

    // 1. 切换激活微信助手 Tab
    switchTab('wechat');

    // 3. 如果已有 panelId 且面板存在，直接激活并确保消息已加载
    if (wechatTab.panelId) {
      const existingPanel = openPanels.find(p => p.id === wechatTab.panelId);
      if (existingPanel) {
        setActivePanelId(existingPanel.id);
        // 🔧 Bug修复: 如果面板消息为空，从后端API重新加载
        // 根因: openPanels 不持久化，刷新后面板虽被 restoreFromPersist 重建，
        //       但可能因网络/时序问题导致 messages 为空数组
        if (!existingPanel.messages || existingPanel.messages.length === 0) {
          try {
            const { conversationsApi } = await import('@/api/conversations');
            const conv = await conversationsApi.getWechatAssistant();
            if (conv?.messages?.length) {
              useConversationStore.setState(s => ({
                openPanels: s.openPanels.map(p =>
                  p.id === existingPanel.id
                    ? { ...p, messages: conv.messages }
                    : p
                ),
              }));
            }
          } catch (err) {
            console.warn('[WechatTab] 加载微信助手消息失败:', err);
          }
        }
        return;
      }
      // 面板已被关闭，清空 panelId
      wechatTab.panelId = null;
    }

    // 4. 使用专用 API 获取/创建微信助手会话
    const { conversationsApi } = await import('@/api/conversations');
    let conv: any;
    try {
      conv = await conversationsApi.getWechatAssistant();
    } catch (err: any) {
      console.error('[WechatTab] API 请求失败:', err);
      const errMsg = err?.response?.data?.error || err?.message || '未知错误';
      const status = err?.response?.status;
      alert(`微信助手会话创建失败\nHTTP ${status || 'N/A'}: ${errMsg}\n\n请检查：\n1. 是否已登录\n2. 浏览器 Console 是否有错误`);
      return;
    }

    if (!conv) {
      console.error('[WechatTab] API 返回空数据');
      alert('微信助手会话创建失败：服务器返回空数据');
      return;
    }

    // 5. 创建面板并绑定到微信 Tab
    const panelId = conv.id;
    const existingPanel = openPanels.find(p => p.id === panelId || p.conversationId === panelId);

    if (existingPanel) {
      bindPanelToTab('wechat', existingPanel.id, '微信助手', '#2563eb');
      setActivePanelId(existingPanel.id);
      return;
    }

    // 新面板
    const { useAgentStore } = await import('@/stores/agentStore');
    const agents = useAgentStore.getState().agents;
    const wechatAgent = agents.find(a => a.id === 'rc-wechat-agent' || a.openclawAgentId === 'rc-wechat-agent' || a.agentCode === 'rc-wechat-agent');

    const panel = {
      id: panelId,
      conversationId: panelId,
      sessionCode: conv.sessionCode,
      agentId: 'rc-wechat-agent',
      currentAgentCode: conv.currentAgentCode,
      agentIds: conv.agentIds?.length ? conv.agentIds : ['rc-wechat-agent'],
      agentName: wechatAgent?.name || '微信助手',
      agentColor: wechatAgent?.color || '#2563eb',
      messages: conv.messages || [],
      isStreaming: false,
    };

    useConversationStore.setState(s => ({
      openPanels: [...s.openPanels, panel],
    }));

    bindPanelToTab('wechat', panelId, '微信助手', '#2563eb');
    setActivePanelId(panelId);
  }, [switchTab]);

  /* ── 发送消息 ─────────────────────────────────────────────── */
  async function handleSend() {
    const text = inputValue.trim();
    // [2026-05-16] 支持纯图片发送（无文字）
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
      // 没有 panel 或 panel 是本地临时面板：必须通过 createSessionTabFn 建会话。
      //
      // ⚠️ 关键回归 BUG（2026-05-06）：
      // 之前这里直接调用 openPanel，只会创建 openPanels，不会创建 sessionTabs。
      // 而刷新恢复的 UI 真相源恰恰是 sessionTabs（openPanels 不再持久化）。
      // 结果就是：用户首条消息能正常聊，但因为没有持久化 tab，刷新后看起来像“会话全丢”。
      const defaultAgent = agents[0];
      if (defaultAgent) {
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
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); handleSend(); }
  }

  // [2026-05-16] 粘贴图片处理：从剪贴板读取图片并上传
  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
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
  }

  // [2026-05-16] 移除已粘贴的图片
  function removePastedImage(idx: number) {
    setPastedImages(prev => { URL.revokeObjectURL(prev[idx]?.preview); return prev.filter((_, i) => i !== idx); });
  }

  function handleTabClick(tab: string) {
    if (tab === '消息渠道') {
      setActiveSideTab(null);
      setShowChannelModal(true);
    } else {
      setActiveSideTab(activeSideTab === tab ? null : tab);
    }
  }

  const progressColor = getProgressColor(taskProgress);

  /* ── 渲染消息列表 ──────────────────────────────────────── */
  const messages = activePanel?.messages ?? [];

  return (
    <>
      <style>{`
        .workspace-body {
          width: 100%; height: 100%; background: #f5f7fa;
          padding: 0 16px 16px; box-sizing: border-box; display: flex; flex-direction: column;
        }
        .layout-container {
          flex: 1; min-height: 0;
          display: flex; flex-direction: column;
          background: #fafbfc; border: 1px solid #e5e6eb;
          border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.05);
          font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
          overflow: hidden;
        }
        .content-header {
          display: flex; align-items: center; gap: 10px;
          padding: 16px 32px; border-bottom: 1px solid #ebedf0;
          flex-shrink: 0; background: #ffffff;
        }
        .content-header .brand-name {
          font-size: 16px; font-weight: 700; color: #1a1d23;
        }
        .status-badge {
          font-size: 12px; padding: 2px 8px; border-radius: 20px;
          white-space: nowrap; display: inline-flex; align-items: center; gap: 5px;
          font-weight: 500; transition: background 0.3s, color 0.3s;
          border: 1px solid;
        }
        .welcome-area {
          flex: 1; min-height: 0; background: #ffffff; overflow-y: auto; overflow-x: hidden;
          scroll-behavior: auto; /* 流式输出时用 scrollTop 直接控制，不要 CSS smooth */
        }
        .function-tabs {
          display: flex; gap: 8px; padding: 10px 20px; flex-wrap: wrap;
          border-bottom: 1px solid #ebedf0; flex-shrink: 0; background: #fafbfc;
        }
        .function-tab {
          padding: 4px 10px; background: #ffffff; border: 1px solid #d9d9d9;
          border-radius: 4px; font-size: 12px; color: #333; cursor: pointer;
          transition: all 0.15s; user-select: none;
        }
        .function-tab:hover { border-color: #1890ff; color: #1890ff; }
        .function-tab.active { background: #e6f4ff; border-color: #1890ff; color: #1890ff; }
        .input-container {
          position: relative; padding: 16px 20px 12px; flex-shrink: 0;
          background: #fafbfc; border-top: 1px solid #ebedf0;
        }
        .resize-bar {
          display: flex; align-items: center; justify-content: center;
          height: 10px; cursor: ns-resize; border-radius: 6px 6px 0 0;
          background: rgba(140,111,255,0.06); transition: background 0.15s;
          margin-bottom: -1px;
        }
        .resize-bar:hover { background: rgba(140,111,255,0.15); }
        .resize-bar::after {
          content: ''; width: 48px; height: 4px; border-radius: 999px;
          background: #c4b5fd; transition: background 0.15s;
        }
        .resize-bar:hover::after { background: #8c6fff; }
        .main-input {
          width: 100%; padding: 12px 50px 12px 14px; border: 1px solid #d9d9d9;
          border-radius: 0 0 8px 8px; min-height: 96px; max-height: 300px; resize: none; background: #ffffff;
          font-size: 14px; font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
          color: #1a1d23; line-height: 1.6; box-sizing: border-box; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .main-input:focus { border-color: #1890ff; box-shadow: 0 0 0 2px rgba(24,144,255,0.2); }
        .send-btn {
          position: absolute; right: 30px; bottom: 22px;
          width: 32px; height: 32px; border-radius: 50%;
          background: #8c6fff; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, transform 0.1s;
        }
        .send-btn:hover { background: #7c5ef0; transform: scale(1.08); }
        .send-btn:active { transform: scale(0.95); }
        .send-btn svg { display: block; }
        .progress-bar-area {
          flex-shrink: 0; padding: 10px 20px 14px;
          border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;
          background: #fafbfc;
        }
        .progress-bar-header {
          display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px;
        }
        .progress-bar-label { font-size: 12px; color: #8c8f9a; }
        .progress-bar-pct { font-size: 12px; font-weight: 600; }
        .progress-track {
          width: 100%; height: 5px; border-radius: 99px;
          background: #ebedf0; overflow: hidden; box-sizing: border-box;
        }
        .progress-fill { height: 100%; border-radius: 99px; transition: width 0.6s ease; }
        .workspace-tabbar {
          display: flex; align-items: flex-end; min-height: 46px; padding: 0; flex-shrink: 0;
          overflow-x: auto; gap: 4px; background: #fafbfc; box-sizing: border-box;
          scrollbar-width: none; -ms-overflow-style: none;
        }
        .workspace-tabbar::-webkit-scrollbar { display: none; }
        .workspace-tab {
          display: flex; align-items: center; gap: 8px;
        }
        .workspace-tab-title {
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px;
        }
        .workspace-tab-close {
          display: flex; align-items: center; justify-content: center;
          width: 20px; height: 20px; border-radius: 6px; opacity: 0.4;
          cursor: pointer; transition: all 0.15s; margin-left: 4px;
        }
        .workspace-tab-add {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; background: transparent; border: 1px dashed #d1d5db;
          border-radius: 8px; cursor: pointer; color: #9ca3af; flex-shrink: 0;
          transition: all 0.2s; margin-bottom: 4px;
        }
        .workspace-message-row { display: flex; margin-bottom: 12px; }
        .workspace-message-row.is-user { justify-content: flex-end; }
        .workspace-message-row.is-agent { justify-content: flex-start; }
        .workspace-message-wrap { max-width: 72%; }
        .workspace-message-meta {
          display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
          font-size: 11px; color: #9ca3af;
        }
        .workspace-message-bubble {
          max-width: 100%; padding: 8px 14px; font-size: 13px; line-height: 1.6;
          word-break: break-word; overflow-wrap: break-word;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.4); }
        }
        /* Markdown 渲染样式 */
        .markdown-body table {
          border-collapse: collapse;
          width: 100%;
          margin: 8px 0;
          font-size: 12px;
        }
        .markdown-body th, .markdown-body td {
          border: 1px solid #d1d5db;
          padding: 6px 10px;
          text-align: left;
        }
        .markdown-body th {
          background: #f3f4f6;
          font-weight: 600;
        }
        .markdown-body code {
          background: rgba(0,0,0,0.08);
          padding: 1px 5px;
          border-radius: 3px;
          font-size: 12px;
          font-family: 'Menlo','Consolas','Courier New',monospace;
        }
        .markdown-body pre {
          background: #f5f5f5;
          border: 1px solid #e5e5e5;
          color: #1a1a1a;
          padding: 12px;
          border-radius: 6px;
          overflow-x: auto;
          font-size: 12px;
          margin: 8px 0;
        }
        .markdown-body pre code {
          background: none;
          padding: 0;
          color: inherit;
        }
        .markdown-body strong { font-weight: 700; }
        .markdown-body em { font-style: italic; }
        .markdown-body ul, .markdown-body ol {
          padding-left: 20px;
          margin: 6px 0;
        }
        .markdown-body li { margin: 3px 0; }
        .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
          margin: 10px 0 6px;
          font-weight: 700;
          line-height: 1.4;
        }
        .markdown-body h1 { font-size: 16px; }
        .markdown-body h2 { font-size: 15px; }
        .markdown-body h3 { font-size: 14px; }
        .markdown-body h4 { font-size: 13px; }
        .markdown-body blockquote {
          border-left: 3px solid #d1d5db;
          padding-left: 12px;
          color: #6b7280;
          margin: 6px 0;
        }
        /* 深色背景下的 markdown */
        .bubble-dark .markdown-body code {
          background: rgba(255,255,255,0.15);
        }
        .bubble-dark .markdown-body pre {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.2);
          color: #f0f0f0;
        }
        .bubble-dark .markdown-body blockquote {
          border-left-color: rgba(255,255,255,0.3);
          color: rgba(255,255,255,0.7);
        }
        @media (max-width: 768px) {
          .workspace-body { padding: 0 !important; }
          .layout-container { border-radius: 0 !important; min-height: 100%; }
          .content-header {
            flex-direction: column; align-items: flex-start; gap: 6px;
            padding: 12px 14px !important;
          }
          .workspace-tabbar {
            min-height: 42px !important;
            padding: 0 8px !important;
            gap: 6px !important;
          }
          .workspace-tab {
            min-width: 96px !important;
            max-width: 180px;
            padding: 10px 12px 8px !important;
            gap: 6px !important;
            font-size: 13px !important;
          }
          .workspace-tab-title { max-width: 92px !important; }
          .workspace-tab-close {
            opacity: 1 !important;
            width: 18px !important;
            height: 18px !important;
            margin-left: 0 !important;
          }
          .workspace-tab-add {
            width: 32px !important;
            height: 32px !important;
            margin: 0 0 4px 0 !important;
          }
          .welcome-area.has-messages { padding: 12px 12px 20px !important; }
          .workspace-message-row { margin-bottom: 10px !important; }
          .workspace-message-wrap { max-width: 88% !important; }
          .workspace-message-meta { flex-wrap: wrap !important; gap: 4px 6px !important; }
          .workspace-message-bubble {
            padding: 8px 10px !important;
            font-size: 13px !important;
          }
          .function-tabs {
            gap: 6px !important;
            padding: 8px 10px !important;
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .function-tabs::-webkit-scrollbar { display: none; }
          .function-tab {
            flex-shrink: 0;
            white-space: nowrap;
          }
          .input-container {
            padding: 12px 10px calc(10px + env(safe-area-inset-bottom)) !important;
          }
          .resize-bar { display: none !important; }
          .main-input {
            min-height: 84px !important;
            max-height: 180px !important;
            font-size: 16px !important;
            padding: 12px 46px 12px 12px !important;
            border-radius: 10px !important;
          }
          .send-btn {
            right: 20px !important;
            bottom: calc(18px + env(safe-area-inset-bottom)) !important;
            width: 34px !important;
            height: 34px !important;
          }
          .progress-bar-area {
            padding: 8px 10px calc(10px + env(safe-area-inset-bottom)) !important;
          }
          .progress-bar-header {
            gap: 8px !important;
            align-items: flex-start !important;
          }
          .progress-bar-label {
            font-size: 11px !important;
            line-height: 1.4;
          }
          .progress-bar-pct {
            font-size: 11px !important;
            flex-shrink: 0;
          }
          .markdown-body table {
            display: block;
            overflow-x: auto;
            white-space: nowrap;
          }
        }
      `}</style>

      <div className="workspace-body">
        <div className="layout-container">

          {/* ── 浏览器风格多标签栏 ── */}
          <div className="workspace-tabbar" style={{ display: 'flex', alignItems: 'flex-end', minHeight: 46, padding: '0', flexShrink: 0, overflowX: 'auto', gap: 4, background: '#fafbfc', boxSizing: 'border-box' }}>
            {allTabs.map((tab) => {
              const isActive = tab.id === storeActiveId;
              const hasSession = tab.type === 'session' && !!tab.panelId;
              const hasPanel = !!tab.panelId; // 微信助手等固定 Tab 有面板时也显示活跃
              return (
                <div
                  key={tab.id}
                  className="workspace-tab"
                  onClick={() => {
                    // 微信助手 TAB：作为会话 Tab 处理，不再跳转到管理页面
                    if (tab.id === 'wechat') {
                      handleWechatTabClick();
                      return;
                    }
                    switchTab(tab.id);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: isActive ? '14px 20px 10px' : '12px 18px 10px',
                    background: isActive ? '#fff' : 'transparent',
                    borderRadius: '8px 8px 0 0',
                    border: isActive ? '1px solid #e5e7eb' : '1px solid transparent',
                    borderBottom: 'none',
                    cursor: 'pointer', minWidth: 120, flexShrink: 0,
                    color: isActive ? '#1f2937' : '#6b7280',
                    fontSize: 14, fontWeight: isActive ? 600 : 500,
                    transition: 'all 0.2s ease',
                    boxShadow: isActive ? '0 -2px 8px rgba(0,0,0,0.06)' : 'none',
                    position: 'relative',
                    marginBottom: isActive ? -3 : -1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = '#f3f4f6';
                      e.currentTarget.style.color = '#374151';
                      e.currentTarget.style.boxShadow = '0 -2px 8px rgba(0,0,0,0.06)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#6b7280';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  {/* 会话状态指示器 */}
                  {(hasSession || hasPanel) ? (
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: tab.color || '#6366f1',
                      boxShadow: `0 0 6px ${tab.color || '#6366f1'}66`,
                    }} />
                  ) : (
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: '#d1d5db',
                    }} />
                  )}

                  {editingTabId === tab.id && tab.type !== 'wechat' ? (
                    <input
                      type="text"
                      value={editingTabTitle}
                      onChange={(e) => setEditingTabTitle(e.target.value)}
                      onBlur={() => {
                        if (editingTabTitle.trim()) renameTab(tab.id, editingTabTitle.trim());
                        setEditingTabId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editingTabTitle.trim()) { renameTab(tab.id, editingTabTitle.trim()); setEditingTabId(null); }
                        if (e.key === 'Escape') { setEditingTabId(null); setEditingTabTitle(''); }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      style={{
                        border: 'none', outline: 'none', background: 'transparent',
                        fontSize: 14, fontWeight: 'inherit', color: 'inherit',
                        width: 120, padding: 0, fontFamily: 'inherit',
                      }}
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => {
                        // [2026-05-19] 微信助手标题不允许修改
                        if (tab.type === 'wechat') return;
                        e.stopPropagation();
                        setEditingTabId(tab.id);
                        setEditingTabTitle(tab.title);
                      }}
                      className="workspace-tab-title"
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}
                      title={tab.type === 'wechat' ? '' : '双击重命名'}
                    >{tab.title}</span>
                  )}
                  {tab.type !== 'home' && tab.id !== 'wechat' && (
                    <span
                      className="workspace-tab-close"
                      onClick={(e) => { e.stopPropagation(); closeTabFn(tab.id); }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 6, opacity: 0.4, cursor: 'pointer', transition: 'all 0.15s', marginLeft: 4 }}
                    onMouseEnter={(e) => { e.stopPropagation(); e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.4'; e.currentTarget.style.color = 'inherit'; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    </span>
                  )}
                </div>
              );
            })}
            <button
              className="workspace-tab-add"
              onClick={() => setShowNewTabModal(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'transparent', border: '1px dashed #d1d5db', borderRadius: 8, cursor: 'pointer', color: '#9ca3af', flexShrink: 0, transition: 'all 0.2s', marginBottom: 4 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; e.currentTarget.style.color = '#6b7280'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#9ca3af'; }}
              title="新增标签页"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>

            {/* 模型切换下拉选择 */}
            {showModelDropdown && modelDropdownTabId && (() => {
              const targetTab = allTabs.find(t => t.id === modelDropdownTabId);
              const targetAgent = targetTab?.agentId ? agents.find(a => a.id === targetTab.agentId) : null;
              if (!targetAgent) return null;
              return createPortal(
                <div
                  ref={modelDropdownRef}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
                    background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                    padding: 12, minWidth: 200, zIndex: 1000,
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, fontWeight: 500 }}>
                    切换智能体模型
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>
                    当前: {targetAgent.modelName || '未设置'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {availableModels.map(model => {
                      const isSelected = targetAgent.modelName === model.id;
                      return (
                        <button
                          key={model.id}
                          onClick={async () => {
                            try {
                              await fetch(`/api/agents/${targetAgent.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ modelName: model.id }),
                              });
                              await fetchAgents();
                              setShowModelDropdown(false);
                              setModelDropdownTabId(null);
                              showToast('模型已更新为 ' + model.label);
                            } catch (err) {
                              showToast('更新模型失败');
                            }
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', borderRadius: 8,
                            border: isSelected ? '1.5px solid #2563eb' : '1px solid #e5e7eb',
                            background: isSelected ? '#f0f5ff' : '#fff',
                            cursor: 'pointer', transition: 'all 0.15s',
                            fontSize: 13, color: isSelected ? '#2563eb' : '#374151',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = '#f3f4f6';
                              e.currentTarget.style.borderColor = '#d1d5db';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = '#fff';
                              e.currentTarget.style.borderColor = '#e5e7eb';
                            }
                          }}
                        >
                          <span>{model.label}</span>
                          {isSelected && <span style={{ fontSize: 11 }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => { setShowModelDropdown(false); setModelDropdownTabId(null); }}
                    style={{
                      marginTop: 12, padding: '6px 12px', borderRadius: 8,
                      border: '1px solid #e5e7eb', background: '#fff',
                      fontSize: 12, color: '#6b7280', cursor: 'pointer',
                      width: '100%', textAlign: 'center',
                    }}
                  >
                    取消
                  </button>
                </div>,
                document.body
              );
            })()}
          </div>

          {/* ══════════ 对话工作台 ══════════ */}

          {/* 多智能体 Agent 栏（仅跟随当前激活 tab 对应的 panel） */}
          {activePanel && (
            <SessionAgentBar
              conversationId={activePanel.conversationId}
              participants={(agents ?? []).filter(a => activePanel.agentIds.includes(a.id) || activePanel.agentIds.includes(a.agentCode || '') || activePanel.agentIds.includes(a.openclawAgentId || '')).map(a => ({ id: a.id, name: a.name, color: a.color }))}
              isWechatAssistant={activePanel.agentId === 'rc-wechat-agent' || activePanel.agentName === '微信助手'}
              onParticipantsChange={async (updatedConversation) => {
                // 这里只同步参与者列表/agent 元数据，绝不能新开 tab。
                // “切换 agent”应始终留在当前会话、当前 panel、当前 tab 内完成。
                await fetchAgents();
                if (!updatedConversation) return;
                useConversationStore.setState((state) => ({
                  openPanels: state.openPanels.map((panel) =>
                    panel.conversationId === activePanel.conversationId || panel.id === activePanel.conversationId
                      ? {
                          ...panel,
                          sessionCode: (updatedConversation as any).sessionCode || panel.sessionCode,
                          agentId: updatedConversation.currentAgentId || panel.agentId,
                          currentAgentCode: (updatedConversation as any).currentAgentCode || panel.currentAgentCode,
                          agentIds: updatedConversation.agentIds?.length ? updatedConversation.agentIds : panel.agentIds,
                        }
                      : panel
                  ),
                  sessionTabs: state.sessionTabs.map((tab) =>
                    tab.conversationId === activePanel.conversationId || tab.panelId === activePanel.conversationId
                      ? {
                          ...tab,
                          sessionCode: (updatedConversation as any).sessionCode || tab.sessionCode,
                          agentId: updatedConversation.currentAgentId || tab.agentId,
                          currentAgentCode: (updatedConversation as any).currentAgentCode || tab.currentAgentCode,
                        }
                      : tab
                  ),
                }));
              }}
            />
          )}
          {/*
            2. 消息展示区：panel 层叠保留，但只展示当前激活 tab 对应的 panel
            关键体验修复（2026-05-06）：
            - 底部保留适度留白，避免最后一条消息紧贴输入区
            - 消息恢复显示“智能体名称 + 时间”元信息
            - 流式输出时恢复可见光标反馈，避免误以为流式失效
          */}
          <div ref={welcomeAreaRef} className={`welcome-area ${messages.length ? 'has-messages' : 'is-empty'}`} style={{ padding: messages.length ? '16px 24px 32px' : 0, position: 'relative' }}>
            {openPanels.map((panel) => {
              const isActivePanel = activePanel?.id === panel.id;
              const panelMessages = panel.messages ?? [];
              return (
                <div
                  key={panel.id}
                  style={{
                    position: isActivePanel ? 'relative' : 'absolute',
                    inset: isActivePanel ? 'auto' : 0,
                    display: isActivePanel ? 'block' : 'none',
                    height: '100%',
                    width: '100%',
                  }}
                >
                  {panelMessages.length === 0 && (
                    <div style={{
                      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'column', gap: 8, color: '#c0c4ce',
                    }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      <span style={{ fontSize: 13 }}>输入消息与智能体开始对话</span>
                    </div>
                  )}
                  {(() => {
                    // [2026-05-16] 消息折叠：默认只显示最近 20 条
                    const VISIBLE_COUNT = 20;
                    const isExpanded = expandedPanels.has(panel.id);
                    const hiddenCount = isExpanded ? 0 : Math.max(0, panelMessages.length - VISIBLE_COUNT);
                    const visibleMessages = isExpanded ? panelMessages : panelMessages.slice(-VISIBLE_COUNT);
                    return (<>
                      {hiddenCount > 0 && (
                        <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
                          <button
                            onClick={() => setExpandedPanels(prev => { const s = new Set(prev); s.add(panel.id); return s; })}
                            style={{
                              fontSize: 12, color: '#6b7280', background: '#f3f4f6',
                              border: '1px solid #e5e7eb', borderRadius: 16,
                              padding: '4px 16px', cursor: 'pointer',
                            }}
                          >
                            ↑ 查看更早的 {hiddenCount} 条消息
                          </button>
                        </div>
                      )}
                      {visibleMessages.map((msg) => {
                    const isStreamingMessage = Boolean(msg.streaming || panel.streamingMessageId === msg.id);
                    const msgAgent = msg.role === 'user'
                      ? null
                      : (msg.agentId ? agents.find(a => a.id === msg.agentId) : null) || { name: panel.agentName, color: panel.agentColor, modelName: undefined as string | undefined };
                    const metaLabel = msg.role === 'user' ? '你' : (msgAgent?.name || panel.agentName || '智能体');
                    const metaTime = formatMessageTime(msg.createdAt);

                    return (
                      <div key={msg.id} className={`workspace-message-row ${msg.role === 'user' ? 'is-user' : 'is-agent'}`} style={{
                        display: 'flex',
                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        marginBottom: 12,
                      }}>
                        <div className="workspace-message-wrap" style={{ maxWidth: '72%' }}>
                          <div className="workspace-message-meta" style={{
                            display: 'flex',
                            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 4,
                            fontSize: 11,
                            color: '#9ca3af',
                          }}>
                            <span style={{ color: msg.role === 'user' ? '#6b7280' : (msgAgent?.color || '#6b7280'), fontWeight: 600 }}>
                              {metaLabel}
                            </span>
                            {msg.role !== 'user' && msgAgent?.modelName && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 2,
                                padding: '1px 6px', borderRadius: 8,
                                background: '#f3f4f6', border: '1px solid #e5e7eb',
                                fontSize: 10, color: '#6b7280', fontWeight: 500,
                              }}>
                                {msgAgent.modelName}
                              </span>
                            )}
                            {metaTime && <span>{metaTime}</span>}
                          </div>
                          <div className="workspace-message-bubble" style={{
                            maxWidth: '100%', padding: '8px 14px',
                            borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                            background: msg.role === 'user' ? '#2a3b4d' : '#f3f4f6',
                            color: msg.role === 'user' ? '#fff' : '#1a202c',
                            fontSize: 13, lineHeight: 1.6,
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                          }}>
                            {msg.content ? (
                              <div className={`markdown-body${msg.role === 'user' ? ' bubble-dark' : ''}`} style={{ ...(msg.role === 'user' ? { color: '#fff' } : {}) }}>
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    code: ({ node, inline, className, children, ...props }: any) => {
                                      const match = /language-(\w+)/.exec(className || '');
                                      const language = match ? match[1] : 'text';
                                      if (inline) {
                                        return <code className={className} {...props}>{children}</code>;
                                      }
                                      return (
                                        <SyntaxHighlighter
                                          style={oneLight}
                                          language={language}
                                          PreTag="div"
                                          {...props}
                                        >
                                          {String(children).trimEnd()}
                                        </SyntaxHighlighter>
                                      );
                                    }
                                  }}
                                >
                                  {msg.content}
                                </ReactMarkdown>
                                {isStreamingMessage && (
                                  <span style={{ display: 'inline-block', marginLeft: 4, opacity: 0.7, color: '#8c6fff', fontWeight: 700 }}>|</span>
                                )}
                              </div>
                            ) : (
                              <span style={{ opacity: 0.45 }}>{isStreamingMessage ? '正在生成...' : '●●●'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </>); })()}
                  {isActivePanel && (
                    <>
                      {/* 真实底部留白：保留一点呼吸感即可，避免最后一条消息贴输入区 */}
                      <div style={{ height: 6, flexShrink: 0 }} />
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* 3. 功能标签栏 */}
          <div className="function-tabs">
            {FUNCTION_TABS
              .filter(tab => {
                // [2026-05-16] 微信助手面板隐藏"多智能体"Tab，智能体固定不可切换
                if (tab === '多智能体' && (activePanel?.agentId === 'rc-wechat-agent' || activePanel?.agentName === '微信助手')) return false;
                return true;
              })
              .map(tab => (
              <button
                key={tab}
                className={`function-tab${activeSideTab === tab ? ' active' : ''}`}
                onClick={() => handleTabClick(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* 4. 输入区 */}
          <div className="input-container">
            <div
              className="resize-bar"
              onMouseDown={e => {
                e.preventDefault();
                const startY = e.clientY;
                const ta = textareaRef.current;
                if (!ta) return;
                const startH = ta.offsetHeight;
                const onMove = (ev: MouseEvent) => {
                  const delta = startY - ev.clientY;
                  // 关键修复：之前最小高度锁在 140，首屏默认高度本身就接近这个值，
                  // 实际效果就是“只能往上拉，几乎不能往下压”。
                  const newH = Math.min(300, Math.max(96, startH + delta));
                  ta.style.height = newH + 'px';
                };
                const onUp = () => {
                  document.removeEventListener('mousemove', onMove);
                  document.removeEventListener('mouseup', onUp);
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
              }}
            />
            {/* [2026-05-16] 粘贴图片预览区 */}
            {pastedImages.length > 0 && (
              <div style={{ display: 'flex', gap: 6, padding: '6px 8px', flexWrap: 'wrap' }}>
                {pastedImages.map((img, idx) => (
                  <div key={idx} style={{ position: 'relative', width: 56, height: 56 }}>
                    <img src={img.preview} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                    {img.uploading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10 }}>上传中</div>}
                    <button onClick={() => removePastedImage(idx)} style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none', fontSize: 10, cursor: 'pointer', lineHeight: '16px', padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              className="main-input"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="输入消息，Enter 发送，Ctrl+Enter 换行，可粘贴图片"
            />
            <button className="send-btn" onClick={handleSend} title="发送">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 11.5V2.5M7 2.5L3 6.5M7 2.5L11 6.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* 5. 上下文使用进度条 */}
          <div className="progress-bar-area">
            <div className="progress-bar-header">
              <span className="progress-bar-label">{activeModelName} · 估算上下文 约 {contextUsedK}k / {contextMaxK}k</span>
              <span className="progress-bar-pct" style={{ color: progressColor }}>{contextPct}%</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${contextPct}%`,
                  background: `linear-gradient(90deg, ${progressColor}88, ${progressColor})`,
                }}
              />
            </div>
          </div>

        </div>
      </div>

      {/* 优先级弹窗 */}
      {showPriorityModal && (
        <PriorityModal
          priority={currentPriority}
          onSetPriority={setPriority}
          onClose={() => setShowPriorityModal(false)}
        />
      )}

      {/* Tab 面板弹窗（标签管理、快捷指令、技能应用、定时任务、多智能体等） */}
      {activeSideTab && activeSideTab !== '消息渠道' && (
        <TabPanel
          tab={activeSideTab}
          onClose={() => setActiveSideTab(null)}
          agents={agents}
          tasks={[...tasks.progress, ...tasks.done]}
          taskName={taskName}
          matchedProject={matchedKanbanProject}
          incomingAgentNames={incomingAgentNames}
          onInject={text => setInputValue(text)}
          onSend={text => { setInputValue(text); setTimeout(() => handleSend(), 0); }}
          openPanels={openPanels}
          activePanelId={activePanelId ?? activePanel?.id ?? null}
          onSwitchPanel={panelId => setActivePanelId(panelId)}
          onOpenAgentPanel={async (agentId, agentName, agentColor, initialMessage) => {
            const existing = openPanels.find(p => p.agentId === agentId);
            if (existing) {
              const isNewTab = !activePanel;
              if (isNewTab) {
                closePanel(existing.id);
                const newPanelId = await openPanel({ agentId, agentName, agentColor, projectId: currentProject?.id, initialMessage, forceNew: true });
                if (newPanelId) {
                  setActivePanelId(newPanelId);
                  createSessionTabFn({ agentId, agentName, agentColor, title: agentName, conversationId: newPanelId });
                }
              } else {
                setActivePanelId(existing.id);
              }
            } else {
              const newPanelId = await openPanel({ agentId, agentName, agentColor, projectId: currentProject?.id, initialMessage });
              const fresh = useConversationStore.getState().openPanels.find(p => p.agentId === agentId);
              if (fresh) {
                setActivePanelId(fresh.id);
                createSessionTabFn({ agentId, agentName, agentColor, title: agentName, conversationId: fresh.id });
              }
            }
          }}
          onSwitchAgentInSession={async (agentId, agentName, agentColor) => {
            const current = activePanel ?? openPanels.find(p => p.id === activePanelId) ?? openPanels[0] ?? null;
            if (!current?.conversationId) return;

            // 会话内切换智能体的业务规则：
            // 1) sessionId / conversationId 不变
            // 2) 不新开 tab，不新建 panel
            // 3) 新 agent 继承当前 conversationId 下的全部历史消息
            // 4) 当前展示 panel 只反映“当前激活 agent”，不能把旧 agent 一起挂在 UI 上
            //
            // 也就是说，记忆继承依赖的是同一个 conversationId，
            // 不是“同时保留多个 agent chip / 多个 panel”。
            await switchAgentFn(current.conversationId, agentId);
            setParticipatingAgentNames(prev => prev.includes(agentName) ? prev : [...prev, agentName]);
            setActivePanelId(current.id);
          }}
          onCloseAgentPanel={panelId => {
            closePanel(panelId);
            setActivePanelId(prev => prev === panelId ? (openPanels.find(p => p.id !== panelId)?.id ?? null) : prev);
          }}
          // 文件快传必须拿“当前工作区项目真值”，不能只依赖 matchedKanbanProject。
          // 否则用户明明已在项目工作区中，但如果当前视图没有命中看板项目对象，上传层会误判为“未进入项目”。
          currentProjectId={currentProject?.id || matchedKanbanProject?.id}
          collabNodes={collabNodes}
          setCollabNodes={setCollabNodes}
          isProject={isProjectMode}
          participatingAgentNames={participatingAgentNames}
          onUpgradeToProject={upgradeToProject}
          onDowngradeToTask={downgradeToTask}
        />
      )}

      {showChannelModal && (
        <ChannelConfigModal onClose={() => setShowChannelModal(false)} />
      )}

      {/* 首页 + 号新建标签页弹窗 */}
      {showNewTabModal && (
        <NewTabModal
          open={showNewTabModal}
          onClose={() => setShowNewTabModal(false)}
          onCreated={(convId, agentName, agentColor, tabTitle) => {
            setActivePanelId(convId);
            createSessionTabFn({ agentId: '', agentName, agentColor, title: tabTitle, conversationId: convId });
          }}
        />
      )}
    </>
  );
}
