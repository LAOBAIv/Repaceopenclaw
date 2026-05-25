import { logger } from '../../utils/logger';
import { getDb, saveDb } from "../../db/client";
import { OpenClawAdapter } from "../llm/OpenClawAdapter";
import { ILLMAdapter } from "../llm/LLMAdapter";
import { AgentCrud } from './crud';
import type { Agent } from './helpers';

export const AgentLlm = {
  // ── 配额检查与用量统计 ────────────────────────────────────────────────

  /** 检查配额是否超限,返回 { allowed, reason } */
  checkQuota(
    agentId: string,
    userId: string,
  ): { allowed: boolean; reason?: string } {
    const agent = AgentCrud.getById(agentId);
    if (!agent) return { allowed: false, reason: 'Agent 不存在' };
    const qc = agent.quotaConfig || {};
    if (!qc.maxDailyTokens && !qc.maxDailyConversations) return { allowed: true };

    const db = getDb();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const row = db.getRow(
      `SELECT tokens_used, conv_count FROM usage_stats
       WHERE user_id = ? AND agent_id = ? AND date = ?`,
      [userId, agentId, today],
    ) as { tokens_used: number; conv_count: number } | undefined;

    const tokensUsed = row?.tokens_used ?? 0;
    const convCount = row?.conv_count ?? 0;

    if (qc.maxDailyTokens && tokensUsed >= qc.maxDailyTokens) {
      return { allowed: false, reason: `今日 Token 用量已达上限 (${qc.maxDailyTokens})` };
    }
    if (qc.maxDailyConversations && convCount >= qc.maxDailyConversations) {
      return { allowed: false, reason: `今日对话次数已达上限 (${qc.maxDailyConversations})` };
    }
    return { allowed: true };
  },

  /** 获取单日 maxTokensPerMessage 限制 */
  getMaxTokensPerMessage(agentId: string): number | null {
    const agent = AgentCrud.getById(agentId);
    if (!agent) return null;
    return agent.quotaConfig?.maxTokensPerMessage ?? null;
  },

  /** 记录一次对话的 token 消耗和对话次数 */
  recordUsage(userId: string, agentId: string, tokenCount: number): void {
    if (tokenCount <= 0) return;
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    try {
      db.run(
        `INSERT INTO usage_stats (id, user_id, agent_id, date, tokens_used, conv_count, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)
         ON CONFLICT(user_id, agent_id, date)
         DO UPDATE SET tokens_used = tokens_used + ?, conv_count = conv_count + 1, updated_at = ?`,
        [`usage_${userId}_${agentId}_${today}`, userId, agentId, today, tokenCount, now, tokenCount, now],
      );
      saveDb();
    } catch (err) {
      logger.error('[AgentService] recordUsage error:', err);
    }
  },

  async generateStream(
    agentId: string,
    messages: Array<{ role: string; content: string }>,
    onChunk: (chunk: string) => void,
    onComplete: (tokenCount: number) => void,
    onError: (err: Error) => void
  ) {
    const agent = AgentCrud.getById(agentId);
    if (!agent) {
      onError(new Error(`Agent ${agentId} not found`));
      return;
    }

    const agentConfig = {
      id: agent.id,
      name: agent.name,
      systemPrompt: agent.systemPrompt,
      writingStyle: agent.writingStyle,
      expertise: agent.expertise,
      modelName: agent.modelName,
      modelProvider: agent.modelProvider,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      topP: agent.topP,
      frequencyPenalty: agent.frequencyPenalty,
      presencePenalty: agent.presencePenalty,
      tokenProvider: agent.tokenProvider,
      tokenApiKey: agent.tokenApiKey,
      tokenBaseUrl: agent.tokenBaseUrl,
      outputFormat: agent.outputFormat,
      boundary: agent.boundary,
      memoryTurns: agent.memoryTurns,
      temperatureOverride: agent.temperatureOverride,
    };

    // V1 强制统一:所有 RepaceClaw 智能体执行一律经 OpenClaw Gateway。
    // - 不再允许 tokenApiKey / token_channels 直连外部模型绕过 Gateway
    // - 所有请求统一带 x-openclaw-message-channel: repaceclaw
    logger.info(`[AgentService] Agent "${agent.name}" → OpenClawAdapter (gateway-forced)`);
    const adapter: ILLMAdapter = new OpenClawAdapter();
    await adapter.generateStream(agentConfig, messages, onChunk, onComplete, onError);
  },
};
