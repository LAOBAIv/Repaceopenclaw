// OpenClawAdapter — 调用 OpenClaw Gateway 的 /v1/chat/completions API
//
// 整合架构：
//  - RepaceClaw: 项目管理 + 工作流编排 + 前端UI
//  - agency-agents: 162+ 专业化智能体角色定义
//  - OpenClaw Gateway: 底层模型路由 + API 对接 + 流式输出

import { ILLMAdapter } from "./LLMAdapter";
import { logger } from '../../utils/logger';
import { REPACECLAW_MESSAGE_CHANNEL, resolveOpenClawGateway } from '../../utils/openclawGateway';

export class OpenClawAdapter implements ILLMAdapter {
  async generateStream(
    agentConfig: {
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
    },
    messages: Array<{ role: string; content: string }>,
    onChunk: (chunk: string) => void,
    onComplete: (tokenCount: number) => void,
    onError: (err: Error) => void
  ): Promise<void> {
    // 1. 构建完整 system prompt
    let systemPrompt = agentConfig.systemPrompt || '';
    if (agentConfig.writingStyle) systemPrompt += `\n\n写作风格：${agentConfig.writingStyle}`;
    if (agentConfig.expertise?.length) systemPrompt += `\n\n专业领域：${agentConfig.expertise.join('、')}`;
    if (agentConfig.outputFormat && agentConfig.outputFormat !== '纯文本') {
      systemPrompt += `\n\n## 输出格式要求\n${agentConfig.outputFormat}`;
    }
    if (agentConfig.boundary?.trim()) {
      systemPrompt += `\n\n## 能力边界\n以下事项你不应处理：\n${agentConfig.boundary.trim()}`;
    }

    // 2. 参数处理
    const temperature = agentConfig.temperatureOverride != null
      ? agentConfig.temperatureOverride
      : (agentConfig.temperature ?? 0.7);
    const maxTokens = agentConfig.maxTokens ?? 4096;

    // 3. 上下文截断：按 memoryTurns 截断
    let msgsToSend = messages;
    const memTurns = agentConfig.memoryTurns ?? 0;
    if (memTurns > 0) {
      const maxMsgs = memTurns * 2 + 1;
      if (msgsToSend.length > maxMsgs) {
        msgsToSend = msgsToSend.slice(-maxMsgs);
      }
      if (msgsToSend.length > 0 && msgsToSend[0].role !== 'user') {
        msgsToSend = msgsToSend.slice(1);
      }
    }

    // 4. 组装完整消息
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...msgsToSend,
    ];

    // 5. OpenClaw Gateway 配置
    const { url: gatewayUrl, token: gatewayToken } = resolveOpenClawGateway();

    try {
      const requestedModel = agentConfig.modelName?.trim() || 'openclaw';
      logger.info(`[OpenClawAdapter] → ${gatewayUrl}/v1/chat/completions (model=${requestedModel}, channel=${REPACECLAW_MESSAGE_CHANNEL})`);

      const response = await fetch(`${gatewayUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${gatewayToken}`,
          'x-openclaw-message-channel': REPACECLAW_MESSAGE_CHANNEL,
        },
        body: JSON.stringify({
          model: requestedModel,
          messages: fullMessages,
          stream: true,
          temperature,
          max_tokens: maxTokens,
          top_p: agentConfig.topP ?? 1,
          frequency_penalty: agentConfig.frequencyPenalty ?? 0,
          presence_penalty: agentConfig.presencePenalty ?? 0,
        }),
      });

      if (!response.ok) {
        let errBody = '';
        try { errBody = await response.text(); } catch {}
        throw new Error(`Gateway ${response.status}: ${errBody.slice(0, 200)}`);
      }

      if (!response.body) {
        throw new Error('Empty response body');
      }

      // 6. 读取 SSE 流
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let totalTokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) onChunk(delta);
            if (json.usage?.total_tokens) totalTokens = json.usage.total_tokens;
          } catch { /* skip malformed */ }
        }
      }

      logger.info(`[OpenClawAdapter] ✓ tokens=${totalTokens}`);
      onComplete(totalTokens);

    } catch (err: any) {
      logger.error('[OpenClawAdapter] ✗', err.message);
      onError(err);
      return;
    }
  }
}
