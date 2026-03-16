import { Router, Request, Response } from "express";
import { SkillService } from "../services/SkillService";
import { AgentService } from "../services/AgentService";
import { z } from "zod";

const router = Router();

const SkillCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  category: z.string().default("general"),
  type: z.enum(["builtin", "custom"]).default("builtin"),
  config: z.record(z.unknown()).default({}),
  enabled: z.boolean().default(true),
});

const SkillUpdateSchema = SkillCreateSchema.partial();

// ── Skill CRUD ────────────────────────────────────────────────────────────────

/** GET /api/skills — 获取所有技能 */
router.get("/", (_req: Request, res: Response) => {
  res.json({ data: SkillService.list() });
});

// !! 静态路由必须在动态路由 /:id 之前注册，否则 /agent/:agentId 会被 /:id 吞掉

/** GET /api/skills/agent/:agentId — 获取 agent 绑定的所有技能 */
router.get("/agent/:agentId", (req: Request, res: Response) => {
  const agent = AgentService.getById(req.params.agentId);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  res.json({ data: SkillService.listByAgent(req.params.agentId) });
});

/** GET /api/skills/:id — 获取单个技能 */
router.get("/:id", (req: Request, res: Response) => {
  const skill = SkillService.getById(req.params.id);
  if (!skill) return res.status(404).json({ error: "Skill not found" });
  res.json({ data: skill });
});

/** POST /api/skills — 创建技能 */
router.post("/", (req: Request, res: Response) => {
  const parsed = SkillCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const skill = SkillService.create(parsed.data as Parameters<typeof SkillService.create>[0]);
  res.status(201).json({ data: skill });
});

/** PUT /api/skills/:id — 更新技能 */
router.put("/:id", (req: Request, res: Response) => {
  const parsed = SkillUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const skill = SkillService.update(req.params.id, parsed.data);
  if (!skill) return res.status(404).json({ error: "Skill not found" });
  res.json({ data: skill });
});

/** DELETE /api/skills/:id — 删除技能 */
router.delete("/:id", (req: Request, res: Response) => {
  const skill = SkillService.getById(req.params.id);
  if (!skill) return res.status(404).json({ error: "Skill not found" });
  SkillService.delete(req.params.id);
  res.json({ success: true });
});

/** PATCH /api/skills/:id/enabled — 启用 / 禁用技能 */
router.patch("/:id/enabled", (req: Request, res: Response) => {
  const { enabled } = req.body;
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "enabled (boolean) required" });
  }
  const skill = SkillService.setEnabled(req.params.id, enabled);
  if (!skill) return res.status(404).json({ error: "Skill not found" });
  res.json({ data: skill });
});

// ── Agent binding ─────────────────────────────────────────────────────────────

/** POST /api/skills/:id/bind — 将技能绑定到 agent */
router.post("/:id/bind", (req: Request, res: Response) => {
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: "agentId required" });

  const skill = SkillService.getById(req.params.id);
  if (!skill) return res.status(404).json({ error: "Skill not found" });

  const agent = AgentService.getById(agentId);
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  SkillService.bindToAgent(agentId, req.params.id);
  res.json({ success: true, data: { agentId, skillId: req.params.id } });
});

/** DELETE /api/skills/:id/bind — 解除技能与 agent 的绑定 */
router.delete("/:id/bind", (req: Request, res: Response) => {
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: "agentId required" });

  SkillService.unbindFromAgent(agentId, req.params.id);
  res.json({ success: true });
});

export default router;
