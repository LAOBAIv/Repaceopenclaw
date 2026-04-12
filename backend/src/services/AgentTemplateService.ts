import { v4 as uuidv4 } from "uuid";
import { getDb, saveDb } from "../db/client";

export interface AgentTemplate {
  id: string;
  name: string;
  category: string;
  emoji: string;
  color: string;
  vibe: string;
  description: string;
  systemPrompt: string;
  writingStyle: string;
  expertise: string[];
  outputFormat: string;
  githubSource: string;
  createdAt: string;
}

function rowToTemplate(obj: any): AgentTemplate {
  return {
    id: obj.id,
    name: obj.name,
    category: obj.category,
    emoji: obj.emoji,
    color: obj.color,
    vibe: obj.vibe,
    description: obj.description,
    systemPrompt: obj.system_prompt,
    writingStyle: obj.writing_style,
    expertise: JSON.parse(obj.expertise || "[]"),
    outputFormat: obj.output_format,
    githubSource: obj.github_source,
    createdAt: obj.created_at,
  };
}

export const AgentTemplateService = {
  /** 获取所有模板，支持按分类筛选 */
  list(category?: string): AgentTemplate[] {
    const db = getDb();
    const sql = category
      ? "SELECT * FROM agent_templates WHERE category = ? ORDER BY name ASC"
      : "SELECT * FROM agent_templates ORDER BY category ASC, name ASC";
    const params = category ? [category] : [];
    const result = db.exec(sql, params);
    if (!result.length) return [];
    const cols = result[0].columns;
    return result[0].values.map((row) => {
      const obj: any = {};
      cols.forEach((c, i) => (obj[c] = row[i]));
      return rowToTemplate(obj);
    });
  },

  /** 获取单个模板 */
  getById(id: string): AgentTemplate | null {
    const db = getDb();
    const result = db.exec("SELECT * FROM agent_templates WHERE id = ?", [id]);
    if (!result.length || !result[0].values.length) return null;
    const cols = result[0].columns;
    const obj: any = {};
    cols.forEach((c, i) => (obj[c] = result[0].values[0][i]));
    return rowToTemplate(obj);
  },

  /** 获取所有分类列表 */
  listCategories(): string[] {
    const db = getDb();
    const result = db.exec("SELECT DISTINCT category FROM agent_templates ORDER BY category ASC");
    if (!result.length) return [];
    return result[0].values.map((row) => row[0] as string);
  },

  /** 基于模板创建真实 Agent */
  createAgentFromTemplate(templateId: string, overrides: Record<string, any>): any {
    const template = this.getById(templateId);
    if (!template) throw new Error("Template not found");

    const { AgentService } = require("./AgentService");
    const agent = AgentService.create({
      name: template.name,
      color: template.color,
      systemPrompt: template.systemPrompt,
      writingStyle: template.writingStyle,
      expertise: template.expertise,
      description: template.description,
      outputFormat: template.outputFormat,
      ...overrides,
    });
    return agent;
  },
};
