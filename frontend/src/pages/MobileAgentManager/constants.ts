/**
 * MobileAgentManager 页面常量定义
 * 包含颜色样式常量和智能体类型选项映射
 */

/* ─────────────────────────────────────────────
 * 颜色常量
 * ───────────────────────────────────────────── */
export const COLORS = {
  bgPrimary: '#0f0f12',
  bgSecondary: '#1a1a1f',
  bgTertiary: '#252530',
  textPrimary: '#f5f5f7',
  textSecondary: '#a0a0a8',
  textMuted: '#6b6b75',
  border: '#353540',
  accent: '#6366f1',
  accentHover: '#7c7cf5',
  danger: '#f43f5e',
};

/* ─────────────────────────────────────────────
 * 智能体类型选项
 * ───────────────────────────────────────────── */
export const AGENT_TYPE_OPTIONS: Record<string, string> = {
  dev: '工程开发类',
  data: '数据分析类',
  creative: '内容生成类',
  pm: '项目管理类',
  research: '知识推理类',
  ops: '平台策略类',
  decision: '决策支持类',
  general: '通用助手类',
};
