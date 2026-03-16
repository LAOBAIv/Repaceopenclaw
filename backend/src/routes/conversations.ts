import { Router, Request, Response } from "express";
import { ConversationService } from "../services/ConversationService";
import { AgentService } from "../services/AgentService";
import { z } from "zod";

const router = Router();

const CreateConvSchema = z.object({
  agentId: z.string().min(1),
  projectId: z.string().optional(),
  title: z.string().optional(),
});

router.get("/", (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  res.json({ data: ConversationService.list(projectId) });
});

router.post("/", (req: Request, res: Response) => {
  const parsed = CreateConvSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { agentId, projectId, title } = parsed.data;
  res.status(201).json({ data: ConversationService.create({ agentId, projectId, title }) });
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
 * P1-4: POST /api/conversations/:id/generate
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
