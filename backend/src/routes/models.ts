import { Router, Request, Response } from "express";
import { ModelService } from "../services/ModelService";
import { z } from "zod";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  const providerId = req.query.providerId as string | undefined;
  res.json({ data: ModelService.listModels(providerId) });
});

router.get("/available", (req: Request, res: Response) => {
  res.json({ data: ModelService.getAvailableModels() });
});

router.get("/:id", (req: Request, res: Response) => {
  const model = ModelService.getModel(req.params.id);
  if (!model) return res.status(404).json({ error: "Model not found" });
  res.json({ data: model });
});

const ModelSchema = z.object({
  providerId: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().default(""),
  contextWindow: z.number().default(128000),
  maxTokens: z.number().default(8192),
  costInput: z.number().default(0),
  costOutput: z.number().default(0),
  capabilities: z.array(z.string()).default(["text"]),
  enabled: z.boolean().default(true),
  description: z.string().default(""),
});

router.post("/", (req: Request, res: Response) => {
  const parsed = ModelSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const model = ModelService.createModel(parsed.data as any);
  res.status(201).json({ data: model });
});

router.put("/:id", (req: Request, res: Response) => {
  const parsed = ModelSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const model = ModelService.updateModel(req.params.id, parsed.data);
  if (!model) return res.status(404).json({ error: "Model not found" });
  res.json({ data: model });
});

router.delete("/:id", (req: Request, res: Response) => {
  ModelService.deleteModel(req.params.id);
  res.json({ success: true });
});

export default router;
