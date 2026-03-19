/**
 * API 响应工具函数
 * 统一封装成功和错误响应格式
 */

import { Response } from 'express';
import { ApiSuccessResponse, ApiErrorResponse, ErrorCode } from '../types';
import { AppError } from './AppError';

/**
 * 发送成功响应
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): void {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
  res.status(statusCode).json(response);
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
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
  };
  res.status(statusCode).json(response);
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
