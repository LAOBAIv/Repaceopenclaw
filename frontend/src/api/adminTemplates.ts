import apiClient from "./client";
import { AgentTemplate } from "../types";

const BASE = "/admin/templates";

export const adminTemplatesApi = {
  /** 获取所有模板 */
  async list(): Promise<AgentTemplate[]> {
    const res = await apiClient.get(BASE);
    return res.data.data || [];
  },

  /** 获取模板详情 */
  async getById(id: string): Promise<AgentTemplate> {
    const res = await apiClient.get(`${BASE}/${id}`);
    return res.data.data;
  },

  /** 创建新模板 */
  async create(data: Partial<AgentTemplate>): Promise<AgentTemplate> {
    const res = await apiClient.post(BASE, data);
    return res.data.data;
  },

  /** 更新模板 */
  async update(id: string, data: Partial<AgentTemplate>): Promise<AgentTemplate> {
    const res = await apiClient.put(`${BASE}/${id}`, data);
    return res.data.data;
  },

  /** 删除模板 */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`${BASE}/${id}`);
  },
};