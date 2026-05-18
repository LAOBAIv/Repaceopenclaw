// [2026-05-18] 从 AgentCreate.tsx 拆分出工具函数

import type { TokenCache } from './types';
import { AGENT_TYPE_OPTIONS } from './constants';

/* ─── 模板分类 → 智能体类型映射 ─── */
export function templateCategoryToAgentType(
  category?: string
): (typeof AGENT_TYPE_OPTIONS)[number]['value'] {
  switch (category) {
    case 'engineering':
    case 'integrations':
    case 'testing':
      return 'dev';
    case 'design':
      return 'creative';
    case 'project-management':
    case 'product':
      return 'pm';
    case 'academic':
      return 'research';
    case 'marketing':
    case 'paid-media':
    case 'strategy':
    case 'sales':
      return 'ops';
    default:
      return 'general';
  }
}

/* ─── Token 本地缓存（按渠道 ID 存取，跨智能体复用） ─── */
export const TOKEN_CACHE_PREFIX = 'wb_token_';

export function saveTokenCache(channelId: string, data: TokenCache) {
  try {
    localStorage.setItem(TOKEN_CACHE_PREFIX + channelId, JSON.stringify(data));
  } catch { /* ignore */ }
}

export function loadTokenCache(channelId: string): TokenCache | null {
  try {
    const raw = localStorage.getItem(TOKEN_CACHE_PREFIX + channelId);
    return raw ? (JSON.parse(raw) as TokenCache) : null;
  } catch { return null; }
}

export const AUTH_TYPE_LABEL: Record<string, string> = {
  Bearer: 'Bearer Token',
  ApiKey: 'API Key',
  Basic:  'Basic Auth',
};
