// [2026-05-18] 从 conversationStore.ts 拆分出辅助函数
import { Conversation } from '../../types';

// 平台助手 UUID(DB 真实 id)+ 兼容旧别名
export const PLATFORM_ASSISTANT_IDS = new Set([
  'platform-assistant',
  'repaceclaw-platform-assistant',
  '24cf6cc5-da0d-48df-814e-11582e398007',  // DB 平台助手 UUID
]);

// 微信助手 ID(全局智能体,独立会话管理)
export const WECHAT_ASSISTANT_IDS = new Set([
  'rc-wechat-agent',
]);

export const isPlatformAssistantAgent = (agentId?: string | null) =>
  agentId ? PLATFORM_ASSISTANT_IDS.has(agentId) : false;

export const isWechatAssistantAgent = (agentId?: string | null) =>
  agentId ? WECHAT_ASSISTANT_IDS.has(agentId) : false;

/** 判断是否属于全局独立助手类会话(平台助手或微信助手) */
export const isGlobalAssistantConversationLike = (input: {
  agentId?: string | null;
  currentAgentCode?: string | null;
  title?: string | null;
}) => {
  const agentId = input.agentId || '';
  return (agentId && (PLATFORM_ASSISTANT_IDS.has(agentId) || WECHAT_ASSISTANT_IDS.has(agentId)))
    || input.title === 'RepaceClaw 平台助手'
    || input.title === '微信助手';
};

export function resolveConversationCurrentAgent(
  conv?: Partial<Conversation> | null, fallback = ""
): string {
  return conv?.currentAgentId || conv?.agentId || conv?.agentIds?.[0] || fallback;
}

export function resolveConversationAgentIds(
  conv?: Partial<Conversation> | null, fallback?: string[]
): string[] {
  const agentIds = conv?.agentIds || [];
  if (agentIds.length > 0) return agentIds;
  const currentAgentId = conv?.currentAgentId || conv?.agentId;
  if (currentAgentId) return [currentAgentId];
  return fallback || [];
}

// [2026-05-24] 类型安全
export function isConversationNotFoundError(err: unknown): boolean {
  const e = err as Record<string, unknown>;
  const response = e?.response as Record<string, unknown> | undefined;
  return response?.status === 404 || (response?.data as Record<string, unknown>)?.error === 'Conversation not found';
}
