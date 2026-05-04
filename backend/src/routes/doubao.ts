/**
 * Doubao Context Chat Completions API
 *
 * V1 说明：
 * - RepaceClaw 全平台模型调用统一经 OpenClaw Gateway
 * - 本路由保留兼容入口，但不再直连豆包接口，也不再维护本地 context cache
 * - 若对应智能体的 modelName/modelProvider 指向豆包模型，Gateway 会继续按模型策略路由
 */

import { Router, Request, Response } from "express";
import { OpenClawAdapter } from "../services/llm/OpenClawAdapter";
import { AgentService } from "../services/AgentService";

const router = Router();
const gatewayAdapter = new OpenClawAdapter();

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

    const agent = AgentService.getById(agentId);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const agentConfig = {
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
    };

    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let fullContent = "";
      let tokenCount = 0;

      await gatewayAdapter.generateStream(
        agentConfig,
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
      return;
    }

    let fullContent = "";
    let tokenCount = 0;
    let hasError = false;
    let errorMsg = "";

    await gatewayAdapter.generateStream(
      agentConfig,
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
      routedBy: "gateway",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/doubao/context/:agentId
router.delete("/context/:agentId", (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    res.json({ success: true, message: `Gateway 路径下不再维护本地 Doubao context cache（agent=${agentId}）` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/doubao/context
router.delete("/context", (_req: Request, res: Response) => {
  try {
    res.json({ success: true, message: "Gateway 路径下不再维护本地 Doubao context cache" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
