import { Router, Request, Response } from "express";
import { ConversationService } from "../services/ConversationService";
import { AgentService } from "../services/AgentService";
import { TaskService } from "../services/TaskService";
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

router.get("/", (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  res.json({ data: ConversationService.list(projectId) });
});

router.post("/", (req: Request, res: Response) => {
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
    const existingConvs = ConversationService.list().filter(c => c.taskId === taskId);
    if (existingConvs.length > 0) {
      // 已有会话，返回现有会话 ID（共享模式）
      return res.status(200).json({ data: existingConvs[0] });
    }
  }

  res.status(201).json({ data: ConversationService.create({ agentIds: ids, projectId, taskId, title, createdBy }) });
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
router.post("/:id/generate", async (req: Request, res: Response) => {
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: "agentId required" });

  const conv = ConversationService.getById(req.params.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });

  const agent = AgentService.getById(agentId);
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  // Build conversation history
  const messages = ConversationService.getMessages(req.params.id);
  const history = messages.map((m) => ({
    role: m.role === "agent" ? "assistant" : "user",
    content: m.content,
  }));

  let fullContent = "";
  let errorMsg: string | null = null;

  await new Promise<void>((resolve) => {
    AgentService.generateStream(
      agentId,
      history,
      (chunk) => { fullContent += chunk; },
      () => resolve(),
      (err) => { errorMsg = err.message; resolve(); }
    );
  });

  if (errorMsg) {
    return res.status(500).json({ error: errorMsg });
  }

  const agentMsg = ConversationService.addMessage({
    conversationId: req.params.id,
    role: "agent",
    content: fullContent,
    agentId,
  });

  res.status(201).json({ data: agentMsg });
});

export default router;
