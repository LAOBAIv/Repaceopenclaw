/**
 * 用户会话管理 API 接口
 * 提供会话列表、删除、状态更新等前端调用方法
 */
import apiClient from "./client";

const BASE = "/admin/user-agents";

/** 会话统计信息 */
export interface UserAgentsStats {
  totalConversations: number;
  totalUsers: number;
  totalMessages: number;
  activeConversations: number;
}

/** 用户会话记录（conversation 维度） */
export interface UserAgentConversation {
  conversationId: string;
  title: string;
  status: "active" | "in_progress" | "archived" | "closed";
  lastMessageAt: string;
  conversationType: string | null;
  userId: string;
  username: string;
  email: string;
  agentId: string;
  agentName: string;
  agentColor: string;
  modelName: string;
  modelProvider: string;
  agentType: string;
  openclawAgentId: string;
  messageCount: number;
}

export interface UserAgentsListResponse {
  data: UserAgentConversation[];
  stats: UserAgentsStats;
}

export const adminUserAgentsApi = {
  /** 获取所有用户会话列表（含统计信息） */
  async list(): Promise<UserAgentsListResponse> {
    const res = await apiClient.get(BASE);
    return res.data;
  },

  /** 删除会话（管理员权限） */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`${BASE}/${id}`);
  },

  /** 更新会话状态 */
  async updateStatus(id: string, status: "active" | "in_progress" | "archived" | "closed"): Promise<void> {
    await apiClient.put(`${BASE}/${id}/status`, { status });
  },
};
