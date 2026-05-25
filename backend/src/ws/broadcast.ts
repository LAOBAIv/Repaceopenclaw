// broadcast.ts — 广播逻辑（broadcastToConversation 等）
import WebSocket from "ws";
import { logger } from '../utils/logger';

/**
 * 向指定会话的所有已认证连接广播消息
 * 用于异步任务(如概述生成)完成后推送给前端
 */
export function createBroadcastFn(clients: Map<WebSocket, { ws: WebSocket; userId: string | null; userRole: string | null }>) {
  return function broadcastToConversation(conversationId: string, data: Record<string, any>): void {
    const payload = JSON.stringify(data);
    for (const [ws, client] of clients) {
      if (ws.readyState === WebSocket.OPEN && client.userId) {
        ws.send(payload);
      }
    }
  };
}

/** 供路由调用的广播函数(setupWebSocket 后初始化) */
export function broadcastToConversation(conversationId: string, data: Record<string, any>): void {
  const fn = (globalThis as any).__broadcastToConversation;
  if (fn) {
    fn(conversationId, data);
  }
}
