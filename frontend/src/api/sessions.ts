/**
 * Sessions API 客户端 — 会话列表管理
 */
import apiClient from './client';

export interface SessionIndexItem {
  id: string;
  title: string;
  agentId: string;
  currentAgentId?: string;
  agentIds: string[];
  sessionCode?: string;
  currentAgentCode?: string;
  ocSessionKey?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  messageCount: number;
  lastMessage: string;
}

export interface SessionDetail extends SessionIndexItem {
  messages: Array<{
    id: string;
    conversation_id: string;
    role: 'user' | 'agent';
    content: string;
    created_at: string;
  }>;
}

export interface SessionPreview extends SessionIndexItem {
  messages: Array<{
    id: string;
    messageCode?: string;
    role: 'user' | 'agent';
    content: string;
    createdAt: string;
  }>;
  hasMore: boolean;
}

export const sessionsApi = {
  /** 获取会话索引列表（自动同步 OpenClaw 会话） */
  async list(): Promise<SessionIndexItem[]> {
    const res = await apiClient.get('/sessions');
    return res.data?.data || [];
  },

  /** 获取完整会话（含所有消息） */
  async get(id: string): Promise<SessionDetail> {
    const res = await apiClient.get(`/sessions/${id}`);
    return res.data?.data;
  },

  /** 获取会话预览（最近 N 条消息） */
  async preview(id: string, limit = 20): Promise<SessionPreview> {
    const res = await apiClient.get(`/sessions/${id}/preview`, { params: { limit } });
    return res.data?.data;
  },

  /** 手动触发同步 OpenClaw sessions */
  async sync(): Promise<{ synced: number; total: number; errors: string[] }> {
    const res = await apiClient.post('/sessions/sync');
    return res.data?.data || { synced: 0, total: 0, errors: [] };
  },
};
