// connection.ts — WebSocket 连接管理（onConnect, onDisconnect, 连接池）
import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import { logger } from '../utils/logger';
import { UserService } from "../services/UserService";
import { createBroadcastFn } from './broadcast';
import { handleMessage } from './handlers';

interface WSClient {
  ws: WebSocket;
  userId: string | null;
  userRole: string | null;
}

export function setupWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const clients = new Map<WebSocket, WSClient>();

  // 创建广播函数并挂载到 wss 和 globalThis
  const broadcastFn = createBroadcastFn(clients);
  (wss as unknown as Record<string, unknown>).broadcastToConversation = broadcastFn;
  (globalThis as Record<string, unknown>).__broadcastToConversation = broadcastFn;

  wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
    logger.info("[WS] Client connected");

    // 从 URL query 提取 token(支持 ?token=xxx)
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const queryToken = url.searchParams.get("token");

    const client: WSClient = { ws, userId: null, userRole: null };
    clients.set(ws, client);

    // 如果 URL 中有 token,直接认证
    if (queryToken) {
      try {
        const payload = UserService.verifyToken(queryToken);
        client.userId = payload.id;
        client.userRole = payload.role;
        logger.info(`[WS] Authenticated via query: ${payload.id.slice(0, 8)}`);
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid authentication token" }));
      }
    }

    ws.on("message", async (data: Buffer) => {
      await handleMessage(ws, client, data, clients);
    });

    ws.on("close", (code, reason) => {
      logger.info(`[WS] Client disconnected code=${code} reason=${reason?.toString() || 'n/a'}`);
    });
    ws.on("error", (err) => logger.error("[WS] Error: " + err.message));
  });

  return wss;
}
