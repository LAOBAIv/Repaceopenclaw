/**
 * ClawBotSse — SSE 事件广播
 *
 * 管理 SSE 客户端连接，透传 Gateway 事件。
 */
import { clawBotClient } from './ClawBotGatewayClient';

type SseCallback = (event: string, payload: string) => void;
const sseClients = new Set<SseCallback>();

export function broadcastSse(event: string, data: unknown): void {
  const payload = JSON.stringify(data);
  for (const client of sseClients) {
    try { client(event, payload); }
    catch { sseClients.delete(client); }
  }
}

export function getSseClientCount(): number {
  return sseClients.size;
}

export function addSseClient(client: SseCallback): void {
  sseClients.add(client);
}

export function removeSseClient(client: SseCallback): void {
  sseClients.delete(client);
}

// 注册 Gateway 事件监听
clawBotClient.on('state_change', (data) => broadcastSse('state_change', data));
clawBotClient.on('connected', (data) => broadcastSse('connected', data));
clawBotClient.on('disconnect', () => broadcastSse('disconnected', {}));
clawBotClient.on('*', (data: unknown) => {
  if ((data as { event?: string })?.event) {
    broadcastSse('gateway_event', data);
  }
});
