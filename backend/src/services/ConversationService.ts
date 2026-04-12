import { v4 as uuidv4 } from "uuid";
import { getDb, saveDb } from "../db/client";

export interface Conversation {
  id: string;
  projectId: string | null;
  taskId: string | null;
  /** 参与本会话的所有智能体 id 列表（按加入时间排序） */
  agentIds: string[];
  /**
   * @deprecated 兼容字段：取 agentIds[0]，若为空则返回空字符串
   * 旧代码仍可通过此字段读取"主智能体"，新代码应使用 agentIds
   */
  agentId: string;
  title: string;
  createdBy: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "agent";
  content: string;
  agentId?: string;
  /** 本条消息实际消耗的 token 数（0 表示用户消息或无统计） */
  tokenCount: number;
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

/** 批量查询多个会话的 agentIds，返回 Map<conversationId, agentId[]> */
function fetchAgentIdsMap(db: any, convIds: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!convIds.length) return map;
  // SQLite IN 查询（最多 999 个参数，实际不会超限）
  const placeholders = convIds.map(() => "?").join(",");
  const rows = execToRows(
    db,
    `SELECT conversation_id, agent_id FROM conversation_agents WHERE conversation_id IN (${placeholders}) ORDER BY joined_at ASC`,
    convIds
  );
  for (const r of rows) {
    if (!map.has(r.conversation_id)) map.set(r.conversation_id, []);
    map.get(r.conversation_id)!.push(r.agent_id);
  }
  return map;
}

/** 将 DB 行 + agentIds 组装成 Conversation 对象 */
function rowToConversation(r: any, agentIds: string[]): Conversation {
  return {
    id: r.id,
    projectId: r.project_id,
    taskId: r.task_id || null,
    agentIds,
    agentId: agentIds[0] ?? "",   // 兼容旧字段
    title: r.title,
    createdBy: r.created_by || null,
    createdAt: r.created_at,
  };
}

export const ConversationService = {
  list(projectId?: string): Conversation[] {
    const db = getDb();
    const sql = projectId
      ? "SELECT * FROM conversations WHERE project_id=? ORDER BY created_at DESC"
      : "SELECT * FROM conversations ORDER BY created_at DESC";
    const rows = execToRows(db, sql, projectId ? [projectId] : undefined);
    if (!rows.length) return [];
    const agentMap = fetchAgentIdsMap(db, rows.map((r) => r.id));
    return rows.map((r) => rowToConversation(r, agentMap.get(r.id) ?? []));
  },

  getById(id: string): Conversation | null {
    const db = getDb();
    const rows = execToRows(db, "SELECT * FROM conversations WHERE id=?", [id]);
    if (!rows.length) return null;
    const r = rows[0];
    const agentMap = fetchAgentIdsMap(db, [id]);
    return rowToConversation(r, agentMap.get(id) ?? []);
  },

  /**
   * 创建会话，支持多智能体
   * @param agentIds 参与此会话的智能体 id 列表，至少 1 个
   * @param taskId 关联的任务 id（可选）
   * @param createdBy 创建人 id（可选）
   */
  create(data: { agentIds: string[]; projectId?: string; taskId?: string; title?: string; createdBy?: string }): Conversation {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const title = data.title || "新对话";
    db.run(
      `INSERT INTO conversations (id, project_id, task_id, title, created_by, created_at) VALUES (?,?,?,?,?,?)`,
      [id, data.projectId || null, data.taskId || null, title, data.createdBy || null, now]
    );
    // 写入关联表
    for (const agentId of data.agentIds) {
      db.run(
        `INSERT OR IGNORE INTO conversation_agents (conversation_id, agent_id, joined_at) VALUES (?,?,?)`,
        [id, agentId, now]
      );
    }
    saveDb();
    return rowToConversation(
      { id, project_id: data.projectId || null, task_id: data.taskId || null, title, created_by: data.createdBy || null, created_at: now },
      data.agentIds
    );
  },

  /**
   * 更新会话信息（标题、项目关联等）
   */
  update(id: string, data: { title?: string; projectId?: string | null; taskId?: string | null }): Conversation | null {
    const db = getDb();
    const existing = this.getById(id);
    if (!existing) return null;
    const title = data.title ?? existing.title;
    const projectId = data.projectId !== undefined ? data.projectId : existing.projectId;
    const taskId = data.taskId !== undefined ? data.taskId : existing.taskId;
    db.run("UPDATE conversations SET title=?, project_id=?, task_id=? WHERE id=?", [title, projectId, taskId, id]);
    saveDb();
    return this.getById(id);
  },

  /**
   * 向已有会话追加新的参与智能体（幂等，已存在则忽略）
   */
  addAgent(conversationId: string, agentId: string): void {
    const db = getDb();
    const now = new Date().toISOString();
    db.run(
      `INSERT OR IGNORE INTO conversation_agents (conversation_id, agent_id, joined_at) VALUES (?,?,?)`,
      [conversationId, agentId, now]
    );
    saveDb();
  },

  /**
   * 从会话中移除某个智能体
   */
  removeAgent(conversationId: string, agentId: string): void {
    const db = getDb();
    db.run(
      `DELETE FROM conversation_agents WHERE conversation_id=? AND agent_id=?`,
      [conversationId, agentId]
    );
    saveDb();
  },

  delete(id: string): boolean {
    const db = getDb();
    // CASCADE 会自动删除 conversation_agents 和 messages 中的关联行
    db.run("DELETE FROM conversations WHERE id=?", [id]);
    saveDb();
    return true;
  },

  getMessages(conversationId: string): Message[] {
    const db = getDb();
    const rows = execToRows(
      db,
      "SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at ASC",
      [conversationId]
    );
    return rows.map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      role: r.role as "user" | "agent",
      content: r.content,
      agentId: r.agent_id || undefined,
      tokenCount: r.token_count ?? 0,
      createdAt: r.created_at,
    }));
  },

  addMessage(data: {
    conversationId: string;
    role: "user" | "agent";
    content: string;
    agentId?: string;
    /** 本次调用实际消耗 token 数，agent 消息时由 AutoLLMAdapter 传入 */
    tokenCount?: number;
  }): Message {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const tokenCount = data.tokenCount ?? 0;
    db.run(
      `INSERT INTO messages (id, conversation_id, role, content, agent_id, token_count, created_at) VALUES (?,?,?,?,?,?,?)`,
      [id, data.conversationId, data.role, data.content, data.agentId || null, tokenCount, now]
    );
    saveDb();
    return {
      id,
      conversationId: data.conversationId,
      role: data.role,
      content: data.content,
      agentId: data.agentId,
      tokenCount,
      createdAt: now,
    };
  },
};
