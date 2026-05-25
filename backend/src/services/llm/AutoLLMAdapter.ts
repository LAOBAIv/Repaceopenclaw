/**
 * AutoLLMAdapter - Auto 模型智能路由器
 *
 * 工作原理:
 * 1. 优先使用 agent 私有 Key → 2. 平台预设渠道 → 3. model_providers 遍历 → 4. Mock 降级
 */

import { ILLMAdapter } from "./LLMAdapter";
import { logger } from '../../utils/logger';
import { resolveOpenClawGateway } from '../../utils/openclawGateway';
import { MockLLMAdapter } from "./MockLLMAdapter";
import { getDb } from "../../db/client";
import { getErrorMessage } from '../../types/ilink';
import { AgentConfig, TokenChannel, truncateMessages, estimateTokens } from "./AutoLLM/utils";
import { buildSystemPrompt, PROVIDER_MODEL_MAP, NON_OPENAI_PROVIDERS, OPENCLAW_PROVIDERS, loadProviders } from "./AutoLLM/config";
import { callOpenAIStream } from "./AutoLLM/api";

const { url: GATEWAY_URL, token: GATEWAY_TOKEN } = resolveOpenClawGateway();
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
    const temperature = agentConfig.temperatureOverride != null ? agentConfig.temperatureOverride : (agentConfig.temperature ?? 0.7);
    const maxTokens = agentConfig.maxTokens ?? 4096;
    const topP = agentConfig.topP ?? 1;
    const frequencyPenalty = agentConfig.frequencyPenalty ?? 0;
    const presencePenalty = agentConfig.presencePenalty ?? 0;

    // 上下文截断
    let msgsToTruncate = messages;
    const memTurns = agentConfig.memoryTurns ?? 0;
    if (memTurns > 0) {
      const maxMsgs = memTurns * 2 + 1;
      if (msgsToTruncate.length > maxMsgs) {
        msgsToTruncate = msgsToTruncate.slice(-maxMsgs);
        logger.info(`[AutoLLMAdapter] Memory turns limit: keeping last ${memTurns} turns (${maxMsgs} messages)`);
      }
      if (msgsToTruncate.length > 0 && msgsToTruncate[0].role !== "user") {
        msgsToTruncate = msgsToTruncate.slice(1);
        logger.info("[AutoLLMAdapter] Dropped leading assistant message after memory-turns truncation");
      }
    }
    const truncated = truncateMessages(systemPrompt, msgsToTruncate, maxTokens);

    // 1. Agent 私有 Key
    const privateKey = agentConfig.tokenApiKey?.trim();
    if (privateKey) {
      const provider = agentConfig.tokenProvider || "custom";
      const providerLower = provider.toLowerCase();

      if (OPENCLAW_PROVIDERS.has(providerLower)) {
        const { OpenClawAdapter } = await import('./OpenClawAdapter');
        return new OpenClawAdapter().generateStream({ ...agentConfig, systemPrompt, temperature, maxTokens }, truncated, onChunk, onComplete, onError);
      }

      let modelId = (agentConfig.modelName && agentConfig.modelName !== "Auto" && agentConfig.modelName !== "auto")
        ? agentConfig.modelName : PROVIDER_MODEL_MAP[providerLower] || "doubao-pro-32k-241215";
      const baseUrl = agentConfig.tokenBaseUrl?.trim() ||
        (["doubao", "ark"].includes(providerLower) ? "https://ark.cn-beijing.volces.com/api/v3" : "https://api.openai.com/v1");

      const controller = new AbortController();
      try {
        logger.info(`[Auto] Using agent private key: provider=${provider} model=${modelId}`);
        const tokenCount = await callOpenAIStream(baseUrl, privateKey, "Bearer", modelId, systemPrompt, truncated, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, onChunk, onComplete, controller, GATEWAY_URL, GATEWAY_TOKEN);
        logger.info(`[Auto] Success via agent private key (${provider}/${modelId}), tokens=${tokenCount}`);
        return;
      } catch (err: unknown) {
        logger.warn(`[Auto] Agent private key failed: ${getErrorMessage(err)}, falling back...`);
      }
    }

    // 2. 平台预设渠道
    if (!privateKey) {
      try {
        const db = getDb();
        const presetResult = db.exec(`SELECT * FROM token_channels WHERE is_preset=1 AND enabled=1 AND api_key != '' LIMIT 1`);
        if (presetResult.length && presetResult[0].values.length) {
          const cols = presetResult[0].columns;
          const p: Record<string, unknown> = {};
          cols.forEach((c, i) => (p[c] = presetResult[0].values[0][i]));
          const pd = p as Record<string, unknown>;
          const presetProvider = (pd.provider as string) || "custom";
          const presetProviderLower = presetProvider.toLowerCase();
          const presetModelId = (pd.model_name as string) || "auto";
          const presetBaseUrl = (pd.base_url as string) || "https://api.openai.com/v1";
          const presetAuthType = (pd.auth_type as string) || "Bearer";

          if (OPENCLAW_PROVIDERS.has(presetProviderLower)) {
            const { OpenClawAdapter } = await import('./OpenClawAdapter');
            return new OpenClawAdapter().generateStream({ ...agentConfig, systemPrompt, temperature, maxTokens }, truncated, onChunk, onComplete, onError);
          }

          const chTemp = pd.temperature != null ? pd.temperature as number : temperature;
          const chMaxTokens = pd.max_tokens != null ? pd.max_tokens as number : maxTokens;
          const chTopP = pd.top_p != null ? pd.top_p as number : topP;
          const chFreq = pd.frequency_penalty != null ? pd.frequency_penalty as number : frequencyPenalty;
          const chPres = pd.presence_penalty != null ? pd.presence_penalty as number : presencePenalty;

          const controller = new AbortController();
          try {
            logger.info(`[Auto] Using preset fallback: provider=${presetProvider} model=${presetModelId}`);
            const tokenCount = await callOpenAIStream(presetBaseUrl, pd.api_key as string, presetAuthType, presetModelId, systemPrompt, truncated, chTemp, chMaxTokens, chTopP, chFreq, chPres, onChunk, onComplete, controller, GATEWAY_URL, GATEWAY_TOKEN);
            logger.info(`[Auto] Success via preset fallback (${presetProvider}/${presetModelId}), tokens=${tokenCount}`);
            return;
          } catch (err: unknown) {
            logger.warn(`[Auto] Preset fallback failed: ${getErrorMessage(err)}`);
          }
        }
      } catch (e) { logger.warn(`[Auto] Preset channel lookup failed: ${e}`); }
    }

    // 3. model_providers 遍历
    const providers = loadProviders();
    if (!providers.length) {
      logger.info("[Auto] No model providers configured, falling back to mock");
      return mockFallback.generateStream(agentConfig, messages, onChunk, onComplete, onError);
    }

    const agentModelName = agentConfig.modelName?.trim();
    let matchedProvider: TokenChannel | null = null;
    let matchedModelId = agentModelName || "gpt-4o";

    if (agentModelName && agentModelName.toLowerCase() !== "auto") {
      try {
        const db = getDb();
        const modelRows = db.exec(
          `SELECT m.*, mp.name as provider_name, mp.base_url, mp.api_key
           FROM models m LEFT JOIN model_providers mp ON m.provider_id = mp.id
           WHERE m.name = ? AND m.enabled = 1 AND mp.enabled = 1 LIMIT 1`, [agentModelName]);
        if (modelRows.length && modelRows[0].values.length) {
          const cols = modelRows[0].columns;
          const m: Record<string, unknown> = {};
          cols.forEach((c, i) => (m[c] = modelRows[0].values[0][i]));
          const md = m as Record<string, unknown>;
          matchedProvider = {
            id: (md.provider_id as string) || "", provider: (md.provider_name as string) || "",
            modelName: md.name as string, baseUrl: (md.base_url as string) || "",
            apiKey: (md.api_key as string) || "", authType: "Bearer" as const, enabled: true, priority: 0,
          };
          matchedModelId = (md.name as string) || agentModelName;
          logger.info(`[Auto] Model matched: ${agentModelName} → provider=${md.provider_name}`);
        }
      } catch (e) { logger.warn(`[Auto] Model lookup failed: ${e}`); }
    }

    const providersToTry = matchedProvider ? [matchedProvider] : providers;

    for (const provider of providersToTry) {
      const providerLower = provider.provider.toLowerCase();
      if (NON_OPENAI_PROVIDERS.has(providerLower)) continue;

      if (OPENCLAW_PROVIDERS.has(providerLower)) {
        const { OpenClawAdapter } = await import('./OpenClawAdapter');
        try {
          logger.info(`[Auto] Trying provider: openclaw`);
          await new OpenClawAdapter().generateStream({ ...agentConfig, systemPrompt, temperature, maxTokens }, truncated, onChunk, onComplete, onError);
          logger.info(`[Auto] Success via openclaw provider`);
          return;
        } catch (err: unknown) {
          logger.warn(`[Auto] OpenClaw provider failed: ${getErrorMessage(err)}, trying next...`);
          continue;
        }
      }

      const modelId = matchedModelId || PROVIDER_MODEL_MAP[providerLower] || "gpt-4o";
      const baseUrl = provider.baseUrl || "https://api.openai.com/v1";
      const controller = new AbortController();

      try {
        logger.info(`[Auto] Trying provider: ${provider.provider} / ${modelId}`);
        const tokenCount = await callOpenAIStream(baseUrl, provider.apiKey, provider.authType, modelId, systemPrompt, truncated, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, onChunk, onComplete, controller, GATEWAY_URL, GATEWAY_TOKEN);
        logger.info(`[Auto] Success via ${provider.provider} / ${modelId}, tokens=${tokenCount}`);
        return;
      } catch (err: unknown) {
        logger.warn(`[Auto] Provider ${provider.provider} failed: ${getErrorMessage(err)}, trying next...`);
        continue;
      }
    }

    // 4. 全部失败 → Mock
    logger.warn("[Auto] All providers failed, falling back to mock output");
    return mockFallback.generateStream(agentConfig, messages, onChunk, onComplete, onError);
  }
}
