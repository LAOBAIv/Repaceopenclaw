import { Router, Request, Response } from "express";
import { PluginService } from "../services/PluginService";
import { AgentService } from "../services/AgentService";
import { z } from "zod";
import { authenticate, requireRole } from "../middleware/auth";

const router = Router();

const PluginInstallSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  version: z.string().default("1.0.0"),
  author: z.string().default(""),
  homepage: z.string().default(""),
  icon: z.string().default(""),
  category: z.string().default("general"),
  config: z.record(z.unknown()).default({}),
  manifest: z.record(z.unknown()).default({}),
  enabled: z.boolean().default(true),
});

const PluginUpdateSchema = PluginInstallSchema.partial();

// ── Plugin CRUD ───────────────────────────────────────────────────────────────

/** GET /api/plugins — 获取所有已安装插件 */
router.get("/", authenticate, (_req: Request, res: Response) => {
  res.json({ data: PluginService.list() });
});

// !! 静态路由必须在动态路由 /:id 之前注册，否则 /agent/:agentId 会被 /:id 吞掉

/** GET /api/plugins/agent/:agentId — 获取 agent 绑定的所有插件 */
router.get("/agent/:agentId", authenticate, (req: Request, res: Response) => {
  const agent = AgentService.getById(req.params.agentId);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  res.json({ data: PluginService.listByAgent(req.params.agentId) });
});

/** GET /api/plugins/:id — 获取单个插件 */
router.get("/:id", authenticate, (req: Request, res: Response) => {
  const plugin = PluginService.getById(req.params.id);
  if (!plugin) return res.status(404).json({ error: "Plugin not found" });
  res.json({ data: plugin });
});

/** POST /api/plugins — 安装插件（仅管理员） */
router.post("/", authenticate, requireRole(["super_admin", "admin"]), (req: Request, res: Response) => {
  const parsed = PluginInstallSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const plugin = PluginService.install(parsed.data as Parameters<typeof PluginService.install>[0]);
  res.status(201).json({ data: plugin });
});

/** PUT /api/plugins/:id — 更新插件（仅管理员） */
router.put("/:id", authenticate, requireRole(["super_admin", "admin"]), (req: Request, res: Response) => {
  const parsed = PluginUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const plugin = PluginService.update(req.params.id, parsed.data);
  if (!plugin) return res.status(404).json({ error: "Plugin not found" });
  res.json({ data: plugin });
});

/** DELETE /api/plugins/:id — 卸载插件（仅管理员） */
router.delete("/:id", authenticate, requireRole(["super_admin", "admin"]), (req: Request, res: Response) => {
  const plugin = PluginService.getById(req.params.id);
  if (!plugin) return res.status(404).json({ error: "Plugin not found" });
  PluginService.uninstall(req.params.id);
  res.json({ success: true });
});

/** PATCH /api/plugins/:id/enabled — 启用/禁用（仅管理员） */
router.patch("/:id/enabled", authenticate, requireRole(["super_admin", "admin"]), (req: Request, res: Response) => {
  const { enabled } = req.body;
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "enabled (boolean) required" });
  }
  const plugin = PluginService.setEnabled(req.params.id, enabled);
  if (!plugin) return res.status(404).json({ error: "Plugin not found" });
  res.json({ data: plugin });
});

/** PUT /api/plugins/:id/config — 更新插件配置（仅管理员） */
router.put("/:id/config", authenticate, requireRole(["super_admin", "admin"]), (req: Request, res: Response) => {
  const { config } = req.body;
  if (!config || typeof config !== "object") {
    return res.status(400).json({ error: "config (object) required" });
  }
  const plugin = PluginService.update(req.params.id, { config });
  if (!plugin) return res.status(404).json({ error: "Plugin not found" });
  res.json({ data: plugin });
});

// ── Agent binding ─────────────────────────────────────────────────────────────

/** POST /api/plugins/:id/bind — 绑定插件到 agent */
router.post("/:id/bind", authenticate, (req: Request, res: Response) => {
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: "agentId required" });

  const plugin = PluginService.getById(req.params.id);
  if (!plugin) return res.status(404).json({ error: "Plugin not found" });

  const agent = AgentService.getById(agentId);
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  PluginService.bindToAgent(agentId, req.params.id);
  res.json({ success: true, data: { agentId, pluginId: req.params.id } });
});

/** DELETE /api/plugins/:id/bind — 解除绑定 */
router.delete("/:id/bind", authenticate, (req: Request, res: Response) => {
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: "agentId required" });

  PluginService.unbindFromAgent(agentId, req.params.id);
  res.json({ success: true });
});

export default router;
