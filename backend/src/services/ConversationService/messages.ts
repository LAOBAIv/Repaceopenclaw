import { v4 as uuidv4 } from "uuid";
import { getDb, saveDb } from "../../db/client";
import { IdGenerator } from '../../utils/IdGenerator';
import { ConversationCrud } from './crud';
import { execToRows, rv, rn, fetchAgentIdsMap, rowToConversation, type Message } from './helpers';
import type { Conversation } from './helpers';

export const ConversationMessages = {
  getMessages(conversationId: string): Message[] {
    const db = getDb();
    const rows = execToRows(
      db,
      "SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at ASC",
      [conversationId]
    );
    return rows.map((r) => ({
      id: rv(r, 'id')!,
      messageCode: rv(r, 'message_code') || undefined,
      conversationId: rv(r, 'conversation_id')!,
      role: rv(r, 'role') as "user" | "agent",
      content: rv(r, 'content')!,
      agentId: rv(r, 'agent_id') || undefined,
      tokenCount: rn(r, 'token_count') ?? 0,
      createdAt: rv(r, 'created_at')!,
    }));
  },

  addMessage(data: {
    conversationId: string;
    role: "user" | "agent";
    content: string;
    agentId?: string;
    /** 本次调用实际消耗 token 数,agent 消息时由 AutoLLMAdapter 传入 */
    tokenCount?: number;
  }): Message {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const tokenCount = data.tokenCount ?? 0;
    // Dual-code Phase 1:消息开始双写 message_code。
    // 不改变底层消息主键 id(UUID),只新增业务消息编码,便于后续会话级排障与展示。
    const conv = ConversationCrud.getById(data.conversationId);
    const existingCount = execToRows(db, "SELECT COUNT(1) as c FROM messages WHERE conversation_id=?", [data.conversationId])[0]?.c ?? 0;
    const messageCode = conv?.sessionCode ? IdGenerator.messageCode(conv.sessionCode, Number(existingCount) + 1) : '';
    db.run(
      `INSERT INTO messages (id, message_code, conversation_id, role, content, agent_id, token_count, created_at) VALUES (?,?,?,?,?,?,?,?)`,
      [id, messageCode, data.conversationId, data.role, data.content, data.agentId || null, tokenCount, now]
    );
    db.run(
      `UPDATE conversations SET last_message_at=? WHERE id=?`,
      [now, data.conversationId]
    );
    saveDb();
    return {
      id,
      messageCode: messageCode || undefined,
      conversationId: data.conversationId,
      role: data.role,
      content: data.content,
      agentId: data.agentId,
      tokenCount,
      createdAt: now,
    };
  },

  getSessionIndex(userId?: string) {
    const db = getDb();
    const rows = execToRows(
      db,
      `SELECT
         c.*, 
         (SELECT COUNT(1) FROM messages m WHERE m.conversation_id = c.id) as message_count,
         (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message
       FROM conversations c
       ${userId ? 'WHERE c.user_id = ?' : ''}
       ORDER BY COALESCE(NULLIF(c.last_message_at, ''), c.created_at) DESC`,
      userId ? [userId] : undefined
    );
    if (!rows.length) return [];
    const agentMap = fetchAgentIdsMap(db, rows.map((r) => rv(r, 'id')!));
    return rows.map((r) => {
      const conv = rowToConversation(r, agentMap.get(rv(r, 'id')!) ?? []);
      return {
        id: conv.id,
        title: conv.title,
        agentId: conv.agentId,
        currentAgentId: conv.currentAgentId,
        agentIds: conv.agentIds,
        sessionCode: conv.sessionCode,
        currentAgentCode: conv.currentAgentCode,
        ocSessionKey: rv(r, 'oc_session_key') || undefined,
        createdAt: conv.createdAt,
        updatedAt: conv.lastMessageAt || conv.createdAt,
        userId: rv(r, 'user_id') || '',
        messageCount: Number(rn(r, 'message_count') || 0),
        lastMessage: String(rv(r, 'last_message') || '').substring(0, 200),
        status: conv.status,
        scopeType: conv.scopeType,
        scopeId: conv.scopeId,
        memoryPolicy: conv.memoryPolicy,
        summary: conv.summary,
      };
    });
  },

  /**
   * 绑定 RC 会话与 OpenClaw session key。
   *
   * 关键原因：RC 只在 conversations 里存 UUID 不够，
   * OpenClaw 还需要一个带 agent 前缀的 session key 才能落到正确 agent 目录。
   * 这里同时更新：
   * 1) conversations.oc_session_key（当前主映射，便于排障）
   * 2) session_mapping（允许一个 RC conversation 对应多个 OC agent session）
   */
  bindOpenClawSession(conversationId: string, ocSessionKey: string, agentId: string, agentIds?: string[]): void {
    const db = getDb();
    const now = new Date().toISOString();
    const normalizedAgentIds = Array.from(new Set((agentIds && agentIds.length ? agentIds : [agentId]).filter(Boolean)));

    db.run(
      `UPDATE conversations SET oc_session_key=? WHERE id=?`,
      [ocSessionKey, conversationId]
    );

    const existing = execToRows(
      db,
      `SELECT id FROM session_mapping WHERE oc_session_key=?`,
      [ocSessionKey]
    )[0];

    if (existing?.id) {
      db.run(
        `UPDATE session_mapping
         SET conversation_id=?, agent_id=?, agent_ids=?, channel='repaceclaw', updated_at=?
         WHERE oc_session_key=?`,
        [conversationId, agentId, JSON.stringify(normalizedAgentIds), now, ocSessionKey]
      );
    } else {
      db.run(
        `INSERT INTO session_mapping
         (id, oc_session_key, conversation_id, session_file, agent_id, agent_ids, channel, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [uuidv4(), ocSessionKey, conversationId, '', agentId, JSON.stringify(normalizedAgentIds), 'repaceclaw', now, now]
      );
    }

    saveDb();
  },
};
