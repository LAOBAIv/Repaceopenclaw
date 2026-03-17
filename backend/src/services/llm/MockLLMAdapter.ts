import { ILLMAdapter } from "./LLMAdapter";

// Writing content templates for mock responses
const WRITING_SNIPPETS = [
  "在这个故事的开端，主角缓缓地推开了那扇尘封已久的门，迎面而来的是久违的阳光。光线透过破旧的窗棂洒落，映照出空气中漂浮的微尘，仿佛时间在这一刻凝固。",
  "深夜的城市依然喧嚣，霓虹灯的倒影在潮湿的街道上摇曳。他站在天台边缘，俯瞰着这片不眠之地，心中涌起一种莫名的孤独与自由交织的情绪。",
  "这一章节将深入探讨人工智能技术对现代社会结构的深远影响。随着大语言模型能力的持续突破，人类与机器协作的边界正在被重新定义，新的生产关系模式呼之欲出。",
  "角色分析：林晓雨，32岁，资深数据分析师，外表冷静内心细腻。她有着过人的逻辑思维，但在情感表达上却总是刻意保持距离。这种性格矛盾将成为整个故事的核心张力所在。",
  "场景描写：古老的图书馆深处，书架间流淌着岁月的气息。晨光从高处的天窗倾泻而下，在木质地板上留下金黄色的方块。每一本书都像是一扇窗，通往不同的世界与时代。",
  "第三幕的高潮设计需要将所有前期伏笔统一收拢。建议在此处安排一场关键对话，通过角色之间的正面冲突，将主题思想推向顶峰，让读者在情感上得到充分的宣泄和升华。",
  "从叙事结构来看，本章应采用倒叙与现实交织的手法，以碎片化的记忆片段逐渐拼凑出真相全貌，制造悬念的同时也完成对人物内心世界的深度刻画。",
  "技术文档补充说明：该模块负责处理用户请求的异步队列管理。采用发布-订阅模式实现解耦，通过滑动时间窗口算法进行流量控制，确保系统在高并发场景下的稳定性与响应性能。",
];

const THINKING_PREFIXES = [
  "让我来续写这一段...\n\n",
  "基于您的描述，我有如下构思：\n\n",
  "好的，我来为这部分添加内容：\n\n",
  "从写作角度分析，这里可以这样展开：\n\n",
  "作为您的写作助手，我的建议是：\n\n",
];

export class MockLLMAdapter implements ILLMAdapter {
  async generateStream(
    agentConfig: {
      id: string;
      name: string;
      systemPrompt: string;
      writingStyle: string;
      expertise: string[];
    },
    messages: Array<{ role: string; content: string }>,
    onChunk: (chunk: string) => void,
    onComplete: (tokenCount: number) => void,
    onError: (err: Error) => void
  ): Promise<void> {
    const prefix =
      THINKING_PREFIXES[Math.floor(Math.random() * THINKING_PREFIXES.length)];
    const snippet =
      WRITING_SNIPPETS[Math.floor(Math.random() * WRITING_SNIPPETS.length)];
    const fullResponse = prefix + snippet + `\n\n— *${agentConfig.name}*`;

    // Simulate streaming with character-by-character output
    let i = 0;
    const chunkSize = 3;
    const delay = 30; // ms per chunk

    return new Promise((resolve) => {
      const send = () => {
        if (i >= fullResponse.length) {
          // Mock: 估算本次输出的 token 数（简单按字符数 / 2 粗估）
          const mockTokens = Math.ceil(fullResponse.length / 2);
          onComplete(mockTokens);
          resolve();
          return;
        }
        const chunk = fullResponse.slice(i, i + chunkSize);
        onChunk(chunk);
        i += chunkSize;
        setTimeout(send, delay);
      };
      setTimeout(send, 300); // Initial thinking delay
    });
  }
}
