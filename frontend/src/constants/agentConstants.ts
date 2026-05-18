// [2026-05-18] 智能体创建共享常量 — PC端和移动端统一引用
// 避免两端各自维护重复的常量定义

/** 智能体类型选项（RC 执行分类） */
export const AGENT_TYPE_OPTIONS = [
  { value: 'dev', id: 'dev', label: '工程开发类', desc: '对应 rc-dev-agent' },
  { value: 'data', id: 'data', label: '数据分析类', desc: '对应 rc-data-agent' },
  { value: 'creative', id: 'creative', label: '内容生成类', desc: '对应 rc-creative-agent' },
  { value: 'pm', id: 'pm', label: '项目管理类', desc: '对应 rc-pm-agent' },
  { value: 'research', id: 'research', label: '知识推理类', desc: '对应 rc-research-agent' },
  { value: 'ops', id: 'ops', label: '平台策略类', desc: '对应 rc-ops-agent' },
  { value: 'decision', id: 'decision', label: '决策支持类', desc: '对应 rc-decision-agent' },
  { value: 'general', id: 'general', label: '通用助手类', desc: '对应 rc-general-agent' },
] as const;

/** 语言风格标签 */
export const STYLE_TAGS = ['极简简洁', '详细全面', '口语化', '正式专业'];

/** 输出格式选项 */
export const OUTPUT_TAGS = ['纯文本', 'Markdown', 'Markdown+完整代码', '结构化JSON'];

/** 可见性选项 */
export const VISIBILITY_OPTIONS = [
  { id: 'private' as const, label: '私有', desc: '仅自己可见' },
  { id: 'public' as const, label: '公开', desc: '所有用户可见' },
  { id: 'template' as const, label: '模板', desc: '作为模板使用' },
];

/** 技能权限配置 */
export const SKILL_OPTIONS = [
  { id: 'web_search', label: '网络搜索', default: true },
  { id: 'file_read', label: '文件读取', default: true },
  { id: 'exec', label: '命令执行', default: false },
  { id: 'shell', label: 'Shell', default: false },
  { id: 'file_write', label: '文件写入', default: false },
  { id: 'browser', label: '浏览器', default: false },
  { id: 'image_generation', label: '图片生成', default: false },
];

/** 可用模型列表（Tab 模型切换 + 移动端创建） */
export const AVAILABLE_MODELS = [
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', provider: 'anthropic' },
  { id: 'glm-5', label: 'GLM-5', provider: 'zhipu' },
  { id: 'glm-5.1', label: 'GLM-5.1', provider: 'zhipu' },
  { id: 'qwen3-max-2026-01-23', label: 'Qwen3 Max', provider: 'alibaba' },
  { id: 'qwen3.6-plus', label: 'Qwen3.6 Plus', provider: 'alibaba' },
  { id: 'kimi-k2.5', label: 'Kimi K2.5', provider: 'moonshot' },
  { id: 'minimax-m2.5', label: 'MiniMax M2.5', provider: 'minimax' },
  { id: 'doubao-pro-32k', label: 'Doubao Pro 32K', provider: 'doubao' },
  { id: 'qwen-max', label: 'Qwen Max', provider: 'alibaba' },
  { id: 'auto', label: '自动选择', provider: 'auto' },
];

/** 颜色选项（移动端智能体创建） */
export const COLOR_OPTIONS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#3b82f6', '#a855f7', '#64748b',
];
