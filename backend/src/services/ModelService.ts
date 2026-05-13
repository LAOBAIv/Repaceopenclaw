// ModelProvider 和 Model 管理服务
import { v4 as uuidv4 } from "uuid";
import { getDb, saveDb } from "../db/client";

export interface ModelProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiFormat: "openai" | "anthropic" | "gemini";
  apiKey: string;
  enabled: boolean;
  priority: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Model {
  id: string;
  providerId: string;
  providerName?: string;
  name: string;
  displayName: string;
  contextWindow: number;
  maxTokens: number;
  costInput: number;
  costOutput: number;
  capabilities: string[];
  enabled: boolean;
  description: string;
  createdAt: string;
}

function rowToProvider(r: any): ModelProvider {
  return {
    id: r.id,
    name: r.name,
    baseUrl: r.base_url,
    apiFormat: r.api_format || "openai",
    apiKey: r.api_key || "",
    enabled: !!r.enabled,
    priority: r.priority ?? 0,
    description: r.description || "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToModel(r: any): Model {
  return {
    id: r.id,
    providerId: r.provider_id,
    providerName: r.provider_name || "",
    name: r.name,
    displayName: r.display_name || r.name,
    contextWindow: r.context_window ?? 128000,
    maxTokens: r.max_tokens ?? 8192,
    costInput: r.cost_input ?? 0,
    costOutput: r.cost_output ?? 0,
    capabilities: JSON.parse(r.capabilities || '["text"]'),
    enabled: !!r.enabled,
    description: r.description || "",
    createdAt: r.created_at,
  };
}

export const ModelService = {
  // ─── Providers ─────────────────────────────────────────────
  listProviders(): ModelProvider[] {
    const db = getDb();
    const rows = db.exec("SELECT * FROM model_providers ORDER BY priority DESC, created_at ASC");
    if (!rows.length) return [];
    const cols = rows[0].columns;
    return rows[0].values.map((v) => {
      const obj: any = {};
      cols.forEach((c, i) => (obj[c] = v[i]));
      return rowToProvider(obj);
    });
  },

  getProvider(id: string): ModelProvider | null {
    const db = getDb();
    const rows = db.exec("SELECT * FROM model_providers WHERE id=?", [id]);
    if (!rows.length || !rows[0].values.length) return null;
    const cols = rows[0].columns;
    const obj: any = {};
    cols.forEach((c, i) => (obj[c] = rows[0].values[0][i]));
    return rowToProvider(obj);
  },

  createProvider(data: Omit<ModelProvider, "id" | "createdAt" | "updatedAt">): ModelProvider {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO model_providers (id, name, base_url, api_format, api_key, enabled, priority, description, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, data.name, data.baseUrl, data.apiFormat, data.apiKey, data.enabled ? 1 : 0, data.priority, data.description, now, now]
    );
    saveDb();
    return this.getProvider(id)!;
  },

  updateProvider(id: string, data: Partial<ModelProvider>): ModelProvider | null {
    const db = getDb();
    const existing = this.getProvider(id);
    if (!existing) return null;
    const fields: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) { fields.push("name=?"); values.push(data.name); }
    if (data.baseUrl !== undefined) { fields.push("base_url=?"); values.push(data.baseUrl); }
    if (data.apiFormat !== undefined) { fields.push("api_format=?"); values.push(data.apiFormat); }
    if (data.apiKey !== undefined) { fields.push("api_key=?"); values.push(data.apiKey); }
    if (data.enabled !== undefined) { fields.push("enabled=?"); values.push(data.enabled ? 1 : 0); }
    if (data.priority !== undefined) { fields.push("priority=?"); values.push(data.priority); }
    if (data.description !== undefined) { fields.push("description=?"); values.push(data.description); }
    fields.push("updated_at=?");
    values.push(new Date().toISOString());
    values.push(id);
    db.run(`UPDATE model_providers SET ${fields.join(", ")} WHERE id=?`, values);
    saveDb();
    return this.getProvider(id);
  },

  deleteProvider(id: string): boolean {
    const db = getDb();
    db.run("DELETE FROM model_providers WHERE id=?", [id]);
    saveDb();
    return true;
  },

  // ─── Models ────────────────────────────────────────────────
  listModels(providerId?: string): Model[] {
    const db = getDb();
    const sql = providerId
      ? `SELECT m.*, mp.name as provider_name FROM models m LEFT JOIN model_providers mp ON m.provider_id=mp.id WHERE m.provider_id=? ORDER BY m.name ASC`
      : `SELECT m.*, mp.name as provider_name FROM models m LEFT JOIN model_providers mp ON m.provider_id=mp.id ORDER BY mp.priority DESC, m.name ASC`;
    const rows = db.exec(sql, providerId ? [providerId] : []);
    if (!rows.length) return [];
    const cols = rows[0].columns;
    return rows[0].values.map((v) => {
      const obj: any = {};
      cols.forEach((c, i) => (obj[c] = v[i]));
      return rowToModel(obj);
    });
  },

  getModel(id: string): Model | null {
    const db = getDb();
    const rows = db.exec(`SELECT m.*, mp.name as provider_name FROM models m LEFT JOIN model_providers mp ON m.provider_id=mp.id WHERE m.id=?`, [id]);
    if (!rows.length || !rows[0].values.length) return null;
    const cols = rows[0].columns;
    const obj: any = {};
    cols.forEach((c, i) => (obj[c] = rows[0].values[0][i]));
    return rowToModel(obj);
  },

  createModel(data: Omit<Model, "id" | "createdAt" | "providerName">): Model {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO models (id, provider_id, name, display_name, context_window, max_tokens, cost_input, cost_output, capabilities, enabled, description, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, data.providerId, data.name, data.displayName, data.contextWindow, data.maxTokens, data.costInput, data.costOutput, JSON.stringify(data.capabilities), data.enabled ? 1 : 0, data.description, now]
    );
    saveDb();
    return this.getModel(id)!;
  },

  updateModel(id: string, data: Partial<Model>): Model | null {
    const db = getDb();
    const existing = this.getModel(id);
    if (!existing) return null;
    const fields: string[] = [];
    const values: any[] = [];
    if (data.providerId !== undefined) { fields.push("provider_id=?"); values.push(data.providerId); }
    if (data.name !== undefined) { fields.push("name=?"); values.push(data.name); }
    if (data.displayName !== undefined) { fields.push("display_name=?"); values.push(data.displayName); }
    if (data.contextWindow !== undefined) { fields.push("context_window=?"); values.push(data.contextWindow); }
    if (data.maxTokens !== undefined) { fields.push("max_tokens=?"); values.push(data.maxTokens); }
    if (data.costInput !== undefined) { fields.push("cost_input=?"); values.push(data.costInput); }
    if (data.costOutput !== undefined) { fields.push("cost_output=?"); values.push(data.costOutput); }
    if (data.capabilities !== undefined) { fields.push("capabilities=?"); values.push(JSON.stringify(data.capabilities)); }
    if (data.enabled !== undefined) { fields.push("enabled=?"); values.push(data.enabled ? 1 : 0); }
    if (data.description !== undefined) { fields.push("description=?"); values.push(data.description); }
    fields.push("updated_at=?");
    values.push(new Date().toISOString());
    values.push(id);
    db.run(`UPDATE models SET ${fields.join(", ")} WHERE id=?`, values);
    saveDb();
    return this.getModel(id);
  },

  deleteModel(id: string): boolean {
    const db = getDb();
    db.run("DELETE FROM models WHERE id=?", [id]);
    saveDb();
    return true;
  },

  // ─── 聚合查询：获取所有可用模型（按 provider 分组）─────────
  getAvailableModels(): { provider: ModelProvider; models: Model[] }[] {
    const providers = this.listProviders().filter(p => p.enabled);
    return providers.map(p => ({
      provider: p,
      models: this.listModels(p.id).filter(m => m.enabled),
    })).filter(g => g.models.length > 0);
  },
};
