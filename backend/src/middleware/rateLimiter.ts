/**
 * 接口限流中间件
 * 基于内存的滑动窗口限流（生产环境建议换为 Redis）
 */
import { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// 内存存储（单实例适用，多实例需换 Redis）
const store = new Map<string, RateLimitEntry>();

interface RateLimitOptions {
  /** 时间窗口（毫秒） */
  windowMs: number;
  /** 窗口内最大请求数 */
  max: number;
  /** 生成限流 key 的函数 */
  keyGenerator?: (req: Request) => string;
  /** 限流响应消息 */
  message?: string;
  /** 限流 HTTP 状态码 */
  statusCode?: number;
}

export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs = 60_000,
    max = 100,
    keyGenerator = (req) => req.ip || "unknown",
    message = "请求过于频繁，请稍后再试",
    statusCode = 429,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;
    const remaining = Math.max(0, max - entry.count);

    res.set({
      "X-RateLimit-Limit": String(max),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(entry.resetAt),
    });

    if (entry.count > max) {
      return res.status(statusCode).json({
        code: statusCode,
        data: null,
        msg: message,
      });
    }

    next();
  };
}

// 预设限流规则
export const apiLimiter = createRateLimiter({
  windowMs: 60_000,  // 1 分钟
  max: 120,
  keyGenerator: (req) => (req as any).userId || req.ip || "anonymous",
  message: "接口请求过于频繁，请稍后再试",
});

export const chatLimiter = createRateLimiter({
  windowMs: 60_000,  // 1 分钟
  max: 30,           // 每分钟最多 30 次对话
  keyGenerator: (req) => (req as any).userId || req.ip || "anonymous",
  message: "对话次数已达上限，请稍后再试",
});

export const authLimiter = createRateLimiter({
  windowMs: 60_000,  // 1 分钟
  max: 10,           // 登录每分钟最多 10 次
  keyGenerator: (req) => req.ip || "anonymous",
  message: "登录尝试过于频繁，请稍后再试",
});

/** 定期清理过期条目 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60_000);
