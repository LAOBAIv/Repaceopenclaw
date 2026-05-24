/**
 * 用户会话管理路由（conversation 维度）
 * 提供会话列表查询、删除、状态更新等管理接口
 */
import { Router, Request, Response } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { getDb } from "../db/client";
import { z } from "zod";

const router = Router();
const adminOnly = [authenticate, requireRole(["super_admin", "admin"])];

/** GET /api/admin/user-agents — 获取所有用户会话列表（含用户和智能体信息） */
router.get("/", ...adminOnly, (_req: Request, res: Response) => {
  const db = getDb();

  const query = `
    SELECT
      c.id as conversation_id, c.title, c.status, c.last_message_at, c.conversation_type,
      c.user_id, c.created_at as conv_created_at, c.scope_type, c.memory_policy,
      c.oc_session_key, c.agent_ids, c.project_id, c.task_id,
      u.username, u.email, u.role as user_role,
      c.agent_id, a.name as agent_name, a.color as agent_color,
      a.model_name, a.model_provider, a.agent_type, a.openclaw_agent_id,
      a.temperature, a.max_tokens, a.visibility as agent_visibility,
      a.token_used, a.description as agent_description,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count,
      (SELECT SUM(COALESCE(m.token_count,0)) FROM messages m WHERE m.conversation_id = c.id) as total_tokens
    FROM conversations c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN agents a ON c.agent_id = a.id
      OR c.agent_id = a.openclaw_agent_id
      OR c.agent_id = a.agent_code
    ORDER BY c.last_message_at DESC
  `;

  const result = db.exec(query);
  const rows = !result.length
    ? []
    : result[0].values.map((valueRow: unknown[]) => { // [2026-05-24] 类型安全
        // [2026-05-24] 类型安全：any → Record<string, unknown>
        const obj: Record<string, unknown> = {};
        result[0].columns.forEach((col: string, i: number) => {
          obj[col] = valueRow[i];
        });
        return obj;
      });

  const data = rows.map((row: Record<string, unknown>) => ({ // [2026-05-24] 类型安全
    conversationId: row.conversation_id,
    title: row.title || "New Conversation",
    status: row.status || "in_progress",
    lastMessageAt: row.last_message_at || "",
    createdAt: row.conv_created_at || "",
    conversationType: row.conversation_type || "",
    scopeType: row.scope_type || "",
    memoryPolicy: row.memory_policy || "",
    ocSessionKey: row.oc_session_key || "",
    projectId: row.project_id || "",
    taskId: row.task_id || "",
    userId: row.user_id || "",
    username: row.username || "",
    email: row.email || "",
    userRole: row.user_role || "",
    agentId: row.agent_id || "",
    agentName: row.agent_name || "",
    agentColor: row.agent_color || "",
    agentDescription: row.agent_description || "",
    agentVisibility: row.agent_visibility || "",
    modelName: row.model_name || "",
    modelProvider: row.model_provider || "",
    temperature: row.temperature ?? null,
    maxTokens: row.max_tokens ?? null,
    agentType: row.agent_type || "",
    openclawAgentId: row.openclaw_agent_id || "",
    tokenUsed: Number(row.token_used) || 0,
    messageCount: Number(row.message_count) || 0,
    totalTokens: Number(row.total_tokens) || 0,
  }));

  // 统计信息
  const statsQuery = `
    SELECT
      COUNT(*) as totalConversations,
      COUNT(DISTINCT c.user_id) as totalUsers,
      (SELECT COUNT(*) FROM messages) as totalMessages,
      SUM(CASE WHEN c.status = 'active' THEN 1 ELSE 0 END) as activeConversations
    FROM conversations c
  `;
  const statsResult = db.exec(statsQuery);
  const stats = statsResult.length
    ? (() => {
        // [2026-05-24] 类型安全：any → Record<string, unknown>
        const s: Record<string, unknown> = {};
        statsResult[0].columns.forEach((col: string, i: number) => {
          s[col] = Number(statsResult[0].values[0][i]);
        });
        return s;
      })()
    : { totalConversations: 0, totalUsers: 0, totalMessages: 0, activeConversations: 0 };

  res.json({ data, stats });
});

/** DELETE /api/admin/user-agents/:id — 删除会话（管理员权限） */
router.delete("/:id", ...adminOnly, (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare("SELECT id FROM conversations WHERE id = ?").get([req.params.id]);
  if (!row) return res.status(404).json({ error: "会话不存在" });

  db.prepare("DELETE FROM conversations WHERE id = ?").run([req.params.id]);
  res.json({ success: true, message: "会话已删除" });
});

/** PUT /api/admin/user-agents/:id/status — 更新会话状态 */
const StatusSchema = z.object({
  status: z.enum(["active", "in_progress", "archived", "closed"]),
});

router.put("/:id/status", ...adminOnly, (req: Request, res: Response) => {
  const parsed = StatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "无效的状态值" });

  const db = getDb();
  const row = db.prepare("SELECT id FROM conversations WHERE id = ?").get([req.params.id]);
  if (!row) return res.status(404).json({ error: "会话不存在" });

  db.prepare("UPDATE conversations SET status = ? WHERE id = ?").run([parsed.data.status, req.params.id]);
  res.json({ success: true, message: "状态已更新" });
});

export default router;
