import type { DbLike } from '../../db/sqlite-compat';
import { AgentService } from '../AgentService';
import { IdGenerator } from '../../utils/IdGenerator';

export type BetterSqlite3Db = DbLike;

export interface Conversation {
  id: string;
  projectId: string | null;
  taskId: string | null;
  /** 业务会话编码，双编码方案中与 taskCode 对齐 */
  sessionCode?: string;
  /** 当前正在对话的智能体 UUID */
  currentAgentId: string;
  /** 业务当前智能体编码：sessionCode + agentCode */
  currentAgentCode?: string;
  /** 参与本会话的所有智能体 id 列表（按加入时间排序） */
  agentIds: string[];
  /**
   * @deprecated 兼容字段：取 agentIds[0]，若为空则返回空字符串
   * 旧代码仍可通过此字段读取"主智能体"，新代码应使用 agentIds
   */
  agentId: string;
  title: string;
  /** 会话状态：'in_progress' | 'completed' | 'archived' | 'deleted' */
  status: 'in_progress' | 'completed' | 'archived' | 'deleted' | 'closed';
  /** V1: 会话作用域（user / department / role / enterprise） */
  scopeType: 'user' | 'department' | 'role' | 'enterprise' | 'wechat';
  /** V1: 作用域 ID；enterprise 级可为空 */
  scopeId: string;
  /** V1: 记忆策略（private / summary_shared） */
  memoryPolicy: 'private' | 'summary_shared';
  /** V1: 会话摘要，供后续共享/聚合使用 */
  summary: string;
  /** V1: 最后一条消息时间 */
  lastMessageAt?: string;
  /** 归属用户 UUID；非 user 作用域会话当前仍保留创建用户 */
  userId: string;
  createdBy: string | null;
  createdAt: string;
  /** 会话类型：general（普通）| wechat_assistant（微信助手，不出现在 kanban） */
  conversationType: 'general' | 'wechat_assistant';
}

export interface Message {
  id: string;
  /** 业务消息编码:sessionCode + 6位序号 */
  messageCode?: string;
  conversationId: string;
  role: "user" | "agent";
  content: string;
  agentId?: string;
  /** 本条消息实际消耗的 token 数(0 表示用户消息或无统计) */
  tokenCount: number;
  createdAt: string;
}

export function execToRows(db: BetterSqlite3Db, sql: string, params?: unknown[]): Record<string, unknown>[] {
  const result = params ? db.exec(sql, params) : db.exec(sql);
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {}; // [2026-05-24] 类型安全：any → Record<string, unknown>
    cols.forEach((c: string, i: number) => (obj[c] = row[i]));
    return obj;
  });
}

// [2026-05-24] 类型安全：Record<string, unknown> 安全取值辅助
export const rv = (r: Record<string, unknown>, k: string): string | undefined => r[k] as string | undefined;
export const rn = (r: Record<string, unknown>, k: string): number | undefined => r[k] as number | undefined;

/** 批量查询多个会话的 agentIds,返回 Map<conversationId, agentId[]> */
export function fetchAgentIdsMap(db: BetterSqlite3Db, convIds: string[]): Map<string, string[]> { // [2026-05-24] 类型安全
  const map = new Map<string, string[]>();
  if (!convIds.length) return map;
  // SQLite IN 查询(最多 999 个参数,实际不会超限)
  const placeholders = convIds.map(() => "?").join(",");
  const rows = execToRows(
    db,
    `SELECT conversation_id, agent_id FROM conversation_agents WHERE conversation_id IN (${placeholders}) ORDER BY joined_at ASC`,
    convIds
  );
  for (const r of rows) {
    const cid = rv(r, 'conversation_id')!;
    const aid = rv(r, 'agent_id')!;
    if (!map.has(cid)) map.set(cid, []);
    map.get(cid)!.push(aid);
  }
  return map;
}

/**
 * 保持 conversations.agent_ids(旧快照列)与 conversation_agents 关联表一致。
 * 说明:当前真实来源是 conversation_agents,但仍有旧代码/排障脚本会直接看 agent_ids 文本列,
 * 所以在双编码过渡期要持续同步,避免"当前会话已切 agent,但旧快照列还是旧值"的脏状态。
 */
export function syncConversationAgentSnapshot(db: BetterSqlite3Db, conversationId: string): string[] { // [2026-05-24] 类型安全
  const rows = execToRows(
    db,
    `SELECT agent_id FROM conversation_agents WHERE conversation_id=? ORDER BY joined_at ASC`,
    [conversationId]
  );
  const agentIds = rows.map((r) => String(r.agent_id)).filter(Boolean);
  db.run(`UPDATE conversations SET agent_ids=? WHERE id=?`, [JSON.stringify(agentIds), conversationId]);
  return agentIds;
}

/** 将 DB 行 + agentIds 组装成 Conversation 对象 */
export function rowToConversation(r: Record<string, unknown>, agentIds: string[]): Conversation { // [2026-05-24] 类型安全
  const v = (k: string) => r[k] as string | undefined; // [2026-05-24] 类型安全：安全取值
  return {
    id: v('id')!,
    projectId: v('project_id') ?? null,
    taskId: v('task_id') ?? null,
    sessionCode: v('session_code'),
    currentAgentId: v('current_agent_id') || v('agent_id') || agentIds[0] || '',
    currentAgentCode: v('current_agent_code'),
    agentIds,
    agentId: agentIds[0] ?? "",   // 兼容旧字段
    title: v('title')!,
    status: (v('status') as Conversation['status']) || 'in_progress',
    scopeType: (v('scope_type') as Conversation['scopeType']) || 'user',
    scopeId: v('scope_id') || '',
    memoryPolicy: (v('memory_policy') as Conversation['memoryPolicy']) || 'private',
    summary: v('summary') || '',
    lastMessageAt: v('last_message_at'),
    userId: v('user_id') || '',
    createdBy: v('created_by') ?? null,
    createdAt: v('created_at')!,
    // 会话类型：general（普通）| wechat_assistant（微信助手）
    conversationType: (v('conversation_type') as Conversation['conversationType']) || 'general',
  };
}

/**
 * 兼容旧数据:若传入的是 OpenClaw agentId,则尝试反查回 RepaceClaw agent UUID。
 * 新逻辑统一在 conversations.current_agent_id 中存 RepaceClaw agent UUID。
 */
export function resolveBusinessAgentId(agentId: string): string {
  // Phase 2:优先兼容 UUID / agent_code,再兼容历史 OpenClaw agentId。
  const byId = AgentService.getByIdOrCode(agentId);
  if (byId) return byId.id;

  const byOcAgentId = AgentService.getByOpenClawAgentId(agentId);
  if (byOcAgentId) return byOcAgentId.id;

  return agentId;
}
