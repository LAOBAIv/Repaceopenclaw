/**
 * SessionSyncService - OpenClaw 会话同步到 RepaceClaw 数据库
 * 
 * 功能：
 * 1. 扫描 ~/.openclaw/agents/main/sessions/*.jsonl
 * 2. 解析每个 session 的元数据和消息
 * 3. 同步到 conversations 表（如果不存在）
 * 4. 创建 session_mapping 映射记录
 * 5. 返回同步后的会话列表
 */
import fs from 'fs';
import path from 'path';

const OPENCLAW_SESSIONS_DIR = path.join(
  process.env.HOME || '/root',
  '.openclaw/agents/main/sessions'
);
const SESSIONS_INDEX_FILE = path.join(OPENCLAW_SESSIONS_DIR, 'sessions.json');
const DB_PATH = path.join(__dirname, '../../data/platform.db');

export interface OpenClawSessionMeta {
  sessionKey: string;
  sessionId: string;
  sessionFile: string;
  updatedAt: number;
  agentName?: string;
  title?: string;
  messageCount: number;
  firstMessage?: string;
  lastMessage?: string;
}

/** 从 JSONL 消息内容中提取纯文本 */
function extractMessageContent(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c: any) => c.text || '')
      .join('')
      .replace(/\[.*?\]/g, '')
      .trim();
  }
  return '';
}

/** 从 JSONL 文件提取会话元数据 */
function parseSessionFile(filePath: string): { title?: string; agentName?: string; firstMessage?: string; lastMessage?: string; messageCount: number } {
  if (!fs.existsSync(filePath)) {
    return { messageCount: 0 };
  }

  const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n').filter(Boolean);
  let firstUserMessage = '';
  let lastAssistantMessage = '';
  let messageCount = 0;

  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      
      if (msg.type === 'message' && msg.message) {
        messageCount++;
        const content = extractMessageContent(msg.message.content);
        
        if (msg.message.role === 'user' && !firstUserMessage && content.length > 10) {
          firstUserMessage = content.substring(0, 100);
        }
        
        if (msg.message.role === 'assistant' && content) {
          lastAssistantMessage = content.substring(0, 200);
        }
      }
    } catch {}
  }

  // 用第一条用户消息作为标题
  const title = firstUserMessage ? firstUserMessage.substring(0, 50) : '新会话';

  return {
    title,
    agentName: '',
    firstMessage: firstUserMessage,
    lastMessage: lastAssistantMessage,
    messageCount,
  };
}

/** 扫描 OpenClaw sessions 目录，解析元数据 */
export function scanOpenClawSessions(): OpenClawSessionMeta[] {
  if (!fs.existsSync(SESSIONS_INDEX_FILE)) return [];
  
  let index: Record<string, any>;
  try {
    index = JSON.parse(fs.readFileSync(SESSIONS_INDEX_FILE, 'utf-8'));
  } catch {
    return [];
  }

  const sessions: OpenClawSessionMeta[] = [];

  for (const [sessionKey, entry] of Object.entries(index)) {
    const e = entry as any;
    const filePath = e.sessionFile;
    const meta = parseSessionFile(filePath);

    sessions.push({
      sessionKey,
      sessionId: e.sessionId,
      sessionFile: filePath,
      updatedAt: e.updatedAt || 0,
      messageCount: meta.messageCount,
      agentName: meta.agentName,
      title: meta.title,
      firstMessage: meta.firstMessage,
      lastMessage: meta.lastMessage,
    });
  }

  sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  return sessions;
}

/** 同步 OpenClaw sessions 到 RepaceClaw DB（接收 db 实例作为参数） */
export function syncToDatabase(db: any, userId: string = ''): { synced: number; total: number; errors: string[] } {
  const openClawSessions = scanOpenClawSessions();
  let synced = 0;
  const errors: string[] = [];

  for (const session of openClawSessions) {
    try {
      const existingMapping = db.prepare(
        "SELECT conversation_id FROM session_mapping WHERE oc_session_key = ?"
      ).get([session.sessionKey]) as { conversation_id: string } | undefined;

      let conversationId: string;
      const title = session.title || '新会话';
      const now = new Date().toISOString();
      const updatedAt = new Date(session.updatedAt).toISOString();

      if (existingMapping) {
        conversationId = existingMapping.conversation_id;
        db.run(
          `UPDATE conversations SET title = ?, oc_session_key = ?, updated_at = ? WHERE id = ?`,
          [title, session.sessionKey, updatedAt, conversationId]
        );
        db.run(
          `UPDATE session_mapping SET conversation_id = ?, session_file = ?, updated_at = ? WHERE oc_session_key = ?`,
          [conversationId, session.sessionFile, now, session.sessionKey]
        );
      } else {
        conversationId = session.sessionId;
        db.run(
          `INSERT OR IGNORE INTO conversations 
           (id, title, agent_id, agent_ids, oc_session_key, created_at, updated_at, user_id)
           VALUES (?, ?, '', '[]', ?, ?, ?, ?)`,
          [conversationId, title, session.sessionKey, now, now, userId]
        );
        const mappingId = `map_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        db.run(
          `INSERT OR IGNORE INTO session_mapping 
           (id, oc_session_key, conversation_id, session_file, agent_id, agent_ids, created_at, updated_at)
           VALUES (?, ?, ?, ?, '', '[]', ?, ?)`,
          [mappingId, session.sessionKey, conversationId, session.sessionFile, now, now]
        );
      }

      synced++;
    } catch (err: any) {
      errors.push(`${session.sessionKey.slice(-8)}: ${err.message}`);
    }
  }

  return { synced, total: openClawSessions.length, errors };
}

/** 获取合并后的会话列表 */
export function getAllSessions(db: any, userId: string = '') {
  const rows = db.exec(`
    SELECT 
      c.id, c.title, c.agent_id as agentId, c.oc_session_key as ocSessionKey,
      c.created_at as createdAt, c.user_id as userId, c.updated_at as updatedAt,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as messageCount,
      (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as lastMessage
    FROM conversations c
    WHERE c.user_id = ? OR c.user_id = ''
    ORDER BY COALESCE(c.updated_at, c.created_at) DESC
  `, [userId]);

  return (rows[0]?.values || []).map(row => {
    const obj: Record<string, any> = {};
    const cols = rows[0].columns;
    cols.forEach((c, i) => { obj[c] = row[i]; });
    obj.lastMessage = obj.lastMessage ? String(obj.lastMessage).substring(0, 200) : '';
    obj.agentIds = [];
    return obj;
  });
}
