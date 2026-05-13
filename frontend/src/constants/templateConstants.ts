// 模板相关常量 - 前台和后台共享

// 分类标签（包含 emoji）
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

// 所有分类 ID 列表（不含 'all'）
export const CATEGORIES = [
  'engineering', 'design', 'paid-media', 'sales', 'marketing',
  'product', 'project-management', 'specialized', 'support',
  'testing', 'academic', 'integrations', 'strategy'
];

// 模板名称中文映射
export const TEMPLATE_NAME_CN: Record<string, string> = {
  // Engineering - 工程开发
  "AI Data Remediation Engineer": "AI 数据修复工程师",
  "AI Engineer": "AI 工程师",
  "API Tester": "API 测试工程师",
  "Backend Architect": "后端架构师",
  "CMS Developer": "CMS 开发工程师",
  "Code Reviewer": "代码审查员",
  "Database Optimizer": "数据库优化师",
  "Data Consolidation Agent": "数据整合智能体",
  "Data Engineer": "数据工程师",
  "DevOps Automator": "DevOps 自动化专家",
  "Developer Advocate": "开发者推广专家",
  "Embedded Firmware Engineer": "嵌入式固件工程师",
  "Frontend Developer": "前端开发工程师",
  "Git Workflow Master": "Git 工作流大师",
  "Infrastructure Maintainer": "基础设施维护工程师",
  "LSP/Index Engineer": "LSP/索引工程师",
  "MCP Builder": "MCP 构建工程师",
  "Mobile App Builder": "移动端开发工程师",
  "Rapid Prototyper": "快速原型师",
  "Security Engineer": "安全工程师",
  "Senior Developer": "高级开发工程师",
  "Software Architect": "软件架构师",
  "Solidity Smart Contract Engineer": "Solidity 智能合约工程师",
  "SRE (Site Reliability Engineer)": "站点可靠性工程师",
  "Technical Writer": "技术文档工程师",
  "Threat Detection Engineer": "威胁检测工程师",
  "WeChat Mini Program Developer": "微信小程序开发工程师",
  "Workflow Architect": "工作流架构师",
  "Workflow Optimizer": "工作流优化师",
  
  // Design - 设计创意
  "Image Prompt Engineer": "AI 图像提示词工程师",
  "Inclusive Visuals Specialist": "包容性视觉专家",
  "UI Designer": "UI 设计师",
  "UX Architect": "UX 架构师",
  "UX Researcher": "UX 研究员",
  "Visual Storyteller": "视觉叙事师",
  "Whimsy Injector": "趣味注入师",
  
  // Marketing - 营销推广
  "Baidu SEO Specialist": "百度 SEO 专员",
  "Bilibili Content Strategist": "B站内容策略师",
  "Content Creator": "内容创作者",
  "Douyin Strategist": "抖音策略师",
  "Growth Hacker": "增长黑客",
  "Instagram Curator": "Instagram 内容策展人",
  "Kuaishou Strategist": "快手策略师",
  "LinkedIn Content Creator": "LinkedIn 内容创作者",
  "Podcast Strategist": "播客策略师",
  "SEO Specialist": "SEO 专员",
  "Short-Video Editing Coach": "短视频剪辑教练",
  "Social Media Strategist": "社交媒体策略师",
  "TikTok Strategist": "TikTok 策略师",
  "Twitter Engager": "Twitter 互动专家",
  "Weibo Strategist": "微博策略师",
  "Xiaohongshu Specialist": "小红书专员",
  "Zhihu Strategist": "知乎策略师",
  
  // Paid Media - 付费媒体
  "Paid Media Auditor": "付费媒体审计师",
  "Paid Social Strategist": "付费社交策略师",
  "PPC Campaign Strategist": "PPC 广告策略师",
  "Programmatic & Display Buyer": "程序化与展示广告购买师",
  "Tracking & Measurement Specialist": "追踪与测量专员",
  
  // Sales - 销售推广
  "Account Strategist": "客户策略师",
  "Deal Strategist": "交易策略师",
  "Discovery Coach": "探索教练",
  "Outbound Strategist": "外呼策略师",
  "Sales Coach": "销售教练",
  "Sales Data Extraction Agent": "销售数据提取智能体",
  "Sales Engineer": "销售工程师",
  
  // Product - 产品管理
  "Product Manager": "产品经理",
  "Proposal Strategist": "提案策略师",
  "Sprint Prioritizer": "冲刺优先级分析师",
  
  // Project Management - 项目管理
  "Jira Workflow Steward": "Jira 工作流管理员",
  "Project Shepherd": "项目守护者",
  "Senior Project Manager": "高级项目经理",
  
  // Strategy - 策略规划
  "AI Citation Strategist": "AI 引用策略师",
  "Cultural Intelligence Strategist": "文化智能策略师",
  "Autonomous Optimization Architect": "自主优化架构师",
  "Behavioral Nudge Engine": "行为助推引擎",
  "Experiment Tracker": "实验追踪师",
  "Performance Benchmarker": "性能基准分析师",
  "Pipeline Analyst": "管道分析师",
  "Trend Researcher": "趋势研究员",
  
  // Testing - 测试验证
  "Accessibility Auditor": "无障碍审计师",
  "Compliance Auditor": "合规审计师",
  "Evidence Collector": "证据收集师",
  "Legal Compliance Checker": "法律合规检查师",
  "Model QA Specialist": "模型 QA 专员",
  "Reality Checker": "事实核查师",
  "Test Results Analyzer": "测试结果分析师",
  
  // Support - 支持服务
  "Document Generator": "文档生成智能体",
  "Executive Summary Generator": "执行摘要生成器",
  "Feedback Synthesizer": "反馈综合师",
  "Report Distribution Agent": "报告分发智能体",
  "Support Responder": "支持响应智能体",
  "Tool Evaluator": "工具评估师",
  
  // Academic - 学术研究
  "Anthropologist": "人类学家",
  "Geographer": "地理学家",
  "Historian": "历史学家",
  "Narratologist": "叙事学家",
  "Psychologist": "心理学家",
  "Study Abroad Advisor": "留学顾问",
  
  // Specialized - 专业领域
  "Accounts Payable Agent": "应付账款智能体",
  "Ad Creative Strategist": "广告创意策略师",
  "Agentic Identity & Trust Architect": "智能体身份与信任架构师",
  "Agents Orchestrator": "智能体编排师",
  "Analytics Reporter": "分析报告师",
  "App Store Optimizer": "应用商店优化师",
  "Automation Governance Architect": "自动化治理架构师",
  "Blockchain Security Auditor": "区块链安全审计师",
  "Book Co-Author": "书籍合著者",
  "Carousel Growth Engine": "轮播增长引擎",
  "China E-Commerce Operator": "中国电商运营师",
  "China Market Localization Strategist": "中国市场本地化策略师",
  "Civil Engineer": "土木工程师",
  "Corporate Training Designer": "企业培训设计师",
  "Cross-Border E-Commerce Specialist": "跨境电商专员",
  "Email Intelligence Engineer": "邮件智能工程师",
  "Feishu Integration Developer": "飞书集成开发工程师",
  "Filament Optimization Specialist": "Filament 优化专员",
  "Finance Tracker": "财务追踪师",
  "French Consulting Market Navigator": "法国咨询市场导航师",
  "Government Digital Presales Consultant": "政府数字化售前顾问",
  "Healthcare Marketing Compliance Specialist": "医疗营销合规专员",
  "Identity Graph Operator": "身份图谱操作师",
  "Incident Response Commander": "故障应急响应指挥官",
  "Korean Business Navigator": "韩国商务导航师",
  "Livestream Commerce Coach": "直播电商教练",
  "Private Domain Operator": "私域运营师",
  "Recruitment Specialist": "招聘专员",
  "Reddit Community Builder": "Reddit 社区建设师",
  "Salesforce Architect": "Salesforce 架构师",
  "Search Query Analyst": "搜索查询分析师",
  "Studio Operations": "工作室运营",
  "Studio Producer": "工作室制作人",
  "Supply Chain Strategist": "供应链策略师",
  "Video Optimization Specialist": "视频优化专员",
  "WeChat Official Account Manager": "微信公众号运营师",
  "ZK Steward": "ZK 管理师",
};