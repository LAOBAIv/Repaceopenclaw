/**
 * AutoLLMUtils — Token 估算 & 上下文截断
 */
import { logger } from '../../../utils/logger';

const CONTEXT_MULTIPLIER = 3;

/**
 * Estimate token count for a string.
 * Heuristic: ASCII ≈ 0.25 token/char; CJK ≈ 0.5 token/char.
 */
export function estimateTokens(text: string): number {
  let tokens = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= 0xff00 && code <= 0xffef)
    ) {
      tokens += 0.5;
    } else {
      tokens += 0.25;
    }
  }
  return Math.ceil(tokens);
}

/**
 * Truncate messages to fit within context budget.
 * 1. Always keep system message. 2. Always keep last user message.
 * 3. Fill older messages newest→oldest until budget exhausted.
 */
export function truncateMessages(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
): Array<{ role: string; content: string }> {
  const contextBudget = maxTokens * CONTEXT_MULTIPLIER;
  const systemTokens = estimateTokens(systemPrompt);
  let remaining = contextBudget - systemTokens - maxTokens;

  if (remaining <= 0) {
    const last = messages[messages.length - 1];
    return last ? [last] : [];
  }

  const kept: Array<{ role: string; content: string }> = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const cost = estimateTokens(msg.content) + 4;
    if (remaining - cost < 0 && kept.length > 0) break;
    kept.unshift(msg);
    remaining -= cost;
    if (remaining <= 0) break;
  }

  if (kept.length === 0 && messages.length > 0) {
    kept.push(messages[messages.length - 1]);
  }

  const dropped = messages.length - kept.length;
  if (dropped > 0) {
    logger.info(`[AutoLLMAdapter] Context truncated: dropped ${dropped} oldest message(s) to fit ~${contextBudget} token budget`);
  }

  return kept;
}

/**
 * 判断是否是 Gateway 地址
 */
export function isGatewayUrl(baseUrl: string, gatewayUrl: string): boolean {
  return baseUrl.replace(/\/$/, '') === gatewayUrl.replace(/\/$/, '');
}

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

export interface AgentConfig {
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
