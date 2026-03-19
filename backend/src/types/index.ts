/**
 * 通用类型定义
 * 统一接口规范，减少 any 类型使用
 */

import { Request, Response } from 'express';

// ============ API 响应类型 ============

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============ 分页类型 ============

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedData<T> {
  list: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ============ 通用实体类型 ============

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt?: string;
}

export type EntityStatus = 'active' | 'inactive' | 'deleted';

// ============ Express 扩展类型 ============

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export type ApiHandler = (req: AuthenticatedRequest, res: Response) => Promise<void> | void;

// ============ 错误码定义 ============

export enum ErrorCode {
  // 通用错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  // 认证相关
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  
  // 业务错误
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  CONVERSATION_NOT_FOUND = 'CONVERSATION_NOT_FOUND',
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  
  // 外部服务错误
  LLM_SERVICE_ERROR = 'LLM_SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

// ============ Token 统计类型 ============

export interface TokenStats {
  agentId: string;
  agentName: string;
  tokenUsed: number;
  tokenFromMessages: number;
  messageCount: number;
  avgTokenPerMsg: number;
  perConversation: Array<{
    conversationId: string;
    messageCount: number;
    totalTokens: number;
  }>;
}

// ============ WebSocket 类型 ============

export interface WSMessage {
  type: string;
  payload: unknown;
  timestamp: string;
}

export interface StreamChunkMessage extends WSMessage {
  type: 'stream:chunk';
  payload: {
    conversationId: string;
    agentId: string;
    content: string;
  };
}

export interface StreamCompleteMessage extends WSMessage {
  type: 'stream:complete';
  payload: {
    conversationId: string;
    agentId: string;
    tokenCount: number;
  };
}

export interface StreamErrorMessage extends WSMessage {
  type: 'stream:error';
  payload: {
    conversationId: string;
    agentId: string;
    error: string;
  };
}
