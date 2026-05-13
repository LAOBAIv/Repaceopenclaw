/**
 * 自定义错误类
 * 统一错误处理，支持错误码和状态码
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
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// 便捷工厂方法
export const Errors = {
  // 400 - Bad Request
  badRequest(message: string, details?: unknown): AppError {
    return new AppError(message, ErrorCode.VALIDATION_ERROR, 400, details);
  },

  // 401 - Unauthorized
  unauthorized(message: string = '未登录或登录已过期'): AppError {
    return new AppError(message, ErrorCode.UNAUTHORIZED, 401);
  },

  // 403 - Forbidden
  forbidden(message: string = '权限不足'): AppError {
    return new AppError(message, ErrorCode.FORBIDDEN, 403);
  },

  // 404 - Not Found
  notFound(resource: string = '资源'): AppError {
    return new AppError(`${resource}不存在`, ErrorCode.NOT_FOUND, 404);
  },

  // 409 - Conflict
  conflict(message: string): AppError {
    return new AppError(message, ErrorCode.VALIDATION_ERROR, 409);
  },

  // 422 - Unprocessable Entity
  validation(message: string, details?: unknown): AppError {
    return new AppError(message, ErrorCode.VALIDATION_ERROR, 422, details);
  },

  // 500 - Internal Server Error
  internal(message: string = '服务器内部错误'): AppError {
    return new AppError(message, ErrorCode.UNKNOWN_ERROR, 500);
  },

  // 503 - Service Unavailable
  serviceUnavailable(message: string): AppError {
    return new AppError(message, ErrorCode.UNKNOWN_ERROR, 503);
  },

  // 外部服务错误
  externalService(service: string, message?: string): AppError {
    return new AppError(
      message || `${service}服务异常`,
      ErrorCode.LLM_SERVICE_ERROR,
      502
    );
  },
};

/**
 * 错误转换器
 * 将未知错误转换为 AppError
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(
      error.message,
      ErrorCode.UNKNOWN_ERROR,
      500
    );
  }

  return Errors.internal('未知错误');
}
