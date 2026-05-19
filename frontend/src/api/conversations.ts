import apiClient from "./client";
import { Conversation, Message } from "../types";

export const conversationsApi = {
  list: async (projectId?: string, status?: string): Promise<Conversation[]> => {
    const params: Record<string, string> = {};
    if (projectId) params.projectId = projectId;
    if (status) params.status = status;
    const res = await apiClient.get("/conversations", { params });
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
    // 🔧 关键修复 (2026-05-12): 阻止对占位符ID的API调用
    if (conversationId === 'wechat-assistant' || conversationId === 'platform-assistant') {
      // 这些是占位符ID，不应直接用于API调用
      console.warn('[getMessages] 尝试使用占位符ID调用API:', conversationId);
      return [];
    }
    
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
  updateStatus: async (conversationId: string, status: 'active' | 'in_progress' | 'completed' | 'archived' | 'deleted' | 'closed') => {
    const res = await apiClient.patch(`/conversations/${conversationId}/status`, { status });
    return res.data?.data;
  },

  /**
   * 获取或创建微信助手专属会话
   * - 每个用户有且仅有一个微信助手会话
   * - 首次访问自动创建
   */
  getWechatAssistant: async (): Promise<Conversation & { messages: Message[] }> => {
    const res = await apiClient.get('/conversations/wechat-assistant');
    return res.data.data;
  },
};
