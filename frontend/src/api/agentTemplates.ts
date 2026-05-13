import apiClient from "./client";
import { AgentTemplate } from "../types";

const BASE = "/agent-templates";

export const agentTemplatesApi = {
  /** 获取所有模板 */
  async list(category?: string): Promise<AgentTemplate[]> {
    const url = category ? `${BASE}?category=${category}` : BASE;
    const res = await apiClient.get(url);
    return res.data.data || [];
  },

  /** 获取所有分类 */
  async categories(): Promise<string[]> {
    const res = await apiClient.get(`${BASE}/categories`);
    return res.data.data || [];
  },

  /** 获取模板详情 */
  async getById(id: string): Promise<AgentTemplate> {
    const res = await apiClient.get(`${BASE}/${id}`);
    return res.data.data;
  },

  /** 基于模板创建 Agent */
  async createFromTemplate(templateId: string, overrides?: Record<string, any>): Promise<any> {
    const res = await apiClient.post(`${BASE}/${templateId}/create`, overrides || {});
    return res.data.data;
  },
};
