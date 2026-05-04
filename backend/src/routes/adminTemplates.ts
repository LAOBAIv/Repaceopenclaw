import { Router, Request, Response } from "express";
import { AgentTemplateService } from "../services/AgentTemplateService";
import { authenticate, requireRole } from "../middleware/auth";
import { z } from "zod";

const router = Router();

// 所有管理路由都需要管理员权限
const adminOnly = [authenticate, requireRole(["super_admin", "admin"])];

// GET /api/admin/templates — 获取模板列表
router.get("/", ...adminOnly, (req: Request, res: Response) => {
  const templates = AgentTemplateService.list();
  res.json({ data: templates });
});

// GET /api/admin/templates/:id — 获取模板详情
router.get("/:id", ...adminOnly, (req: Request, res: Response) => {
  const template = AgentTemplateService.getById(req.params.id);
  if (!template) return res.status(404).json({ error: "模板不存在" });
  res.json({ data: template });
});

// POST /api/admin/templates — 创建新模板
const CreateSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  emoji: z.string().optional(),
  color: z.string().optional(),
  vibe: z.string().optional(),
  description: z.string().optional(),
  systemPrompt: z.string().optional(),
  writingStyle: z.string().optional(),
  expertise: z.array(z.string()).optional(),
  outputFormat: z.string().optional(),
  githubSource: z.string().optional(),
}).passthrough();

router.post("/", ...adminOnly, (req: Request, res: Response) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const template = AgentTemplateService.create(parsed.data);
    res.status(201).json({ data: template });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/admin/templates/:id — 更新模板
router.put("/:id", ...adminOnly, (req: Request, res: Response) => {
  const template = AgentTemplateService.getById(req.params.id);
  if (!template) return res.status(404).json({ error: "模板不存在" });
  try {
    const updated = AgentTemplateService.update(req.params.id, req.body);
    res.json({ data: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/admin/templates/:id — 删除模板
router.delete("/:id", ...adminOnly, (req: Request, res: Response) => {
  const success = AgentTemplateService.delete(req.params.id);
  if (!success) return res.status(404).json({ error: "模板不存在" });
  res.json({ data: { success: true } });
});

export default router;