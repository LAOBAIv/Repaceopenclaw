import { Router, Request, Response } from "express";
import { AgentService } from "../services/AgentService";
import { authenticate, requireRole } from "../middleware/auth";
import { getDb } from "../db/client";
import { z } from "zod";

const router = Router();

// 所有管理路由都需要管理员权限
const adminOnly = [authenticate, requireRole(["super_admin", "admin"])];

// GET /api/admin/user-agents — 获取所有用户的智能体列表（含用户信息）
router.get("/", ...adminOnly, (req: Request, res: Response) => {
  const db = getDb();

  // 联表查询：agents + users，获取智能体及其所属用户信息
  const query = `
    SELECT 
      a.id, a.name, a.color, a.description, a.status, a.model_name, a.model_provider,
      a.token_used, a.visibility, a.created_at, a.user_id,
      u.username, u.email, u.user_code, u.role as user_role
    FROM agents a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC
  `;

  const result = db.exec(query);
  const rows = !result.length
    ? []
    : result[0].values.map((valueRow: any[]) => {
        const obj: any = {};
        result[0].columns.forEach((col: string, i: number) => {
          obj[col] = valueRow[i];
        });
        return obj;
      });

  // 格式化返回数据
  const agents = rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    description: row.description || "",
    status: row.status || "idle",
    modelName: row.model_name || "",
    modelProvider: row.model_provider || "",
    tokenUsed: row.token_used || 0,
    visibility: row.visibility || "private",
    createdAt: row.created_at,
    userId: row.user_id || "",
    user: row.user_id ? {
      username: row.username || "",
      email: row.email || "",
      userCode: row.user_code || "",
      role: row.user_role || "user",
    } : null,
  }));
  
  res.json({ data: agents });
});

// GET /api/admin/user-agents/:id — 获取单个智能体详情（含用户信息）
router.get("/:id", ...adminOnly, (req: Request, res: Response) => {
  const agent = AgentService.getById(req.params.id);
  if (!agent) return res.status(404).json({ error: "智能体不存在" });

  let user: {
    username: string;
    email: string;
    userCode: string;
    role: string;
  } | null = null;

  // 补充用户信息
  const db = getDb();
  if (agent.userId) {
    const userQuery = `SELECT username, email, user_code, role FROM users WHERE id = ?`;
    const userRow = db.prepare(userQuery).get([agent.userId]);
    if (userRow) {
      user = {
        username: (userRow as any).username || "",
        email: (userRow as any).email || "",
        userCode: (userRow as any).user_code || "",
        role: (userRow as any).role || "user",
      };
    }
  }

  res.json({
    data: {
      ...agent,
      user,
    },
  });
});

// DELETE /api/admin/user-agents/:id — 删除智能体（管理员权限）
router.delete("/:id", ...adminOnly, (req: Request, res: Response) => {
  const agent = AgentService.getById(req.params.id);
  if (!agent) return res.status(404).json({ error: "智能体不存在" });
  
  AgentService.delete(req.params.id);
  res.json({ success: true, message: "智能体已删除" });
});

// PUT /api/admin/user-agents/:id/status — 更新智能体状态
const StatusSchema = z.object({
  status: z.enum(["active", "idle", "busy"]),
});

router.put("/:id/status", ...adminOnly, (req: Request, res: Response) => {
  const parsed = StatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "无效的状态值" });
  }
  
  const agent = AgentService.getById(req.params.id);
  if (!agent) return res.status(404).json({ error: "智能体不存在" });
  
  AgentService.update(req.params.id, { status: parsed.data.status });
  res.json({ success: true, message: "状态已更新" });
});

export default router;