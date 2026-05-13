import apiClient from "./client";

const BASE = "/admin/user-agents";

export interface UserAgent {
  id: string;
  name: string;
  color: string;
  description: string;
  status: "active" | "idle" | "busy";
  modelName: string;
  modelProvider: string;
  tokenUsed: number;
  visibility: "private" | "public" | "template";
  createdAt: string;
  userId: string;
  user: {
    username: string;
    email: string;
    userCode: string;
    role: string;
  } | null;
}

export const adminUserAgentsApi = {
  /** 获取所有用户的智能体列表（含用户信息） */
  async list(): Promise<UserAgent[]> {
    const res = await apiClient.get(BASE);
    return res.data.data || [];
  },

  /** 获取单个智能体详情（含用户信息） */
  async getById(id: string): Promise<UserAgent> {
    const res = await apiClient.get(`${BASE}/${id}`);
    return res.data.data;
  },

  /** 删除智能体（管理员权限） */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`${BASE}/${id}`);
  },

  /** 更新智能体状态 */
  async updateStatus(id: string, status: "active" | "idle" | "busy"): Promise<void> {
    await apiClient.put(`${BASE}/${id}/status`, { status });
  },
};