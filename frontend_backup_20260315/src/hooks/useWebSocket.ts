import { useEffect, useRef, useCallback } from "react";
import { useConversationStore } from "../stores/conversationStore";

// Use relative WebSocket URL so Vite proxy (/ws → ws://localhost:3001/ws) handles routing.
// This also works correctly in production when WS is served from the same host.
const WS_PROTOCOL = window.location.protocol === "https:" ? "wss:" : "ws:";
const WS_URL = `${WS_PROTOCOL}//${window.location.host}/ws`;

interface WSIncoming {
  type: string;
  messageId?: string;
  message?: any;
  chunk?: string;
  agentId?: string;
}

/**
 * Low-level WebSocket hook.
 * NOTE: The ConversationStore already manages its own WS connection for panel message routing.
 * This hook is provided as an escape hatch for direct WS access (e.g., in components that
 * need to send raw messages outside of a conversation panel context).
 */
export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { startStreaming, appendStreamChunk, finishStreaming } = useConversationStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS hook] Connected");
      ws.send(JSON.stringify({ type: "ping" }));
    };

    ws.onmessage = (event) => {
      let data: WSIncoming;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      const panels = useConversationStore.getState().openPanels;

      if (data.type === "agent_start" && data.messageId && data.agentId) {
        const activePanel = panels.find((p) => p.agentId === data.agentId && !p.isStreaming);
        if (activePanel) {
          startStreaming(activePanel.id, data.messageId);
        }
      }

      if (data.type === "agent_chunk" && data.messageId && data.chunk) {
        const activePanel = panels.find(
          (p) => p.streamingMessageId === data.messageId || p.agentId === data.agentId
        );
        if (activePanel) {
          appendStreamChunk(activePanel.id, data.messageId!, data.chunk);
        }
      }

      if (data.type === "agent_done" && data.messageId && data.message) {
        const activePanel = panels.find(
          (p) => p.streamingMessageId === data.messageId || p.agentId === data.agentId
        );
        if (activePanel) {
          finishStreaming(activePanel.id, data.messageId!, data.message);
        }
      }
    };

    ws.onerror = (err) => {
      console.error("[WS hook] Error:", err);
    };

    ws.onclose = () => {
      console.log("[WS hook] Disconnected, reconnecting in 3s...");
      reconnectTimerRef.current = setTimeout(connect, 3000);
    };
  }, [startStreaming, appendStreamChunk, finishStreaming]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      console.warn("[WS hook] Not connected, cannot send message");
    }
  }, []);

  const sendChatMessage = useCallback(
    (conversationId: string, agentId: string, content: string) => {
      sendMessage({ type: "chat", conversationId, agentId, content });
    },
    [sendMessage]
  );

  return { sendChatMessage, wsRef };
}
