/**
 * AgentKanban 工具函数
 *
 * 提供标签颜色计算和相对时间格式化。
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
 * 将日期字符串格式化为相对时间（中文）
 */
export function relativeTime(dateStr: string): string {
  try {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
    return date.toLocaleDateString('zh-CN');
  } catch {
    return dateStr;
  }
}
