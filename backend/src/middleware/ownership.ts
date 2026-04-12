/**
 * 资源归属校验中间件
 * 确保用户只能操作自己拥有的资源，越权返回 403
 * 管理员可访问所有资源
 */
import { Request, Response, NextFunction } from "express";
import { getDb } from "../db/client";
import { authenticate } from "./auth";

type ResourceType = "agent" | "conversation" | "project" | "task" | "token-channel" | "message";

const TABLE_MAP: Record<ResourceType, string> = {
  agent: "agents",
  conversation: "conversations",
  project: "projects",
  task: "tasks",
  "token-channel": "token_channels",
  message: "messages",
};

/**
 * 校验资源归属
 * 用法: router.put('/:id', authenticate, ensureOwnership('agent'), handler)
 */
export function ensureOwnership(resourceType: ResourceType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "未登录" });

    // 管理员跳过归属校验
    if (user.role === "super_admin" || user.role === "admin") return next();

    const resourceId = req.params.id;
    if (!resourceId) return next(); // 列表请求，不需要校验单个资源

    const table = TABLE_MAP[resourceType];
    if (!table) return next();

    try {
      const db = getDb();
      const result = db.exec(`SELECT user_id FROM ${table} WHERE id = ?`, [resourceId]);
      if (!result.length || !result[0].values.length) {
        return next(); // 资源不存在，交给后续逻辑处理
      }
      const ownerId = result[0].values[0][0] as string;
      if (!ownerId || ownerId !== user.id) {
        return res.status(403).json({ error: "无权限访问此资源" });
      }
    } catch {
      // 查询失败，不阻塞请求
    }

    next();
  };
}
