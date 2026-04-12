// wsHandler.ts — WebSocket 处理器
//
// RepaceClaw 负责：智能体配置管理、会话管理、消息存储
// OpenClaw Gateway 负责：模型路由、LLM API 调用、流式输出

import WebSocket, { WebSocketServer } from "ws";
import { AgentService } from "../services/AgentService";
import { ConversationService } from "../services/ConversationService";
import { ProjectService } from "../services/ProjectService";
import { UserService } from "../services/UserService";
import http from "http";
import https from "https";
import { v4 as uuidv4 } from "uuid";

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "http://localhost:18789";
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "021a420c0665ef2813ffe22e10725a629c58565ced1345d3";

interface WSMessage {
  type: "chat" | "multi_chat" | "ping" | "auth";
  conversationId?: string;
  agentId?: string;
  agentIds?: string[];
  content?: string;
  projectId?: string;
  workflowNodeId?: string;
  token?: string;  // JWT token for auth
}

interface WSClient {
  ws: WebSocket;
  userId: string | null;
  userRole: string | null;
}

export function setupWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const clients = new Map<WebSocket, WSClient>();

  wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
    console.log("[WS] Client connected");

    // 从 URL query 提取 token（支持 ?token=xxx）
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const queryToken = url.searchParams.get("token");

    const client: WSClient = { ws, userId: null, userRole: null };
    clients.set(ws, client);

    // 如果 URL 中有 token，直接认证
    if (queryToken) {
      try {
        const payload = UserService.verifyToken(queryToken);
        client.userId = payload.id;
        client.userRole = payload.role;
        console.log(`[WS] Authenticated via query: ${payload.id.slice(0, 8)}`);
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid authentication token" }));
      }
    }

    ws.on("message", async (data: Buffer) => {
      let msg: WSMessage;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
        return;
      }

      // ── Auth ──
      if (msg.type === "auth") {
        if (msg.token) {
          try {
            const payload = UserService.verifyToken(msg.token);
            client.userId = payload.id;
            client.userRole = payload.role;
            ws.send(JSON.stringify({ type: "auth_ok", userId: payload.id, role: payload.role }));
            console.log(`[WS] Authenticated: ${payload.id.slice(0, 8)} (${payload.role})`);
          } catch {
            ws.send(JSON.stringify({ type: "error", message: "Invalid token" }));
          }
        }
        return;
      }

      // ── Ping ──
      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      // ── 未认证拦截 ──
      if (!client.userId) {
        ws.send(JSON.stringify({ type: "error", message: "Not authenticated. Send { type: 'auth', token: '...' } first." }));
        return;
      }

      // ── 单智能体对话 ──
      if (msg.type === "chat") {
        const { conversationId, agentId, agentIds: msgAgentIds, content } = msg;
        if (!content || !conversationId) {
          ws.send(JSON.stringify({ type: "error", message: "Missing fields: conversationId, content" }));
          return;
        }

        // 确定 agentId
        const conv = ConversationService.getById(conversationId);
        if (!conv) {
          ws.send(JSON.stringify({ type: "error", message: "Conversation not found" }));
          return;
        }

        // Phase 3: 会话归属校验（非管理员必须是自己创建的会话）
        const db = require("../db/client").getDb();
        const ownerCheck = db.exec("SELECT user_id FROM conversations WHERE id = ?", [conversationId]);
        if (ownerCheck.length && ownerCheck[0].values.length) {
          const ownerId = ownerCheck[0].values[0][0] as string;
          if (ownerId && ownerId !== client.userId && client.userRole !== "super_admin" && client.userRole !== "admin") {
            ws.send(JSON.stringify({ type: "error", message: "无权访问此会话" }));
            return;
          }
        }

        const dbAgentIds = conv.agentIds ?? [];
        const targetAgentId =
          (msgAgentIds && msgAgentIds.length > 0) ? msgAgentIds[0]
          : dbAgentIds.length > 0 ? dbAgentIds[0]
          : agentId || '';

        if (!targetAgentId) {
          ws.send(JSON.stringify({ type: "error", message: "No agent associated with this conversation" }));
          return;
        }

        // 保存用户消息到 DB
        const userMsg = ConversationService.addMessage({
          conversationId,
          role: "user",
          content,
          agentId: targetAgentId,
        });
        ws.send(JSON.stringify({ type: "user_message", message: userMsg }));

        // 获取智能体配置
        const agent = AgentService.getById(targetAgentId);
        if (!agent) {
          ws.send(JSON.stringify({ type: "error", message: `Agent ${targetAgentId} not found` }));
          return;
        }

        // 构建 system prompt
        let systemPrompt = agent.systemPrompt || '';
        if (agent.writingStyle) systemPrompt += `\n\n写作风格：${agent.writingStyle}`;
        if (agent.expertise?.length) systemPrompt += `\n\n专业领域：${agent.expertise.join('、')}`;
        if (agent.outputFormat && agent.outputFormat !== '纯文本') {
          systemPrompt += `\n\n## 输出格式要求\n${agent.outputFormat}`;
        }
        if (agent.boundary?.trim()) {
          systemPrompt += `\n\n## 能力边界\n${agent.boundary.trim()}`;
        }
        systemPrompt += `\n\n你的名字是 ${agent.name}，请始终以第一人称回复。`;

        // 获取历史消息
        const historyMessages = ConversationService.getMessages(conversationId);
        const history = historyMessages.map((m) => ({
          role: m.role === "agent" ? "assistant" : "user",
          content: m.content,
        }));

        // 调用 OpenClaw Gateway 生成回复
        await callGateway(ws, conversationId, targetAgentId, systemPrompt, history, content);
        return;
      }

      // ── 多智能体协作对话 ──
      if (msg.type === "multi_chat") {
        const { conversationId, projectId, workflowNodeId, content } = msg;
        if (!content || !conversationId || !projectId) {
          ws.send(JSON.stringify({ type: "error", message: "Missing fields: conversationId, projectId, content" }));
          return;
        }

        const project = ProjectService.getById(projectId);
        if (!project) {
          ws.send(JSON.stringify({ type: "error", message: `Project ${projectId} not found` }));
          return;
        }

        const targetNodes = workflowNodeId
          ? project.workflowNodes.filter((n) => n.id === workflowNodeId)
          : project.workflowNodes;

        if (!targetNodes.length) {
          ws.send(JSON.stringify({ type: "error", message: "No workflow nodes found" }));
          return;
        }

        // 保存用户消息
        const userMsg = ConversationService.addMessage({ conversationId, role: "user", content });
        ws.send(JSON.stringify({ type: "user_message", message: userMsg }));

        ws.send(JSON.stringify({
          type: "multi_agent_start",
          nodeCount: targetNodes.length,
          projectId,
          workflowNodeId: workflowNodeId || null,
        }));

        for (const node of targetNodes) {
          ws.send(JSON.stringify({
            type: "workflow_node_start",
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.nodeType,
            agentCount: node.agentIds.length,
          }));

          for (const agentId of node.agentIds) {
            const agent = AgentService.getById(agentId);
            if (!agent) continue;

            let systemPrompt = agent.systemPrompt || '';
            if (agent.writingStyle) systemPrompt += `\n\n写作风格：${agent.writingStyle}`;
            if (agent.expertise?.length) systemPrompt += `\n\n专业领域：${agent.expertise.join('、')}`;
            systemPrompt += `\n\n你的名字是 ${agent.name}，请始终以第一人称回复。`;

            const historyMessages = ConversationService.getMessages(conversationId);
            const history = historyMessages.map((m) => ({
              role: m.role === "agent" ? "assistant" : "user",
              content: m.content,
            }));

            await callGateway(ws, conversationId, agentId, systemPrompt, history, content);
          }

          ws.send(JSON.stringify({ type: "workflow_node_done", nodeId: node.id }));
        }

        ws.send(JSON.stringify({
          type: "multi_agent_done",
          projectId,
          workflowNodeId: workflowNodeId || null,
        }));
        return;
      }

      ws.send(JSON.stringify({ type: "error", message: `Unknown message type: ${(msg as any).type}` }));
    });

    ws.on("close", () => console.log("[WS] Client disconnected"));
    ws.on("error", (err) => console.error("[WS] Error:", err.message));
  });

  return wss;
}

/**
 * 调用 OpenClaw Gateway 生成智能体回复
 * Gateway 负责：模型路由、LLM API 调用
 * 我们负责：system prompt、对话历史、消息存储
 */
async function callGateway(
  ws: WebSocket,
  conversationId: string,
  agentId: string,
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userContent: string
): Promise<void> {
  return new Promise((resolve) => {
    const msgId = uuidv4();

    if (ws.readyState !== WebSocket.OPEN) { resolve(); return; }

    ws.send(JSON.stringify({ type: "agent_start", messageId: msgId, agentId }));

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userContent },
    ];

    console.log(`[Gateway] Calling with model=openclaw, messages=${messages.length}, agent=${agentId}`);

    const url = new URL(`${GATEWAY_URL}/v1/chat/completions`);
    const payload = JSON.stringify({
      model: "openclaw",
      messages,
      stream: false,
    });

    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "Authorization": `Bearer ${GATEWAY_TOKEN}`,
      },
    }, (res) => {
      let body = "";
      res.on("data", (d: Buffer) => (body += d.toString()));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          const content = json.choices?.[0]?.message?.content || "";
          const totalTokens = json.usage?.total_tokens || 0;

          if (res.statusCode && res.statusCode >= 400) {
            console.error(`[Gateway] Error ${res.statusCode}:`, body.substring(0, 200));
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "error", message: `Gateway error: ${body.substring(0, 200)}`, agentId }));
            }
            resolve();
            return;
          }

          // 保存到 DB
          const agentMsg = ConversationService.addMessage({
            conversationId,
            role: "agent",
            content,
            agentId,
            tokenCount: totalTokens,
          });

          console.log(`[Gateway] Response: ${content.length} chars, ${totalTokens} tokens`);

          // 模拟流式：逐段发送给前端
          if (content && ws.readyState === WebSocket.OPEN) {
            const chunkSize = 20;
            for (let i = 0; i < content.length; i += chunkSize) {
              ws.send(JSON.stringify({
                type: "agent_chunk",
                messageId: msgId,
                chunk: content.substring(i, i + chunkSize),
                agentId,
              }));
            }
          }

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "agent_done",
              messageId: msgId,
              message: agentMsg,
              agentId,
              tokenCount: totalTokens,
            }));
          }
          resolve();
        } catch (e: any) {
          console.error(`[Gateway] Parse error:`, e.message, body.substring(0, 200));
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "error", message: e.message, agentId }));
          }
          resolve();
        }
      });
    });

    req.on("error", (err) => {
      console.error(`[Gateway] Request error:`, err.message);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "error", message: err.message, agentId }));
      }
      resolve();
    });

    req.setTimeout(120000, () => {
      req.destroy();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "error", message: "Gateway timeout", agentId }));
      }
      resolve();
    });

    req.write(payload);
    req.end();
  });
}
