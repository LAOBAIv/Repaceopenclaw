/**
 * 项目页面常量定义
 * 包含状态映射和优先级映射
 */

/** 项目状态映射 */
export const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: '进行中', color: '#16a34a', bg: '#dcfce7' },
  archived: { label: '已归档', color: '#6b7280', bg: '#f3f4f6' },
};

/** 项目优先级映射 */
export const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  high: { label: '高', color: '#ef4444' },
  mid: { label: '中', color: '#f59e0b' },
  low: { label: '低', color: '#22c55e' },
};
