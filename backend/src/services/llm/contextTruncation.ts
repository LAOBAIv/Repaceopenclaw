// [2026-05-18] 从 AutoLLMAdapter.ts 拆分出上下文截断逻辑
import { logger } from '../../utils/logger';

// ─── Context window budget ────────────────────────────────────────────────────
// How many "response tokens" to multiply by to get the context budget.
// e.g. maxTokens=4096, CONTEXT_MULTIPLIER=3 → contextBudget ≈ 12 288 tokens for the prompt.
// This leaves room for the model output.
export const CONTEXT_MULTIPLIER = 3;

/**
 * Estimate token count for a string.
 * Heuristic: ASCII chars ≈ 0.25 token/char; CJK chars ≈ 0.5 token/char.
 * Accurate within ~20 % for mixed Chinese/English text - good enough for budget control.
 */
export function estimateTokens(text: string): number {
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
 */
export function truncateMessages(
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
