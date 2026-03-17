/**
 * OpenAI 兼容对外接口 (OpenAI Compatible Proxy)
 *
 * 用途：让 OpenClaw、Claude Code、OpenCode 等外部 AI 编程工具将本平台作为模型后端。
 *
 * 接口列表：
 *   GET  /v1/models               — 返回可用智能体列表（OpenAI models 格式）
 *   POST /v1/chat/completions     — 流式或非流式对话，代理到对应智能体的 LLM
 *
 * 认证：
 *   请求头携带 `Authorization: Bearer <agentId>` 即可（agentId 即智能体 ID）。
 *   如果不传 agentId，则走全局 token_channels 自动路由。
 *
 * 在 OpenClaw / Claude Code 中的配置示例：
 *   Base URL : http://localhost:3001/v1
 *   API Key  : <你的智能体 ID>（从平台智能体列表复制）
 *   Model    : <对应 agentId 或 "auto">
 */

import { Router, Request, Response } from "express";
import { AgentService } from "../services/AgentService";
import { AutoLLMAdapter } from "../services/llm/AutoLLMAdapter";

const router = Router();

// ─── GET /v1/models ──────────────────────────────────────────────────────────
// 返回所有智能体作为"模型"，让客户端可以选择
router.get("/models", (_req: Request, res: Response) => {
  try {
    const agents = AgentService.list();
    const models = agents.map((a) => ({
      id: a.id,
      object: "model",
      created: Math.floor(new Date(a.createdAt).getTime() / 1000),
      owned_by: "platform",
      // 额外信息方便用户识别
      display_name: a.name,
      description: a.description || "",
    }));

    // 追加一个通用 "auto" 模型（走全局渠道路由）
    models.unshift({
      id: "auto",
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: "platform",
      display_name: "Auto（平台自动路由）",
      description: "由平台按优先级自动选择渠道和模型",
    });

    res.json({ object: "list", data: models });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message, type: "internal_error" } });
  }
});

// ─── POST /v1/chat/completions ───────────────────────────────────────────────
router.post("/chat/completions", async (req: Request, res: Response) => {
  try {
    const {
      model,
      messages,
      stream = false,
      temperature,
      max_tokens,
      top_p,
      frequency_penalty,
      presence_penalty,
    } = req.body as {
      model?: string;
      messages: Array<{ role: string; content: string }>;
      stream?: boolean;
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
      frequency_penalty?: number;
      presence_penalty?: number;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: { message: "messages is required and must be a non-empty array", type: "invalid_request_error" },
      });
    }

    // ── 解析认证：优先从 Authorization header 取 agentId ──────────────────
    // 支持两种形式：
    //   Authorization: Bearer <agentId>
    //   Authorization: <agentId>  (部分客户端不加 Bearer)
    const authHeader = req.headers.authorization || "";
    const rawToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : authHeader.trim();

    // model 字段也可作为 agentId（有些工具会把 API key 留空，用 model 传 ID）
    const candidateAgentId = rawToken || model || "";

    // ── 构建 agentConfig ──────────────────────────────────────────────────
    let agentConfig: Parameters<InstanceType<typeof AutoLLMAdapter>["generateStream"]>[0];

    const agent = candidateAgentId ? AgentService.getById(candidateAgentId) : null;

    if (agent) {
      // 用智能体已配置的所有参数（包含私有 Key、系统提示等）
      agentConfig = {
        id: agent.id,
        name: agent.name,
        systemPrompt: agent.systemPrompt,
        writingStyle: agent.writingStyle,
        expertise: agent.expertise,
        modelName: agent.modelName,
        modelProvider: agent.modelProvider,
        temperature: temperature ?? agent.temperature,
        maxTokens: max_tokens ?? agent.maxTokens,
        topP: top_p ?? agent.topP,
        frequencyPenalty: frequency_penalty ?? agent.frequencyPenalty,
        presencePenalty: presence_penalty ?? agent.presencePenalty,
        tokenProvider: agent.tokenProvider,
        tokenApiKey: agent.tokenApiKey,
        tokenBaseUrl: agent.tokenBaseUrl,
        // 输出格式 & 能力边界
        outputFormat: agent.outputFormat,
        boundary: agent.boundary,
        // 对话记忆轮数 & 温度快捷覆盖（外部工具调用时也应生效）
        memoryTurns: agent.memoryTurns,
        temperatureOverride: agent.temperatureOverride,
      };
    } else {
      // 没有指定智能体 / 找不到时：走全局渠道自动路由
      agentConfig = {
        id: "proxy",
        name: "Platform Proxy",
        systemPrompt: "",
        writingStyle: "",
        expertise: [],
        modelName: model && model !== "auto" ? model : "",
        modelProvider: "",
        temperature: temperature ?? 0.7,
        maxTokens: max_tokens ?? 4096,
        topP: top_p ?? 1,
        frequencyPenalty: frequency_penalty ?? 0,
        presencePenalty: presence_penalty ?? 0,
      };
    }

    // ── 过滤掉 system 消息（agentConfig.systemPrompt 已包含） ─────────────
    // 客户端可能在 messages[0] 中传入 system，这里剔除，避免重复
    const chatMessages = messages.filter((m) => m.role !== "system");

    const adapter = new AutoLLMAdapter();
    const requestId = `chatcmpl-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);

    // ─────────────────────────────────────────────────────────────────────
    // 流式响应 (SSE)
    // ─────────────────────────────────────────────────────────────────────
    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      let finished = false;

      const sendChunk = (delta: string) => {
        const payload = {
          id: requestId,
          object: "chat.completion.chunk",
          created,
          model: agent?.id || "auto",
          choices: [
            {
              index: 0,
              delta: { role: "assistant", content: delta },
              finish_reason: null,
            },
          ],
        };
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      };

      const sendDone = () => {
        if (finished) return;
        finished = true;
        const donePayload = {
          id: requestId,
          object: "chat.completion.chunk",
          created,
          model: agent?.id || "auto",
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: "stop",
            },
          ],
        };
        res.write(`data: ${JSON.stringify(donePayload)}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      };

      await adapter.generateStream(
        agentConfig,
        chatMessages,
        sendChunk,
        sendDone,
        (err) => {
          if (!finished) {
            finished = true;
            const errPayload = {
              error: { message: err.message, type: "upstream_error" },
            };
            res.write(`data: ${JSON.stringify(errPayload)}\n\n`);
            res.write("data: [DONE]\n\n");
            res.end();
          }
        }
      );

      return;
    }

    // ─────────────────────────────────────────────────────────────────────
    // 非流式响应
    // ─────────────────────────────────────────────────────────────────────
    let fullContent = "";
    let errorMsg: string | null = null;

    await new Promise<void>((resolve) => {
      adapter.generateStream(
        agentConfig,
        chatMessages,
        (chunk) => { fullContent += chunk; },
        () => resolve(),
        (err) => { errorMsg = err.message; resolve(); }
      );
    });

    if (errorMsg) {
      return res.status(502).json({
        error: { message: errorMsg, type: "upstream_error" },
      });
    }

    res.json({
      id: requestId,
      object: "chat.completion",
      created,
      model: agent?.id || "auto",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: fullContent },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    });
  } catch (err: any) {
    console.error("[OpenAI Compat] Unhandled error:", err);
    res.status(500).json({
      error: { message: err.message || "Internal server error", type: "internal_error" },
    });
  }
});

export default router;
