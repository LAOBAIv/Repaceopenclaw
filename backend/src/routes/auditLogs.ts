import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { AuditService } from "../services/AuditService";

const router = Router();

// GET /api/audit-logs — 获取审计日志（管理员）
router.get("/", authenticate, (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user.role !== "super_admin" && user.role !== "admin") {
    return res.status(403).json({ error: "仅管理员可访问审计日志" });
  }

  const userId = req.query.userId as string | undefined;
  const resource = req.query.resource as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const logs = AuditService.list({ userId, resource, limit, offset });
  res.json({ data: logs });
});

export default router;
