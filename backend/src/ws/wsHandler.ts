import WebSocket, { WebSocketServer } from "ws";
import { AgentService } from "../services/AgentService";
import { ConversationService } from "../services/ConversationService";
import { ProjectService } from "../services/ProjectService";
import http from "http";
import { v4 as uuidv4 } from "uuid";

interface WSMessage {
  type: "chat" | "multi_chat" | "ping";
  conversationId?: string;
  agentId?: string;
  /** 多智能体：前端可传全量参与 agentIds；若不传则从 DB conversation_agents 表读取 */
  agentIds?: string[];
  content?: string;
  // multi_chat specific
  projectId?: string;
  workflowNodeId?: string;
}

export function setupWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    console.log("[WS] Client connected");

    ws.on("message", async (data: Buffer) => {
      let msg: WSMessage;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
        return;
      }

      // ── Ping ──────────────────────────────────────────────────────────────
      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      // ── Single agent chat ─────────────────────────────────────────────────
      if (msg.type === "chat") {
        const { conversationId, agentId, agentIds: msgAgentIds, content } = msg;
        if (!content || !conversationId) {
          ws.send(JSON.stringify({ type: "error", message: "Missing fields: conversationId, content" }));
          return;
        }

        // 解析本次参与的 agentIds，确定执行顺序：
        //   1. 优先使用前端显式传来的 agentIds（前端可自由排序）
        //   2. 其次从 DB conversation_agents 读取（按 joined_at ASC 排序 = 协作流程的加入顺序）
        //   3. 最后降级为前端传来的单个 agentId
        //
        // 多智能体场景下，activeAgentIds[0] 即"协作流程最靠前的智能体"，
        // 它将被第一个调用，其回复会进入 history 供后续 agent 参考。
        const conv = ConversationService.getById(conversationId);
        const dbAgentIds = conv?.agentIds ?? [];  // 已按 joined_at ASC 排序
        let activeAgentIds: string[] =
          (msgAgentIds && msgAgentIds.length > 0)
            ? msgAgentIds
            : dbAgentIds.length > 0
              ? dbAgentIds
              : agentId ? [agentId] : [];

        if (activeAgentIds.length === 0) {
          ws.send(JSON.stringify({ type: "error", message: "No agent associated with this conversation" }));
          return;
        }

        // Save user message
        const userMsg = ConversationService.addMessage({
          conversationId,
          role: "user",
          content,
        });
        ws.send(JSON.stringify({ type: "user_message", message: userMsg }));

        // Build history for LLM context
        const messages = ConversationService.getMessages(conversationId);
        const history = messages.map((m) => ({
          role: m.role === "agent" ? "assistant" : "user",
          content: m.content,
        }));

        if (activeAgentIds.length === 1) {
          // 单智能体：直接调用
          await runSingleAgent(ws, conversationId, activeAgentIds[0], history);
        } else {
          // 多智能体：串行依次回复（每个 agent 都能看到前者的回复）
          ws.send(JSON.stringify({
            type: "multi_agent_start",
            nodeCount: 1,
            agentIds: activeAgentIds,
          }));

          let currentHistory = [...history];
          for (const aid of activeAgentIds) {
            // 刷新 history，让后续 agent 看到前面 agent 的回复
            const refreshed = ConversationService.getMessages(conversationId);
            currentHistory = refreshed.map((m) => ({
              role: m.role === "agent" ? "assistant" : "user",
              content: m.content,
            }));

            // 防止 history 末尾出现连续 user 消息
            const lastRole = currentHistory.length > 0
              ? currentHistory[currentHistory.length - 1].role
              : null;
            const isFirst = activeAgentIds.indexOf(aid) === 0;
            if (!isFirst && lastRole === "user") {
              ConversationService.addMessage({
                conversationId,
                role: "agent",
                content: "[上一个智能体未返回回复]",
                agentId: activeAgentIds[activeAgentIds.indexOf(aid) - 1],
              });
              const fixed = ConversationService.getMessages(conversationId);
              currentHistory = fixed.map((m) => ({
                role: m.role === "agent" ? "assistant" : "user",
                content: m.content,
              }));
            }

            await runSingleAgent(ws, conversationId, aid, currentHistory);
          }

          ws.send(JSON.stringify({ type: "multi_agent_done", agentIds: activeAgentIds }));
        }

        return;
      }

      // ── Multi-agent collaboration chat ────────────────────────────────────
      if (msg.type === "multi_chat") {
        const { conversationId, projectId, workflowNodeId, content } = msg;
        if (!content || !conversationId || !projectId) {
          ws.send(JSON.stringify({ type: "error", message: "Missing fields: conversationId, projectId, content" }));
          return;
        }

        // Load project workflow
        const project = ProjectService.getById(projectId);
        if (!project) {
          ws.send(JSON.stringify({ type: "error", message: `Project ${projectId} not found` }));
          return;
        }

        // Find target workflow node (or use all nodes if not specified)
        const targetNodes = workflowNodeId
          ? project.workflowNodes.filter((n) => n.id === workflowNodeId)
          : project.workflowNodes;

        if (!targetNodes.length) {
          ws.send(JSON.stringify({ type: "error", message: "No workflow nodes found" }));
          return;
        }

        // Save user message
        const userMsg = ConversationService.addMessage({
          conversationId,
          role: "user",
          content,
        });
        ws.send(JSON.stringify({ type: "user_message", message: userMsg }));

        // Build base history
        const messages = ConversationService.getMessages(conversationId);
        const baseHistory = messages.map((m) => ({
          role: m.role === "agent" ? "assistant" : "user",
          content: m.content,
        }));

        // Notify client that multi-agent flow is starting
        ws.send(JSON.stringify({
          type: "multi_agent_start",
          nodeCount: targetNodes.length,
          projectId,
          workflowNodeId: workflowNodeId || null,
        }));

        // Execute each workflow node
        for (const node of targetNodes) {
          if (node.nodeType === "serial") {
            // ── Serial: run each agent one by one ────────────────────────────
            ws.send(JSON.stringify({
              type: "workflow_node_start",
              nodeId: node.id,
              nodeName: node.name,
              nodeType: "serial",
              agentCount: node.agentIds.length,
            }));

            for (const agentId of node.agentIds) {
              // Refresh history after each agent so next agent has full context
              const currentMessages = ConversationService.getMessages(conversationId);
              const currentHistory = currentMessages.map((m) => ({
                role: m.role === "agent" ? "assistant" : "user",
                content: m.content,
              }));

              // Guard: if history ends with a user message (no assistant reply yet),
              // that's the expected state for the first agent. But after an agent run,
              // if the last message is still "user" it means the previous agent errored
              // without writing to DB — skip a broken state by continuing with what we have.
              const lastRole = currentHistory.length > 0 ? currentHistory[currentHistory.length - 1].role : null;
              const isFirstAgent = node.agentIds.indexOf(agentId) === 0;

              if (!isFirstAgent && lastRole === "user") {
                // Previous agent failed without saving a reply — insert an empty placeholder
                // so history remains alternating (user → assistant → user → assistant…)
                console.warn(`[WS] Previous agent in serial node failed silently; inserting empty placeholder for agent ${agentId}`);
                ConversationService.addMessage({
                  conversationId,
                  role: "agent",
                  content: "[上一个智能体未返回回复]",
                  agentId: node.agentIds[node.agentIds.indexOf(agentId) - 1],
                });
                // Re-fetch history with the placeholder included
                const fixedMessages = ConversationService.getMessages(conversationId);
                currentHistory.length = 0;
                fixedMessages.forEach((m) =>
                  currentHistory.push({ role: m.role === "agent" ? "assistant" : "user", content: m.content })
                );
              }

              await runSingleAgent(ws, conversationId, agentId, currentHistory);
            }

            ws.send(JSON.stringify({
              type: "workflow_node_done",
              nodeId: node.id,
            }));

          } else {
            // ── Parallel: fire all agents concurrently ────────────────────────
            ws.send(JSON.stringify({
              type: "workflow_node_start",
              nodeId: node.id,
              nodeName: node.name,
              nodeType: "parallel",
              agentCount: node.agentIds.length,
            }));

            // All agents see the same history snapshot (including the current user message)
            // baseHistory is built AFTER the user message is saved, so it already includes it.
            const historySnapshot = [...baseHistory];

            await Promise.all(
              node.agentIds.map((agentId) =>
                runSingleAgent(ws, conversationId, agentId, historySnapshot)
              )
            );

            ws.send(JSON.stringify({
              type: "workflow_node_done",
              nodeId: node.id,
            }));
          }
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

    ws.on("close", () => {
      console.log("[WS] Client disconnected");
    });

    ws.on("error", (err) => {
      console.error("[WS] Error:", err.message);
    });
  });

  return wss;
}

/**
 * Run a single agent stream and save its response to the conversation.
 * Pushes agent_start / agent_chunk / agent_done WebSocket events.
 * 完成后将本次 token 用量累加到 agents.token_used。
 */
async function runSingleAgent(
  ws: WebSocket,
  conversationId: string,
  agentId: string,
  history: Array<{ role: string; content: string }>
): Promise<void> {
  return new Promise((resolve) => {
    const msgId = uuidv4();

    if (ws.readyState !== WebSocket.OPEN) {
      resolve();
      return;
    }

    ws.send(JSON.stringify({ type: "agent_start", messageId: msgId, agentId }));

    let fullContent = "";

    AgentService.generateStream(
      agentId,
      history,
      (chunk) => {
        fullContent += chunk;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "agent_chunk", messageId: msgId, chunk, agentId }));
        }
      },
      (tokenCount) => {
        // 保存完整 agent 消息，同时记录本次 token 用量
        const agentMsg = ConversationService.addMessage({
          conversationId,
          role: "agent",
          content: fullContent,
          agentId,
          tokenCount,
        });
        // 将本次消耗的 token 累加到 agents.token_used 统计列
        AgentService.addTokenUsed(agentId, tokenCount);

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "agent_done",
            messageId: msgId,
            message: agentMsg,
            agentId,
            tokenCount,   // 通知前端本次 token 用量
          }));
        }
        resolve();
      },
      (err) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "error", message: err.message, agentId }));
        }
        resolve();
      }
    );
  });
}
