/**
 * MobileAgentCreate 常量定义
 * 包含颜色选项、智能体类型、模型列表、可见性、技能配置及样式常量
 */

/* ─────────────────────────────────────────────
 * 颜色选项
 * ───────────────────────────────────────────── */
export const COLOR_OPTIONS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#3b82f6', '#a855f7', '#64748b',
];

/* ─────────────────────────────────────────────
 * 智能体类型选项
 * ───────────────────────────────────────────── */
export const AGENT_TYPE_OPTIONS = [
  { id: 'dev',      label: '开发/工程类' },
  { id: 'data',     label: '数据分析类' },
  { id: 'creative', label: '内容/创作类' },
  { id: 'pm',       label: '产品/管理类' },
  { id: 'research', label: 'AI/研究类' },
  { id: 'ops',      label: '运营类' },
  { id: 'decision', label: '决策类' },
  { id: 'general',  label: '通用/助手类' },
];

/* ─────────────────────────────────────────────
 * 输出格式选项（对齐PC端 AgentCreate.tsx 第26行）
 * ───────────────────────────────────────────── */
export const OUTPUT_TAGS = ['纯文本', 'Markdown', 'Markdown+完整代码', '结构化JSON'];

/* ─────────────────────────────────────────────
 * 可用模型列表
 * ───────────────────────────────────────────── */
export const AVAILABLE_MODELS = [
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { id: 'glm-5',           label: 'GLM-5' },
  { id: 'glm-5.1',         label: 'GLM-5.1' },
  { id: 'qwen3-max-2026-01-23', label: 'Qwen3 Max' },
  { id: 'qwen3.6-plus',    label: 'Qwen3.6 Plus' },
  { id: 'kimi-k2.5',       label: 'Kimi K2.5' },
  { id: 'minimax-m2.5',    label: 'MiniMax M2.5' },
  { id: 'doubao-pro-32k',  label: 'Doubao Pro 32K' },
  { id: 'qwen-max',        label: 'Qwen Max' },
];

/* ─────────────────────────────────────────────
 * 可见性选项
 * ───────────────────────────────────────────── */
export const VISIBILITY_OPTIONS = [
  { id: 'private' as const, label: '私有', desc: '仅自己可见' },
  { id: 'public' as const, label: '公开', desc: '所有用户可见' },
  { id: 'template' as const, label: '模板', desc: '作为模板使用' },
];

/* ─────────────────────────────────────────────
 * 技能权限配置
 * ───────────────────────────────────────────── */
export const SKILL_OPTIONS = [
  { id: 'web_search', label: '网络搜索', default: true },
  { id: 'file_read', label: '文件读取', default: true },
  { id: 'exec', label: '命令执行', default: false },
  { id: 'shell', label: 'Shell', default: false },
  { id: 'file_write', label: '文件写入', default: false },
  { id: 'browser', label: '浏览器', default: false },
  { id: 'image_generation', label: '图片生成', default: false },
];

/* ─────────────────────────────────────────────
 * 颜色常量（样式）
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
