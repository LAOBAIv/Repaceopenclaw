import apiClient from "./client";
import { Conversation, Message } from "../types";

export const conversationsApi = {
  list: async (projectId?: string): Promise<Conversation[]> => {
    const res = await apiClient.get("/conversations", { params: projectId ? { projectId } : {} });
    return res.data.data;
  },
  create: async (data: { agentId: string; projectId?: string; title?: string }): Promise<Conversation> => {
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
    const res = await apiClient.post(`/conversations/${conversationId}/messages`, { role: 'user', content });
    return res.data.data;
  },
};
