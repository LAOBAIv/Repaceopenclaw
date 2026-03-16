import { v4 as uuidv4 } from "uuid";
import { getDb, saveDb } from "../db/client";

export interface Conversation {
  id: string;
  projectId: string | null;
  agentId: string;
  title: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "agent";
  content: string;
  agentId?: string;
  createdAt: string;
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

export const ConversationService = {
  list(projectId?: string): Conversation[] {
    const db = getDb();
    const sql = projectId
      ? "SELECT * FROM conversations WHERE project_id=? ORDER BY created_at DESC"
      : "SELECT * FROM conversations ORDER BY created_at DESC";
    const rows = execToRows(db, sql, projectId ? [projectId] : undefined);
    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      agentId: r.agent_id,
      title: r.title,
      createdAt: r.created_at,
    }));
  },

  getById(id: string): Conversation | null {
    const db = getDb();
    const rows = execToRows(db, "SELECT * FROM conversations WHERE id=?", [id]);
    if (!rows.length) return null;
    const r = rows[0];
    return { id: r.id, projectId: r.project_id, agentId: r.agent_id, title: r.title, createdAt: r.created_at };
  },

  create(data: { agentId: string; projectId?: string; title?: string }): Conversation {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const title = data.title || "新对话";
    db.run(
      `INSERT INTO conversations (id, project_id, agent_id, title, created_at) VALUES (?,?,?,?,?)`,
      [id, data.projectId || null, data.agentId, title, now]
    );
    saveDb();
    return { id, projectId: data.projectId || null, agentId: data.agentId, title, createdAt: now };
  },

  delete(id: string): boolean {
    const db = getDb();
    db.run("DELETE FROM conversations WHERE id=?", [id]);
    saveDb();
    return true;
  },

  getMessages(conversationId: string): Message[] {
    const db = getDb();
    const rows = execToRows(db, "SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at ASC", [conversationId]);
    return rows.map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      role: r.role as "user" | "agent",
      content: r.content,
      agentId: r.agent_id || undefined,
      createdAt: r.created_at,
    }));
  },

  addMessage(data: { conversationId: string; role: "user" | "agent"; content: string; agentId?: string }): Message {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO messages (id, conversation_id, role, content, agent_id, created_at) VALUES (?,?,?,?,?,?)`,
      [id, data.conversationId, data.role, data.content, data.agentId || null, now]
    );
    saveDb();
    return { id, conversationId: data.conversationId, role: data.role, content: data.content, agentId: data.agentId, createdAt: now };
  },
};
