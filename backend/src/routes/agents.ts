import { Router, Request, Response } from "express";
import { AgentService } from "../services/AgentService";
import { z } from "zod";

const router = Router();

const AgentSchema = z.object({
  name: z.string().min(1),
  color: z.string().default("#6366F1"),
  systemPrompt: z.string().default(""),
  writingStyle: z.string().default("balanced"),
  expertise: z.array(z.string()).default([]),
  description: z.string().default(""),
  status: z.enum(["active", "idle", "busy"]).default("idle"),
  // 模型参数
  modelName: z.string().default(""),
  modelProvider: z.string().default(""),
  temperature: z.number().default(0.7),
  maxTokens: z.number().default(4096),
  topP: z.number().default(1),
  frequencyPenalty: z.number().default(0),
  presencePenalty: z.number().default(0),
});

router.get("/", (req: Request, res: Response) => {
  const agents = AgentService.list();
  res.json({ data: agents });
});

router.get("/:id", (req: Request, res: Response) => {
  const agent = AgentService.getById(req.params.id);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  res.json({ data: agent });
});

router.post("/", (req: Request, res: Response) => {
  const parsed = AgentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  // AgentSchema has defaults for all fields, so cast is safe
  const agent = AgentService.create(parsed.data as Parameters<typeof AgentService.create>[0]);
  res.status(201).json({ data: agent });
});

router.put("/:id", (req: Request, res: Response) => {
  const parsed = AgentSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const agent = AgentService.update(req.params.id, parsed.data);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  res.json({ data: agent });
});

router.delete("/:id", (req: Request, res: Response) => {
  AgentService.delete(req.params.id);
  res.json({ success: true });
});

export default router;
