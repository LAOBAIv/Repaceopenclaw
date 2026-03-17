// LLM Adapter abstract interface
export interface ILLMAdapter {
  generateStream(
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
      // 用户私有 Token 接入
      tokenProvider?: string;
      tokenApiKey?: string;
      tokenBaseUrl?: string;
    },
    messages: Array<{ role: string; content: string }>,
    onChunk: (chunk: string) => void,
    /** 流式输出完成回调，tokenCount 为本次实际消耗 token 数（0 表示无法统计） */
    onComplete: (tokenCount: number) => void,
    onError: (err: Error) => void
  ): Promise<void>;
}

