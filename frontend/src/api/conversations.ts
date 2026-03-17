import apiClient from "./client";
import { Conversation, Message } from "../types";

export const conversationsApi = {
  list: async (projectId?: string): Promise<Conversation[]> => {
    const res = await apiClient.get("/conversations", { params: projectId ? { projectId } : {} });
    return res.data.data;
  },

  /**
   * 创建会话
   * - 新版：传 agentIds 数组，支持多智能体
   * - 兼容旧版：也可传 agentId 单字符串（后端自动处理）
   */
  create: async (data: {
    agentId?: string;
    agentIds?: string[];
    projectId?: string;
    title?: string;
  }): Promise<Conversation> => {
    const res = await apiClient.post("/conversations", data);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/conversations/${id}`);
  },

  getMessages: async (conversationId: string): Promise<Message[]> => {
    const res = await apiClient.get(`/conversations/${conversationId}/messages`);
    return res.data.data;
  },

  sendMessage: async (conversationId: string, content: string): Promise<Message> => {
    const res = await apiClient.post(`/conversations/${conversationId}/messages`, { role: "user", content });
    return res.data.data;
  },

  /** 向已有会话追加新智能体（幂等） */
  addAgent: async (conversationId: string, agentId: string): Promise<void> => {
    await apiClient.post(`/conversations/${conversationId}/agents`, { agentId });
  },

  /** 从会话中移除某个智能体 */
  removeAgent: async (conversationId: string, agentId: string): Promise<void> => {
    await apiClient.delete(`/conversations/${conversationId}/agents/${agentId}`);
  },
};

