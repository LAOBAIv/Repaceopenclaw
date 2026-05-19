/**
 * ILinkMonitor.ts
 * [2026-05-18] RC 后端直接对接 iLink long-poll，接管微信消息收发
 * 
 * 链路：微信bot → iLink → RC(long-poll) → OC Gateway(AI) → RC → iLink → 微信bot
 */
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

// ── 配置 ──────────────────────────────────────────────────────
const ILINK_ACCOUNT_PATH = '/root/.openclaw/openclaw-weixin/accounts/868c6e16ab10-im-bot.json';
const SYNC_BUF_PATH = '/root/repaceclaw/backend/data/ilink-sync-buf.txt';
const LONG_POLL_TIMEOUT_MS = 35000;
const MAX_CONSECUTIVE_FAILURES = 5;
const BACKOFF_DELAY_MS = 30000;
const RETRY_DELAY_MS = 2000;

interface ILinkConfig {
  token: string;
  baseUrl: string;
  userId: string;
}

// iLink App ID
let cachedAppId = '';
function getAppId(): string {
  if (cachedAppId) return cachedAppId;
  try {
    const pkg = JSON.parse(fs.readFileSync('/root/.openclaw/extensions/openclaw-weixin/package.json', 'utf-8'));
    cachedAppId = pkg.ilink_appid || '';
  } catch {}
  return cachedAppId;
}

function buildBaseInfo() {
  return { local_id: Date.now().toString(), ...(getAppId() ? { ilink_appid: getAppId() } : {}) };
}

function loadConfig(): ILinkConfig | null {
  try {
    if (!fs.existsSync(ILINK_ACCOUNT_PATH)) return null;
    return JSON.parse(fs.readFileSync(ILINK_ACCOUNT_PATH, 'utf-8'));
  } catch { return null; }
}

function loadSyncBuf(): string {
  try { return fs.existsSync(SYNC_BUF_PATH) ? fs.readFileSync(SYNC_BUF_PATH, 'utf-8') : ''; }
  catch { return ''; }
}

function saveSyncBuf(buf: string): void {
  try {
    const dir = path.dirname(SYNC_BUF_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SYNC_BUF_PATH, buf);
  } catch {}
}

// ── HTTP 请求工具 ─────────────────────────────────────────────
function apiPost(baseUrl: string, endpoint: string, body: string, token?: string, timeoutMs?: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl}/${endpoint}`);
    const lib = url.protocol === 'https:' ? https : http;
    const timeout = timeoutMs || 10000;

    const req = lib.request({
      hostname: url.hostname,
      port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(token ? { 'Authorization': `Bearer ${token}`, 'AuthorizationType': 'ilink_bot_token' } : {}),
      },
      timeout,
    }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        } else {
          resolve(data);
        }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── iLink API ─────────────────────────────────────────────────
async function getUpdates(config: ILinkConfig, syncBuf: string): Promise<any> {
  const body = JSON.stringify({ get_updates_buf: syncBuf, base_info: buildBaseInfo() });
  const raw = await apiPost(config.baseUrl, 'ilink/bot/getupdates', body, config.token, LONG_POLL_TIMEOUT_MS + 5000);
  return JSON.parse(raw);
}

export async function sendMessage(config: ILinkConfig, toUserId: string, text: string, contextToken?: string): Promise<boolean> {
  // [2026-05-18] 修复：必须使用 message_type=2(BOT) + message_state=2(FINISH) + client_id + context_token
  const msgPayload: any = {
    from_user_id: '',
    to_user_id: toUserId,
    client_id: `rc-${Date.now()}`,
    message_type: 2,
    message_state: 2,
    item_list: [{ type: 1, text_item: { text } }],
  };
  if (contextToken) {
    msgPayload.context_token = contextToken;
  }
  const body = JSON.stringify({
    msg: msgPayload,
    base_info: buildBaseInfo(),
  });
  try {
    const resp = await apiPost(config.baseUrl, 'ilink/bot/sendmessage', body, config.token);
    logger.info(`[iLink][RC-ILinkMonitor] sendMessage resp: ${resp.slice(0, 200)}`);
    return true;
  } catch (e: any) {
    logger.error(`[iLink] sendMessage failed: ${e.message}`);
    return false;
  }
}

export async function sendTyping(config: ILinkConfig, ilinkUserId: string, typingTicket?: string): Promise<void> {
  const body = JSON.stringify({
    ilink_user_id: ilinkUserId,
    typing_ticket: typingTicket || '',
    status: 1,
    base_info: buildBaseInfo(),
  });
  try {
    await apiPost(config.baseUrl, 'ilink/bot/sendtyping', body, config.token, 5000);
  } catch {}
}

// [2026-05-18] 获取 bot config（含 typing_ticket）
async function getConfig(config: ILinkConfig, ilinkUserId: string, contextToken?: string): Promise<any> {
  const body = JSON.stringify({
    ilink_user_id: ilinkUserId,
    context_token: contextToken || '',
    base_info: buildBaseInfo(),
  });
  const resp = await apiPost(config.baseUrl, 'ilink/bot/getconfig', body, config.token, 5000);
  return JSON.parse(resp);
}

// ── 图片下载工具 ─────────────────────────────────────────────
/**
 * [2026-05-19] 下载图片并转换为 base64
 * 支持 URL 或 media_id
 */
async function downloadImageAsBase64(config: ILinkConfig, imageItem: any): Promise<string | null> {
  try {
    let imageUrl = '';

    // 优先使用 image_url
    if (imageItem.image_url) {
      imageUrl = imageItem.image_url;
    } else if (imageItem.url) {
      imageUrl = imageItem.url;
    }
    // media_id 需要调用 API 获取 URL
    else if (imageItem.media_id) {
      try {
        const body = JSON.stringify({
          media_id: imageItem.media_id,
          base_info: buildBaseInfo(),
        });
        const resp = await apiPost(config.baseUrl, 'ilink/bot/getmessage', body, config.token, 10000);
        const data = JSON.parse(resp);
        imageUrl = data.url || data.image_url || '';
      } catch (e) {
        logger.error('[iLink] Failed to get image URL from media_id');
      }
    }

    if (!imageUrl) {
      logger.warn('[iLink] No image URL found in image_item');
      return null;
    }

    // 下载图片
    return downloadImage(imageUrl);
  } catch (e) {
    logger.error('[iLink] Failed to download image');
    return null;
  }
}

/**
 * [2026-05-19] 从 URL 下载图片并转为 base64
 */
function downloadImage(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(imageUrl);
    const lib = urlObj.protocol === 'https:' ? https : http;
    const req = lib.get({
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      timeout: 30000,
    }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const base64 = buffer.toString('base64');
        const mimeType = res.headers['content-type'] || 'image/jpeg';
        resolve('data:' + mimeType + ';base64,' + base64);
      });
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')); });
    req.on('error', reject);
  });
}

// ── 消息处理 ──────────────────────────────────────────────────
async function handleIncomingMessage(config: ILinkConfig, msg: any): Promise<void> {
  const fromUserId = msg.from_user_id;
  if (!fromUserId) return;

  // [2026-05-18] 提取 context_token，回复时必须带回
  const contextToken = msg.context_token || '';

  // 提取文本内容
  let text = '';
  if (msg.item_list && Array.isArray(msg.item_list)) {
    for (const item of msg.item_list) {
      if (item.type === 1 && item.text_item?.text) {
        text += item.text_item.text;
      }
    }
  }
  if (!text) return;

  logger.info(`[iLink] Incoming from ${fromUserId.slice(0, 15)}...: ${text.slice(0, 50)}`);

  // [2026-05-18] 获取 typing_ticket 并发送 typing 状态
  let typingTicket = '';
  try {
    const configResp = await getConfig(config, fromUserId, contextToken);
    typingTicket = configResp?.typing_ticket || '';
  } catch {}
  if (typingTicket) {
    sendTyping(config, fromUserId, typingTicket).catch(() => {});
  }

  // 调用现有的 wechatIncoming 处理逻辑
  try {
    const { handleILinkMessage } = await import('../routes/wechatIncoming');
    const reply = await handleILinkMessage(fromUserId, text, msg.create_time_ms);
    
    if (reply) {
      await sendMessage(config, fromUserId, reply, contextToken);
      logger.info(`[iLink][RC-ILinkMonitor] Reply sent to ${fromUserId.slice(0, 15)}...`);
    }
  } catch (e: any) {
    logger.error(`[iLink] handleIncomingMessage error: ${e.message}`);
    // 回复错误信息
    await sendMessage(config, fromUserId, '⚠️ 系统处理异常，请稍后重试', contextToken);
  }
}

// ── Long-poll 主循环 ──────────────────────────────────────────
let isRunning = false;
let abortController: AbortController | null = null;

export async function startILinkMonitor(): Promise<void> {
  if (isRunning) {
    logger.info('[iLink] Monitor already running');
    return;
  }

  const config = loadConfig();
  if (!config) {
    logger.error('[iLink] Config not found, monitor not started');
    return;
  }

  isRunning = true;
  abortController = new AbortController();
  let syncBuf = loadSyncBuf();
  let consecutiveFailures = 0;

  logger.info(`[iLink] Monitor started (baseUrl=${config.baseUrl})`);

  while (isRunning && !abortController.signal.aborted) {
    try {
      logger.info(`[iLink] Polling... (syncBuf=${syncBuf ? syncBuf.length + 'chars' : 'empty'})`);
      const resp = await getUpdates(config, syncBuf);

      // 更新 sync buf
      if (resp.get_updates_buf) {
        syncBuf = resp.get_updates_buf;
        saveSyncBuf(syncBuf);
      }

      consecutiveFailures = 0;

      // 处理消息
      const messages = resp.msgs || [];
      logger.info(`[iLink] Poll returned: ${messages.length} messages`);
      updatePollStatus(messages.length);
      for (const msg of messages) {
        // [2026-05-18] bot 的真实 ID 是 to_user_id 中的 @im.bot 地址
        // 如果 from_user_id 包含 @im.bot，说明是 bot 自己发的消息，跳过
        if (msg.from_user_id && msg.from_user_id.includes('@im.bot')) {
          continue;
        }
        await handleIncomingMessage(config, msg);
      }

      // 正常间隔
      await sleep(100);
    } catch (e: any) {
      if (e.message === 'TIMEOUT') {
        // long-poll 超时是正常的，直接重试
        logger.info('[iLink] Poll timeout, retrying...');
        continue;
      }

      consecutiveFailures++;
      logger.error(`[iLink] Poll error (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}): ${e.message}`);

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        logger.error(`[iLink] Too many failures, backing off ${BACKOFF_DELAY_MS}ms`);
        await sleep(BACKOFF_DELAY_MS);
        consecutiveFailures = 0;
      } else {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  logger.info('[iLink] Monitor stopped');
  isRunning = false;
}

export function stopILinkMonitor(): void {
  isRunning = false;
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

// [2026-05-18] 替代 WechatMessageBridge 的状态接口
let lastPollAt = '';
let pollMessageCount = 0;

export function getILinkStatus() {
  return {
    running: isRunning,
    lastPollAt,
    pollMessageCount,
  };
}

export function updatePollStatus(messageCount: number) {
  lastPollAt = new Date().toISOString();
  pollMessageCount += messageCount;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const ILinkMonitor = {
  start: startILinkMonitor,
  stop: stopILinkMonitor,
  sendMessage,
  sendTyping,
  getStatus: getILinkStatus,
};
