/**
 * 自定义应用错误类
 * 统一错误处理，支持错误码和HTTP状态码
 */

import { ErrorCode } from '../types';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    statusCode: number = 500,
    details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // 保持堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

// ============ 4xx 客户端错误 ============

export class ValidationError extends AppError {
  constructor(message: string = '参数验证失败', details?: unknown) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, details);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = '资源已存在') {
    super(message, ErrorCode.VALIDATION_ERROR, 409);
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = '未登录，请先登录') {
    super(message, ErrorCode.UNAUTHORIZED, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = '权限不足') {
    super(message, ErrorCode.FORBIDDEN, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = '资源') {
    super(`${resource}不存在`, ErrorCode.NOT_FOUND, 404);
    this.name = 'NotFoundError';
  }
}

// ============ 特定业务错误 ============

export class AuthError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCode.AUTH_INVALID_CREDENTIALS) {
    super(message, code, 401);
    this.name = 'AuthError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = '数据库操作失败') {
    super(message, ErrorCode.DATABASE_ERROR, 500);
    this.name = 'DatabaseError';
  }
}

export class LLMServiceError extends AppError {
  constructor(message: string = 'LLM服务调用失败') {
    super(message, ErrorCode.LLM_SERVICE_ERROR, 502);
    this.name = 'LLMServiceError';
  }
}
