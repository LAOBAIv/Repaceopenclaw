/**
 * WechatMessageBridge — 链路 B：RC 代理通道
 *
 * 功能：从 iLink 拉取微信消息 → 转发到 OC Gateway 处理 → 存库 → 回复微信
 *
 * 链路：
 *   微信用户 → iLink → RC后端（本服务） → callGateway → 存库 → iLink回复微信
 *
 * 与链路 A（openclaw-weixin 插件）并行运行，互不干扰：
 *   - 各自维护独立的 get_updates_buf 游标
 *   - 各自独立的 session key 命名空间
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../../utils/logger';
import { ILinkResponse, isError, getErrorMessage } from '../../types/ilink';
import { resolveOpenClawGateway } from '../../utils/openclawGateway';
import { getDb } from '../../db/client';
import { loadSyncState, saveSyncState, type SyncState } from './sync';
import { extractMessageText, extractMessageTimestamp } from './transform';

// ─── 配置 ────────────────────────────────────────────────────────────────

const ILINK_BASE = 'https://ilinkai.weixin.qq.com';
const WECHAT_ACCOUNTS_DIR = '/root/.openclaw/openclaw-weixin/accounts';
const DEFAULT_POLL_INTERVAL_MS = 30_000; // 30 秒轮询

// 链路 B 专用的 session key 前缀（区别于链路 A 的 openclaw-weixin）
const BRIDGE_SESSION_PREFIX = 'agent:rc-wechat-agent:rc-bridge';

// ─── 类型 ────────────────────────────────────────────────────────────────

interface WechatAccount {
  token: string;
  botId: string;
  userId: string;
  baseUrl: string;
}

// ─── HTTP 请求 ───────────────────────────────────────────────────────────

function ilinkFetch(
  apiPath: string,
  token: string,
  method: string = 'POST',
  body?: unknown,
  timeoutMs: number = 30000
): Promise<ILinkResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(apiPath.startsWith('http') ? apiPath : ILINK_BASE + apiPath);
    const payload = body ? JSON.stringify(body) : '';
    const uin = crypto.randomBytes(4).readUInt32LE(0);
    const uinBase64 = Buffer.from(uin.toString()).toString('base64');

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'AuthorizationType': 'ilink_bot_token',
        'Authorization': `Bearer ${token}`,
        'X-WECHAT-UIN': uinBase64,
        'User-Agent': 'RepaceClaw-Bridge/1.0',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode || 0, data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('iLink request timeout'));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * 调 OC Gateway 获取 agent 回复
 * 使用 HTTP /v1/chat/completions 接口
 */
async function callGateway(
  messages: Array<{ role: string; content: string }>,
  sessionKey: string,
  onChunk?: (text: string) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const { url: gatewayUrl, token: gatewayToken } = resolveOpenClawGateway();
    const url = new URL(gatewayUrl + '/v1/chat/completions');
    const body = JSON.stringify({
      model: 'openclaw/rc-wechat-agent',
      messages,
      stream: true,
    });

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
        'X-OpenClaw-Session-Key': sessionKey,
        'X-OpenClaw-Message-Channel': 'repaceclaw-bridge',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 120000,
    }, (res) => {
      let fullText = '';

      res.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(l => l.trim().startsWith('data: '));
        for (const line of lines) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              onChunk?.(delta);
            }
          } catch { /* skip parse errors */ }
        }
      });

      res.on('end', () => {
        if (fullText) resolve(fullText);
        else reject(new Error('Gateway returned empty response'));
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Gateway request timeout'));
    });

    req.write(body);
    req.end();
  });
}

// ─── 账号加载 ────────────────────────────────────────────────────────────

export function loadWechatAccounts(): WechatAccount[] {
  const accounts: WechatAccount[] = [];
  try {
    if (!fs.existsSync(WECHAT_ACCOUNTS_DIR)) return accounts;
    const files = fs.readdirSync(WECHAT_ACCOUNTS_DIR);
    for (const file of files) {
      if (!file.endsWith('.json') || file.includes('.context-tokens.') || file.includes('.sync.')) continue;
      if (file === 'accounts.json') continue;
      try {
        const filePath = path.join(WECHAT_ACCOUNTS_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (data.token) {
          accounts.push({
            token: data.token,
            botId: file.replace('.json', ''),
            userId: data.userId || file.replace('.json', ''),
            baseUrl: data.baseUrl || ILINK_BASE,
          });
        }
      } catch (err: unknown) {
        logger.warn(`[WechatBridge] Failed to parse account file: ${file}`, { error: getErrorMessage(err) });
      }
    }
  } catch (err: unknown) {
    logger.error('[WechatBridge] Failed to read accounts directory', { error: getErrorMessage(err) });
  }
  return accounts;
}

// ─── RC 数据库操作 ──────────────────────────────────────────────────────

export function getOrCreateConversation(ilinkUserId: string): string {
  const db = getDb();
  const ocSessionKey = `${BRIDGE_SESSION_PREFIX}:direct:${ilinkUserId}`;
  const conversationId = `wechat-bridge-${ilinkUserId}`;
  const now = new Date().toISOString();

  try {
    const existing = db.exec(
      `SELECT id FROM conversations WHERE oc_session_key = ? LIMIT 1`,
      [ocSessionKey]
    );
    if (existing.length > 0 && existing[0].values.length > 0) {
      return existing[0].values[0][0] as string;
    }
  } catch (err) {
    logger.warn('[WechatBridge] Query conversation failed', err);
  }

  try {
    db.run(
      `INSERT INTO conversations (id, user_id, title, oc_session_key, agent_id, created_at, last_message_at, status, scope_type)
       VALUES (?, 'admin', '微信助手(链路B)', ?, 'rc-wechat-agent', ?, ?, 'in_progress', 'wechat')`,
      [conversationId, ocSessionKey, now, now]
    );
    logger.info(`[WechatBridge] Created bridge conversation for ${ilinkUserId}`);
  } catch (err: unknown) {
    const errMsg = getErrorMessage(err);
    if (errMsg?.includes('UNIQUE') || errMsg?.includes('PRIMARY KEY')) {
      db.run(`UPDATE conversations SET oc_session_key = ?, last_message_at = ? WHERE id = ?`,
        [ocSessionKey, now, conversationId]);
    } else {
      throw err;
    }
  }

  return conversationId;
}

function saveMessage(conversationId: string, role: string, content: string, createdAt: string): void {
  const db = getDb();
  const messageId = `bridge-msg-${crypto.randomUUID()}`;
  try {
    db.run(
      `INSERT OR IGNORE INTO messages (id, user_id, conversation_id, role, content, agent_id, token_count, created_at)
       VALUES (?, 'admin', ?, ?, ?, ?, 0, ?)`,
      [messageId, conversationId, role, content, role === 'assistant' ? 'rc-wechat-agent' : null, createdAt]
    );
    db.run(`UPDATE conversations SET last_message_at = ? WHERE id = ?`, [createdAt, conversationId]);
  } catch (err: unknown) {
    const errMsg = getErrorMessage(err);
    if (!errMsg?.includes('UNIQUE') && !errMsg?.includes('PRIMARY KEY')) {
      logger.warn('[WechatBridge] Failed to save message', { error: errMsg });
    }
  }
}

// ─── 核心同步逻辑 ───────────────────────────────────────────────────────

/**
 * 从 iLink 获取新消息
 * 超时设为 25s，与 timeout_ms 参数匹配，避免误报超时
 */
async function fetchMessages(account: WechatAccount, syncState?: SyncState): Promise<{
  messages: unknown[];
  newBuf: string;
}> {
  const result = await ilinkFetch(
    `${account.baseUrl}/ilink/bot/getupdates`,
    account.token,
    'POST',
    {
      get_updates_buf: syncState?.getUpdatesBuf || '',
      timeout_ms: 20000, // 20s 长轮询
    },
    30000 // socket 超时 30s，留有 10s 余量
  );

  const data = result.data as { ret?: number; msgs?: unknown[]; get_updates_buf?: string } | undefined;
  if (result.status !== 200 || data?.ret !== 0) {
    logger.warn(`[WechatBridge] getUpdates failed for ${account.userId}: status=${result.status}, ret=${data?.ret}`);
    return { messages: [], newBuf: syncState?.getUpdatesBuf || '' };
  }

  const msgs = data?.msgs || [];
  const newBuf = data?.get_updates_buf || syncState?.getUpdatesBuf || '';

  // 只返回用户消息（message_type = 1）
  const userMsgs = msgs.filter((m: Record<string, unknown>) => m.message_type === 1);

  return { messages: userMsgs, newBuf };
}

/**
 * 发送回复到微信
 */
async function sendReply(account: WechatAccount, toUser: string, text: string): Promise<boolean> {
  try {
    const result = await ilinkFetch(
      `${account.baseUrl}/ilink/bot/sendmessage`,
      account.token,
      'POST',
      {
        to_user: toUser,
        content: text,
        content_type: 1, // 1 = 文本
      },
      15000
    );

    const data = result.data as { ret?: number } | undefined;
    if (result.status === 200 && data?.ret === 0) {
      logger.info(`[WechatBridge] Reply sent OK to ${toUser}`);
      return true;
    } else {
      logger.warn(`[WechatBridge] Reply failed: status=${result.status}, ret=${data?.ret}`);
      return false;
    }
  } catch (err: unknown) {
    logger.error(`[WechatBridge] Reply error: ${getErrorMessage(err)}`);
    return false;
  }
}

/**
 * 处理单条用户消息
 */
async function processUserMessage(
  account: WechatAccount,
  msg: unknown,
  conversationId: string
): Promise<void> {
  const userText = extractMessageText(msg);
  if (!userText) return;

  const createdAt = extractMessageTimestamp(msg);

  // 1. 存用户消息
  saveMessage(conversationId, 'user', userText, createdAt);
  logger.info(`[WechatBridge] Saved user message: "${userText.substring(0, 50)}..."`);

  // 2. 构建 session key（链路 B 独立命名空间）
  const ilinkUserId = account.userId;
  const sessionKey = `${BRIDGE_SESSION_PREFIX}:direct:${ilinkUserId}`;

  // 3. 调 Gateway 获取 agent 回复
  try {
    let assistantText = '';
    const replyText = await callGateway(
      [{ role: 'user', content: userText }],
      sessionKey,
      (chunk) => { assistantText += chunk; }
    );

    // 4. 存助手回复
    const replyTime = new Date().toISOString();
    saveMessage(conversationId, 'assistant', replyText, replyTime);
    logger.info(`[WechatBridge] Saved assistant reply: "${replyText.substring(0, 50)}..."`);

    // 5. 发回微信
    await sendReply(account, ilinkUserId, replyText);
  } catch (err: unknown) {
    logger.error(`[WechatBridge] Gateway call failed: ${getErrorMessage(err)}`);
    // 降级：存一条错误提示
    saveMessage(conversationId, 'assistant', '⚠️ 处理消息时出错，请稍后再试。', new Date().toISOString());
  }
}

// ─── Bridge 服务主类 ──────────────────────────────────────────────────────

class WechatMessageBridge {
  private pollTimer: NodeJS.Timeout | null = null;
  private syncStates: Map<string, SyncState>;
  private running = false;

  constructor() {
    this.syncStates = loadSyncState();
  }

  /**
   * 启动轮询（链路 B）
   */
  start(intervalMs = DEFAULT_POLL_INTERVAL_MS): void {
    if (this.running) {
      logger.warn('[WechatBridge] Already running');
      return;
    }

    const accounts = loadWechatAccounts();
    if (accounts.length === 0) {
      logger.info('[WechatBridge] No WeChat accounts found, bridge not started');
      return;
    }

    this.running = true;
    logger.info(`[WechatBridge] [链路B] Started, polling ${accounts.length} accounts every ${intervalMs / 1000}s`);

    // 立即执行一次
    this.pollAll(accounts);

    this.pollTimer = setInterval(() => {
      if (this.running) {
        this.pollAll(loadWechatAccounts());
      }
    }, intervalMs);
  }

  /**
   * 停止轮询
   */
  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    logger.info('[WechatBridge] Stopped');
  }

  /**
   * 手动触发一次轮询
   */
  async pollOnce(): Promise<void> {
    await this.pollAll(loadWechatAccounts());
  }

  /**
   * 轮询所有账号
   */
  private async pollAll(accounts: WechatAccount[]): Promise<void> {
    for (const account of accounts) {
      try {
        await this.pollAccount(account);
      } catch (err: unknown) {
        logger.error(`[WechatBridge] Poll failed for ${account.userId}: ${getErrorMessage(err)}`);
      }
    }
  }

  /**
   * 轮询单个账号
   */
  private async pollAccount(account: WechatAccount): Promise<void> {
    const syncState = this.syncStates.get(account.userId);

    const { messages, newBuf } = await fetchMessages(account, syncState);

    // 更新 buf（无论有没有消息）
    if (newBuf && newBuf !== syncState?.getUpdatesBuf) {
      const state: SyncState = {
        ilinkUserId: account.userId,
        getUpdatesBuf: newBuf,
        lastSyncAt: new Date().toISOString(),
        conversationId: syncState?.conversationId || '',
      };
      this.syncStates.set(account.userId, state);
      saveSyncState(state);
    }

    if (messages.length === 0) return;

    logger.info(`[WechatBridge] [链路B] Found ${messages.length} new messages for ${account.userId}`);

    const conversationId = getOrCreateConversation(account.userId);

    for (const msg of messages) {
      try {
        await processUserMessage(account, msg, conversationId);
      } catch (err: unknown) {
        logger.error(`[WechatBridge] Failed to process message: ${getErrorMessage(err)}`);
      }
    }
  }

  /**
   * 获取状态
   */
  getStatus(): Array<{ ilinkUserId: string; lastSyncAt: string; conversationId: string }> {
    const accounts = loadWechatAccounts();
    return accounts.map(acc => {
      const state = this.syncStates.get(acc.userId);
      return {
        ilinkUserId: acc.userId,
        lastSyncAt: state?.lastSyncAt || 'never',
        conversationId: state?.conversationId || '',
      };
    });
  }

  /**
   * 别名：兼容 wechatClawBot.ts 的旧调用
   */
  getSyncStatus() { return this.getStatus(); }
  async syncOnce() { await this.pollOnce(); }
}

// ─── 单例导出 ────────────────────────────────────────────────────────────

export const wechatMessageBridge = new WechatMessageBridge();
