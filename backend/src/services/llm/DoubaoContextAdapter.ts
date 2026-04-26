/**
 * Doubao ContextChatCompletions Adapter
 * 
 * 豆包大模型的 ContextChatCompletions 接口适配器
 * 支持上下文缓存和长期记忆功能
 * 
 * API 文档: https://www.volcengine.com/docs/82379/1302008
 */

import { ILLMAdapter } from "./LLMAdapter";
import { logger } from '../../utils/logger';
import { MockLLMAdapter } from "./MockLLMAdapter";
import https from "https";
import http from "http";
import { URL } from "url";

interface DoubaoConfig {
  apiKey: string;
  baseUrl: string;
  modelId: string;
  // Context 缓存相关
  contextId?: string;  // 上下文 ID，用于保持对话连续性
  ttl?: number;        // 上下文缓存 TTL（秒）
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
  tokenProvider?: string;
  tokenApiKey?: string;
  tokenBaseUrl?: string;
  outputFormat?: string;
  boundary?: string;
  memoryTurns?: number;
  temperatureOverride?: number | null;
}

/**
 * 调用豆包 ContextChatCompletions API
 * 支持上下文缓存，适合长对话场景
 */
function callDoubaoContextChatCompletions(
  config: DoubaoConfig,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  maxTokens: number,
  topP: number,
  frequencyPenalty: number,
  presencePenalty: number,
  onChunk: (chunk: string) => void,
  onComplete: (tokenCount: number, contextId?: string) => void,
  signal: AbortController
): Promise<{ tokenCount: number; contextId?: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${config.baseUrl.replace(/\/$/, "")}/context/chat/completions`);
    
    // 构建请求体
    const body = JSON.stringify({
      model: config.modelId,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ],
      stream: true,
      stream_options: { include_usage: true },
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      // Context 缓存参数
      ...(config.contextId && { context_id: config.contextId }),
      ...(config.ttl && { ttl: config.ttl }),
    });

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "Authorization": `Bearer ${config.apiKey}`,
      },
    };

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
      let totalTokens = 0;
      let responseContextId: string | undefined;

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
            
            // 提取文本内容
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) onChunk(delta);
            
            // 提取 token 用量
            if (json.usage?.total_tokens) {
              totalTokens = json.usage.total_tokens;
            }
            
            // 提取上下文 ID（豆包特有）
            if (json.context_id) {
              responseContextId = json.context_id;
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      });

      res.on("end", () => {
        onComplete(totalTokens, responseContextId);
        resolve({ tokenCount: totalTokens, contextId: responseContextId });
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

export class DoubaoContextAdapter implements ILLMAdapter {
  private contextCache: Map<string, string> = new Map(); // agentId -> contextId

  async generateStream(
    agentConfig: AgentConfig,
    messages: Array<{ role: string; content: string }>,
    onChunk: (chunk: string) => void,
    onComplete: (tokenCount: number) => void,
    onError: (err: Error) => void
  ): Promise<void> {
    const apiKey = agentConfig.tokenApiKey?.trim();
    if (!apiKey) {
      return mockFallback.generateStream(agentConfig, messages, onChunk, onComplete, onError);
    }

    const baseUrl = agentConfig.tokenBaseUrl?.trim() || "https://ark.cn-beijing.volces.com/api/v3";
    const modelId = agentConfig.modelName || "doubao-pro-32k-241215";
    
    // 获取或创建上下文 ID
    let contextId = this.contextCache.get(agentConfig.id);
    
    const systemPrompt = this.buildSystemPrompt(agentConfig);
    const temperature = agentConfig.temperatureOverride ?? agentConfig.temperature ?? 0.7;
    const maxTokens = agentConfig.maxTokens ?? 4096;
    const topP = agentConfig.topP ?? 1;
    const frequencyPenalty = agentConfig.frequencyPenalty ?? 0;
    const presencePenalty = agentConfig.presencePenalty ?? 0;

    const controller = new AbortController();

    try {
      logger.info(`[DoubaoContext] Using context_id: ${contextId || "new"}`);
      
      const result = await callDoubaoContextChatCompletions(
        { apiKey, baseUrl, modelId, contextId, ttl: 3600 },
        systemPrompt,
        messages,
        temperature,
        maxTokens,
        topP,
        frequencyPenalty,
        presencePenalty,
        onChunk,
        (tokens, newContextId) => {
          // 保存新的 context ID
          if (newContextId) {
            this.contextCache.set(agentConfig.id, newContextId);
            logger.info(`[DoubaoContext] Saved context_id: ${newContextId}`);
          }
          onComplete(tokens);
        },
        controller
      );

      logger.info(`[DoubaoContext] Success, tokens=${result.tokenCount}`);
    } catch (err: any) {
      logger.error(`[DoubaoContext] Error: ${err.message}`);
      onError(err);
    }
  }

  private buildSystemPrompt(agent: AgentConfig): string {
    const parts: string[] = [];
    if (agent.systemPrompt) parts.push(agent.systemPrompt);
    if (agent.writingStyle) parts.push(`写作风格：${agent.writingStyle}`);
    if (agent.expertise?.length) parts.push(`专业领域：${agent.expertise.join("、")}`);
    parts.push(`你的名字是 ${agent.name}，请始终以第一人称回复。`);

    if (agent.outputFormat && agent.outputFormat !== "纯文本") {
      parts.push(`输出格式：${agent.outputFormat}`);
    }

    if (agent.boundary?.trim()) {
      parts.push(`能力边界：${agent.boundary.trim()}`);
    }

    return parts.join("\n\n");
  }

  /**
   * 清除指定智能体的上下文缓存
   */
  clearContext(agentId: string): void {
    this.contextCache.delete(agentId);
    logger.info(`[DoubaoContext] Cleared context for agent: ${agentId}`);
  }

  /**
   * 清除所有上下文缓存
   */
  clearAllContexts(): void {
    this.contextCache.clear();
    logger.info("[DoubaoContext] Cleared all contexts");
  }
}
