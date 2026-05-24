import { v4 as uuidv4 } from "uuid";
import { getDb, saveDb } from "../db/client";

export interface Skill {
  id: string;
  name: string;
  description: string;
  /** 技能分类，如 search / code / data / general */
  category: string;
  /** builtin = 内置 | custom = 自定义 */
  type: "builtin" | "custom";
  /** 技能配置参数（JSON 对象） */
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

function rowToSkill(obj: Record<string, unknown>): Skill { // [2026-05-24] 类型安全
  return {
    id: obj['id'] as string,
    name: obj['name'] as string,
    description: (obj['description'] as string) || "",
    category: (obj['category'] as string) || "general",
    type: ((obj['type'] as string) || "builtin") as Skill["type"],
    config: (() => { try { return JSON.parse((obj['config'] as string) || "{}"); } catch { return {}; } })(),
    enabled: !!obj['enabled'],
    createdAt: obj['created_at'] as string,
    updatedAt: obj['updated_at'] as string,
  };
}

// [2026-05-24] 类型安全：any → DbClient / unknown
interface DbClient { exec(sql: string, params?: unknown[]): Array<{ columns: string[]; values: unknown[][] }> }
function execToRows(db: DbClient, sql: string, params?: unknown[]): Record<string, unknown>[] {
  const result = params ? db.exec(sql, params) : db.exec(sql);
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map((row: unknown[]) => { // [2026-05-24] 类型安全
    // [2026-05-24] 类型安全：any → Record<string, unknown>
    const obj: Record<string, unknown> = {};
    cols.forEach((c: string, i: number) => (obj[c] = row[i]));
    return obj;
  });
}

export const SkillService = {
  list(): Skill[] {
    const db = getDb();
    return execToRows(db, "SELECT * FROM skills ORDER BY created_at DESC").map(rowToSkill);
  },

  getById(id: string): Skill | null {
    const db = getDb();
    const rows = execToRows(db, "SELECT * FROM skills WHERE id=?", [id]);
    return rows.length ? rowToSkill(rows[0]) : null;
  },

  create(data: Omit<Skill, "id" | "createdAt" | "updatedAt">): Skill {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO skills (id, name, description, category, type, config, enabled, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        id,
        data.name,
        data.description || "",
        data.category || "general",
        data.type || "builtin",
        JSON.stringify(data.config || {}),
        data.enabled !== false ? 1 : 0,
        now,
        now,
      ]
    );
    saveDb();
    return { id, ...data, config: data.config || {}, enabled: data.enabled !== false, createdAt: now, updatedAt: now };
  },

  update(id: string, data: Partial<Omit<Skill, "id" | "createdAt">>): Skill | null {
    const db = getDb();
    const existing = this.getById(id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    const now = new Date().toISOString();
    db.run(
      `UPDATE skills SET name=?, description=?, category=?, type=?, config=?, enabled=?, updated_at=? WHERE id=?`,
      [
        merged.name,
        merged.description,
        merged.category,
        merged.type,
        JSON.stringify(merged.config),
        merged.enabled ? 1 : 0,
        now,
        id,
      ]
    );
    saveDb();
    return { ...merged, updatedAt: now };
  },

  delete(id: string): void {
    const db = getDb();
    db.run("DELETE FROM skills WHERE id=?", [id]);
    saveDb();
  },

  // ── Agent binding ──────────────────────────────────────────────────────────

  /** 将技能绑定到 agent */
  bindToAgent(agentId: string, skillId: string): void {
    const db = getDb();
    const now = new Date().toISOString();
    db.run(
      `INSERT OR IGNORE INTO agent_skills (agent_id, skill_id, bound_at) VALUES (?,?,?)`,
      [agentId, skillId, now]
    );
    saveDb();
  },

  /** 解除 agent 与技能的绑定 */
  unbindFromAgent(agentId: string, skillId: string): void {
    const db = getDb();
    db.run("DELETE FROM agent_skills WHERE agent_id=? AND skill_id=?", [agentId, skillId]);
    saveDb();
  },

  /** 获取 agent 的所有已绑定技能 */
  listByAgent(agentId: string): Skill[] {
    const db = getDb();
    const rows = execToRows(
      db,
      `SELECT s.* FROM skills s
       INNER JOIN agent_skills a ON a.skill_id = s.id
       WHERE a.agent_id=?
       ORDER BY a.bound_at DESC`,
      [agentId]
    );
    return rows.map(rowToSkill);
  },

  /** 启用/禁用技能 */
  setEnabled(id: string, enabled: boolean): Skill | null {
    return this.update(id, { enabled });
  },
};
