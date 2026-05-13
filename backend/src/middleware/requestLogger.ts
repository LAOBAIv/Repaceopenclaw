/**
 * HTTP 请求日志中间件
 * 记录所有 HTTP 请求的方法、路径、状态码、耗时
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// 跳过健康检查和静态文件的详细日志
const SKIP_PATHS = ['/health', '/favicon.ico'];

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const method = req.method;
  const path = req.originalUrl || req.url;

  // 响应完成后记录
  const originalEnd = res.end;
  res.end = function (this: Response, ...args: any[]) {
    const duration = Date.now() - start;
    const status = res.statusCode;

    // 跳过健康检查等高频无意义请求
    if (!SKIP_PATHS.some(p => path.startsWith(p))) {
      // 4xx/5xx 用 warn/error，其他用 info
      if (status >= 500) {
        logger.warn(`[HTTP] ${method} ${path} → ${status} (${duration}ms)`);
      } else if (status >= 400) {
        logger.info(`[HTTP] ${method} ${path} → ${status} (${duration}ms)`);
      } else {
        logger.info(`[HTTP] ${method} ${path} → ${status} (${duration}ms)`);
      }
    }

    return originalEnd.apply(this, args as any);
  };

  next();
}
