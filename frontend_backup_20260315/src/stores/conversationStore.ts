import { create } from "zustand";
import { Message } from "../types";
import { conversationsApi } from "../api/conversations";

interface ConversationPanel {
  id: string;
  conversationId: string;
  agentId: string;
  agentName: string;
  agentColor: string;
  messages: Message[];
  isStreaming: boolean;
  streamingMessageId?: string;
  streamingContent?: string;
}

interface ConversationStore {
  openPanels: ConversationPanel[];
  messagesMap: Record<string, Message[]>;
  maxPanels: number;
  /** WebSocket 是否已连通 */
  wsConnected: boolean;

  connect: () => void;
  sendMessage: (panelId: string, content: string) => void;
  /** Open a new conversation panel */
  openPanel: (opts: { agentId: string; agentName: string; agentColor: string; projectId?: string; initialMessage?: string }) => Promise<void>;
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
}

// WebSocket singleton
let wsInstance: WebSocket | null = null;

export const useConversationStore = create<ConversationStore>((set, get) => ({
  openPanels: [],
  messagesMap: {},
  maxPanels: 4,
  wsConnected: false,

  connect: () => {
    if (wsInstance?.readyState === WebSocket.OPEN) return;
    try {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
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
          if (data.type === "agent_start" && data.messageId && data.agentId) {
            const panel = panels.find((p) => p.agentId === data.agentId);
            if (panel) get().startStreaming(panel.id, data.messageId);
          }
          if (data.type === "agent_chunk" && data.messageId && data.chunk) {
            const panel = panels.find((p) => p.streamingMessageId === data.messageId);
            if (panel) get().appendStreamChunk(panel.id, data.messageId, data.chunk);
          }
          if (data.type === "agent_done" && data.messageId && data.message) {
            const panel = panels.find((p) => p.streamingMessageId === data.messageId);
            if (panel) get().finishStreaming(panel.id, data.messageId, data.message);
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
    if (wsInstance?.readyState === WebSocket.OPEN) {
      wsInstance.send(JSON.stringify({ type: "chat", conversationId: panel.conversationId, agentId: panel.agentId, content }));
    }
  },

  addPanel: async (agentId, agentName, agentColor, projectId) => {
    return get().openPanel({ agentId, agentName, agentColor, projectId });
  },

  openPanel: async ({ agentId, agentName, agentColor, projectId, initialMessage }) => {
    const { openPanels, maxPanels } = get();
    if (openPanels.length >= maxPanels) return;

    const sendInitialMsg = async (panelId: string, conversationId: string) => {
      if (!initialMessage) return;
      try {
        const msg = await conversationsApi.sendMessage(conversationId, initialMessage);
        set((s) => ({
          openPanels: s.openPanels.map((p) =>
            p.id === panelId ? { ...p, messages: [...p.messages, msg] } : p
          ),
        }));
      } catch {
        // REST 不可用时退化为 WS 发送
        if (wsInstance?.readyState === WebSocket.OPEN) {
          wsInstance.send(JSON.stringify({ type: 'chat', conversationId, agentId, content: initialMessage }));
        }
      }
    };

    try {
      const conv = await conversationsApi.create({ agentId, projectId, title: `与 ${agentName} 的对话` });
      const panel: ConversationPanel = {
        id: conv.id,
        conversationId: conv.id,
        agentId,
        agentName,
        agentColor,
        messages: [],
        isStreaming: false,
      };
      set((s) => ({ openPanels: [...s.openPanels, panel] }));
      await sendInitialMsg(conv.id, conv.id);
    } catch {
      // API not available, add a local panel
      const localId = `local-${Date.now()}`;
      const panel: ConversationPanel = {
        id: localId,
        conversationId: localId,
        agentId,
        agentName,
        agentColor,
        messages: [],
        isStreaming: false,
      };
      set((s) => ({ openPanels: [...s.openPanels, panel] }));
      // 本地面板也尝试通过 WS 发送
      if (initialMessage && wsInstance?.readyState === WebSocket.OPEN) {
        wsInstance.send(JSON.stringify({ type: 'chat', conversationId: localId, agentId, content: initialMessage }));
      }
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
}));
