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
        modelName: template.name,
      });
      setSuccessMsg(`✅ ${template.name} 已创建成功！前往智能体管理查看。`);
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
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">🎭 Agent 模板库</h1>
        <p className="text-sm text-muted-foreground mt-1">
          来自 agency-agents 的 100+ 专业 AI 角色，一键创建到你的平台
        </p>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {successMsg}
        </div>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            selectedCategory === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          全部 ({templates.length})
        </button>
        {categories.map((cat) => {
          const count = templates.filter((t) => t.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {CATEGORY_LABELS[cat] || cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Templates by category */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          暂无模板。运行导入脚本: npx tsx backend/src/scripts/import-agency-agents.ts
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <h2 className="text-lg font-semibold mb-3">
                {CATEGORY_LABELS[cat] || cat}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((t) => (
                  <div
                    key={t.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-card"
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
                          <h3 className="font-medium">{t.name}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-1">
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
                        className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {creating === t.id ? "创建中..." : "创建"}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {t.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {t.expertise.slice(0, 3).map((e) => (
                        <span
                          key={e}
                          className="px-2 py-0.5 text-xs bg-muted rounded-full"
                        >
                          {e}
                        </span>
                      ))}
                    </div>

                    {/* Expanded detail */}
                    {selectedTemplate?.id === t.id && (
                      <div className="mt-3 pt-3 border-t text-xs space-y-2">
                        <p className="text-muted-foreground">{t.systemPrompt.slice(0, 300)}...</p>
                        <div className="flex gap-2 text-muted-foreground">
                          <span>风格: {t.writingStyle}</span>
                          <span>输出: {t.outputFormat}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
