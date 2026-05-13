/**
 * 工具函数集合
 */

import { Response } from 'express';
import { ErrorCode } from '../types';
import { AppError } from '../errors/AppError';

// ============ API 响应工具 ============

/**
 * 发送成功响应
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): void {
  res.status(statusCode).json({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 发送创建成功响应 (201)
 */
export function sendCreated<T>(
  res: Response,
  data: T,
  message?: string
): void {
  sendSuccess(res, data, message, 201);
}

/**
 * 发送无内容响应 (204)
 */
export function sendNoContent(res: Response): void {
  res.status(204).send();
}

// ============ 错误响应工具 ============

/**
 * 发送错误响应
 */
export function sendError(
  res: Response,
  message: string,
  code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
  statusCode: number = 500,
  details?: unknown
): void {
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * 从 AppError 发送错误响应
 */
export function sendAppError(res: Response, error: AppError): void {
  sendError(res, error.message, error.code, error.statusCode, error.details);
}

/**
 * 发送验证错误响应
 */
export function sendValidationError(
  res: Response,
  message: string = '参数验证失败',
  details?: unknown
): void {
  sendError(res, message, ErrorCode.VALIDATION_ERROR, 400, details);
}

/**
 * 发送未找到错误响应
 */
export function sendNotFound(
  res: Response,
  resource: string = '资源'
): void {
  sendError(res, `${resource}不存在`, ErrorCode.NOT_FOUND, 404);
}

/**
 * 发送未授权错误响应
 */
export function sendUnauthorized(
  res: Response,
  message: string = '未登录，请先登录'
): void {
  sendError(res, message, ErrorCode.UNAUTHORIZED, 401);
}

/**
 * 发送禁止访问错误响应
 */
export function sendForbidden(
  res: Response,
  message: string = '权限不足'
): void {
  sendError(res, message, ErrorCode.FORBIDDEN, 403);
}

// ============ 通用工具函数 ============

/**
 * 包装异步路由处理函数，自动捕获错误
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: import('express').NextFunction) => Promise<void> | void
) {
  return (req: Request, res: Response, next: import('express').NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 生成 UUID v4
 */
export function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}

/**
 * 安全地解析 JSON
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * 格式化日期为 ISO 字符串
 */
export function now(): string {
  return new Date().toISOString();
}
