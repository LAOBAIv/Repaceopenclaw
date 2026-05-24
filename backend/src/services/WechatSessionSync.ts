/**
 * WechatSessionSync — 链路 A 优化：微信消息被动同步到 RC 数据库
 *
 * 原理：定期读取 OC agent 的 openclaw-weixin session 文件，
 *       将已处理的消息同步写入 RC 平台数据库。
 *
 * 特点：
 *   - 纯读取，不干预消息流，与链路 A 零冲突
 *   - 通过 lastSyncedAt 游标增量同步，不重复写入
 *   - 自动创建/更新 RC conversation 映射
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { getDb } from '../db/client';
import { getErrorMessage } from '../types/ilink';

// ─── 配置 ────────────────────────────────────────────────────────────────

const SESSIONS_DIR = '/root/.openclaw/agents/rc-wechat-agent/sessions';
const SYNC_STATE_DIR = '/root/.openclaw/workspace/RepaceClaw/backend/data/wechat-sync-state';
const DEFAULT_SYNC_INTERVAL_MS = 15_000; // 15 秒同步一次

// ─── 类型 ────────────────────────────────────────────────────────────────

interface SessionEntry {
  sessionKey: string;
  sessionId: string;
  sessionFile: string;
  updatedAt: number;
  lastChannel?: string;
  provider?: string;
}

interface SyncCursor {
  sessionKey: string;
  lastSyncedTimestamp: number; // Unix ms，最后一条已同步消息的时间戳
  conversationId: string;
}

// ─── 工具函数 ────────────────────────────────────────────────────────────

function parseSessionsJson(): Map<string, SessionEntry> {
  const sessions = new Map<string, SessionEntry>();
  try {
    const sessionsFile = path.join(SESSIONS_DIR, 'sessions.json');
    if (!fs.existsSync(sessionsFile)) return sessions;

    const data = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
    for (const [key, val] of Object.entries(data)) {
      if (!key.includes('openclaw-weixin')) continue;

      // [2026-05-24] 类型安全：any → Record<string, unknown>
      const entry = val as Record<string, unknown>;
      sessions.set(key, {
        sessionKey: key,
        sessionId: (entry.sessionId as string) || '',
        sessionFile: (entry.sessionFile as string) || '',
        updatedAt: (entry.updatedAt as number) || 0,
        lastChannel: entry.lastChannel as string | undefined,
        provider: ((entry.origin as Record<string, unknown> | undefined)?.provider as string) || (entry.provider as string),
      });
    }
  } catch (err) {
    logger.warn('[WechatSessionSync] Failed to parse sessions.json', err);
  }
  return sessions;
}

function parseSessionFile(filePath: string): Array<{
  role: string;
  content: string;
  timestamp: number;
}> {
  const messages: Array<{ role: string; content: string; timestamp: number }> = [];
  try {
    if (!fs.existsSync(filePath)) return messages;

    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type !== 'message') continue;

        const msg = entry.message;
        if (!msg || !msg.role) continue;

        // 过滤 role：只保留 user 和 assistant
        if (msg.role !== 'user' && msg.role !== 'assistant') continue;

        // 提取文本内容
        let content = '';
        if (typeof msg.content === 'string') {
          content = msg.content;
        } else if (Array.isArray(msg.content)) {
          content = msg.content
            // [2026-05-24] 类型安全：any → unknown
            .filter((c: unknown) => (c as Record<string, unknown>).type === 'text')
            // [2026-05-24] 类型安全：any → unknown
            .map((c: unknown) => (c as Record<string, unknown>).text as string)
            .join('');
        }

        // 过滤 assistant 内部消息（API 调试、curl 输出等）
        if (msg.role === 'assistant' && isInternalMessage(content)) continue;

        // 过滤掉 system 元数据消息，提取实际用户消息
        if (content.includes('Conversation info (untrusted metadata)')) {
          // 格式: ...}\n```\n\n实际消息文本
          const match = content.match(/```\s*\n\s*\n\s*(.+)$/s);
          if (match) {
            content = match[1].trim();
          } else {
            continue;
          }
        }

        if (!content) continue;

        // Assistant 回复去 markdown（微信是纯文本渠道）
        if (msg.role === 'assistant') {
          content = stripMarkdown(content);
        }

        messages.push({
          role: msg.role,
          content,
          timestamp: msg.timestamp || entry.timestamp || 0,
        });
      } catch { /* skip bad lines */ }
    }
  } catch (err) {
    logger.warn(`[WechatSessionSync] Failed to read session file: ${filePath}`, err);
  }
  return messages;
}

// ─── 内部消息检测 ─────────────────────────────────────────────────────────

/**
 * 识别并过滤内部系统消息（不应暴露给用户的 agent 中间产物）
 */
function isInternalMessage(content: string): boolean {
  if (!content) return true;
  const trimmed = content.trim();

  // 1. JSON 错误响应
  if (trimmed.startsWith('{"error"') || trimmed.startsWith('{"success":false')) return true;

  // 2. curl / HTTP 调试输出
  if (trimmed.startsWith('* Host') || trimmed.startsWith('* Trying') ||
      trimmed.startsWith('> ') || trimmed.startsWith('< HTTP/') ||
      (trimmed.includes('\ncurl') && trimmed.includes('Host'))) return true;

  // 3. API 认证相关错误（agent 自己调用接口失败的返回）
  if (/API requires authentication|returns 401|Unauthorized/i.test(trimmed)) return true;

  // 4. thinking 标记的内部推理
  if (trimmed.startsWith('[thinking]') || trimmed.startsWith('<thinking>')) return true;

  return false;
}

// ─── Markdown 去格式 ────────────────────────────────────────────────────────

/**
 * 将 markdown 文本转为纯文本，适配微信等纯文本渠道
 */
function stripMarkdown(text: string): string {
  if (!text) return text;

  // 代码块: ```code``` → code（保留代码内容）
  text = text.replace(/```[a-z]*\n?([\s\S]*?)```/g, (_m, code) => {
    return code.trim();
  });

  // 行内代码: `code` → code
  text = text.replace(/`([^`]+)`/g, '$1');

  // 标题: ### Title → Title
  text = text.replace(/^#{1,6}\s+/gm, '');

  // 粗体+斜体: ***bold italic*** → bold italic
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');

  // 粗体: **bold** → bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');

  // 斜体: *italic* → italic
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');

  // 删除线: ~~strikethrough~~ → strikethrough
  text = text.replace(/~~([^~]+)~~/g, '$1');

  // 链接: [text](url) → text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 图片: ![alt](url) → alt
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

  // 列表项: - item 或 * item → • item
  text = text.replace(/^[*\-+]\s+/gm, '• ');
  text = text.replace(/^\d+\.\s+/gm, (m) => m); // 有序列表保留数字

  // 引用: > quote → quote
  text = text.replace(/^>\s+/gm, '');

  // 水平线: --- 或 *** 或 ___ → （空行）
  text = text.replace(/^\s*[-*_]{3,}\s*$/gm, '');

  // 清理多余空行（连续 3 个以上换行 → 2 个）
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

// ─── 同步游标管理 ─────────────────────────────────────────────────────────

function loadCursor(sessionKey: string): SyncCursor | null {
  try {
    const safeKey = sessionKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    const file = path.join(SYNC_STATE_DIR, `${safeKey}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function saveCursor(cursor: SyncCursor): void {
  try {
    if (!fs.existsSync(SYNC_STATE_DIR)) fs.mkdirSync(SYNC_STATE_DIR, { recursive: true });
    const safeKey = cursor.sessionKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    const file = path.join(SYNC_STATE_DIR, `${safeKey}.json`);
    fs.writeFileSync(file, JSON.stringify(cursor, null, 2));
  } catch (err) {
    logger.warn('[WechatSessionSync] Failed to save cursor', err);
  }
}

// ─── RC 数据库操作 ──────────────────────────────────────────────────────

function getOrCreateConversation(sessionKey: string, ilinkUserId: string): string {
  const db = getDb();
  const conversationId = `wechat-sync-${ilinkUserId}`;
  const now = new Date().toISOString();

  // 先按 oc_session_key 查找
  try {
    const existing = db.exec(
      `SELECT id FROM conversations WHERE oc_session_key = ? LIMIT 1`,
      [sessionKey]
    );
    if (existing.length > 0 && existing[0].values.length > 0) {
      return existing[0].values[0][0] as string;
    }
  } catch (err) {
    logger.warn('[WechatSessionSync] Query conversation failed', err);
  }

  // 按 conversationId 查找
  try {
    const existing = db.exec(
      `SELECT id FROM conversations WHERE id = ? LIMIT 1`,
      [conversationId]
    );
    if (existing.length > 0 && existing[0].values.length > 0) {
      // 更新 oc_session_key
      db.run(`UPDATE conversations SET oc_session_key = ? WHERE id = ?`, [sessionKey, conversationId]);
      return conversationId;
    }
  } catch (err) {
    logger.warn('[WechatSessionSync] Query by id failed', err);
  }

  // 创建新会话
  try {
    db.run(
      `INSERT INTO conversations (id, user_id, title, oc_session_key, agent_id, created_at, last_message_at, status, scope_type)
       VALUES (?, 'admin', '微信助手', ?, 'rc-wechat-agent', ?, ?, 'in_progress', 'wechat')`,
      [conversationId, sessionKey, now, now]
    );
    logger.info(`[WechatSessionSync] Created conversation for ${ilinkUserId}`);
  } catch (err: unknown) {
    // [2026-05-24] 类型安全：any → unknown
    const errMsg = getErrorMessage(err);
    if (errMsg?.includes('UNIQUE') || errMsg?.includes('PRIMARY KEY')) {
      db.run(`UPDATE conversations SET oc_session_key = ?, last_message_at = ? WHERE id = ?`,
        [sessionKey, now, conversationId]);
    } else {
      throw err;
    }
  }

  return conversationId;
}

function saveMessage(conversationId: string, role: string, content: string, timestampMs: number): boolean {
  const db = getDb();
  const messageId = `ws-msg-${crypto.randomUUID()}`;
  const messageCode = `ws-mc-${crypto.randomUUID()}`;
  const createdAt = new Date(timestampMs).toISOString();

  try {
    db.run(
      `INSERT INTO messages (id, user_id, conversation_id, role, content, agent_id, token_count, created_at, message_code)
       VALUES (?, 'admin', ?, ?, ?, ?, 0, ?, ?)`,
      [messageId, conversationId, role, content, role === 'assistant' ? 'rc-wechat-agent' : null, createdAt, messageCode]
    );
    db.run(`UPDATE conversations SET last_message_at = ? WHERE id = ?`, [createdAt, conversationId]);
    return true;
  } catch (err: unknown) {
    // [2026-05-24] 类型安全：any → unknown
    const errMsg = getErrorMessage(err);
    if (errMsg?.includes('UNIQUE') || errMsg?.includes('PRIMARY KEY')) {
      return false;
    }
    logger.warn('[WechatSessionSync] Failed to save message', err);
    return false;
  }
}

// ─── 同步服务 ────────────────────────────────────────────────────────────

class WechatSessionSync {
  private syncTimer: NodeJS.Timeout | null = null;
  private running = false;

  start(intervalMs = DEFAULT_SYNC_INTERVAL_MS): void {
    if (this.running) return;

    this.running = true;
    logger.info(`[WechatSessionSync] Started, syncing every ${intervalMs / 1000}s`);

    // 立即执行一次
    this.sync();

    this.syncTimer = setInterval(() => {
      if (this.running) this.sync();
    }, intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    logger.info('[WechatSessionSync] Stopped');
  }

  private sync(): void {
    const sessions = parseSessionsJson();
    if (sessions.size === 0) return;

    let totalNew = 0;

    for (const [sessionKey, entry] of sessions) {
      try {
        const newCount = this.syncSession(sessionKey, entry);
        totalNew += newCount;
      } catch (err: unknown) {
        // [2026-05-24] 类型安全：any → unknown
        logger.error(`[WechatSessionSync] Failed to sync session ${sessionKey}: ${getErrorMessage(err)}`);
      }
    }

    if (totalNew > 0) {
      logger.info(`[WechatSessionSync] Synced ${totalNew} new messages`);
    }
  }

  private syncSession(sessionKey: string, entry: SessionEntry): number {
    // 提取 ilink user id
    const parts = sessionKey.split(':');
    const ilinkUserId = parts[parts.length - 1];
    if (!ilinkUserId) return 0;

    const conversationId = getOrCreateConversation(sessionKey, ilinkUserId);

    // 加载游标
    let cursor = loadCursor(sessionKey);
    if (!cursor) {
      cursor = {
        sessionKey,
        lastSyncedTimestamp: 0,
        conversationId,
      };
    }

    // 读取 session 文件
    const messages = parseSessionFile(entry.sessionFile);
    if (messages.length === 0) return 0;

    let newCount = 0;
    for (const msg of messages) {
      // 增量过滤
      if (msg.timestamp <= cursor.lastSyncedTimestamp) continue;

      const saved = saveMessage(conversationId, msg.role, msg.content, msg.timestamp);
      if (saved) newCount++;

      if (msg.timestamp > cursor.lastSyncedTimestamp) {
        cursor.lastSyncedTimestamp = msg.timestamp;
      }
    }

    // 保存游标
    saveCursor(cursor);

    return newCount;
  }
}

// ─── 单例导出 ────────────────────────────────────────────────────────────

export const wechatSessionSync = new WechatSessionSync();
