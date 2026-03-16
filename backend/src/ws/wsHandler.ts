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
        const { conversationId, agentId, content } = msg;
        if (!content || !conversationId || !agentId) {
          ws.send(JSON.stringify({ type: "error", message: "Missing fields: conversationId, agentId, content" }));
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

        await runSingleAgent(ws, conversationId, agentId, history);
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

            // All agents see the same history snapshot (before any of them reply)
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
      () => {
        // Save complete agent message
        const agentMsg = ConversationService.addMessage({
          conversationId,
          role: "agent",
          content: fullContent,
          agentId,
        });
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "agent_done", messageId: msgId, message: agentMsg, agentId }));
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
