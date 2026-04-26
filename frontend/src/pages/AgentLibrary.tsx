import { useState, useEffect } from "react";
import { AgentTemplate } from "../types";
import { agentTemplatesApi } from "../api/agentTemplates";

// 分类中文映射
const CATEGORY_LABELS: Record<string, string> = {
  all: "全部",
  engineering: "💻 工程开发",
  design: "🎨 设计",
  "paid-media": "💰 付费媒体",
  sales: "💼 销售",
  marketing: "📢 营销",
  product: "📦 产品",
  "project-management": "📋 项目管理",
  specialized: "🔬 专业领域",
  support: "🛟 支持",
  testing: "🧪 测试",
  academic: "🎓 学术",
  integrations: "🔗 集成",
  strategy: "♟️ 策略",
};

// 模板名称中文映射（常用模板）
const TEMPLATE_NAME_CN: Record<string, string> = {
  // Engineering
  "Frontend Developer": "前端开发工程师",
  "Backend Architect": "后端架构师",
  "AI Engineer": "AI 工程师",
  "DevOps Automator": "DevOps 自动化专家",
  "Mobile App Builder": "移动端开发工程师",
  "Security Engineer": "安全工程师",
  "Database Optimizer": "数据库优化师",
  "Technical Writer": "技术文档工程师",
  "SRE": "站点可靠性工程师",
  "Code Reviewer": "代码审查员",
  "Data Engineer": "数据工程师",
  "Rapid Prototyper": "快速原型师",
  "Senior Developer": "高级开发工程师",
  "Software Architect": "软件架构师",
  "Incident Response Commander": "故障应急响应指挥官",
  "Git Workflow Master": "Git 工作流大师",
  "WeChat Mini Program Developer": "微信小程序开发工程师",
  "Embedded Firmware Engineer": "嵌入式固件工程师",
  "Solidity Smart Contract Engineer": "Solidity 智能合约工程师",
  "Threat Detection Engineer": "威胁检测工程师",
  "Filament Optimization Specialist": "Filament 优化专家",
  "Autonomous Optimization Architect": "自主优化架构师",
  "CMS Developer": "CMS 开发工程师",
  "Email Intelligence Engineer": "邮件智能分析工程师",
  "Feishu Integration Developer": "飞书集成开发工程师",
  "AI Data Remediation Engineer": "AI 数据修复工程师",
  // Design
  "UI Designer": "UI 设计师",
  "UX Researcher": "UX 研究员",
  "UX Architect": "UX 架构师",
  "Brand Guardian": "品牌守护者",
  "Visual Storyteller": "视觉叙事师",
  "Whimsy Injector": "趣味注入师",
  "Image Prompt Engineer": "AI 图像提示词工程师",
  "Inclusive Visuals Specialist": "包容性视觉专家",
  // Marketing
  "SEO Specialist": "SEO 专家",
  "Content Creator": "内容创作者",
  "Growth Hacker": "增长黑客",
  "Social Media Strategist": "社交媒体策略师",
  "TikTok Strategist": "TikTok 策略师",
  "Douyin Strategist": "抖音策略师",
  "Xiaohongshu Specialist": "小红书运营专家",
  "Bilibili Content Strategist": "B站内容策略师",
  "WeChat Official Account Manager": "微信公众号运营",
  "Weibo Strategist": "微博策略师",
  "Zhihu Strategist": "知乎策略师",
  "Kuaishou Strategist": "快手策略师",
  "Twitter Engager": "Twitter 互动专家",
  "Reddit Community Builder": "Reddit 社区建设师",
  "LinkedIn Content Creator": "LinkedIn 内容创作者",
  "Podcast Strategist": "播客策略师",
  "Livestream Commerce Coach": "直播带货教练",
  "Short-Video Editing Coach": "短视频剪辑教练",
  "App Store Optimizer": "应用商店优化师",
  "Baidu SEO Specialist": "百度 SEO 专家",
  "China Market Localization Strategist": "中国市场本地化策略师",
  "Cross-Border E-Commerce Specialist": "跨境电商专家",
  "Private Domain Operator": "私域运营专家",
  "China E-Commerce Operator": "中国电商运营",
  "Carousel Growth Engine": "轮播图增长引擎",
  "Video Optimization Specialist": "视频优化专家",
  "AI Citation Strategist": "AI 引用策略师",
  "Book Co-Author": "联合创作者",
  // Sales
  "Outbound Strategist": "外展策略师",
  "Discovery Coach": "需求挖掘教练",
  "Deal Strategist": "交易策略师",
  "Sales Engineer": "售前工程师",
  "Proposal Strategist": "方案策略师",
  "Pipeline Analyst": "销售管道分析师",
  "Account Strategist": "客户策略师",
  "Sales Coach": "销售教练",
  // Product
  "Product Manager": "产品经理",
  "Sprint Prioritizer": "迭代优先级规划师",
  "Trend Researcher": "趋势研究员",
  "Feedback Synthesizer": "用户反馈整合师",
  "Behavioral Nudge Engine": "行为引导引擎",
  // Specialized
  "Developer Advocate": "开发者关系倡导者",
  "Document Generator": "文档生成器",
  "Model QA Specialist": "模型 QA 专家",
  "MCP Builder": "MCP 构建师",
  "Salesforce Architect": "Salesforce 架构师",
  "Workflow Architect": "工作流架构师",
  "Agents Orchestrator": "智能体编排师",
  "Compliance Auditor": "合规审计师",
  "Recruitment Specialist": "招聘专家",
  "Blockchain Security Auditor": "区块链安全审计师",
  "Civil Engineer": "土木工程师",
  "Cultural Intelligence Strategist": "文化情报策略师",
  "Supply Chain Strategist": "供应链策略师",
  "Study Abroad Advisor": "留学顾问",
  "Government Digital Presales Consultant": "政务数字化售前顾问",
  "Healthcare Marketing Compliance Specialist": "医疗营销合规专家",
  "Corporate Training Designer": "企业培训设计师",
  "French Consulting Market Navigator": "法国咨询市场顾问",
  "Korean Business Navigator": "韩国商务顾问",
  "ZK Steward": "零知识证明管家",
  "Identity Graph Operator": "身份图谱运营",
  "Agentic Identity & Trust Architect": "智能体身份与信任架构师",
  "Automation Governance Architect": "自动化治理架构师",
  "Data Consolidation Agent": "数据整合专家",
  "LSP/Index Engineer": "语言服务器协议工程师",
  "Report Distribution Agent": "报告分发专家",
  "Sales Data Extraction Agent": "销售数据提取专家",
  "Accounts Payable Agent": "应付账款专员",
  // Support
  "Support Responder": "客服响应专员",
  "Analytics Reporter": "数据分析报告员",
  "Executive Summary Generator": "执行摘要生成器",
  "Finance Tracker": "财务追踪员",
  "Infrastructure Maintainer": "基础设施维护员",
  "Legal Compliance Checker": "法律合规检查员",
  // Testing
  "API Tester": "API 测试员",
  "Accessibility Auditor": "无障碍审计员",
  "Performance Benchmarker": "性能基准测试员",
  "Reality Checker": "现实核查员",
  "Tool Evaluator": "工具评估员",
  "Evidence Collector": "证据收集员",
  "Test Results Analyzer": "测试结果分析师",
  "Workflow Optimizer": "工作流优化员",
  // Academic
  "Anthropologist": "人类学家",
  "Historian": "历史学家",
  "Psychologist": "心理学家",
  "Geographer": "地理学家",
  "Narratologist": "叙事学家",
};

// 描述中文翻译（通用模板）
const TEMPLATE_DESC_CN: Record<string, string> = {
  "Frontend Developer": "构建响应式、可访问的现代 Web 应用，精通 React/Vue/Angular 框架和性能优化",
  "Backend Architect": "设计可扩展的 API、微服务和数据库架构，构建稳健的后端系统",
  "AI Engineer": "开发机器学习功能、数据管道和 AI 驱动的应用程序",
  "DevOps Automator": "CI/CD 流水线、基础设施自动化、云运维和监控",
  "Security Engineer": "威胁建模、安全代码审查、安全架构和漏洞评估",
  "UI Designer": "视觉设计、组件库、设计系统和品牌一致性",
  "UX Researcher": "用户测试、行为分析和设计洞察",
  "Product Manager": "产品战略、路线图规划、需求分析和团队协作",
  "SEO Specialist": "搜索引擎优化、关键词策略、技术 SEO 和排名提升",
  "Content Creator": "内容策划、文案撰写、多平台内容分发",
  "Growth Hacker": "数据驱动的增长策略、A/B 测试和用户获取",
  "SRE": "SLO 管理、错误预算、可观测性、混沌工程和生产可靠性",
  "Code Reviewer": "建设性代码审查、安全性评估和可维护性建议",
  "Database Optimizer": "Schema 设计、查询优化、索引策略和慢查询调试",
  "Technical Writer": "开发者文档、API 参考、教程和技术写作",
};

function cnName(name: string): string {
  return TEMPLATE_NAME_CN[name] || name;
}

function cnDesc(name: string, desc: string): string {
  return TEMPLATE_DESC_CN[name] || desc || "";
}

export default function AgentLibrary() {
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const [cats, temps] = await Promise.all([
        agentTemplatesApi.categories(),
        agentTemplatesApi.list(),
      ]);
      setCategories(cats);
      setTemplates(temps);
    } catch (err) {
      console.error("加载模板失败:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(template: AgentTemplate) {
    setCreating(template.id);
    try {
      await agentTemplatesApi.createFromTemplate(template.id, {
        name: cnName(template.name),
        modelName: template.name,
      });
      setSuccessMsg(`✅ ${cnName(template.name)} 已创建成功！前往智能体管理查看。`);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      alert(`创建失败: ${err.message}`);
    } finally {
      setCreating(null);
    }
  }

  const filtered =
    selectedCategory === "all"
      ? templates
      : templates.filter((t) => t.category === selectedCategory);

  // 按分类分组
  const grouped: Record<string, AgentTemplate[]> = {};
  filtered.forEach((t) => {
    if (!grouped[t.category]) grouped[t.category] = [];
    grouped[t.category].push(t);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载 Agent 模板库...</div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "24px 32px", background: "var(--body-bg)" }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>🎭 Agent 模板库</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)", marginTop: 4 }}>
            来自 agency-agents 的 136 个专业 AI 角色，一键创建到你的平台
          </p>
        </div>

        {/* Success message */}
        {successMsg && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a" }}>
            {successMsg}
          </div>
        )}

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedCategory("all")}
            className="px-3 py-1.5 text-sm rounded-full transition-colors"
            style={{
              background: selectedCategory === "all" ? "var(--accent)" : "var(--muted)",
              color: selectedCategory === "all" ? "#fff" : "var(--text-secondary)",
              fontWeight: selectedCategory === "all" ? 600 : 400,
            }}
          >
            全部 ({templates.length})
          </button>
          {categories.map((cat) => {
            const count = templates.filter((t) => t.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="px-3 py-1.5 text-sm rounded-full transition-colors"
                style={{
                  background: selectedCategory === cat ? "var(--accent)" : "var(--muted)",
                  color: selectedCategory === cat ? "#fff" : "var(--text-secondary)",
                  fontWeight: selectedCategory === cat ? 600 : 400,
                }}
              >
                {CATEGORY_LABELS[cat] || cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Templates by category */}
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
            暂无模板
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                  {CATEGORY_LABELS[cat] || cat}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((t) => {
                    const displayName = cnName(t.name);
                    const displayDesc = cnDesc(t.name, t.description);
                    return (
                      <div
                        key={t.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-card"
                        style={{ border: "1px solid #e5e7eb", background: "#fff" }}
                        onClick={() =>
                          setSelectedTemplate(
                            selectedTemplate?.id === t.id ? null : t
                          )
                        }
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{t.emoji}</span>
                            <div>
                              <h3 className="font-medium" style={{ color: "var(--text-primary)", fontSize: 14 }}>
                                {displayName}
                              </h3>
                              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                {t.vibe}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreate(t);
                            }}
                            disabled={creating === t.id}
                            className="px-3 py-1 text-xs rounded transition-opacity"
                            style={{
                              background: "var(--accent)",
                              color: "#fff",
                              opacity: creating === t.id ? 0.5 : 1,
                              cursor: creating === t.id ? "not-allowed" : "pointer",
                            }}
                          >
                            {creating === t.id ? "创建中..." : "创建"}
                          </button>
                        </div>
                        <p className="text-xs mt-2 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                          {displayDesc}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {t.expertise.slice(0, 3).map((e) => (
                            <span
                              key={e}
                              className="px-2 py-0.5 text-xs rounded-full"
                              style={{ background: "var(--muted)", fontSize: 11 }}
                            >
                              {e}
                            </span>
                          ))}
                        </div>

                        {/* Expanded detail */}
                        {selectedTemplate?.id === t.id && (
                          <div className="mt-3 pt-3 border-t text-xs space-y-2" style={{ borderTop: "1px solid #e5e7eb" }}>
                            <p style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                              {t.systemPrompt.slice(0, 300)}...
                            </p>
                            <div className="flex gap-2" style={{ color: "var(--text-muted)" }}>
                              <span>风格: {t.writingStyle}</span>
                              <span>输出: {t.outputFormat}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
