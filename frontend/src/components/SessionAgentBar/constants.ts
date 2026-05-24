/**
 * SessionAgentBar 常量定义
 * 包含标签颜色池和备选模型列表
 */

/** 标签颜色池 — 根据标签名哈希值选取 */
export const TAG_COLOR_POOL = [
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  { bg: '#fdf4ff', border: '#e9d5ff', text: '#7c3aed' },
  { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
];

/** 可用模型列表（fallback） */
// [2026-05-23] 模型列表改为动态加载，关联后台模型渠道数据
// 硬编码列表作为 fallback，实际数据从 /api/models + /api/model-providers 获取
export const FALLBACK_MODELS = [
  { id: 'auto', label: '自动选择' },
];
