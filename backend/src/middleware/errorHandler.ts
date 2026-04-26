/**
 * 全局错误处理中间件
 * 统一捕获和处理所有错误，返回标准化响应
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AppError } from '../errors/AppError';
import { sendAppError, sendError, ErrorCode } from '../utils/response';

/**
 * 全局错误处理中间件
 * 必须是 Express 错误处理中间件签名：4个参数
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 记录错误日志
  logger.error('[Error]', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // 处理自定义应用错误
  if (err instanceof AppError) {
    sendAppError(res, err);
    return;
  }

  // 处理 Zod 验证错误
  if (err.name === 'ZodError') {
    sendError(
      res,
      '参数验证失败',
      ErrorCode.VALIDATION_ERROR,
      400,
      (err as any).errors || err.message
    );
    return;
  }

  // 处理 JWT 错误
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    const code = err.name === 'TokenExpiredError' 
      ? ErrorCode.AUTH_TOKEN_EXPIRED 
      : ErrorCode.AUTH_TOKEN_INVALID;
    sendError(res, '登录已过期或Token无效', code, 401);
    return;
  }

  // 处理 SQLite 错误
  if (err.message?.includes('SQLITE') || err.message?.includes('SQL')) {
    sendError(
      res,
      '数据库操作失败',
      ErrorCode.DATABASE_ERROR,
      500,
      process.env.NODE_ENV === 'development' ? err.message : undefined
    );
    return;
  }

  // 默认：未知错误
  sendError(
    res,
    process.env.NODE_ENV === 'production' 
      ? '服务器内部错误' 
      : err.message || 'Unknown error',
    ErrorCode.UNKNOWN_ERROR,
    500,
    process.env.NODE_ENV === 'development' ? err.stack : undefined
  );
}

/**
 * 404 处理中间件
 * 处理未匹配的路由
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 如果是 API 请求，返回 JSON 错误
  if (req.path.startsWith('/api') || req.path.startsWith('/v1')) {
    sendError(
      res,
      `路由不存在: ${req.method} ${req.path}`,
      ErrorCode.NOT_FOUND,
      404
    );
    return;
  }
  
  // 否则交给下一个中间件（可能是静态文件服务）
  next();
}
