/**
 * useWechatTab — 微信助手 Tab 逻辑 Hook
 *
 * 封装微信助手 Tab 的创建、面板绑定、消息加载等逻辑。
 */
import { useCallback } from 'react';
import { useConversationStore } from '@/stores/conversationStore';
import type { Message } from '@/types';

export function useWechatTab(
  switchTab: (tabId: string) => void,
  setActivePanelId: (id: string | null | ((prev: string | null) => string | null)) => void,
) {
  const handleWechatTabClick = useCallback(async () => {
    const { sessionTabs, openPanels, bindPanelToTab } = useConversationStore.getState();
    let wechatTab = sessionTabs.find(t => t.id === 'wechat');

    // 确保 wechat tab 存在
    if (!wechatTab) {
      const exists = useConversationStore.getState().sessionTabs.some(t => t.id === 'wechat');
      if (!exists) {
        useConversationStore.setState((state) => ({
          sessionTabs: [{
            id: 'wechat', type: 'wechat', title: '微信助手', panelId: null,
            conversationId: 'wechat-assistant', agentId: 'rc-wechat-agent',
            agentName: '微信助手', agentColor: '#2563eb',
          }, ...state.sessionTabs],
        }));
      }
      wechatTab = useConversationStore.getState().sessionTabs.find(t => t.id === 'wechat');
    }

    switchTab('wechat');

    // 已有面板：加载消息
    if (wechatTab?.panelId) {
      const existingPanel = openPanels.find(p => p.id === wechatTab.panelId);
      if (existingPanel) {
        setActivePanelId(existingPanel.id);
        if (!existingPanel.messages || existingPanel.messages.length === 0) {
          try {
            const { conversationsApi } = await import('@/api/conversations');
            const conv = await conversationsApi.getWechatAssistant();
            if (conv?.messages?.length) {
              useConversationStore.setState(s => ({
                openPanels: s.openPanels.map(p =>
                  p.id === existingPanel.id ? { ...p, messages: conv.messages } : p
                ),
              }));
            }
          } catch (err) { console.warn('[WechatTab] 加载微信助手消息失败:', err); }
        }
        return;
      }
      wechatTab.panelId = null;
    }

    // 创建新面板
    const { conversationsApi } = await import('@/api/conversations');
    let conv: unknown; // [2026-05-24] 类型安全
    try { conv = await conversationsApi.getWechatAssistant(); }
    catch (err: unknown) { // [2026-05-24] 类型安全
      console.error('[WechatTab] API 请求失败:', err);
      const e = err as { response?: { data?: { error?: string }; status?: number }; message?: string };
      const errMsg = e?.response?.data?.error || e?.message || '未知错误';
      const status = e?.response?.status;
      alert(`微信助手会话创建失败\nHTTP ${status || 'N/A'}: ${errMsg}`);
      return;
    }
    if (!conv) { alert('微信助手会话创建失败：服务器返回空数据'); return; }
    const c = conv as { id: string; sessionCode?: string; currentAgentCode?: string; agentIds?: string[]; messages?: Message[] }; // [2026-05-24] 类型安全

    const panelId = c.id;
    const existingPanel = openPanels.find(p => p.id === panelId || p.conversationId === panelId);
    if (existingPanel) {
      bindPanelToTab('wechat', existingPanel.id, '微信助手', '#2563eb');
      setActivePanelId(existingPanel.id);
      return;
    }

    const { useAgentStore } = await import('@/stores/agentStore');
    const agents = useAgentStore.getState().agents;
    const wechatAgent = agents.find(a =>
      a.id === 'rc-wechat-agent' || a.openclawAgentId === 'rc-wechat-agent' || a.agentCode === 'rc-wechat-agent'
    );

    const panel = {
      id: panelId, conversationId: panelId, sessionCode: c.sessionCode,
      agentId: 'rc-wechat-agent', currentAgentCode: c.currentAgentCode,
      agentIds: c.agentIds?.length ? c.agentIds : ['rc-wechat-agent'],
      agentName: wechatAgent?.name || '微信助手',
      agentColor: wechatAgent?.color || '#2563eb',
      messages: c.messages || [], isStreaming: false,
    };
    useConversationStore.setState(s => ({ openPanels: [...s.openPanels, panel] }));
    bindPanelToTab('wechat', panelId, '微信助手', '#2563eb');
    setActivePanelId(panelId);
  }, [switchTab, setActivePanelId]);

  return { handleWechatTabClick };
}
