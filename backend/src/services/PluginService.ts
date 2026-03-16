import { v4 as uuidv4 } from "uuid";
import { getDb, saveDb } from "../db/client";

export interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  homepage: string;
  icon: string;
  /** 插件分类，如 tool / data / communication / general */
  category: string;
  /** 插件运行时配置（JSON 对象，如 apiKey、endpoint 等） */
  config: Record<string, unknown>;
  /** 插件声明的能力清单（JSON 对象，描述 actions/events） */
  manifest: Record<string, unknown>;
  enabled: boolean;
  installedAt: string;
  updatedAt: string;
}

function rowToPlugin(obj: any): Plugin {
  return {
    id: obj.id,
    name: obj.name,
    description: obj.description || "",
    version: obj.version || "1.0.0",
    author: obj.author || "",
    homepage: obj.homepage || "",
    icon: obj.icon || "",
    category: obj.category || "general",
    config: (() => { try { return JSON.parse(obj.config || "{}"); } catch { return {}; } })(),
    manifest: (() => { try { return JSON.parse(obj.manifest || "{}"); } catch { return {}; } })(),
    enabled: !!obj.enabled,
    installedAt: obj.installed_at,
    updatedAt: obj.updated_at,
  };
}

function execToRows(db: any, sql: string, params?: any[]): any[] {
  const result = params ? db.exec(sql, params) : db.exec(sql);
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map((row: any[]) => {
    const obj: any = {};
    cols.forEach((c: string, i: number) => (obj[c] = row[i]));
    return obj;
  });
}

export const PluginService = {
  list(): Plugin[] {
    const db = getDb();
    return execToRows(db, "SELECT * FROM plugins ORDER BY installed_at DESC").map(rowToPlugin);
  },

  getById(id: string): Plugin | null {
    const db = getDb();
    const rows = execToRows(db, "SELECT * FROM plugins WHERE id=?", [id]);
    return rows.length ? rowToPlugin(rows[0]) : null;
  },

  install(data: Omit<Plugin, "id" | "installedAt" | "updatedAt">): Plugin {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO plugins
         (id, name, description, version, author, homepage, icon, category, config, manifest, enabled, installed_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        data.name,
        data.description || "",
        data.version || "1.0.0",
        data.author || "",
        data.homepage || "",
        data.icon || "",
        data.category || "general",
        JSON.stringify(data.config || {}),
        JSON.stringify(data.manifest || {}),
        data.enabled !== false ? 1 : 0,
        now,
        now,
      ]
    );
    saveDb();
    return {
      id,
      ...data,
      config: data.config || {},
      manifest: data.manifest || {},
      enabled: data.enabled !== false,
      installedAt: now,
      updatedAt: now,
    };
  },

  update(id: string, data: Partial<Omit<Plugin, "id" | "installedAt">>): Plugin | null {
    const db = getDb();
    const existing = this.getById(id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    const now = new Date().toISOString();
    db.run(
      `UPDATE plugins SET name=?, description=?, version=?, author=?, homepage=?, icon=?,
         category=?, config=?, manifest=?, enabled=?, updated_at=?
       WHERE id=?`,
      [
        merged.name,
        merged.description,
        merged.version,
        merged.author,
        merged.homepage,
        merged.icon,
        merged.category,
        JSON.stringify(merged.config),
        JSON.stringify(merged.manifest),
        merged.enabled ? 1 : 0,
        now,
        id,
      ]
    );
    saveDb();
    return { ...merged, updatedAt: now };
  },

  uninstall(id: string): void {
    const db = getDb();
    db.run("DELETE FROM plugins WHERE id=?", [id]);
    saveDb();
  },

  // ── Agent binding ──────────────────────────────────────────────────────────

  /** 将插件绑定到 agent */
  bindToAgent(agentId: string, pluginId: string): void {
    const db = getDb();
    const now = new Date().toISOString();
    db.run(
      `INSERT OR IGNORE INTO agent_plugins (agent_id, plugin_id, bound_at) VALUES (?,?,?)`,
      [agentId, pluginId, now]
    );
    saveDb();
  },

  /** 解除 agent 与插件的绑定 */
  unbindFromAgent(agentId: string, pluginId: string): void {
    const db = getDb();
    db.run("DELETE FROM agent_plugins WHERE agent_id=? AND plugin_id=?", [agentId, pluginId]);
    saveDb();
  },

  /** 获取 agent 已绑定的所有插件 */
  listByAgent(agentId: string): Plugin[] {
    const db = getDb();
    const rows = execToRows(
      db,
      `SELECT p.* FROM plugins p
       INNER JOIN agent_plugins a ON a.plugin_id = p.id
       WHERE a.agent_id=?
       ORDER BY a.bound_at DESC`,
      [agentId]
    );
    return rows.map(rowToPlugin);
  },

  /** 启用/禁用插件 */
  setEnabled(id: string, enabled: boolean): Plugin | null {
    return this.update(id, { enabled });
  },
};
