/**
 * MobileAgentLibrary 常量定义
 * 包含颜色样式、分类映射、写作风格、输出格式、智能体类型等常量
 */

/* ─────────────────────────────────────────────
 * 颜色样式常量
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
 * 分类中文映射
 * ───────────────────────────────────────────── */
export const CATEGORY_LABELS: Record<string, string> = {
  all: "全部模板",
  engineering: "💻 工程开发",
  design: "🎨 设计创意",
  "paid-media": "💰 付费媒体",
  sales: "💼 销售推广",
  marketing: "📢 营销推广",
  product: "📦 产品管理",
  "project-management": "📋 项目管理",
  specialized: "🔬 专业领域",
  support: "🛟 支持服务",
  testing: "🧪 测试验证",
  academic: "🎓 学术研究",
  integrations: "🔗 集成开发",
  strategy: "♟️ 策略规划",
};

/* ─────────────────────────────────────────────
 * 写作风格中文映射
 * ───────────────────────────────────────────── */
export const WRITING_STYLE_CN: Record<string, string> = {
  "professional": "专业",
  "casual": "轻松",
  "technical": "技术",
  "creative": "创意",
  "concise": "简洁",
  "detailed": "详细",
};

/* ─────────────────────────────────────────────
 * 输出格式中文映射
 * ───────────────────────────────────────────── */
export const OUTPUT_FORMAT_CN: Record<string, string> = {
  "markdown": "Markdown",
  "json": "JSON",
  "text": "文本",
  "code": "代码",
  "report": "报告",
  "bullet-points": "要点列表",
};

/* ─────────────────────────────────────────────
 * 智能体类型中文映射
 * ───────────────────────────────────────────── */
export const AGENT_TYPE_LABELS: Record<string, string> = {
  dev: '工程开发类',
  data: '数据分析类',
  creative: '内容生成类',
  pm: '项目管理类',
  research: '知识推理类',
  ops: '平台策略类',
  decision: '决策支持类',
  general: '通用助手类',
};
