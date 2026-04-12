/**
 * Doubao Context Chat Completions API
 * 
 * 提供豆包大模型的上下文缓存对话接口
 * POST /api/doubao/context-chat
 */

import { Router, Request, Response } from "express";
import { DoubaoContextAdapter } from "../services/llm/DoubaoContextAdapter";
import { AgentService } from "../services/AgentService";

const router = Router();
const doubaoAdapter = new DoubaoContextAdapter();

// POST /api/doubao/context-chat
router.post("/context-chat", async (req: Request, res: Response) => {
  try {
    const {
      agentId,
      messages,
      stream = true,
    } = req.body as {
      agentId: string;
      messages: Array<{ role: string; content: string }>;
      stream?: boolean;
    };

    if (!agentId) {
      return res.status(400).json({ error: "agentId is required" });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages is required" });
    }

    // 获取智能体配置
    const agent = AgentService.getById(agentId);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // 检查是否配置了豆包 API
    if (!agent.tokenApiKey && !agent.modelProvider?.toLowerCase().includes("豆包")) {
      return res.status(400).json({ 
        error: "Agent is not configured for Doubao. Please set tokenApiKey or use a Doubao model provider." 
      });
    }

    if (stream) {
      // 流式响应
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let fullContent = "";
      let tokenCount = 0;

      await doubaoAdapter.generateStream(
        {
          id: agent.id,
          name: agent.name,
          systemPrompt: agent.systemPrompt || "",
          writingStyle: agent.writingStyle || "balanced",
          expertise: agent.expertise ? (Array.isArray(agent.expertise) ? agent.expertise : JSON.parse(agent.expertise)) : [],
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
        },
        messages,
        (chunk) => {
          fullContent += chunk;
          res.write(`data: ${JSON.stringify({ chunk, content: fullContent })}\n\n`);
        },
        (tokens) => {
          tokenCount = tokens;
          res.write(`data: ${JSON.stringify({ done: true, tokenCount, content: fullContent })}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
        },
        (err) => {
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.end();
        }
      );
    } else {
      // 非流式响应
      let fullContent = "";
      let tokenCount = 0;
      let hasError = false;
      let errorMsg = "";

      await doubaoAdapter.generateStream(
        {
          id: agent.id,
          name: agent.name,
          systemPrompt: agent.systemPrompt || "",
          writingStyle: agent.writingStyle || "balanced",
          expertise: agent.expertise ? (Array.isArray(agent.expertise) ? agent.expertise : JSON.parse(agent.expertise)) : [],
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
        },
        messages,
        (chunk) => {
          fullContent += chunk;
        },
        (tokens) => {
          tokenCount = tokens;
        },
        (err) => {
          hasError = true;
          errorMsg = err.message;
        }
      );

      if (hasError) {
        return res.status(500).json({ error: errorMsg });
      }

      res.json({
        content: fullContent,
        tokenCount,
        agent: {
          id: agent.id,
          name: agent.name,
        },
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/doubao/context/:agentId
// 清除指定智能体的上下文缓存
router.delete("/context/:agentId", (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    doubaoAdapter.clearContext(agentId);
    res.json({ success: true, message: `Context cleared for agent ${agentId}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/doubao/context
// 清除所有上下文缓存
router.delete("/context", (req: Request, res: Response) => {
  try {
    doubaoAdapter.clearAllContexts();
    res.json({ success: true, message: "All contexts cleared" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
