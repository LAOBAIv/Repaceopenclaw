import { Router, Request, Response } from "express";
import { ModelService } from "../services/ModelService";
import { z } from "zod";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  res.json({ data: ModelService.listProviders() });
});

router.get("/:id", (req: Request, res: Response) => {
  const provider = ModelService.getProvider(req.params.id);
  if (!provider) return res.status(404).json({ error: "Provider not found" });
  res.json({ data: provider });
});

const ProviderSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().url(),
  apiFormat: z.enum(["openai", "anthropic", "gemini"]).default("openai"),
  apiKey: z.string().default(""),
  enabled: z.boolean().default(true),
  priority: z.number().default(0),
  description: z.string().default(""),
});

router.post("/", (req: Request, res: Response) => {
  const parsed = ProviderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const provider = ModelService.createProvider(parsed.data as any);
  res.status(201).json({ data: provider });
});

router.put("/:id", (req: Request, res: Response) => {
  const parsed = ProviderSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const provider = ModelService.updateProvider(req.params.id, parsed.data);
  if (!provider) return res.status(404).json({ error: "Provider not found" });
  res.json({ data: provider });
});

router.delete("/:id", (req: Request, res: Response) => {
  ModelService.deleteProvider(req.params.id);
  res.json({ success: true });
});

export default router;
