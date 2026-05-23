/**
 * constants.ts - AgentLibrary 常量定义与工具函数
 *
 * 包含：分类映射、专业领域/写作风格/输出格式映射、
 * Agent 类型标签，以及 cnName/cnDesc/templateCategoryToAgentType 工具函数。
 * 大型翻译字典已拆分到 translations.ts。
 */

import { TEMPLATE_DESC_CN } from "./translations";

// ==================== 分类中文映射 ====================

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

// ==================== 专业领域中文映射 ====================

export const EXPERTISE_CN: Record<string, string> = {
  "devops": "DevOps",
  "ai-ml": "AI/ML",
  "backend": "后端",
  "frontend": "前端",
  "security": "安全",
  "design": "设计",
  "product": "产品",
  "sales": "销售",
  "marketing": "营销",
  "testing": "测试",
  "data": "数据",
  "cloud": "云服务",
  "mobile": "移动端",
  "integration": "集成",
  "automation": "自动化",
  "compliance": "合规",
  "strategy": "策略",
  "academic": "学术",
  "database": "数据库",
  "engineering": "工程",
  "paid-media": "付费媒体",
  "project-management": "项目管理",
  "specialized": "专业",
  "support": "支持",
};

// ==================== 写作风格中文映射 ====================

export const WRITING_STYLE_CN: Record<string, string> = {
  "professional": "专业",
  "casual": "轻松",
  "technical": "技术",
  "creative": "创意",
  "concise": "简洁",
  "detailed": "详细",
};

// ==================== 输出格式中文映射 ====================

export const OUTPUT_FORMAT_CN: Record<string, string> = {
  "markdown": "Markdown",
  "json": "JSON",
  "text": "文本",
  "code": "代码",
  "report": "报告",
  "bullet-points": "要点列表",
};

// ==================== Agent 执行分类标签 ====================

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

// ==================== 工具函数 ====================

/** 获取模板中文名称（数据库已存储中文名称，直接返回） */
export function cnName(name: string): string {
  return name;
}

/** 获取模板中文描述，优先使用翻译映射 */
export function cnDesc(name: string, desc: string): string {
  return TEMPLATE_DESC_CN[name] || desc || "";
}

/** 将模板分类映射为 Agent 执行分类 */
export function templateCategoryToAgentType(category?: string): keyof typeof AGENT_TYPE_LABELS {
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
