/**
 * 共享常量和配置
 */

/* 优先级配置 */
export const PRIORITY_MAP = {
  high: { label: '紧急',    color: '#ef4444', bg: '#fef2f2' },
  mid:  { label: '高优先级', color: '#f59e0b', bg: '#fffbeb' },
  low:  { label: '普通',    color: '#9ca3af', bg: '#f3f4f6' },
};

/* 标签颜色池 */
export const TAG_COLOR_POOL = [
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  { bg: '#fdf4ff', border: '#e9d5ff', text: '#7c3aed' },
  { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
  { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
  { bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1' },
  { bg: '#fafaf9', border: '#e7e5e4', text: '#44403c' },
];

/* 预设标签 */
export const PRESET_TAGS = ['优先级高', '待跟进', '已完成', '阻塞中', 'Bug', 'Feature', '文档', '重构'];

/* 获取标签颜色 */
export function getTagColor(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_COLOR_POOL[h % TAG_COLOR_POOL.length];
}