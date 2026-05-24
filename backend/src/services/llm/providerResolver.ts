// [2026-05-18] 从 AutoLLMAdapter.ts 拆分出渠道解析逻辑
import { getDb } from '../../db/client';

export interface TokenChannel {
  id: string;
  provider: string;
  modelName: string;
  baseUrl: string;
  apiKey: string;
  authType: "Bearer" | "ApiKey" | "Basic";
  enabled: boolean;
  priority: number;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

// ─── Provider model map ───────────────────────────────────────────────────────

// OpenAI-compatible models that work with the standard /chat/completions endpoint
export const PROVIDER_MODEL_MAP: Record<string, string> = {
  openai: "gpt-4o",
  deepseek: "deepseek-chat",
  qwen: "qwen-max",
  anthropic: "claude-3-5-sonnet-20241022",
  azure: "gpt-4o",
  mistral: "mistral-large-latest",
  google: "gemini-1.5-pro",
  // 豆包 / 火山方舟
  doubao: "doubao-pro-32k-241215",
  volc: "doubao-pro-32k-241215",
  ark: "doubao-pro-32k-241215",
  // OpenClaw 底层
  openclaw: "auto",
};

// Providers that use non-OpenAI format (need special handling)
export const NON_OPENAI_PROVIDERS = new Set(["anthropic", "google"]);
// Providers that use OpenClawAdapter directly
export const OPENCLAW_PROVIDERS = new Set(["openclaw", "open-claw"]);

// ─── 从 model_providers 表加载渠道 ──────────────────────────────
// 替代旧的 token_channels,使用新的 model_providers/models 结构
export function loadProviders(): TokenChannel[] {
  try {
    const db = getDb();
    const result = db.exec(
      "SELECT id, name, base_url, api_format, api_key, enabled, priority FROM model_providers WHERE enabled=1 ORDER BY priority DESC, created_at ASC"
    );
    if (!result.length) return [];
    const cols = result[0].columns;
    return result[0].values.map((row: any[]) => {
      const obj: Record<string, unknown> = {}; // [2026-05-24] 类型安全：any → Record<string, unknown>
      cols.forEach((c: string, i: number) => (obj[c] = row[i]));
      return {
        id: obj.id,
        provider: obj.name,
        modelName: "",  // 从 models 表按 name 匹配
        baseUrl: obj.base_url || "",
        apiKey: obj.api_key || "",
        authType: "Bearer" as TokenChannel["authType"],
        enabled: !!obj.enabled,
        priority: obj.priority ?? 0,
      };
    });
  } catch {
    return [];
  }
}
