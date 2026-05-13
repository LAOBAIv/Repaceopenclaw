import { Router, Request, Response } from "express";
import { getDb, saveDb } from "../db/client";
import { v4 as uuidv4 } from "uuid";

const router = Router();

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

/**
 * P2-6: GET /api/export
 * Export all data as a single JSON snapshot.
 */
router.get("/", (_req: Request, res: Response) => {
  const db = getDb();

  const agents = execToRows(db, "SELECT * FROM agents ORDER BY created_at");
  const projects = execToRows(db, "SELECT * FROM projects ORDER BY created_at");
  const tasks = execToRows(db, "SELECT * FROM tasks ORDER BY created_at");
  const conversations = execToRows(db, "SELECT * FROM conversations ORDER BY created_at");
  const messages = execToRows(db, "SELECT * FROM messages ORDER BY created_at");
  const documents = execToRows(db, "SELECT * FROM documents ORDER BY created_at");
  const documentVersions = execToRows(db, "SELECT * FROM document_versions ORDER BY snapshot_at");
  const tokenChannels = execToRows(db, "SELECT id, provider, model_name, base_url, auth_type, enabled, priority, created_at, updated_at FROM token_channels ORDER BY created_at");

  res.json({
    data: {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      agents,
      projects,
      tasks,
      conversations,
      messages,
      documents,
      documentVersions,
      tokenChannels,
    },
  });
});

/**
 * P2-6: POST /api/import
 * Import data from JSON. Supports merge (default) or overwrite mode.
 * Body: { mode?: "merge" | "overwrite", data: { agents?, projects?, tasks?, ... } }
 *
 * "merge": inserts rows that don't exist yet (keyed by id), skips duplicates.
 * "overwrite": deletes all existing data in each supplied table, then inserts.
 */
router.post("/", (req: Request, res: Response) => {
  const { mode = "merge", data } = req.body;
  if (!data || typeof data !== "object") {
    return res.status(400).json({ error: "data object required" });
  }
  if (mode !== "merge" && mode !== "overwrite") {
    return res.status(400).json({ error: "mode must be 'merge' or 'overwrite'" });
  }

  const db = getDb();
  const stats: Record<string, number> = {};

  const importTable = (
    tableName: string,
    rows: any[],
    insertSql: (r: any) => [string, any[]]
  ) => {
    if (!Array.isArray(rows) || !rows.length) return;

    if (mode === "overwrite") {
      db.run(`DELETE FROM ${tableName}`);
    }

    let count = 0;
    for (const r of rows) {
      try {
        const [sql, params] = insertSql(r);
        db.run(sql, params);
        count++;
      } catch {
        // skip duplicates in merge mode
      }
    }
    stats[tableName] = count;
  };

  // Agents
  importTable("agents", data.agents || [], (r) => [
    `INSERT OR IGNORE INTO agents (id, name, color, system_prompt, writing_style, expertise, description, status,
      model_name, model_provider, temperature, max_tokens, top_p, frequency_penalty, presence_penalty, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [r.id || uuidv4(), r.name, r.color || "#6366F1", r.system_prompt || "", r.writing_style || "balanced",
     r.expertise || "[]", r.description || "", r.status || "idle",
     r.model_name || "", r.model_provider || "",
     r.temperature ?? 0.7, r.max_tokens ?? 4096, r.top_p ?? 1,
     r.frequency_penalty ?? 0, r.presence_penalty ?? 0,
     r.created_at || new Date().toISOString()],
  ]);

  // Projects
  importTable("projects", data.projects || [], (r) => [
    `INSERT OR IGNORE INTO projects (id, title, description, tags, status, goal, priority, start_time, end_time, decision_maker, workflow_nodes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [r.id || uuidv4(), r.title, r.description || "", r.tags || "[]", r.status || "active",
     r.goal || "", r.priority || "mid", r.start_time || "", r.end_time || "",
     r.decision_maker || "", r.workflow_nodes || "[]",
     r.created_at || new Date().toISOString(), r.updated_at || new Date().toISOString()],
  ]);

  // Tasks
  importTable("tasks", data.tasks || [], (r) => [
    `INSERT OR IGNORE INTO tasks (id, title, description, column_id, priority, tags, agent, agent_color, agent_id, due_date, comment_count, file_count, sort_order, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [r.id || uuidv4(), r.title, r.description || "", r.column_id || "todo", r.priority || "mid",
     r.tags || "[]", r.agent || "", r.agent_color || "#6366F1", r.agent_id || "",
     r.due_date || "", r.comment_count || 0, r.file_count || 0, r.sort_order || 0,
     r.created_at || new Date().toISOString(), r.updated_at || new Date().toISOString()],
  ]);

  // Conversations
  importTable("conversations", data.conversations || [], (r) => [
    `INSERT OR IGNORE INTO conversations (id, project_id, agent_id, title, created_at) VALUES (?,?,?,?,?)`,
    [r.id || uuidv4(), r.project_id || null, r.agent_id, r.title || "新对话", r.created_at || new Date().toISOString()],
  ]);

  // Messages
  importTable("messages", data.messages || [], (r) => [
    `INSERT OR IGNORE INTO messages (id, conversation_id, role, content, agent_id, created_at) VALUES (?,?,?,?,?,?)`,
    [r.id || uuidv4(), r.conversation_id, r.role, r.content, r.agent_id || null, r.created_at || new Date().toISOString()],
  ]);

  // Documents
  importTable("documents", data.documents || [], (r) => [
    `INSERT OR IGNORE INTO documents (id, project_id, parent_id, title, content, node_order, assigned_agent_ids, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [r.id || uuidv4(), r.project_id, r.parent_id || null, r.title, r.content || "", r.node_order || 0,
     r.assigned_agent_ids || "[]", r.created_at || new Date().toISOString(), r.updated_at || new Date().toISOString()],
  ]);

  saveDb();

  res.json({ data: { mode, imported: stats } });
});

export default router;
