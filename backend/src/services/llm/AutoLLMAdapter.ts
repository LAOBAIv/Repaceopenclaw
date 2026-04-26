/**
 * AutoLLMAdapter - Auto 模型智能路由器
 *
 * 工作原理:
 * 1. 从 token_channels 表读取所有已启用、有 api_key 的渠道
 * 2. 按 priority 排序,依次尝试调用(主要优先级逻辑见下)
 * 3. 优先选择:有 api_key > priority 高 > 上下文长(支持长对话)
 * 4. 任一渠道调用成功即结束;失败则自动 fallback 到下一个
 * 5. 所有渠道均失败时降级到 MockLLMAdapter 保底输出
 *
 * 上下文截断:
 * - 使用简单字符数估算 token(1 token ≈ 4 字符,中文 ≈ 2 字符/token)
 * - 保留 system message 全文 + 尽可能多的最新消息
 * - 默认 context budget = maxTokens * CONTEXT_MULTIPLIER(可配置)
 *
 * Skills 注入:
 * - 调用前查询 agent_skills 表,将已绑定且启用的技能描述追加到 system prompt
 *
 * 调用格式:OpenAI Chat Completions API(兼容 DeepSeek / Qwen / Azure 等)
 */

import { ILLMAdapter } from "./LLMAdapter";
import { logger } from '../../utils/logger';
import { MockLLMAdapter } from "./MockLLMAdapter";
import { getDb } from "../../db/client";
import https from "https";
import http from "http";
import { URL } from "url";

// ─── Gateway 配置(底层模型调用统一走 Gateway)─────────────────────────────
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';

/** 判断是否是 Gateway 地址 */
function isGatewayUrl(baseUrl: string): boolean {
  const normalized = baseUrl.replace(/\/$/, '');
  return normalized === GATEWAY_URL.replace(/\/$/, '');
}

interface TokenChannel {
  id: string;
  provider: string;
  modelName: string;
  baseUrl: string;
  apiKey: string;
  authType: "Bearer" | "ApiKey" | "Basic";
  enabled: boolean;
  priority: number;
}

interface AgentConfig {
  id: string;
  name: string;
  systemPrompt: string;
  writingStyle: string;
  expertise: string[];
  modelName?: string;
  modelProvider?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  // 用户私有 Token
  tokenProvider?: string;
  tokenApiKey?: string;
  tokenBaseUrl?: string;
  // 输出格式 & 能力边界
  outputFormat?: string;
  boundary?: string;
  // 对话记忆轮数(0 = 不限)
  memoryTurns?: number;
  // 简单温度快捷覆盖(null 表示使用模型默认)
  temperatureOverride?: number | null;
}

// ─── Context window budget ────────────────────────────────────────────────────
// How many "response tokens" to multiply by to get the context budget.
// e.g. maxTokens=4096, CONTEXT_MULTIPLIER=3 → contextBudget ≈ 12 288 tokens for the prompt.
// This leaves room for the model output.
const CONTEXT_MULTIPLIER = 3;

/**
 * Estimate token count for a string.
 * Heuristic: ASCII chars ≈ 0.25 token/char; CJK chars ≈ 0.5 token/char.
 * Accurate within ~20 % for mixed Chinese/English text - good enough for budget control.
 */
function estimateTokens(text: string): number {
  let tokens = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // CJK Unified Ideographs + common CJK blocks
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0x3000 && code <= 0x303f) ||  // CJK symbols
      (code >= 0xff00 && code <= 0xffef)     // fullwidth forms
    ) {
      tokens += 0.5; // ~2 CJK chars per token
    } else {
      tokens += 0.25; // ~4 ASCII chars per token
    }
  }
  return Math.ceil(tokens);
}

/**
 * Truncate messages to fit within the context budget (token count).
 *
 * Strategy:
 *  1. Always keep system message at full length.
 *  2. Always keep the last (most recent) user message.
 *  3. Fill in older messages from newest → oldest until budget is exhausted.
 *
 * @param systemPrompt  The system prompt string (counted separately).
 * @param messages      The full conversation history (user/assistant turns).
 * @param maxTokens     The model's max_tokens (response budget).
 * @returns             Truncated messages array.
 */
function truncateMessages(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
): Array<{ role: string; content: string }> {
  const contextBudget = maxTokens * CONTEXT_MULTIPLIER;
  const systemTokens = estimateTokens(systemPrompt);
  let remaining = contextBudget - systemTokens - maxTokens; // reserve space for response

  if (remaining <= 0) {
    // System prompt alone eats most of the budget - just pass last user message
    const last = messages[messages.length - 1];
    return last ? [last] : [];
  }

  // Walk from newest to oldest, accumulating messages that fit
  const kept: Array<{ role: string; content: string }> = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const cost = estimateTokens(msg.content) + 4; // ~4 tokens overhead per message
    if (remaining - cost < 0 && kept.length > 0) {
      // Would overflow, but we already have at least 1 message - stop here
      break;
    }
    kept.unshift(msg);
    remaining -= cost;
    if (remaining <= 0) break;
  }

  if (kept.length === 0 && messages.length > 0) {
    // Always keep at least the last message to avoid empty requests
    kept.push(messages[messages.length - 1]);
  }

  const dropped = messages.length - kept.length;
  if (dropped > 0) {
    logger.info(`[AutoLLMAdapter] Context truncated: dropped ${dropped} oldest message(s) to fit ~${contextBudget} token budget`);
  }

  return kept;
}

// ─── Skills injection ─────────────────────────────────────────────────────────

/**
 * Load enabled skills bound to an agent and return a formatted prompt block.
 * Returns empty string if agent has no bound/enabled skills.
 */
function loadAgentSkillsPrompt(agentId: string): string {
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
      const obj: any = {};
      cols.forEach((c, i) => (obj[c] = row[i]));
      return obj;
    });

    const lines = skills.map(
      (s: any) => `- 【${s.name}】(${s.category}):${s.description}`
    );
    return `\n\n## 可用技能\n你拥有以下技能,可在回答中酌情说明或使用:\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

// ─── Provider model map ───────────────────────────────────────────────────────

// OpenAI-compatible models that work with the standard /chat/completions endpoint
const PROVIDER_MODEL_MAP: Record<string, string> = {
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
const NON_OPENAI_PROVIDERS = new Set(["anthropic", "google"]);
// Providers that use OpenClawAdapter directly
const OPENCLAW_PROVIDERS = new Set(["openclaw", "open-claw"]);

// ─── 从 model_providers 表加载渠道 ──────────────────────────────
// 替代旧的 token_channels,使用新的 model_providers/models 结构
function loadProviders(): TokenChannel[] {
  try {
    const db = getDb();
    const result = db.exec(
      "SELECT id, name, base_url, api_format, api_key, enabled, priority FROM model_providers WHERE enabled=1 ORDER BY priority DESC, created_at ASC"
    );
    if (!result.length) return [];
    const cols = result[0].columns;
    return result[0].values.map((row) => {
      const obj: any = {};
      cols.forEach((c, i) => (obj[c] = row[i]));
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

function buildSystemPrompt(agent: AgentConfig): string {
  const parts: string[] = [];
  if (agent.systemPrompt) parts.push(agent.systemPrompt);
  if (agent.writingStyle) parts.push(`写作风格:${agent.writingStyle}`);
  if (agent.expertise?.length) parts.push(`专业领域:${agent.expertise.join("、")}`);
  parts.push(`你的名字是 ${agent.name},请始终以第一人称回复。`);

  // 输出格式要求
  if (agent.outputFormat && agent.outputFormat !== "纯文本") {
    const fmtMap: Record<string, string> = {
      "代码优先":
        "回复时优先以代码块展示实现,代码后补充简要说明。",
      "预览+完整代码":
        `回答涉及代码时,必须严格按以下结构输出,不得省略任何部分:

【格式规范】
1. 先用 <!-- PREVIEW_START --> 和 <!-- PREVIEW_END --> 包裹"预览说明"区块,内容包括:功能描述、使用方式、运行效果说明(如有 HTML/UI 可描述视觉效果)。
2. 再用 <!-- CODE_START --> 和 <!-- CODE_END --> 包裹完整可运行代码块,代码必须完整,不得省略任何部分。

【示例格式】
<!-- PREVIEW_START -->
这是一个实现 XX 功能的组件,运行后会显示 XX 效果,点击按钮可以 XX。
<!-- PREVIEW_END -->

<!-- CODE_START -->
\`\`\`语言
完整代码...
\`\`\`
<!-- CODE_END -->

【重要】:如果回复不涉及代码,则正常回复即可,不需要使用上述标记。`,
      "结构化JSON":
        "所有回复以合法 JSON 格式输出,键名使用英文 camelCase。",
    };
    const fmtHint = fmtMap[agent.outputFormat] ?? `输出格式:${agent.outputFormat}`;
    parts.push(`## 输出格式要求\n${fmtHint}`);
  }

  // 能力边界
  if (agent.boundary?.trim()) {
    parts.push(`## 能力边界\n以下事项你不应处理,如用户要求请礼貌拒绝并说明原因:\n${agent.boundary.trim()}`);
  }

  // 注入该智能体已绑定且启用的技能描述
  const skillsPrompt = loadAgentSkillsPrompt(agent.id);
  if (skillsPrompt) parts.push(skillsPrompt);

  return parts.join("\n\n");
}

/**
 * 调用 OpenAI-compatible streaming API
 * 返回 Promise<number> 表示本次调用实际消耗的 token 数(来自 usage 字段,无则返回 0)
 * 抛出 Error 表示调用失败
 */
function callOpenAIStream(
  baseUrl: string,
  apiKey: string,
  authType: string,
  modelId: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  maxTokens: number,
  topP: number,
  frequencyPenalty: number,
  presencePenalty: number,
  onChunk: (chunk: string) => void,
  onComplete: (tokenCount: number) => void,
  signal: AbortController
): Promise<number> {
  return new Promise((resolve, reject) => {
    // ── Gateway 路由:通过 Gateway 进行底层模型调用 ──
    const useGateway = isGatewayUrl(baseUrl);
    const actualUrl = new URL(useGateway ? `${GATEWAY_URL.replace(/\/$/, '')}/v1/chat/completions` : `${baseUrl.replace(/\/$/, '')}/chat/completions`);
    const actualModel = useGateway ? 'openclaw' : modelId;
    const actualAuth = useGateway ? `Bearer ${GATEWAY_TOKEN}` : (authType === "ApiKey" ? apiKey : `Bearer ${apiKey}`);

    if (useGateway) {
      logger.info(`[Auto→Gateway] Routing: ${modelId} → Gateway(openclaw)`);
    }

    const bodyObj: any = {
      model: actualModel,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: false,
      temperature,
      max_tokens: maxTokens,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
    };
    // Claude 不支持 top_p + temperature 同时指定
    if (!modelId.includes('claude') && !modelId.includes('Claude')) {
      bodyObj.top_p = topP;
    }
    const body = JSON.stringify(bodyObj);

    const options = {
      hostname: actualUrl.hostname,
      port: actualUrl.port || (actualUrl.protocol === "https:" ? 443 : 80),
      path: actualUrl.pathname + actualUrl.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Authorization: actualAuth,
      },
    };

    // Remove undefined headers
    Object.keys(options.headers).forEach(
      (k) => (options.headers as any)[k] === undefined && delete (options.headers as any)[k]
    );

    const lib = actualUrl.protocol === "https:" ? https : http;
    const req = lib.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        let errBody = "";
        res.on("data", (d: Buffer) => (errBody += d.toString()));
        res.on("end", () =>
          reject(new Error(`HTTP ${res.statusCode}: ${errBody.slice(0, 200)}`))
        );
        return;
      }

      let body = "";

      res.on("data", (data: Buffer) => {
        body += data.toString();
      });

      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          const content = json.choices?.[0]?.message?.content || "";
          const totalTokens = json.usage?.total_tokens || 0;

          logger.info('[AutoLLM] Raw response: ' + JSON.stringify(json).substring(0, 300));
          logger.info(`[AutoLLM] Response: ${content.length} chars, ${totalTokens} tokens`);

          // 模拟流式：逐段发送内容
          if (content) {
            const chunkSize = 20;
            for (let i = 0; i < content.length; i += chunkSize) {
              onChunk(content.substring(i, i + chunkSize));
            }
          }

          onComplete(totalTokens);
          resolve(totalTokens);
        } catch (e: any) {
          reject(new Error(`Response parse error: ${e.message}. Body: ${body.slice(0, 200)}`));
        }
      });

      res.on("error", reject);
    });

    req.on("error", reject);

    signal.signal.addEventListener("abort", () => {
      req.destroy();
      reject(new Error("Aborted"));
    });

    req.write(body);
    req.end();
  });
}

const mockFallback = new MockLLMAdapter();

export class AutoLLMAdapter implements ILLMAdapter {
  async generateStream(
    agentConfig: AgentConfig,
    messages: Array<{ role: string; content: string }>,
    onChunk: (chunk: string) => void,
    onComplete: (tokenCount: number) => void,
    onError: (err: Error) => void
  ): Promise<void> {
    const systemPrompt = buildSystemPrompt(agentConfig);
    // temperatureOverride 优先于 agentConfig.temperature(来自 CODE 弹窗的 customTemp)
    const temperature =
      agentConfig.temperatureOverride != null
        ? agentConfig.temperatureOverride
        : (agentConfig.temperature ?? 0.7);
    const maxTokens = agentConfig.maxTokens ?? 4096;
    const topP = agentConfig.topP ?? 1;
    const frequencyPenalty = agentConfig.frequencyPenalty ?? 0;
    const presencePenalty = agentConfig.presencePenalty ?? 0;

    // ── 上下文截断:将过长的历史消息裁剪到 token 预算内 ──────────────────
    // 若配置了 memoryTurns(> 0),先按轮数截断(1 轮 = 1 user + 1 assistant);
    // 再按 token budget 截断(两者取更严格的那个)。
    let msgsToTruncate = messages;
    const memTurns = agentConfig.memoryTurns ?? 0;
    if (memTurns > 0) {
      // 1 轮 = 1 user + 1 assistant,共 2 条
      // 但 history 末尾通常是当前用户消息(尚无 assistant 回复),所以实际条数是 memTurns*2 + 1
      // 为保证末尾 user 消息始终被保留,取后 memTurns*2+1 条,再做对齐修正
      const maxMsgs = memTurns * 2 + 1;
      if (msgsToTruncate.length > maxMsgs) {
        msgsToTruncate = msgsToTruncate.slice(-maxMsgs);
        logger.info(`[AutoLLMAdapter] Memory turns limit: keeping last ${memTurns} turns (${maxMsgs} messages)`);
      }
      // 确保截断后第一条是 user 消息(若开头是 assistant 则去掉,避免 role 顺序异常)
      if (msgsToTruncate.length > 0 && msgsToTruncate[0].role !== "user") {
        msgsToTruncate = msgsToTruncate.slice(1);
        logger.info("[AutoLLMAdapter] Dropped leading assistant message after memory-turns truncation");
      }
    }
    const truncated = truncateMessages(systemPrompt, msgsToTruncate, maxTokens);

    // ── 优先:使用 agent 自己配置的私有 Key ──────────────────────────
    const privateKey = agentConfig.tokenApiKey?.trim();
    if (privateKey) {
      const provider = agentConfig.tokenProvider || "custom";
      const providerLower = provider.toLowerCase();

      // 如果是 openclaw provider,直接使用 OpenClawAdapter
      if (OPENCLAW_PROVIDERS.has(providerLower)) {
        const { OpenClawAdapter } = await import('./OpenClawAdapter');
        const adapter = new OpenClawAdapter();
        return adapter.generateStream(
          {
            ...agentConfig,
            systemPrompt,
            temperature,
            maxTokens,
          },
          truncated,
          onChunk,
          onComplete,
          onError
        );
      }

      const isDoubao = ["doubao", "volc", "ark"].includes(providerLower);

      // 确定模型 ID:优先用 agent 选的具名模型,其次用 provider 默认模型
      let modelId =
        (agentConfig.modelName && agentConfig.modelName !== "Auto" && agentConfig.modelName !== "auto")
          ? agentConfig.modelName
          : PROVIDER_MODEL_MAP[providerLower] || "doubao-pro-32k-241215";

      const baseUrl =
        agentConfig.tokenBaseUrl?.trim() ||
        (providerLower === "doubao" || providerLower === "ark"
          ? "https://ark.cn-beijing.volces.com/api/v3"
          : "https://api.openai.com/v1");

      const controller = new AbortController();
      try {
        logger.info(`[Auto] Using agent private key: provider=${provider} model=${modelId} url=${baseUrl}`);
        const tokenCount = await callOpenAIStream(
          baseUrl, privateKey, "Bearer", modelId,
          systemPrompt, truncated,
          temperature, maxTokens, topP, frequencyPenalty, presencePenalty,
          onChunk, onComplete, controller
        );
        logger.info(`[Auto] Success via agent private key (${provider}/${modelId}), tokens=${tokenCount}`);
        return;
      } catch (err: any) {
        logger.warn(`[Auto] Agent private key failed: ${err.message}, falling back to global channels...`);
      }
    }

    // ── 降级：从 model_providers 表读取提供商 ──────────────────────
    const providers = loadProviders();

    if (!providers.length) {
      logger.info("[Auto] No model providers configured, falling back to mock");
      return mockFallback.generateStream(agentConfig, messages, onChunk, onComplete, onError);
    }

    // 按 agent 配置的 model_name 匹配 models 表，找到对应的 provider
    const agentModelName = agentConfig.modelName?.trim();
    let matchedProvider: TokenChannel | null = null;
    let matchedModelId = agentModelName || "gpt-4o";

    if (agentModelName && agentModelName.toLowerCase() !== "auto") {
      try {
        const db = getDb();
        const modelRows = db.exec(
          `SELECT m.*, mp.name as provider_name, mp.base_url, mp.api_key
           FROM models m
           LEFT JOIN model_providers mp ON m.provider_id = mp.id
           WHERE m.name = ? AND m.enabled = 1 AND mp.enabled = 1
           LIMIT 1`,
          [agentModelName]
        );
        if (modelRows.length && modelRows[0].values.length) {
          const cols = modelRows[0].columns;
          const m: any = {};
          cols.forEach((c, i) => (m[c] = modelRows[0].values[0][i]));
          matchedProvider = {
            id: m.provider_id || "",
            provider: m.provider_name || "",
            modelName: m.name,
            baseUrl: m.base_url || "",
            apiKey: m.api_key || "",
            authType: "Bearer",
            enabled: true,
            priority: 0,
          };
          matchedModelId = m.name || agentModelName;
          logger.info(`[Auto] Model matched: ${agentModelName} → provider=${m.provider_name} url=${m.base_url}`);
        }
      } catch (e) {
        logger.warn(`[Auto] Model lookup failed: ${e}`);
      }
    }

    // 如果有匹配的 provider，直接使用；否则按优先级遍历所有 provider
    const providersToTry = matchedProvider ? [matchedProvider] : providers;

    for (const provider of providersToTry) {
      const providerLower = provider.provider.toLowerCase();

      // Skip providers that require special (non-OpenAI) format for now
      if (NON_OPENAI_PROVIDERS.has(providerLower)) continue;

      // If openclaw provider, use OpenClawAdapter directly
      if (OPENCLAW_PROVIDERS.has(providerLower)) {
        const { OpenClawAdapter } = await import('./OpenClawAdapter');
        const adapter = new OpenClawAdapter();
        try {
          logger.info(`[Auto] Trying provider: openclaw / OpenClaw native runtime`);
          await adapter.generateStream(
            {
              ...agentConfig,
              systemPrompt,
              temperature,
              maxTokens,
            },
            truncated,
            onChunk,
            onComplete,
            onError
          );
          logger.info(`[Auto] Success via openclaw provider`);
          return;
        } catch (err: any) {
          logger.warn(`[Auto] OpenClaw provider failed: ${err.message}, trying next...`);
          continue;
        }
      }

      const modelId = matchedModelId || PROVIDER_MODEL_MAP[providerLower] || "gpt-4o";
      const baseUrl = provider.baseUrl || "https://api.openai.com/v1";
      const controller = new AbortController();

      try {
        logger.info(
          `[Auto] Trying provider: ${provider.provider} / ${modelId} @ ${baseUrl}`
        );
        const tokenCount = await callOpenAIStream(
          baseUrl,
          provider.apiKey,
          provider.authType,
          modelId,
          systemPrompt,
          truncated,
          temperature,
          maxTokens,
          topP,
          frequencyPenalty,
          presencePenalty,
          onChunk,
          onComplete,
          controller
        );
        logger.info(`[Auto] Success via ${provider.provider} / ${modelId}, tokens=${tokenCount}`);
        return;
      } catch (err: any) {
        logger.warn(
          `[Auto] Provider ${provider.provider} failed: ${err.message}, trying next...`
        );
        continue;
      }
    }

    // All providers failed — fallback to mock
    logger.warn("[Auto] All providers failed, falling back to mock output");
    return mockFallback.generateStream(agentConfig, messages, onChunk, onComplete, onError);
  }
}
