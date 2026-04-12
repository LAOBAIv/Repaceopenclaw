import { AgentTemplate } from "../types";

const BASE = "/api/agent-templates";

export const agentTemplatesApi = {
  /** 获取所有模板 */
  async list(category?: string): Promise<AgentTemplate[]> {
    const url = category ? `${BASE}?category=${category}` : BASE;
    const res = await fetch(url);
    const json = await res.json();
    return json.data || [];
  },

  /** 获取所有分类 */
  async categories(): Promise<string[]> {
    const res = await fetch(`${BASE}/categories`);
    const json = await res.json();
    return json.data || [];
  },

  /** 获取模板详情 */
  async getById(id: string): Promise<AgentTemplate> {
    const res = await fetch(`${BASE}/${id}`);
    const json = await res.json();
    return json.data;
  },

  /** 基于模板创建 Agent */
  async createFromTemplate(templateId: string, overrides?: Record<string, any>): Promise<any> {
    const res = await fetch(`${BASE}/${templateId}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(overrides || {}),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "创建失败");
    return json.data;
  },
};
