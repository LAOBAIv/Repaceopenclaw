/**
 * SessionAgentBar 工具函数
 * 包含标签颜色计算、存储键生成和标签加载逻辑
 */

import { TAG_COLOR_POOL } from './constants';

/**
 * 根据标签名计算颜色（确定性哈希）
 */
export function getTagColor(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_COLOR_POOL[h % TAG_COLOR_POOL.length];
}

/**
 * 生成 localStorage 存储键
 */
export function getStorageKey(conversationId: string): string {
  return `repaceclaw-session-tags-${conversationId}`;
}

/**
 * 从 localStorage 加载会话标签
 */
export function loadSessionTags(conversationId: string): string[] {
  try {
    const saved = localStorage.getItem(getStorageKey(conversationId));
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}
