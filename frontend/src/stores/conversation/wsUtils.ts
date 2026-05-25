// [2026-05-25] WebSocket 工具函数 — 从 conversationStore.ts 拆分
import { Message } from '../../types';

// WebSocket singleton
export let wsInstance: WebSocket | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function getWsReconnectTimer() { return wsReconnectTimer; }
export function setWsReconnectTimer(timer: ReturnType<typeof setTimeout> | null) { wsReconnectTimer = timer; }

/**
 * 获取当前 WebSocket 实例(供 sync 模块等非核心模块复用)
 */
export function getWsInstance(): WebSocket | null {
  return wsInstance;
}

export function setWsInstance(ws: WebSocket | null) {
  wsInstance = ws;
}

type ConversationWsEvent = {
  type: string;
  conversationId?: string;
  messageId?: string;
  message?: Message;
  chunk?: string;
  agentId?: string;
};

const conversationWsSubscribers = new Map<string, Set<(event: ConversationWsEvent) => void>>();

export function notifyConversationWsSubscribers(event: ConversationWsEvent) {
  const conversationId = event.conversationId || event.message?.conversationId;
  if (!conversationId) return;
  const handlers = conversationWsSubscribers.get(conversationId);
  if (!handlers?.size) return;
  handlers.forEach((handler) => {
    try { handler(event); } catch (e) { console.warn("[ConvStore]", e); }
  });
}

export function subscribeConversationWs(
  conversationId: string,
  handler: (event: ConversationWsEvent) => void,
): () => void {
  const handlers = conversationWsSubscribers.get(conversationId) || new Set<(event: ConversationWsEvent) => void>();
  handlers.add(handler);
  conversationWsSubscribers.set(conversationId, handlers);
  return () => {
    const current = conversationWsSubscribers.get(conversationId);
    if (!current) return;
    current.delete(handler);
    if (current.size === 0) conversationWsSubscribers.delete(conversationId);
  };
}

/**
 * 确保 WS 连接已打开。使用动态 import 避免循环依赖。
 */
export async function ensureWsOpen(timeoutMs = 5000): Promise<boolean> {
  if (wsInstance?.readyState === WebSocket.OPEN) return true;
  // 动态 import 避免循环依赖
  const { useConversationStore } = await import('./store');
  useConversationStore.getState().connect();
  const start = Date.now();
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      if (wsInstance?.readyState === WebSocket.OPEN) {
        clearInterval(timer);
        resolve(true);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 100);
  });
}

export async function sendConversationMessageOverWs(payload: {
  conversationId: string;
  conversationTitle?: string;
  previousConversationTitle?: string;
  agentId: string;
  agentIds?: string[];
  content: string;
}): Promise<void> {
  const ok = await ensureWsOpen();
  if (!ok || !wsInstance || wsInstance.readyState !== WebSocket.OPEN) {
    throw new Error("WS not connected");
  }
  wsInstance.send(JSON.stringify({
    type: "chat",
    conversationId: payload.conversationId,
    conversationTitle: payload.conversationTitle || "",
    previousConversationTitle: payload.previousConversationTitle || "",
    agentId: payload.agentId,
    agentIds: payload.agentId ? [payload.agentId] : (payload.agentIds || []),
    content: payload.content,
  }));
}
