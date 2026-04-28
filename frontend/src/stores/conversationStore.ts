import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Message, Conversation } from "../types";
import { conversationsApi } from "../api/conversations";

interface ConversationPanel {
  id: string;
  conversationId: string;
  /** 当前面板"主"agentId（单智能体对话时即为唯一 agent；多智能体时取第一个） */
  agentId: string;
  /** 参与此会话的所有 agentIds */
  agentIds: string[];
  agentName: string;
  agentColor: string;
  messages: Message[];
  isStreaming: boolean;
  streamingMessageId?: string;
  streamingContent?: string;
  /** 协作任务启动提示，仅前端展示，不存库，用户可关闭 */
  systemBanner?: string;
}

/** 顶部会话 Tab 数据结构 — 唯一 Tab 数据源 */
export interface SessionTab {
  /** 唯一 id：'home' 或 conversationId */
  id: string;
  /** Tab 类型 */
  type: 'home' | 'session';
  /** Tab 标题（智能体名称、项目名称或"新会话 N"） */
  title: string;
  /** 绑定的会话 panel id（home tab 为 null） */
  panelId: string | null;
  /** Tab 颜色（智能体颜色，home tab 无） */
  color?: string;
  /** 是否正在 streaming */
  isStreaming?: boolean;
  /** 绑定的会话 ID（与 panelId 相同，冗余字段便于查询） */
  conversationId?: string;
  /** 关联的智能体 ID */
  agentId?: string;
  /** 关联的智能体名称 */
  agentName?: string;
}

interface ConversationStore {
  openPanels: ConversationPanel[];
  messagesMap: Record<string, Message[]>;
  maxPanels: number;
  /** WebSocket 是否已连通 */
  wsConnected: boolean;

  /** 顶部会话 Tab 列表 */
  sessionTabs: SessionTab[];
  /** 当前激活的 Tab id */
  activeTabId: string | null;
  /** 用户主动关闭的会话 ID 列表（刷新后不再恢复） */
  closedSessionIds: string[];

  connect: () => void;
  sendMessage: (panelId: string, content: string) => void;
  /**
   * 打开会话面板
   * - agentIds 传多个时，创建多智能体会话
   * - agentId（单个）向下兼容
   * - 返回创建的 panelId
   */
  openPanel: (opts: {
    agentId: string;
    agentIds?: string[];
    agentName: string;
    agentColor: string;
    projectId?: string;
    initialMessage?: string;
    /** 绑定到指定 tabId（新建 Tab 时传入） */
    tabId?: string;
    /** 强制创建新会话，不复用已有会话 */
    forceNew?: boolean;
  }) => Promise<string | void>;
  /** Close a panel by panelId */
  closePanel: (panelId: string) => void;
  /** @deprecated use openPanel */
  addPanel: (agentId: string, agentName: string, agentColor: string, projectId?: string) => Promise<void>;
  /** @deprecated use closePanel */
  removePanel: (panelId: string) => void;

  // internal streaming helpers
  startStreaming: (panelId: string, messageId: string) => void;
  appendStreamChunk: (panelId: string, messageId: string, chunk: string) => void;
  finishStreaming: (panelId: string, messageId: string, finalMessage: Message) => void;
  loadMessages: (panelId: string, conversationId: string) => Promise<void>;
  clearPanels: () => void;
  /** 关闭协作任务 Banner */
  dismissBanner: (panelId: string) => void;

  /** 将 panel 绑定到指定 Tab */
  bindPanelToTab: (tabId: string, panelId: string, title: string, color?: string) => void;
  /** 同步 Tab 的 streaming 状态 */
  syncTabStreamingState: () => void;
  /** 刷新后从持久化的 tabs 恢复 panels 和消息 */
  restoreFromPersist: () => Promise<void>;
  /** 永久关闭指定会话（刷新后也不再恢复） */
  permanentlyCloseSession: (conversationId: string) => void;

  /** ── Tab 管理（统一入口） ── */
  /** 获取完整 Tab 列表（含 home tab） */
  getTabs: () => SessionTab[];
  /** 切换激活 Tab */
  switchTab: (tabId: string) => void;
  /** 关闭 Tab（会话 tab 记录到 closedSessionIds，home tab 忽略） */
  closeTab: (tabId: string) => void;
  /** 重命名 Tab */
  renameTab: (tabId: string, newTitle: string) => void;
  /** 新建会话 Tab（创建 panel + tab + 切换） */
  createSessionTab: (opts: {
    agentId: string;
    agentName: string;
    agentColor: string;
    title?: string;
    conversationId?: string;
    messages?: Message[];
  }) => Promise<string>;
}

// WebSocket singleton
let wsInstance: WebSocket | null = null;

export const useConversationStore = create<ConversationStore>()(
  persist(
    (set, get) => ({
  openPanels: [],
  messagesMap: {},
  maxPanels: 4,
  wsConnected: false,
  sessionTabs: [{ id: 'home', type: 'home' as const, title: '工作台', panelId: null }],
  activeTabId: 'home',
  /** 用户主动关闭的会话 ID 列表（刷新后不再恢复） */
  closedSessionIds: [],

  connect: () => {
    if (wsInstance?.readyState === WebSocket.OPEN) return;
    try {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      // Phase 3: 携带 JWT token 用于 WebSocket 认证
      const raw = localStorage.getItem("repaceclaw-auth");
      let tokenParam = "";
      if (raw) {
        try {
          const state = JSON.parse(raw);
          const token = state?.state?.token;
          if (token) tokenParam = `?token=${encodeURIComponent(token)}`;
        } catch {}
      }
      const wsUrl = `${wsProtocol}//${window.location.host}/ws${tokenParam}`;
      wsInstance = new WebSocket(wsUrl);
      wsInstance.onopen = () => {
        console.log("[WS] Connected");
        set({ wsConnected: true });
      };
      wsInstance.onclose = () => {
        console.log("[WS] Disconnected");
        set({ wsConnected: false });
        setTimeout(() => get().connect(), 3000);
      };
      wsInstance.onerror = () => {}; // ignore error silently
      wsInstance.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const panels = get().openPanels;

          // ── 用户消息已保存到后端，将真实消息（含数据库 id）插入面板 ──
          if (data.type === "user_message" && data.message) {
            const msg: Message = data.message;
            const panel = panels.find((p) => p.conversationId === msg.conversationId);
            if (panel) {
              set((s) => ({
                openPanels: s.openPanels.map((p) => {
                  if (p.id !== panel.id) return p;
                  const filtered = p.messages.filter(
                    (m) => !m.id.startsWith("optimistic-") && m.id !== msg.id
                  );
                  return { ...p, messages: [...filtered, msg] };
                }),
              }));
            }
          }

          if (data.type === "agent_start" && data.messageId && data.agentId) {
          console.log("[WS] agent_start:", data.messageId, data.agentId, "panels:", panels.length);
            // 找到包含此 agentId 的 panel（单智能体：主 agentId；多智能体：agentIds 包含）
            const panel = panels.find(
              (p) => p.agentId === data.agentId || p.agentIds.includes(data.agentId)
            );
            console.log("[WS] agent_start panel:", panel?.id); if (panel) get().startStreaming(panel.id, data.messageId);
          }
          if (data.type === "agent_chunk" && data.messageId && data.chunk) {
            const panel = panels.find((p) => p.streamingMessageId === data.messageId);
            if (panel) get().appendStreamChunk(panel.id, data.messageId, data.chunk);
          }
          if (data.type === "agent_done" && data.messageId && data.message) {
          console.log("[WS] agent_done:", data.messageId, "content:", data.message?.content?.length);
            const panel = panels.find((p) => p.streamingMessageId === data.messageId);
            console.log("[WS] agent_done panel:", panel?.id); if (panel) get().finishStreaming(panel.id, data.messageId, data.message);
          }
        } catch {}
      };
    } catch {
      // WS not available, ignore
    }
  },

  sendMessage: (panelId, content) => {
    const panel = get().openPanels.find((p) => p.id === panelId);
    if (!panel) return;

    // 乐观更新
    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}`,
      conversationId: panel.conversationId,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      openPanels: s.openPanels.map((p) =>
        p.id === panelId ? { ...p, messages: [...p.messages, optimisticMsg] } : p
      ),
    }));

    // 如果 WS 未连接，先尝试重连
    if (wsInstance?.readyState !== WebSocket.OPEN) {
      console.warn("[WS] Not connected, reconnecting...");
      get().connect();
      // 等待连接建立后重试发送（最多等 5 秒）
      let retries = 0;
      const retryInterval = setInterval(() => {
        retries++;
        if (wsInstance?.readyState === WebSocket.OPEN) {
          clearInterval(retryInterval);
          wsInstance.send(JSON.stringify({
            type: "chat",
            conversationId: panel.conversationId,
            agentId: panel.agentId,
            agentIds: panel.agentIds,
            content,
          }));
          console.log("[WS] Message sent after reconnect");
        } else if (retries > 15) {
          clearInterval(retryInterval);
          console.error("[WS] Failed to reconnect, message lost");
          // 移除乐观消息，显示发送失败
          set((s) => ({
            openPanels: s.openPanels.map((p) =>
              p.id === panelId ? { ...p, messages: p.messages.filter((m) => m.id !== optimisticMsg.id) } : p
            ),
          }));
        }
      }, 300);
      return;
    }

    wsInstance.send(JSON.stringify({
      type: "chat",
      conversationId: panel.conversationId,
      agentId: panel.agentId,
      agentIds: panel.agentIds,
      content,
    }));
  },

  addPanel: async (agentId, agentName, agentColor, projectId) => {
    await get().openPanel({ agentId, agentName, agentColor, projectId });
  },

  openPanel: async ({ agentId, agentIds, agentName, agentColor, projectId, initialMessage, tabId, forceNew }) => {
    const { openPanels, maxPanels } = get();
    if (openPanels.length >= maxPanels) return;

    // 若该 agent 的面板已经打开
    const existingPanel = openPanels.find((p) => p.agentId === agentId);
    if (existingPanel) {
      if (forceNew) {
        // 强制新建：关闭旧面板
        get().closePanel(existingPanel.id);
      } else {
        // 复用已有面板 — 重新加载消息确保数据最新
        if (tabId) get().bindPanelToTab(tabId, existingPanel.id, existingPanel.agentName, existingPanel.agentColor);
        await get().loadMessages(existingPanel.id, existingPanel.conversationId);
        return existingPanel.id;
      }
    }

    // 合并 agentIds（去重，确保主 agentId 在列表中）
    const allAgentIds: string[] = agentIds?.length
      ? [...new Set([agentId, ...agentIds])]
      : [agentId];

    try {
      // ── 优先复用该 agent 的最新已有会话（除非强制新建） ──
      let conv: Conversation;
      if (!forceNew) {
        const existingList = await conversationsApi.list(projectId);
        const existing = existingList.find((c) => c.agentId === agentId || c.agentIds.includes(agentId));
        if (existing) {
          conv = existing;
          // 若新的参与者比已有会话多，逐个追加
          for (const id of allAgentIds) {
            if (!conv.agentIds.includes(id)) {
              await conversationsApi.addAgent(conv.id, id);
            }
          }
        } else {
          conv = await conversationsApi.create({
            agentIds: allAgentIds,
            projectId,
            title: allAgentIds.length > 1
              ? `${allAgentIds.length} 智能体协作`
              : agentName,
          });
        }
      } else {
        // 强制创建新会话
        conv = await conversationsApi.create({
          agentIds: allAgentIds,
          projectId,
          title: allAgentIds.length > 1
            ? `${allAgentIds.length} 智能体协作`
            : agentName,
        });
      }

      const panel: ConversationPanel = {
        id: conv.id,
        conversationId: conv.id,
        agentId,
        agentIds: conv.agentIds.length > 0 ? conv.agentIds : allAgentIds,
        agentName,
        agentColor,
        messages: [],
        isStreaming: false,
        systemBanner: initialMessage,
      };
      set((s) => ({ openPanels: [...s.openPanels, panel] }));
      await get().loadMessages(conv.id, conv.id);
      // 绑定到 Tab
      if (tabId) {
        get().bindPanelToTab(tabId, conv.id, agentName, agentColor);
      }
      // 返回创建的 panelId
      return conv.id;
    } catch {
      // API not available, add a local panel
      const localId = `local-${Date.now()}`;
      const panel: ConversationPanel = {
        id: localId,
        conversationId: localId,
        agentId,
        agentIds: allAgentIds,
        agentName,
        agentColor,
        messages: [],
        isStreaming: false,
        systemBanner: initialMessage,
      };
      set((s) => ({ openPanels: [...s.openPanels, panel] }));
      // 绑定到 Tab
      if (tabId) {
        get().bindPanelToTab(tabId, localId, agentName, agentColor);
      }
      // 返回创建的 panelId
      return localId;
    }
  },

  removePanel: (panelId) => {
    set((s) => ({ openPanels: s.openPanels.filter((p) => p.id !== panelId) }));
  },

  closePanel: (panelId) => {
    set((s) => ({ openPanels: s.openPanels.filter((p) => p.id !== panelId) }));
  },

  startStreaming: (panelId, messageId) => {
    const placeholder: Message = {
      id: messageId,
      conversationId: panelId,
      role: "agent",
      content: "",
      createdAt: new Date().toISOString(),
      streaming: true,
    };
    set((s) => ({
      openPanels: s.openPanels.map((p) =>
        p.id === panelId
          ? { ...p, isStreaming: true, streamingMessageId: messageId, streamingContent: "", messages: [...p.messages, placeholder] }
          : p
      ),
    }));
  },

  appendStreamChunk: (panelId, messageId, chunk) => {
    set((s) => ({
      openPanels: s.openPanels.map((p) => {
        if (p.id !== panelId) return p;
        const newContent = (p.streamingContent || "") + chunk;
        return {
          ...p,
          streamingContent: newContent,
          messages: p.messages.map((m) => m.id === messageId ? { ...m, content: newContent } : m),
        };
      }),
    }));
  },

  finishStreaming: (panelId, messageId, finalMessage) => {
    set((s) => ({
      openPanels: s.openPanels.map((p) => {
        if (p.id !== panelId) return p;
        return {
          ...p,
          isStreaming: false,
          streamingMessageId: undefined,
          streamingContent: undefined,
          messages: p.messages.map((m) => m.id === messageId ? { ...finalMessage, streaming: false } : m),
        };
      }),
    }));
  },

  loadMessages: async (panelId, conversationId) => {
    try {
      const messages = await conversationsApi.getMessages(conversationId);
      set((s) => ({
        openPanels: s.openPanels.map((p) => p.id === panelId ? { ...p, messages } : p),
      }));
    } catch {}
  },

  clearPanels: () => set({ openPanels: [] }),

  dismissBanner: (panelId) => {
    set((s) => ({
      openPanels: s.openPanels.map((p) =>
        p.id === panelId ? { ...p, systemBanner: undefined } : p
      ),
    }));
  },

  // ─────────────────────────────────────────────
  // Session Tab 多会话 Tab 管理方法（统一入口）
  // ─────────────────────────────────────────────

  /** 获取完整 Tab 列表（含 home tab） */
  getTabs: () => {
    const { sessionTabs } = get();
    const hasHome = sessionTabs.some(t => t.id === 'home');
    const homeTab: SessionTab = { id: 'home', type: 'home', title: '工作台', panelId: null };
    return hasHome ? sessionTabs : [homeTab, ...sessionTabs];
  },

  /** 切换激活 Tab */
  switchTab: (tabId) => {
    set({ activeTabId: tabId });
  },

  /** 关闭 Tab */
  closeTab: (tabId) => {
    const { sessionTabs, activeTabId, openPanels, closedSessionIds } = get();
    const tab = sessionTabs.find(t => t.id === tabId);
    if (!tab) return;
    if (tab.type === 'home') return; // home tab 不能关闭
    // 记录已关闭的会话 ID（刷新后不再恢复）
    const convId = tab.panelId || tab.conversationId || tab.id;
    const newClosedIds = !closedSessionIds.includes(convId)
      ? [...closedSessionIds, convId]
      : closedSessionIds;
    // 关闭绑定的 panel
    if (tab.panelId) {
      set(s => ({
        openPanels: s.openPanels.filter(p => p.id !== tab.panelId),
      }));
    }
    const remaining = sessionTabs.filter(t => t.id !== tabId);
    // 重新计算激活 Tab：若关闭的是当前激活，切换到相邻 Tab（优先 home）
    let newActiveTabId: string | null = activeTabId;
    if (activeTabId === tabId) {
      const idx = sessionTabs.findIndex(t => t.id === tabId);
      const hasHome = remaining.some(t => t.id === 'home');
      const tabsWithHome = hasHome ? remaining : [
        { id: 'home', type: 'home' as const, title: '工作台', panelId: null },
        ...remaining,
      ];
      newActiveTabId = tabsWithHome[idx]?.id ?? tabsWithHome[idx - 1]?.id ?? 'home';
    }
    set({ sessionTabs: remaining, activeTabId: newActiveTabId, closedSessionIds: newClosedIds });
  },

  /** 重命名 Tab */
  renameTab: (tabId, newTitle) => {
    set(s => ({
      sessionTabs: s.sessionTabs.map(t =>
        t.id === tabId ? { ...t, title: newTitle } : t
      ),
    }));
    // 同步到后端 API（home tab 不同步）
    if (tabId !== 'home') {
      import('@/api/sessionTabs').then(({ sessionTabsApi }) => {
        sessionTabsApi.upsert({
          browser_tab_key: tabId,
          title: newTitle,
          conversation_id: tabId,
          agent_id: '',
          agent_name: newTitle,
          color: '',
        }).catch(() => {});
      }).catch(() => {});
    }
  },

  /** 新建会话 Tab（创建 panel + tab + 切换） */
  createSessionTab: async (opts) => {
    const { sessionTabs, openPanel } = get();
    const tabId = opts.conversationId || `conv-${Date.now()}`;
    // 检查是否已存在该 tab，存在则直接切换过去并返回 panelId
    const existing = sessionTabs.find(t => t.id === tabId);
    if (existing) {
      set({ activeTabId: tabId });
      if (existing.panelId) return existing.panelId;
    }
    // 创建 panel
    const panelId = await openPanel({
      agentId: opts.agentId,
      agentName: opts.agentName,
      agentColor: opts.agentColor,
      tabId,
    });
    // 创建/更新 tab（如果 openPanel 返回了新 panelId，用它来更新）
    const finalPanelId = panelId || tabId;
    const newTab: SessionTab = {
      id: tabId,
      type: 'session',
      title: opts.title || opts.agentName,
      panelId: finalPanelId,
      color: opts.agentColor,
      conversationId: opts.conversationId || finalPanelId,
      agentId: opts.agentId,
      agentName: opts.agentName,
    };
    set(s => ({
      sessionTabs: s.sessionTabs.some(t => t.id === tabId)
        ? s.sessionTabs.map(t => t.id === tabId ? { ...t, ...newTab } : t)
        : [...s.sessionTabs, newTab],
      activeTabId: tabId,
    }));
    return tabId;
  },

  /** 永久关闭指定会话（不通过 UI 关闭，直接标记为已关闭） */
  permanentlyCloseSession: (conversationId) => {
    const { closedSessionIds, sessionTabs, activeTabId } = get();
    if (closedSessionIds.includes(conversationId)) return;
    const newClosedIds = [...closedSessionIds, conversationId];
    // 同时移除相关的 sessionTab
    const remaining = sessionTabs.filter((t) => t.panelId !== conversationId);
    let newActiveTabId = activeTabId;
    if (activeTabId && remaining.find(t => t.id === activeTabId) === undefined) {
      newActiveTabId = remaining[0]?.id ?? null;
    }
    set({ closedSessionIds: newClosedIds, sessionTabs: remaining, activeTabId: newActiveTabId });
  },

  bindPanelToTab: (tabId, panelId, title, color) => {
    set((s) => ({
      sessionTabs: s.sessionTabs.map((t) =>
        t.id === tabId ? { ...t, panelId, title, color } : t
      ),
    }));
  },

  syncTabStreamingState: () => {
    const { sessionTabs, openPanels } = get();
    const updated = sessionTabs.map((tab) => {
      if (!tab.panelId) return tab;
      const panel = openPanels.find((p) => p.id === tab.panelId);
      return panel ? { ...tab, isStreaming: panel.isStreaming } : tab;
    });
    set({ sessionTabs: updated });
  },

  restoreFromPersist: async () => {
    const { sessionTabs: persistedTabs, activeTabId: persistedActiveId, closedSessionIds } = get();

    // ━━━ 第一优先：Zustand persist 是用户真实状态 ━━━
    // 如果用户之前已经打开过标签页，直接恢复
    // 刷新页面不会改变用户已打开/已关闭的状态
    if (persistedTabs && persistedTabs.length > 0) {
      const restoredPanels: ConversationPanel[] = [];
      const restoredTabs: SessionTab[] = [];
      for (const tab of persistedTabs) {
        if (!tab.panelId) continue;
        try {
          const messages = await conversationsApi.getMessages(tab.panelId);
          let agentId = '';
          let agentIds: string[] = [];
          try {
            const convList = await conversationsApi.list();
            const conv = convList.find((c) => c.id === tab.panelId);
            if (conv) {
              agentId = conv.agentId || conv.agentIds?.[0] || '';
              agentIds = conv.agentIds || [];
            }
          } catch {}
          let agentName = tab.title || '会话';
          let agentColor = tab.color || '#9ca3af';
          if (agentId) {
            try {
              const { useAgentStore } = await import('@/stores/agentStore');
              const agent = useAgentStore.getState().agents.find(a => a.id === agentId);
              if (agent) {
                agentName = agent.name;
                agentColor = agent.color || tab.color || '#9ca3af';
              }
            } catch {}
          }
          restoredPanels.push({
            id: tab.panelId,
            conversationId: tab.panelId,
            agentId,
            agentIds,
            agentName,
            agentColor,
            messages,
            isStreaming: false,
          });
          restoredTabs.push({
            ...tab,
            type: tab.type || 'session',
            conversationId: tab.conversationId || tab.panelId || tab.id,
            agentId: tab.agentId || agentId,
            agentName: tab.agentName || agentName,
          });
        } catch {
          restoredPanels.push({
            id: tab.panelId,
            conversationId: tab.panelId,
            agentId: '',
            agentIds: [],
            agentName: tab.title || '会话',
            agentColor: tab.color || '#9ca3af',
            messages: [],
            isStreaming: false,
          });
          restoredTabs.push({
            ...tab,
            type: tab.type || 'session',
            conversationId: tab.conversationId || tab.panelId || tab.id,
            agentId: tab.agentId || '',
            agentName: tab.agentName || (tab.title || '会话'),
          });
        }
      }
      set({
        openPanels: restoredPanels,
        sessionTabs: restoredTabs,
        activeTabId: persistedActiveId || (restoredTabs.length > 0 ? restoredTabs[0].id : null),
      });
      return;
    }

    // ━━━ 第二优先：首次访问（zustand 无数据），从 conversations API 填充 ━━━
    // 只恢复尚未被用户关闭的会话
    try {
      const { useAgentStore } = await import('@/stores/agentStore');
      const agents = useAgentStore.getState().agents;
      const convList = await conversationsApi.list();
      if (convList && convList.length > 0) {
        const restoredPanels: ConversationPanel[] = [];
        const restoredTabs: SessionTab[] = [];
        for (const conv of convList.slice(0, 10)) {
          if (closedSessionIds?.includes(conv.id)) continue;
          try {
            const messages = await conversationsApi.getMessages(conv.id);
            const agentId = conv.agentId || conv.agentIds?.[0] || '';
            const agent = agents.find(a => a.id === agentId);
            const agentName = agent?.name || conv.title || '会话';
            const agentColor = agent?.color || '#6366f1';
            restoredPanels.push({
              id: conv.id,
              conversationId: conv.id,
              agentId,
              agentIds: conv.agentIds || [],
              agentName,
              agentColor,
              messages,
              isStreaming: false,
            });
            restoredTabs.push({
              id: conv.id,
              type: 'session',
              title: agentName,
              panelId: conv.id,
              color: agentColor,
              conversationId: conv.id,
              agentId,
              agentName,
            });
          } catch {
            restoredPanels.push({
              id: conv.id,
              conversationId: conv.id,
              agentId: conv.agentId || '',
              agentIds: conv.agentIds || [],
              agentName: conv.title || '会话',
              agentColor: '#6366f1',
              messages: [],
              isStreaming: false,
            });
            restoredTabs.push({
              id: conv.id,
              type: 'session',
              title: conv.title || '会话',
              panelId: conv.id,
              color: '#6366f1',
              conversationId: conv.id,
              agentId: conv.agentId || '',
              agentName: conv.title || '会话',
            });
          }
        }
        if (restoredTabs.length > 0) {
          set({
            openPanels: restoredPanels,
            sessionTabs: restoredTabs,
            activeTabId: restoredTabs[0].id,
          });
          return;
        }
      }
    } catch {}

    // ━━━ 兜底：sessions API ━━━
    try {
      const { sessionsApi } = await import('@/api/sessions');
      const sessions = await sessionsApi.list();
      if (sessions && sessions.length > 0) {
        const restoredPanels: ConversationPanel[] = [];
        const restoredTabs: SessionTab[] = [];
        for (const session of sessions.slice(0, 10)) {
          if (closedSessionIds?.includes(session.id)) continue;
          try {
            const preview = await sessionsApi.preview(session.id, 20);
            const messages = (preview?.messages || []).map((m: any) => ({
              id: m.id,
              conversationId: session.id,
              role: m.role as 'user' | 'agent',
              content: m.content,
              createdAt: m.createdAt,
            }));
            const agentId = preview?.agentId || session.agentId || '';
            let agentName = '';
            let agentColor = '#6366f1';
            if (agentId) {
              try {
                const { useAgentStore } = await import('@/stores/agentStore');
                const agent = useAgentStore.getState().agents.find(a => a.id === agentId);
                if (agent) {
                  agentName = agent.name;
                  agentColor = agent.color || '#6366f1';
                }
              } catch {}
            }
            if (!agentName) {
              agentName = preview?.title || session.title || '会话';
            }
            restoredPanels.push({
              id: session.id,
              conversationId: session.id,
              agentId,
              agentIds: preview?.agentIds || session.agentIds || [],
              agentName,
              agentColor,
              messages,
              isStreaming: false,
            });
            restoredTabs.push({
              id: session.id,
              type: 'session',
              title: agentName,
              panelId: session.id,
              color: agentColor,
              conversationId: session.id,
              agentId,
              agentName,
            });
          } catch {
            restoredPanels.push({
              id: session.id,
              conversationId: session.id,
              agentId: session.agentId || '',
              agentIds: session.agentIds || [],
              agentName: session.title || '会话',
              agentColor: '#6366f1',
              messages: [],
              isStreaming: false,
            });
            restoredTabs.push({
              id: session.id,
              type: 'session',
              title: session.title || '会话',
              panelId: session.id,
              color: '#6366f1',
              conversationId: session.id,
              agentId: session.agentId || '',
              agentName: session.title || '会话',
            });
          }
        }
        if (restoredTabs.length > 0) {
          set({
            openPanels: restoredPanels,
            sessionTabs: restoredTabs,
            activeTabId: restoredTabs[0].id,
          });
        }
      }
    } catch {}
  },
  }),
  {
    name: "repaceclaw-conversations",
    version: 2, // 版本升级：新增 closedSessionIds 字段
    migrate: (persistedState: any, version: number) => {
      // v1 → v2: 旧数据没有 closedSessionIds，清空 sessionTabs 让 API 重新填充
      if (version < 2) {
        persistedState.sessionTabs = [];
        persistedState.activeTabId = null;
        persistedState.closedSessionIds = [];
      }
      return persistedState;
    },
    // 持久化 tabs、激活状态、已关闭会话列表 — 消息从 API 恢复
    partialize: (state) => ({
      sessionTabs: state.sessionTabs,
      activeTabId: state.activeTabId,
      closedSessionIds: state.closedSessionIds,
    }),
  }
)
);
