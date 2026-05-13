/**
 * 全链路 Request ID 中间件
 * 为每个请求生成唯一 requestId，贯穿整个请求生命周期
 */
import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers["x-request-id"] as string) || uuidv4();
  res.setHeader("X-Request-Id", requestId);
  (req as any).requestId = requestId;
  next();
}
