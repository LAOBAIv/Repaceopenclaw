/**
 * useWorkspaceInit — 工作区初始化逻辑 Hook
 *
 * 封装项目加载、智能体获取、WS 连接、会话恢复、导航处理、beforeunload 等初始化逻辑。
 */
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useConversationStore } from '@/stores/conversationStore';
import { useTaskStore } from '@/stores/taskStore';
import { useProjectKanbanStore } from '@/stores/projectKanbanStore';

type NavState = {
  projectName?: string;
  projectId?: string;
  taskId?: string;
  agentNames?: string[];
  sessionId?: string;
  precreatedTabId?: string;
  navNonce?: number;
} | null;

export function useWorkspaceInit(
  navState: NavState,
  fetchProjects: () => void,
  fetchAgents: () => void,
  connect: () => void,
  switchTab: (tabId: string) => void,
  setActivePanelId: (id: string | null | ((prev: string | null) => string | null)) => void,
  createSessionTabFn: (params: {
    agentId: string; agentName: string; agentColor: string;
    title: string; conversationId: string; forceNewTab?: boolean;
  }) => Promise<string>,
) {
  const location = useLocation();
  const [restoreReady, setRestoreReady] = useState(false);
  const handledNavKeyRef = useRef<string | null>(null);

  /* ── 初始化：加载项目 + 智能体 + WS 连接 + 恢复会话 ── */
  useEffect(() => {
    fetchProjects();
    fetchAgents();
    connect();

    useConversationStore.getState().restoreFromPersist().then(async () => {
      const freshPanels = useConversationStore.getState().openPanels;
      const freshTabs = useConversationStore.getState().sessionTabs;
      const freshActiveTabId = useConversationStore.getState().activeTabId;

      let targetTabId = freshActiveTabId;
      let targetPanelId: string | null = null;

      if (targetTabId) {
        const currentActiveTab = freshTabs.find(t => t.id === targetTabId);
        if (currentActiveTab?.panelId) {
          targetPanelId = currentActiveTab.panelId;
        } else if (currentActiveTab?.id === 'wechat') {
          targetPanelId = currentActiveTab.panelId;
        } else {
          const firstTabWithPanel = freshTabs.find(t => t.panelId && freshPanels.some(p => p.id === t.panelId));
          if (firstTabWithPanel) {
            targetTabId = firstTabWithPanel.id;
            targetPanelId = firstTabWithPanel.panelId;
            useConversationStore.setState({ activeTabId: targetTabId });
          } else {
            const firstTab = freshTabs[0];
            if (firstTab && !targetTabId) {
              targetTabId = firstTab.id;
              useConversationStore.setState({ activeTabId: targetTabId });
            }
          }
        }
      } else {
        const firstTabWithPanel = freshTabs.find(t => t.panelId && freshPanels.some(p => p.id === t.panelId));
        if (firstTabWithPanel) {
          targetTabId = firstTabWithPanel.id;
          targetPanelId = firstTabWithPanel.panelId;
          useConversationStore.setState({ activeTabId: targetTabId });
        } else if (freshTabs.length > 0) {
          targetTabId = freshTabs[0].id;
          useConversationStore.setState({ activeTabId: targetTabId });
        }
      }

      if (targetPanelId) {
        setActivePanelId(targetPanelId);
      } else if (freshPanels.length > 0) {
        setActivePanelId(freshPanels[0].id);
      } else {
        setActivePanelId(null);
      }
      setRestoreReady(true);
    }).catch(() => { setRestoreReady(true); });

    useTaskStore.getState().restoreFromPersist().catch(() => {});
    useProjectKanbanStore.getState().restoreFromPersist().catch(() => {});

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
          } catch (e) { console.warn("[RC]", e); }
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 从会话列表/kanban 进入工作区：激活预创建的 tab ── */
  useEffect(() => {
    if (!restoreReady || !navState?.sessionId) return;
    const navKey = `${location.key}:${navState.sessionId}:${navState.precreatedTabId || ''}:${navState.navNonce || ''}`;
    if (handledNavKeyRef.current === navKey) return;
    handledNavKeyRef.current = navKey;

    if (navState.precreatedTabId) {
      switchTab(navState.precreatedTabId);
      const tabList = useConversationStore.getState().sessionTabs;
      const hitTab = tabList.find(t => t.id === navState.precreatedTabId);
      if (hitTab?.panelId) setActivePanelId(hitTab.panelId);
      return;
    }

    import('@/api/conversations').then(({ conversationsApi }) => {
      conversationsApi.list().then(convList => {
        const conv = convList.find(c => c.id === navState.sessionId);
        const agentId = conv?.currentAgentId || conv?.agentId || conv?.agentIds?.[0] || '';
        const agentName = conv?.title || navState.projectName || '会话';
        createSessionTabFn({
          agentId, agentName, agentColor: '#6366f1', title: agentName,
          conversationId: navState.sessionId!, forceNewTab: true,
        }).then((newTabId) => {
          const tabList = useConversationStore.getState().sessionTabs;
          const hitTab = tabList.find(t => t.id === newTabId);
          if (hitTab?.panelId) setActivePanelId(hitTab.panelId);
          switchTab(newTabId);
        });
      }).catch(() => {});
    });
  }, [restoreReady, location.key, navState?.sessionId, navState?.projectName, navState?.precreatedTabId, navState?.navNonce, createSessionTabFn, switchTab, setActivePanelId]);

  return { restoreReady };
}
