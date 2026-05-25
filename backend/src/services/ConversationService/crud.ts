import { v4 as uuidv4 } from "uuid";
import { getDb, saveDb } from "../../db/client";
import { AgentService } from "../AgentService";
import { TaskService } from "../TaskService";
import { IdGenerator } from '../../utils/IdGenerator';
import {
  execToRows, rv, rn, fetchAgentIdsMap, syncConversationAgentSnapshot,
  rowToConversation, resolveBusinessAgentId,
  type BetterSqlite3Db, type Conversation
} from './helpers';

export const ConversationCrud = {
  list(userId?: string, projectId?: string, status?: string): Conversation[] {
    const db = getDb();
    let sql = "SELECT * FROM conversations";
    const params: unknown[] = []; // [2026-05-24] 类型安全
    const conditions: string[] = [];
    if (userId) {
      conditions.push("user_id = ?");
      params.push(userId);
    }
    if (projectId) {
      conditions.push("project_id = ?");
      params.push(projectId);
    }
    // [2026-05-19] 支持按状态筛选，默认返回进行中的会话（active + in_progress）
    if (status === 'in_progress') {
      // 进行中 = active + in_progress
      conditions.push("status IN ('active', 'in_progress')");
    } else if (status === 'active') {
      conditions.push("status = 'active'");
    } else if (status && ['closed', 'deleted'].includes(status)) {
      conditions.push("status = ?");
      params.push(status);
    } else {
      // 默认：排除已关闭和已删除
      conditions.push("status NOT IN ('closed', 'deleted')");
    }
    if (conditions.length) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY created_at DESC";
    const rows = execToRows(db, sql, params.length ? params : undefined);
    if (!rows.length) return [];
    const agentMap = fetchAgentIdsMap(db, rows.map((r) => rv(r, 'id')!));
    return rows.map((r) => rowToConversation(r, agentMap.get(rv(r, 'id')!) ?? []));
  },

  getById(id: string, userId?: string): Conversation | null {
    const db = getDb();
    let sql = "SELECT * FROM conversations WHERE id=?";
    const params: unknown[] = [id]; // [2026-05-24] 类型安全
    if (userId) {
      sql = "SELECT * FROM conversations WHERE id=? AND user_id=?";
      params.push(userId);
    }
    const rows = execToRows(db, sql, params);
    if (!rows.length) return null;
    const r = rows[0];
    const agentMap = fetchAgentIdsMap(db, [rv(r, 'id')!]);
    return rowToConversation(r, agentMap.get(rv(r, 'id')!) ?? []);
  },

  /**
   * Dual-code Phase 2:接口层允许同时传 conversation.id 或 session_code。
   * session_code 当前按设计全局唯一,因此可直接解析。
   */
  getByIdOrCode(idOrCode: string, userId?: string): Conversation | null {
    const byId = this.getById(idOrCode, userId);
    if (byId) return byId;

    const db = getDb();
    let sql = "SELECT * FROM conversations WHERE session_code=?";
    const params: unknown[] = [idOrCode]; // [2026-05-24] 类型安全
    if (userId) {
      sql = "SELECT * FROM conversations WHERE session_code=? AND user_id=?";
      params.push(userId);
    }
    const rows = execToRows(db, sql, params);
    if (!rows.length) return null;
    const r = rows[0];
    const agentMap = fetchAgentIdsMap(db, [rv(r, 'id')!]);
    return rowToConversation(r, agentMap.get(rv(r, 'id')!) ?? []);
  },

  /** 将 conversation UUID/session_code 统一解析成真实底层主键。 */
  resolveId(idOrCode: string, userId?: string): string | null {
    return this.getByIdOrCode(idOrCode, userId)?.id || null;
  },

  /**
   * 创建会话,支持多智能体
   * @param agentIds 参与此会话的智能体 id 列表,至少 1 个
   * @param taskId 关联的任务 id(可选)
   * @param createdBy 创建人 id(可选)
   */
  create(data: { agentIds: string[]; projectId?: string; taskId?: string; title?: string; createdBy?: string; userId?: string; currentAgentId?: string; scopeType?: Conversation['scopeType']; scopeId?: string; memoryPolicy?: Conversation['memoryPolicy']; conversationType?: Conversation['conversationType'] }): Conversation {
    const db = getDb();
    // Dual-code Phase 1:先在现有结构上开始双写业务编码,不一次性推翻会话主键。
    // 注意:当前 conversation.id 仍沿用既有行为(很多前端/恢复逻辑依赖它),
    // sessionCode 才是后续要对齐 taskCode 的业务会话编码。
    const userUuid = data.userId || '';
    const userCodeRow = userUuid ? execToRows(db, "SELECT user_code FROM users WHERE id=?", [userUuid])[0] : null;
    // Phase 2:taskId 入参既可能是 UUID,也可能已经是 task_code。
    // 统一先解析出真实 task UUID,再决定 sessionCode 应复用哪个业务码。
    const resolvedTask = data.taskId ? TaskService.getByIdOrCode(data.taskId) : null;
    const sessionCode = resolvedTask?.taskCode || data.taskId || IdGenerator.taskCode((userCodeRow?.user_code as string) || IdGenerator.userCode()); // [2026-05-24] 类型安全
    const taskId = resolvedTask?.id || null;
    // 关键修复：无 taskId 的普通会话也必须有真实 conversation.id。
    // 之前这里直接把 taskId 赋给 conversationId，导致未绑定任务的前台新会话 id 变成 null，
    // 后续所有 /conversations/:id/... 接口都会落成 /conversations/null/...，表现为"创建了但不生效"。
    const conversationId = taskId || uuidv4();
    const now = new Date().toISOString();
    const title = data.title || "新对话";
    // currentAgentId 统一存 RepaceClaw agent UUID(兼容传入旧的 OpenClaw agentId)
    const currentAgentId = data.currentAgentId
      ? resolveBusinessAgentId(data.currentAgentId)
      : resolveBusinessAgentId(data.agentIds[0] || '');
    const currentAgent = AgentService.getById(currentAgentId);
    // 业务当前智能体编码 = sessionCode + agentCode
    // 这样日志里不用再到处拼 UUID,就能直接看出"哪个会话里的哪个智能体"。
    const currentAgentCode = currentAgent?.agentCode ? IdGenerator.currentAgentCode(sessionCode, currentAgent.agentCode) : '';
    const agentIdStr = JSON.stringify(data.agentIds);
    const scopeType = data.scopeType || 'user';
    const scopeId = data.scopeId ?? userUuid;
    const memoryPolicy = data.memoryPolicy || 'private';
    // 会话类型：默认 general，微信助手会话传入 wechat_assistant
    const conversationType = data.conversationType || 'general';
    db.run(
      `INSERT INTO conversations (id, project_id, task_id, session_code, current_agent_id, current_agent_code, title, status, created_by, user_id, agent_id, agent_ids, scope_type, scope_id, memory_policy, summary, last_message_at, created_at, conversation_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [conversationId, data.projectId || null, taskId, sessionCode, currentAgentId, currentAgentCode, title, 'in_progress', data.createdBy || null, userUuid, currentAgentId, agentIdStr, scopeType, scopeId, memoryPolicy, '', '', now, conversationType]
    );
    // 写入关联表(统一存 RepaceClaw agent UUID)
    for (const agentId of data.agentIds.map(resolveBusinessAgentId)) {
      db.run(
        `INSERT OR IGNORE INTO conversation_agents (conversation_id, agent_id, joined_at) VALUES (?,?,?)`,
        [conversationId, agentId, now]
      );
    }
    saveDb();
    return rowToConversation(
      { id: conversationId, project_id: data.projectId || null, task_id: taskId, session_code: sessionCode, current_agent_id: currentAgentId, current_agent_code: currentAgentCode, title, status: 'in_progress', scope_type: scopeType, scope_id: scopeId, memory_policy: memoryPolicy, summary: '', last_message_at: '', user_id: userUuid, created_by: data.createdBy || null, created_at: now },
      data.agentIds.map(resolveBusinessAgentId)
    );
  },

  /**
   * 切换当前会话的 Agent
   *
   * ⚠️ 关键业务规则：会话内切换 agent 是"替换"而非"追加"。
   * 只更新 current_agent_id/current_agent_code，不新建 Session，不新增参与者。
   *
   * conversation_agents 关联表用于记录"曾经参与过的 agent 历史"，
   * 但切换 agent 时要把旧的删掉、只保留新 agent，
   * 否则 rowToConversation 读 agentIds 时会返回多个 agent，
   * 前端 SessionAgentBar 就会同时显示两个智能体——这是之前反复出现的回归 BUG。
   */
  switchAgent(conversationId: string, agentId: string): boolean {
    const db = getDb();
    const businessAgentId = resolveBusinessAgentId(agentId);
    const conv = this.getById(conversationId);
    const agent = AgentService.getById(businessAgentId);
    const currentAgentCode = conv?.sessionCode && agent?.agentCode
      ? IdGenerator.currentAgentCode(conv.sessionCode, agent.agentCode)
      : '';

    // 1) 更新 current_agent_id/current_agent_code/agent_id
    db.run(
      `UPDATE conversations SET current_agent_id = ?, current_agent_code = ?, agent_id = ? WHERE id = ?`,
      [businessAgentId, currentAgentCode, businessAgentId, conversationId]
    );
    const mainChanges = db.getRowsModified(); // ✅ 立即捕获主更新的行数

    // 2) 清理旧 agent，只保留新 agent（防止 conversation_agents 积累多个 agent 导致前端显示两个智能体）
    db.run(`DELETE FROM conversation_agents WHERE conversation_id = ?`, [conversationId]);
    db.run(
      `INSERT INTO conversation_agents (conversation_id, agent_id, joined_at) VALUES (?,?,?)`,
      [conversationId, businessAgentId, new Date().toISOString()]
    );

    // 3) 同步 agent_ids 快照列
    syncConversationAgentSnapshot(db, conversationId);

    saveDb();
    // ✅ 使用主更新的行数判断成功，或简单地返回 true（因为前置校验已确保 conv/agent 存在）
    return mainChanges > 0;
  },

  /**
   * 更新会话信息(标题、项目关联等)
   */
  update(id: string, data: { title?: string; projectId?: string | null; taskId?: string | null; scopeType?: Conversation['scopeType']; scopeId?: string; memoryPolicy?: Conversation['memoryPolicy']; summary?: string }): Conversation | null {
    const db = getDb();
    const existing = this.getById(id);
    if (!existing) return null;
    const title = data.title ?? existing.title;
    const projectId = data.projectId !== undefined ? data.projectId : existing.projectId;
    const taskId = data.taskId !== undefined ? data.taskId : existing.taskId;
    const scopeType = data.scopeType ?? existing.scopeType;
    const scopeId = data.scopeId !== undefined ? data.scopeId : existing.scopeId;
    const memoryPolicy = data.memoryPolicy ?? existing.memoryPolicy;
    const summary = data.summary !== undefined ? data.summary : existing.summary;
    db.run("UPDATE conversations SET title=?, project_id=?, task_id=?, scope_type=?, scope_id=?, memory_policy=?, summary=? WHERE id=?", [title, projectId, taskId, scopeType, scopeId, memoryPolicy, summary, id]);
    saveDb();
    return this.getById(id);
  },

  /**
   * 向已有会话追加新的参与智能体(幂等,已存在则忽略)
   */
  addAgent(conversationId: string, agentId: string): void {
    const db = getDb();
    const now = new Date().toISOString();
    db.run(
      `INSERT OR IGNORE INTO conversation_agents (conversation_id, agent_id, joined_at) VALUES (?,?,?)`,
      [conversationId, agentId, now]
    );
    syncConversationAgentSnapshot(db, conversationId);
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
    const agentIds = syncConversationAgentSnapshot(db, conversationId);

    // 兼容字段兜底:若移除的是当前 agent,需要把 current_agent_id / agent_id 切到剩余列表的第一个,避免悬空。
    const conv = this.getById(conversationId);
    if (conv && conv.currentAgentId === agentId) {
      const fallbackAgentId = agentIds[0] || '';
      const fallbackAgent = fallbackAgentId ? AgentService.getById(fallbackAgentId) : null;
      const fallbackAgentCode = conv.sessionCode && fallbackAgent?.agentCode
        ? IdGenerator.currentAgentCode(conv.sessionCode, fallbackAgent.agentCode)
        : '';
      db.run(
        `UPDATE conversations SET current_agent_id=?, current_agent_code=?, agent_id=? WHERE id=?`,
        [fallbackAgentId, fallbackAgentCode, fallbackAgentId, conversationId]
      );
    }
    saveDb();
  },

  delete(id: string): boolean {
    const db = getDb();
    // 先检查是否存在
    const existing = db.exec("SELECT id FROM conversations WHERE id=?", [id]);
    if (!existing.length || !existing[0].values.length) return false;

    // [2026-05-19] 彻底删除：先删消息，再删会话
    db.run("DELETE FROM messages WHERE conversation_id=?", [id]);
    db.run("DELETE FROM conversation_agents WHERE conversation_id=?", [id]);
    db.run("DELETE FROM conversations WHERE id=?", [id]);
    const changes = db.getRowsModified();
    saveDb();
    return changes > 0;
  },

  /**
   * 更新会话状态
   * [2026-05-19] 新增 active 状态：设为 active 时自动把同用户其他 active 会话降为 in_progress
   */
  updateStatus(id: string, status: 'active' | 'in_progress' | 'completed' | 'archived' | 'deleted' | 'closed'): Conversation | null {
    const db = getDb();
    const existing = this.getById(id);
    if (!existing) return null;
    // 设为 active 时，先把同用户其他 active 会话降为 in_progress
    if (status === 'active' && existing.userId) {
      db.run("UPDATE conversations SET status='in_progress' WHERE user_id=? AND status='active' AND id!=?", [existing.userId, id]);
    }
    db.run("UPDATE conversations SET status=? WHERE id=?", [status, id]);
    saveDb();
    return this.getById(id);
  },
};
