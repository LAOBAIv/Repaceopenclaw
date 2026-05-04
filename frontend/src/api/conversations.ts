import apiClient from "./client";
import { Conversation, Message } from "../types";

export const conversationsApi = {
  list: async (projectId?: string): Promise<Conversation[]> => {
    const res = await apiClient.get("/conversations", { params: projectId ? { projectId } : {} });
    return res.data.data;
  },

  /**
   * 创建会话并生成项目概述（空白对话 + AI 概述消息）
   * ⚠️ 修复：AI 概述生成耗时 8-15s，全局 10s 超时不够用
   *    之前前端报超时但后端实际已成功，表现为“提示失败但列表里能看到会话”
   */
  createWithOverview: async (data: {
    title: string;
    agentIds: string[];
    projectId?: string;
    description?: string;
  }): Promise<Conversation & { messages: Message[] }> => {
    const res = await apiClient.post("/conversations/create-with-overview", data, {
      timeout: 30000, // 30s 超时，适配 AI 模型生成概述
    });
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

  /**
   * 更新会话信息（标题、项目关联等）
   */
  update: async (id: string, data: { title?: string; projectId?: string | null; taskId?: string | null }): Promise<Conversation> => {
    const res = await apiClient.put(`/conversations/${id}`, data);
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
  addAgent: async (conversationId: string, agentId: string): Promise<Conversation | undefined> => {
    const res = await apiClient.post(`/conversations/${conversationId}/agents`, { agentId });
    return res.data?.data;
  },

  /** 从会话中移除某个智能体 */
  removeAgent: async (conversationId: string, agentId: string): Promise<Conversation | undefined> => {
    const res = await apiClient.delete(`/conversations/${conversationId}/agents/${agentId}`);
    return res.data?.data;
  },

  /** 切换会话的当前 Agent */
  switchAgent: async (conversationId: string, agentId: string) => {
    const res = await apiClient.post(`/conversations/${conversationId}/switch-agent`, { agentId });
    return res.data?.data;
  },

  /** 更新会话状态 */
  updateStatus: async (conversationId: string, status: 'in_progress' | 'completed' | 'archived' | 'deleted') => {
    const res = await apiClient.patch(`/conversations/${conversationId}/status`, { status });
    return res.data?.data;
  },
};
