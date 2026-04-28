import { Router, Request, Response } from "express";
import { ConversationService } from "../services/ConversationService";
import { AgentService } from "../services/AgentService";
import { TaskService } from "../services/TaskService";
import { authenticate } from "../middleware/auth";
import { z } from "zod";

const router = Router();

// 创建会话：支持单个或多个 agentIds
const CreateConvSchema = z.object({
  // 兼容旧版传 agentId（字符串）以及新版传 agentIds（数组）
  agentId: z.string().min(1).optional(),
  agentIds: z.array(z.string().min(1)).min(1).optional(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  title: z.string().optional(),
  createdBy: z.string().optional(),
}).refine(
  (data) => data.agentId || (data.agentIds && data.agentIds.length > 0),
  { message: "agentId or agentIds (non-empty array) is required" }
);

router.get("/", authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const projectId = req.query.projectId as string | undefined;
  res.json({ data: ConversationService.list(userId, projectId) });
});

router.post("/", authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const parsed = CreateConvSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { agentId, agentIds, projectId, taskId, title, createdBy } = parsed.data;

  // 统一成数组（兼容旧版单 agentId 传参）
  const ids: string[] = agentIds?.length ? agentIds : [agentId!];

  // 应用层外键校验：确认每个 agentId 都真实存在，防止孤儿数据
  for (const id of ids) {
    const agent = AgentService.getById(id);
    if (!agent) {
      return res.status(404).json({ error: `Agent not found: ${id}` });
    }
  }

  // 如果指定了 taskId，检查是否已存在会话（一个任务只能有一个会话）
  if (taskId) {
    const existingConvs = ConversationService.list(userId).filter(c => c.taskId === taskId);
    if (existingConvs.length > 0) {
      // 已有会话，返回现有会话 ID（共享模式）
      return res.status(200).json({ data: existingConvs[0] });
    }
  }

  res.status(201).json({ data: ConversationService.create({ agentIds: ids, projectId, taskId, title, createdBy, userId }) });
});

/**
 * PUT /api/conversations/:id
 * 更新会话信息（标题、项目关联等）
 */
router.put("/:id", (req: Request, res: Response) => {
  const { title, projectId, taskId } = req.body;
  const conv = ConversationService.update(req.params.id, { title, projectId, taskId });
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  res.json({ data: conv });
});

router.delete("/:id", (req: Request, res: Response) => {
  ConversationService.delete(req.params.id);
  res.json({ success: true });
});

router.get("/:id/messages", (req: Request, res: Response) => {
  res.json({ data: ConversationService.getMessages(req.params.id) });
});

router.post("/:id/messages", (req: Request, res: Response) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: "content required" });
  const conv = ConversationService.getById(req.params.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  const msg = ConversationService.addMessage({ conversationId: req.params.id, role: "user", content });
  res.status(201).json({ data: msg });
});

/**
 * POST /api/conversations/:id/agents
 * 向已有会话追加智能体（多对多关联，幂等）
 */
router.post("/:id/agents", (req: Request, res: Response) => {
  const conv = ConversationService.getById(req.params.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });

  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: "agentId required" });

  const agent = AgentService.getById(agentId);
  if (!agent) return res.status(404).json({ error: `Agent not found: ${agentId}` });

  ConversationService.addAgent(req.params.id, agentId);
  res.json({ success: true });
});

/**
 * DELETE /api/conversations/:id/agents/:agentId
 * 从会话移除某个智能体
 */
router.delete("/:id/agents/:agentId", (req: Request, res: Response) => {
  const conv = ConversationService.getById(req.params.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  ConversationService.removeAgent(req.params.id, req.params.agentId);
  res.json({ success: true });
});

/**
 * POST /api/conversations/:id/generate
 * Trigger AI to generate a reply for the latest messages in this conversation.
 * Non-streaming, waits for full response before returning.
 * Body: { agentId: string }
 */
router.post("/:id/generate", authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: "agentId required" });

  const conv = ConversationService.getById(req.params.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });

  const agent = AgentService.getById(agentId);
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  // ── 配额检查 ──────────────────────────────────────────────────────
  const quotaResult = AgentService.checkQuota(agentId, userId);
  if (!quotaResult.allowed) {
    return res.status(429).json({ error: quotaResult.reason });
  }

  const maxTokensPerMsg = AgentService.getMaxTokensPerMessage(agentId);

  // Build conversation history
  const messages = ConversationService.getMessages(req.params.id);
  const history = messages.map((m) => ({
    role: m.role === "agent" ? "assistant" : "user",
    content: m.content,
  }));

  let fullContent = "";
  let errorMsg: string | null = null;
  let tokenCount = 0;

  await new Promise<void>((resolve) => {
    AgentService.generateStream(
      agentId,
      history,
      (chunk) => {
        // maxTokensPerMessage 限制：超出部分丢弃且不保存到回复中
        if (maxTokensPerMsg && fullContent.length >= maxTokensPerMsg) return;
        fullContent += chunk;
      },
      (tokens) => { tokenCount = tokens; resolve(); },
      (err) => { errorMsg = err.message; resolve(); }
    );
  });

  if (errorMsg) {
    return res.status(500).json({ error: errorMsg });
  }

  // ── 记录用量 ──────────────────────────────────────────────────────
  AgentService.recordUsage(userId, agentId, tokenCount);
  AgentService.addTokenUsed(agentId, tokenCount);

  const agentMsg = ConversationService.addMessage({
    conversationId: req.params.id,
    role: "agent",
    content: fullContent,
    agentId,
  });

  res.status(201).json({ data: agentMsg });
});

/**
 * POST /api/conversations/create-with-overview
 * 创建全新会话 + 生成项目概述（空白对话 + AI 概述消息）
 * Body: { title, agentIds[], projectId?, description? }
 */
router.post("/create-with-overview", authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { title, agentIds, projectId, description } = req.body;

  if (!title || !agentIds || !agentIds.length) {
    return res.status(400).json({ error: "title and agentIds (non-empty array) are required" });
  }

  // 校验 agentId
  for (const id of agentIds) {
    const agent = AgentService.getById(id);
    if (!agent) {
      return res.status(404).json({ error: `Agent not found: ${id}` });
    }
  }

  // 1. 创建全新会话（空消息）
  const conv = ConversationService.create({
    agentIds,
    projectId,
    title,
    createdBy: userId,
    userId,
  });

  // 2. 生成 AI 项目概述并写入为首条 agent 消息
  const mainAgentId = agentIds[0];
  const mainAgent = AgentService.getById(mainAgentId);
  const selectedAgents = agentIds.map(id => AgentService.getById(id)!);
  const agentNames = selectedAgents.map(a => a.name).join('、');
  const isProject = agentIds.length >= 2;
  const typeLabel = isProject ? '项目' : '任务';
  const descText = description ? `\n\n任务描述：${description}` : '';

  const overviewPrompt = `你是一名${isProject ? '项目经理' : '任务助手'}。请根据以下信息生成一份简洁的项目概述。

${typeLabel}名称：${title}
参与智能体：${agentNames}
智能体详情：${selectedAgents.map(a => `  - ${a.name}：擅长${a.expertise?.join('、') || '通用'}，${a.description || '暂无描述'}`).join('\n')}${descText}

请按以下格式输出（使用 Markdown）：

# ${title} — 项目概述

## 项目简介\n简要说明本项目的目标和范围（2-3 句）\n\n## 参与角色\n列出每个智能体的职责分工\n\n## 初始建议\n给出 2-3 条可立即执行的下一步建议\n
请保持简洁专业。`;

  try {
    const quotaResult = AgentService.checkQuota(mainAgentId, userId);
    const maxTokensPerMsg = AgentService.getMaxTokensPerMessage(mainAgentId);

    let fullContent = "";
    let errorMsg: string | null = null;
    let tokenCount = 0;

    await new Promise<void>((resolve) => {
      AgentService.generateStream(
        mainAgentId,
        [{ role: "user", content: overviewPrompt }],
        () => {},
        (tokens) => { tokenCount = tokens; resolve(); },
        (err) => { errorMsg = err.message; resolve(); }
      );
    });

    if (!errorMsg && fullContent) {
      AgentService.recordUsage(userId, mainAgentId, tokenCount);
      AgentService.addTokenUsed(mainAgentId, tokenCount);

      ConversationService.addMessage({
        conversationId: conv.id,
        role: "agent",
        content: fullContent,
        agentId: mainAgentId,
        tokenCount,
      });
    }
  } catch (err: any) {
    // 概述生成失败不影响会话创建，记录警告即可
    console.warn(`[create-with-overview] Overview generation failed: ${err?.message}`);
  }

  // 3. 返回完整会话信息（含消息）
  const messages = ConversationService.getMessages(conv.id);
  res.status(201).json({ data: { ...conv, messages } });
});

export default router;
