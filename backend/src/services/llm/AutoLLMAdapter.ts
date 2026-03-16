/**
 * AutoLLMAdapter — Auto 模型智能路由器
 *
 * 工作原理：
 * 1. 从 token_channels 表读取所有已启用、有 api_key 的渠道
 * 2. 按 priority 排序，依次尝试调用（主要优先级逻辑见下）
 * 3. 优先选择：有 api_key > priority 高 > 上下文长（支持长对话）
 * 4. 任一渠道调用成功即结束；失败则自动 fallback 到下一个
 * 5. 所有渠道均失败时降级到 MockLLMAdapter 保底输出
 *
 * 调用格式：OpenAI Chat Completions API（兼容 DeepSeek / Qwen / Azure 等）
 */

import { ILLMAdapter } from "./LLMAdapter";
import { MockLLMAdapter } from "./MockLLMAdapter";
import { getDb } from "../../db/client";
import https from "https";
import http from "http";
import { URL } from "url";

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
}

// OpenAI-compatible models that work with the standard /chat/completions endpoint
const PROVIDER_MODEL_MAP: Record<string, string> = {
  openai: "gpt-4o",
  deepseek: "deepseek-chat",
  qwen: "qwen-max",
  anthropic: "claude-3-5-sonnet-20241022",
  azure: "gpt-4o",
  mistral: "mistral-large-latest",
  google: "gemini-1.5-pro",
};

// Providers that use non-OpenAI format (need special handling)
const NON_OPENAI_PROVIDERS = new Set(["anthropic", "google"]);

function loadChannels(): TokenChannel[] {
  try {
    const db = getDb();
    const result = db.exec(
      "SELECT * FROM token_channels WHERE enabled=1 AND api_key != '' ORDER BY priority DESC, created_at ASC"
    );
    if (!result.length) return [];
    const cols = result[0].columns;
    return result[0].values.map((row) => {
      const obj: any = {};
      cols.forEach((c, i) => (obj[c] = row[i]));
      return {
        id: obj.id,
        provider: obj.provider,
        modelName: obj.model_name || "",
        baseUrl: obj.base_url || "",
        apiKey: obj.api_key || "",
        authType: (obj.auth_type || "Bearer") as TokenChannel["authType"],
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
  if (agent.writingStyle) parts.push(`写作风格：${agent.writingStyle}`);
  if (agent.expertise?.length) parts.push(`专业领域：${agent.expertise.join("、")}`);
  parts.push(`你的名字是 ${agent.name}，请始终以第一人称回复。`);
  return parts.join("\n\n");
}

/**
 * 调用 OpenAI-compatible streaming API
 * 返回 Promise<true> 表示成功，抛出 Error 表示失败
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
  onComplete: () => void,
  signal: AbortController
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl.replace(/\/$/, "")}/chat/completions`);
    const body = JSON.stringify({
      model: modelId,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
    });

    const authHeader =
      authType === "ApiKey" ? `${apiKey}` : `Bearer ${apiKey}`;

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Authorization: authType === "ApiKey" ? undefined : authHeader,
        "x-api-key": authType === "ApiKey" ? apiKey : undefined,
        "api-key": authType === "ApiKey" ? apiKey : undefined, // Azure style
      },
    };

    // Remove undefined headers
    Object.keys(options.headers).forEach(
      (k) => (options.headers as any)[k] === undefined && delete (options.headers as any)[k]
    );

    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        let errBody = "";
        res.on("data", (d: Buffer) => (errBody += d.toString()));
        res.on("end", () =>
          reject(new Error(`HTTP ${res.statusCode}: ${errBody.slice(0, 200)}`))
        );
        return;
      }

      let buffer = "";
      res.on("data", (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) onChunk(delta);
          } catch {
            // ignore malformed SSE lines
          }
        }
      });

      res.on("end", () => {
        onComplete();
        resolve();
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
    onComplete: () => void,
    onError: (err: Error) => void
  ): Promise<void> {
    const channels = loadChannels();

    if (!channels.length) {
      console.log("[Auto] No token channels configured, falling back to mock");
      return mockFallback.generateStream(agentConfig, messages, onChunk, onComplete, onError);
    }

    const systemPrompt = buildSystemPrompt(agentConfig);
    const temperature = agentConfig.temperature ?? 0.7;
    const maxTokens = agentConfig.maxTokens ?? 4096;
    const topP = agentConfig.topP ?? 1;
    const frequencyPenalty = agentConfig.frequencyPenalty ?? 0;
    const presencePenalty = agentConfig.presencePenalty ?? 0;

    // Try each channel in priority order
    for (const channel of channels) {
      // Skip providers that require special (non-OpenAI) format for now
      if (NON_OPENAI_PROVIDERS.has(channel.provider.toLowerCase())) continue;

      const modelId =
        channel.modelName ||
        PROVIDER_MODEL_MAP[channel.provider.toLowerCase()] ||
        "gpt-4o";

      const baseUrl = channel.baseUrl || "https://api.openai.com/v1";
      const controller = new AbortController();

      try {
        console.log(
          `[Auto] Trying channel: ${channel.provider} / ${modelId} @ ${baseUrl}`
        );
        await callOpenAIStream(
          baseUrl,
          channel.apiKey,
          channel.authType,
          modelId,
          systemPrompt,
          messages,
          temperature,
          maxTokens,
          topP,
          frequencyPenalty,
          presencePenalty,
          onChunk,
          onComplete,
          controller
        );
        console.log(`[Auto] Success via ${channel.provider} / ${modelId}`);
        return; // success — stop trying
      } catch (err: any) {
        console.warn(
          `[Auto] Channel ${channel.provider} failed: ${err.message}, trying next...`
        );
        // continue to next channel
      }
    }

    // All real channels failed — fallback to mock
    console.warn("[Auto] All channels failed, falling back to mock output");
    return mockFallback.generateStream(agentConfig, messages, onChunk, onComplete, onError);
  }
}
