/**
 * AutoLLMConfig — 提供商映射、Skills 注入、System Prompt 构建、渠道加载
 */
import { getDb } from "../../../db/client";
import { TokenChannel } from "./utils";

// OpenAI-compatible models that work with the standard /chat/completions endpoint
export const PROVIDER_MODEL_MAP: Record<string, string> = {
  openai: "gpt-4o",
  deepseek: "deepseek-chat",
  qwen: "qwen-max",
  anthropic: "claude-3-5-sonnet-20241022",
  azure: "gpt-4o",
  mistral: "mistral-large-latest",
  google: "gemini-1.5-pro",
  doubao: "doubao-pro-32k-241215",
  volc: "doubao-pro-32k-241215",
  ark: "doubao-pro-32k-241215",
  openclaw: "auto",
};

export const NON_OPENAI_PROVIDERS = new Set(["anthropic", "google"]);
export const OPENCLAW_PROVIDERS = new Set(["openclaw", "open-claw"]);

/**
 * Load enabled skills bound to an agent and return a formatted prompt block.
 */
export function loadAgentSkillsPrompt(agentId: string): string {
  try {
    const db = getDb();
    const result = db.exec(
      `SELECT s.name, s.description, s.category
       FROM skills s
       INNER JOIN agent_skills a ON a.skill_id = s.id
       WHERE a.agent_id = ? AND s.enabled = 1
       ORDER BY a.bound_at ASC`,
      [agentId]
    );
    if (!result.length || !result[0].values.length) return "";

    const cols = result[0].columns;
    const skills = result[0].values.map((row) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((c, i) => (obj[c] = row[i]));
      return obj;
    });

    const lines = skills.map(
      (s: unknown) => `- 【${(s as Record<string, unknown>).name}】(${(s as Record<string, unknown>).category}):${(s as Record<string, unknown>).description}`
    );
    return `\n\n## 可用技能\n你拥有以下技能,可在回答中酌情说明或使用:\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

/**
 * 从 model_providers 表加载渠道
 */
export function loadProviders(): TokenChannel[] {
  try {
    const db = getDb();
    const result = db.exec(
      "SELECT id, name, base_url, api_format, api_key, enabled, priority FROM model_providers WHERE enabled=1 ORDER BY priority DESC, created_at ASC"
    );
    if (!result.length) return [];
    const cols = result[0].columns;
    return result[0].values.map((row) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((c, i) => (obj[c] = row[i]));
      return {
        id: obj.id as string,
        provider: obj.name as string,
        modelName: "",
        baseUrl: (obj.base_url as string) || "",
        apiKey: (obj.api_key as string) || "",
        authType: "Bearer" as TokenChannel["authType"],
        enabled: !!obj.enabled,
        priority: (obj.priority as number) ?? 0,
      };
    });
  } catch {
    return [];
  }
}

/**
 * 构建完整的 system prompt（含风格、领域、输出格式、能力边界、Skills）
 */
export function buildSystemPrompt(agent: {
  id: string; name: string; systemPrompt: string; writingStyle: string;
  expertise: string[]; outputFormat?: string; boundary?: string;
}): string {
  const parts: string[] = [];
  if (agent.systemPrompt) parts.push(agent.systemPrompt);
  if (agent.writingStyle) parts.push(`写作风格:${agent.writingStyle}`);
  if (agent.expertise?.length) parts.push(`专业领域:${agent.expertise.join("、")}`);
  parts.push(`你的名字是 ${agent.name},请始终以第一人称回复。`);

  if (agent.outputFormat && agent.outputFormat !== "纯文本") {
    const fmtMap: Record<string, string> = {
      "代码优先": "回复时优先以代码块展示实现,代码后补充简要说明。",
      "预览+完整代码": `回答涉及代码时,必须严格按以下结构输出,不得省略任何部分:

【格式规范】
1. 先用 <!-- PREVIEW_START --> 和 <!-- PREVIEW_END --> 包裹"预览说明"区块。
2. 再用 <!-- CODE_START --> 和 <!-- CODE_END --> 包裹完整可运行代码块。

【重要】:如果回复不涉及代码,则正常回复即可。`,
      "结构化JSON": "所有回复以合法 JSON 格式输出,键名使用英文 camelCase。",
    };
    const fmtHint = fmtMap[agent.outputFormat] ?? `输出格式:${agent.outputFormat}`;
    parts.push(`## 输出格式要求\n${fmtHint}`);
  }

  if (agent.boundary?.trim()) {
    parts.push(`## 能力边界\n以下事项你不应处理,如用户要求请礼貌拒绝并说明原因:\n${agent.boundary.trim()}`);
  }

  const skillsPrompt = loadAgentSkillsPrompt(agent.id);
  if (skillsPrompt) parts.push(skillsPrompt);

  return parts.join("\n\n");
}
