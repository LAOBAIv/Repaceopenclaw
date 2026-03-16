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
    },
    messages: Array<{ role: string; content: string }>,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (err: Error) => void
  ): Promise<void>;
}
