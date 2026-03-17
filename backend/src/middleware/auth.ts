import { Request, Response, NextFunction } from "express";
import { UserService, UserRole } from "../services/UserService";

// 扩展 Request 类型，附加 user 信息
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; role: UserRole };
    }
  }
}

// JWT 鉴权中间件
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "未登录，请先登录" });
  }

  const token = authHeader.slice(7);
  try {
    const payload = UserService.verifyToken(token);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "登录已过期，请重新登录" });
  }
}

// RBAC 角色权限中间件
export function requireRole(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "未登录，请先登录" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "权限不足" });
    }
    next();
  };
}
