/**
 * wechatClawBot — 微信 ClawBot API 路由
 *
 * 直接调用 iLink API 获取微信机器人二维码，不再依赖 OpenClaw Gateway：
 *   - POST /api/wechat-clawbot/qrcode        — 获取扫码登录二维码 (iLink API)
 *   - POST /api/wechat-clawbot/qrcode/status — 轮询扫码状态 (iLink API)
 *   - POST /api/wechat-clawbot/channel/reset — 重置 IM 通道 (iLink API)
 *   - GET  /api/wechat-clawbot/status         — 获取微信连接状态
 *   - GET  /api/wechat-clawbot/ws-status      — 获取 Gateway WebSocket 连接状态
 *   - GET  /api/wechat-clawbot/models         — 获取可用模型列表 (Gateway)
 *   - GET  /api/wechat-clawbot/events         — SSE 实时事件流
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { resolveOpenClawGateway } from '../utils/openclawGateway';
import { clawBotClient } from '../services/ClawBotGatewayClient';
import { wechatMessageBridge, loadWechatAccounts } from '../services/WechatMessageBridge';
import { getDb, execToRows } from '../db/client';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const router = Router();

// iLink API 配置
const ILINK_BASE = 'https://ilinkai.weixin.qq.com';
const ILINK_BOT_TYPE = 3;
const ILINK_APP_ID = process.env.ILINK_APP_ID || '';
const ILINK_SECRET_KEY = process.env.ILINK_SECRET_KEY || '';

// iLink 账号文件目录
const ILINK_ACCOUNTS_DIR = '/root/.openclaw/openclaw-weixin/accounts';

/**
 * 生成 iLink HMAC-SHA256 签名
 * 签名规则：timestamp + nonce + path + body → HMAC-SHA256
 */
function createILinkSignature(method: string, urlPath: string, body: string): { timestamp: string; nonce: string; signature: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(8).toString('hex');
  const signContent = `${method.toUpperCase()}\n${urlPath}\n${timestamp}\n${nonce}\n${body}`;
  const signature = crypto.createHmac('sha256', ILINK_SECRET_KEY).update(signContent).digest('hex');
  return { timestamp, nonce, signature };
}

/**
 * 读取已绑定的 iLink 账号列表
 */
function getBoundAccounts(): Array<{ botId: string; token: string; userId: string; baseUrl: string }> {
  const accounts: Array<{ botId: string; token: string; userId: string; baseUrl: string }> = [];
  try {
    if (!fs.existsSync(ILINK_ACCOUNTS_DIR)) return accounts;
    const files = fs.readdirSync(ILINK_ACCOUNTS_DIR);
    for (const file of files) {
      // 只读取主账号文件（不带后缀的 .json）
      if (!file.endsWith('.json') || file.includes('.context-tokens.') || file.includes('.sync.')) continue;
      try {
        const filePath = path.join(ILINK_ACCOUNTS_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (data.token) {
          const botId = file.replace('.json', '');
          accounts.push({
            botId,
            token: data.token,
            userId: data.userId || '',
            baseUrl: data.baseUrl || ILINK_BASE,
          });
        }
      } catch (err) {
        logger.warn(`[WechatClawBot] Failed to parse account file: ${file}`, err);
      }
    }
  } catch (err) {
    logger.error('[WechatClawBot] Failed to read accounts directory', err);
  }
  return accounts;
}

// 缓存二维码的 qrserver URL（用于 SVG 代理内嵌 base64）
const qrcodeImageCache = new Map<string, { qrserverUrl: string; createdAt: number }>();
const QRCODE_CACHE_TTL_MS = 10 * 60 * 1000;

function cleanupQrcodeCache() {
  const now = Date.now();
  for (const [key, value] of qrcodeImageCache.entries()) {
    if (now - value.createdAt > QRCODE_CACHE_TTL_MS) {
      qrcodeImageCache.delete(key);
    }
  }
}

/**
 * 从 qrserver URL 下载 PNG 图片，转 base64 data URI
 */
function fetchImageAsBase64DataUri(url: string, timeout = 8000): Promise<string | null> {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, { timeout }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || 'image/png';
        resolve(`data:${contentType};base64,${buf.toString('base64')}`);
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── HTTP 请求工具 ──────────────────────────────────────────────────────

const { url: GATEWAY_URL, token: GATEWAY_TOKEN } = resolveOpenClawGateway();

/**
 * 向 Gateway 发起 HTTP 请求（仅用于 /v1/models 等可用端点）
 */
function proxyToGateway(
  method: string,
  path: string,
  body?: any,
  timeout = 30000
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(GATEWAY_URL + path);
    const payload = body ? JSON.stringify(body) : '';

    const lib = url.protocol === 'https:' ? https : http;

    const reqOptions: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GATEWAY_TOKEN,
      },
      timeout,
    };

    if (payload) {
      reqOptions.headers!['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = lib.request(reqOptions, (res) => {
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
      reject(new Error('Gateway request timeout'));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * 向 iLink API 发起 HTTP 请求（用于二维码、扫码状态、渠道重置）
 * 自动添加 HMAC-SHA256 签名认证
 */
function callILink(
  method: string,
  path: string,
  body?: any,
  timeout = 30000
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(ILINK_BASE + path);
    const payload = body ? JSON.stringify(body) : '';

    // 生成 HMAC-SHA256 签名
    const { timestamp, nonce, signature } = createILinkSignature(method, url.pathname + url.search, payload);

    const reqOptions: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RepaceClaw/1.0',
        'x-app-id': ILINK_APP_ID,
        'x-timestamp': timestamp,
        'x-nonce': nonce,
        'x-signature': signature,
      },
      timeout,
    };

    if (payload) {
      reqOptions.headers!['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request(reqOptions, (res) => {
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
 * iLink GET 请求（无签名）— 用于 get_qrcode_status 等 GET-only 端点
 * 与 openclaw-weixin 插件的 apiGetFetch 保持一致
 */
function callILinkGet(
  path: string,
  timeout = 35000
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(ILINK_BASE + path);

    const reqOptions: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'iLink-App-Id': ILINK_APP_ID,
        'iLink-App-ClientVersion': '65547', // v1.0.11 = 0x0001000B
      },
      timeout,
    };

    const req = https.request(reqOptions, (res) => {
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
      reject(new Error('iLink GET request timeout'));
    });

    req.end();
  });
}

// ─── SSE 事件管理 ───────────────────────────────────────────────────────

type SseCallback = (event: string, payload: string) => void;
const sseClients = new Set<SseCallback>();

function broadcastSse(event: string, data: any): void {
  const payload = JSON.stringify(data);
  for (const client of sseClients) {
    try {
      client(event, payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// 注册 Gateway 事件监听
clawBotClient.on('state_change', (data) => {
  broadcastSse('state_change', data);
});

clawBotClient.on('connected', (data) => {
  broadcastSse('connected', data);
});

clawBotClient.on('disconnect', () => {
  broadcastSse('disconnected', {});
});

// 透传 Gateway 事件（通过通配符监听）
clawBotClient.on('*', (data: any) => {
  if (data?.event) {
    broadcastSse('gateway_event', data);
  }
});

// ─── 路由 ────────────────────────────────────────────────────────────────

/**
 * POST /api/wechat-clawbot/qrcode
 * 直接调用 iLink API 获取微信机器人登录二维码
 */
router.post('/qrcode', async (req: Request, res: Response) => {
  try {
    logger.info('[WechatClawBot] Fetching QR code from iLink...');
    // 获取已绑定的账号 token 列表
    const boundAccounts = getBoundAccounts();
    const localTokenList = boundAccounts.map(a => a.token);
    logger.info('[WechatClawBot] local_token_list:', localTokenList);

    const result = await callILink(
      'POST',
      `/ilink/bot/get_bot_qrcode?bot_type=${ILINK_BOT_TYPE}`,
      { local_token_list: localTokenList }
    );

    if (result.status >= 400 || (result.data && result.data.ret !== 0)) {
      const errMsg = result.data?.msg || result.data?.message || 'iLink error';
      logger.error('[WechatClawBot] iLink error: ' + result.status + ' ' + errMsg);
      return res.status(result.status >= 400 ? result.status : 500).json({
        success: false,
        error: errMsg,
        detail: result.data,
      });
    }

    cleanupQrcodeCache();

    const ilinkData = result.data;
    const qrToken = ilinkData.qrcode;
    // 获取 iLink 返回的原始二维码数据（可能是网页链接或 base64 图片）
    const originalQrUrl = ilinkData.qrcode_url || ilinkData.qrcode_img_content;
    const qrImageContent = ilinkData.qrcode_img_content || null;

    if (!originalQrUrl) {
      logger.error('[WechatClawBot] iLink returned no qrcode_url or qrcode_img_content');
      return res.status(500).json({
        success: false,
        error: 'iLink returned no qrcode URL',
        detail: ilinkData,
      });
    }

    logger.info('[WechatClawBot] QR code URL: ' + originalQrUrl);

    // 判断原始链接类型：base64 图片、http(s) 图片、还是网页链接
    let displayType: 'image_base64' | 'image_url' | 'web_link' = 'web_link';
    let displayUrl = originalQrUrl;

    if (originalQrUrl.startsWith('data:')) {
      // 已经是 base64 图片
      displayType = 'image_base64';
      displayUrl = originalQrUrl;
    } else if (originalQrUrl.match(/^https?:\/\/.*\.(png|jpg|jpeg|gif|svg|webp)/i)) {
      // 直接是图片 URL
      displayType = 'image_url';
      displayUrl = originalQrUrl;
    } else {
      // 网页链接：使用 qrserver 生成二维码图片供前端展示
      // 同时保留原始链接供用户直接打开
      displayType = 'web_link';
      displayUrl = originalQrUrl;
    }

    // 生成展示用二维码图片（仅对网页链接使用 qrserver）
    const qrDisplayUrl = displayType === 'web_link'
      ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(originalQrUrl)}`
      : displayUrl;

    res.json({
      success: true,
      data: {
        qrcode: qrToken,
        // 展示用：前端直接显示这个
        qrcode_url: qrDisplayUrl,
        // 原始 iLink 链接（前端同时展示，用户可点击跳转）
        original_qrcode_url: originalQrUrl,
        // 链接类型：image_base64 | image_url | web_link
        qrcode_type: displayType,
        // base64 图片内容（如果有）
        qrcode_img_content: qrImageContent,
      },
    });
  } catch (err: any) {
    logger.error('[WechatClawBot] QR code fetch failed: ' + err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/wechat-clawbot/qrcode/image?id=xxx
 * 从 qrserver 下载 PNG，转 base64 内嵌到 SVG，完全自包含
 */
router.get('/qrcode/image', async (req: Request, res: Response) => {
  cleanupQrcodeCache();
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  const cached = id ? qrcodeImageCache.get(id) : null;
  if (!cached?.qrserverUrl) {
    return res.status(404).send('QR code image not found or expired');
  }

  // 从 qrserver 下载 PNG 并转 base64 data URI
  const dataUri = await fetchImageAsBase64DataUri(cached.qrserverUrl);
  if (!dataUri) {
    return res.status(502).send('Failed to fetch QR code image from qrserver');
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="32" fill="#f3f4f6"/>
  <rect x="92" y="92" width="840" height="840" rx="20" fill="#ffffff"/>
  <image href="${dataUri}" x="132" y="132" width="760" height="760" preserveAspectRatio="none"/>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.send(svg);
});

/**
 * POST /api/wechat-clawbot/qrcode/status
 * 调用 iLink API 轮询扫码状态
 */
router.post('/qrcode/status', async (req: Request, res: Response) => {
  const { qrcode } = req.body || {};
  if (!qrcode || typeof qrcode !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing required field: qrcode' });
  }
  try {
    // 使用 GET 请求（无签名），与 openclaw-weixin 插件保持一致
    const result = await callILinkGet(
      `/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}&bot_type=${ILINK_BOT_TYPE}`
    );

    logger.info('[WechatClawBot] QR status response: ' + JSON.stringify(result.data).substring(0, 200));

    // iLink 返回格式: { status: "wait"|"scaned"|"confirmed"|"expired", bot_token?, ilink_bot_id?, ilink_user_id?, baseurl? }
    if (result.data && result.data.status) {
      const status = result.data.status;
      const baseUrl = result.data.baseurl || 'https://ilinkai.weixin.qq.com';

      // 如果扫码成功（confirmed），保存 token 到账号文件并触发 Gateway 热重载
      if (status === 'confirmed' && result.data.bot_token) {
        try {
          const botId = result.data.ilink_bot_id;
          const botToken = result.data.bot_token;
          const userId = result.data.ilink_user_id;

          if (botId && botToken && userId) {
            const accountsDir = path.resolve('/root/.openclaw/openclaw-weixin/accounts');
            if (!fs.existsSync(accountsDir)) {
              fs.mkdirSync(accountsDir, { recursive: true });
            }

            // 写入账号文件
            const accountFile = path.join(accountsDir, `${botId}.json`);
            const accountData = {
              token: botToken,
              savedAt: new Date().toISOString(),
              baseUrl: baseUrl,
              userId: userId,
            };
            fs.writeFileSync(accountFile, JSON.stringify(accountData, null, 2));
            logger.info('[WechatClawBot] Account saved: ' + botId);

            // 注册到 accounts.json 索引
            const accountsIndexFile = path.join(accountsDir, 'accounts.json');
            let accountsIndex: string[] = [];
            if (fs.existsSync(accountsIndexFile)) {
              try {
                accountsIndex = JSON.parse(fs.readFileSync(accountsIndexFile, 'utf-8'));
              } catch { accountsIndex = []; }
            }
            if (!accountsIndex.includes(botId)) {
              accountsIndex.push(botId);
              fs.writeFileSync(accountsIndexFile, JSON.stringify(accountsIndex, null, 2));
              logger.info('[WechatClawBot] Account registered in index: ' + botId);
            }

            // 触发 Gateway 热重载
            const openclawConfigFile = '/root/.openclaw/openclaw.json';
            if (fs.existsSync(openclawConfigFile)) {
              const openclawConfig = JSON.parse(fs.readFileSync(openclawConfigFile, 'utf-8'));
              openclawConfig.channelConfigUpdatedAt = new Date().toISOString();
              fs.writeFileSync(openclawConfigFile, JSON.stringify(openclawConfig, null, 2));
              logger.info('[WechatClawBot] Gateway hot reload triggered');
            }
          }
        } catch (saveErr: any) {
          logger.error('[WechatClawBot] Failed to save account: ' + saveErr.message);
        }
      }

      res.json({
        success: true,
        data: {
          status: status,
          credentials: status === 'confirmed' ? {
            bot_token: result.data.bot_token,
            ilink_bot_id: result.data.ilink_bot_id,
            ilink_user_id: result.data.ilink_user_id,
          } : undefined,
          baseurl: baseUrl,
        },
      });
    } else {
      // 没有 status 字段，视为过期
      res.json({
        success: true,
        data: {
          status: 'expired',
        },
      });
    }
  } catch (err: any) {
    logger.error('[WechatClawBot] QR status poll failed: ' + err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/wechat-clawbot/channel/reset
 * 调用 iLink API 重置 IM 通道
 */
router.post('/channel/reset', async (req: Request, res: Response) => {
  const { channel_id } = req.body || {};
  if (!channel_id || typeof channel_id !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing required field: channel_id' });
  }
  try {
    logger.info('[WechatClawBot] Resetting channel: ' + channel_id);
    const result = await callILink(
      'POST',
      `/ilink/bot/reset_channel?bot_type=${ILINK_BOT_TYPE}`,
      { channel_id }
    );
    res.json({
      success: result.data?.ret === 0,
      data: result.data,
    });
  } catch (err: any) {
    logger.error('[WechatClawBot] Channel reset failed: ' + err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 读取 iLink 账号文件，返回已绑定的微信账号列表
 */
function getWeixinAccounts() {
  const accountsDir = path.resolve('/root/.openclaw/openclaw-weixin/accounts');
  const accounts: Array<{
    accountId: string;
    userId: string;
    baseUrl: string;
    hasToken: boolean;
    savedAt: string;
  }> = [];

  try {
    if (!fs.existsSync(accountsDir)) {
      logger.warn('[WechatClawBot] Accounts directory not found: ' + accountsDir);
      return accounts;
    }

    // 直接扫描目录下的账号文件（排除索引文件和上下文文件）
    const files = fs.readdirSync(accountsDir);
    for (const file of files) {
      // 只读取主账号文件（.json 结尾，不包含 .context-tokens. 和 .sync.）
      if (!file.endsWith('.json') || file.includes('.context-tokens.') || file.includes('.sync.')) continue;
      if (file === 'accounts.json') continue; // 跳过索引文件

      const accountId = file.replace('.json', '');
      const accountFile = path.join(accountsDir, file);

      try {
        const account = JSON.parse(fs.readFileSync(accountFile, 'utf-8'));
        accounts.push({
          accountId,
          userId: account.userId || 'unknown',
          baseUrl: account.baseUrl || 'unknown',
          hasToken: !!account.token,
          savedAt: account.savedAt || 'unknown',
        });
      } catch (err: any) {
        logger.warn(`[WechatClawBot] Failed to parse account file: ${file}`, err);
      }
    }
  } catch (err: any) {
    logger.error('[WechatClawBot] Failed to read weixin accounts: ' + err.message);
  }

  return accounts;
}

/**
 * GET /api/wechat-clawbot/status
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const wsState = clawBotClient.getState();
    const weixinAccounts = getWeixinAccounts();
    const activeAccounts = weixinAccounts.filter(a => a.hasToken);

    res.json({
      success: true,
      data: {
        wsConnection: wsState,
        channelStatus: {
          plugin: 'openclaw-weixin',
          channel: 'openclaw-weixin',
          active: activeAccounts.length > 0,
          accountCount: activeAccounts.length,
          accounts: activeAccounts.map(a => ({
            accountId: a.accountId,
            userId: a.userId,
          })),
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/wechat-clawbot/ws-status
 */
router.get('/ws-status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: { state: clawBotClient.getState(), timestamp: new Date().toISOString() },
  });
});

/**
 * GET /api/wechat-clawbot/models
 */
router.get('/models', async (_req: Request, res: Response) => {
  try {
    const result = await proxyToGateway('GET', '/v1/models', undefined, 10000);
    res.json(result.data);
  } catch (err: any) {
    logger.error('[WechatClawBot] Models fetch failed: ' + err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/wechat-clawbot/events
 * SSE 实时事件流
 */
router.get('/events', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const initState = JSON.stringify({ state: clawBotClient.getState() });
  res.write('event: state\ndata: ' + initState + '\n\n');

  const client: SseCallback = (event, payload) => {
    res.write('event: ' + event + '\ndata: ' + payload + '\n\n');
  };

  sseClients.add(client);

  const keepalive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      cleanup();
    }
  }, 15000);

  function cleanup() {
    clearInterval(keepalive);
    sseClients.delete(client);
  }

  req.on('close', cleanup);
  req.on('error', cleanup);
});

/**
 * GET /api/wechat-clawbot/accounts
 * 返回已绑定的微信账号列表
 */
router.get('/accounts', (_req: Request, res: Response) => {
  try {
    const accounts = getWeixinAccounts();
    // [2026-05-22] 关联 user_wechat_bindings + users + departments 表，返回 RC 用户名和组织
    const db = getDb();
    const bindingsResult = execToRows(db,
      `SELECT b.wechat_openid, b.bot_id, u.username, u.nickname,
              COALESCE(root_d.name, d.name) as department
       FROM user_wechat_bindings b
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN user_org_scope uos ON uos.user_id = u.id AND uos.is_primary = 1 AND uos.status = 'active'
       LEFT JOIN departments d ON d.id = uos.department_id
       LEFT JOIN departments root_d ON root_d.id = d.parent_id AND d.parent_id IS NOT NULL`);
    const bindingMap = new Map<string, { username: string; nickname: string; department: string }>();
    for (const row of bindingsResult) {
      const key = row.bot_id || row.wechat_openid;
      const info = { username: row.username || '', nickname: row.nickname || '', department: row.department || '' };
      bindingMap.set(key, info);
      if (row.wechat_openid) bindingMap.set(row.wechat_openid, info);
    }
    res.json({
      success: true,
      data: {
        accounts: accounts.map(a => {
          const binding = bindingMap.get(a.accountId) || bindingMap.get(a.userId);
          return {
            accountId: a.accountId,
            userId: a.userId,
            hasToken: a.hasToken,
            savedAt: a.savedAt,
            rcUsername: binding?.username || '',
            rcNickname: binding?.nickname || '',
            rcDepartment: binding?.department || '',
          };
        }),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/wechat-clawbot/accounts/:accountId
 * 删除已绑定的微信账号
 */
router.delete('/accounts/:accountId', (req: Request, res: Response) => {
  const { accountId } = req.params;
  try {
    const accountsDir = path.resolve('/root/.openclaw/openclaw-weixin/accounts');
    const accountFiles = [
      `${accountId}.json`,
      `${accountId}.context-tokens.json`,
      `${accountId}.sync.json`,
    ];
    
    let deleted = false;
    for (const file of accountFiles) {
      const filePath = path.join(accountsDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deleted = true;
        logger.info('[WechatClawBot] Deleted account file: ' + file);
      }
    }

    // 更新 accounts.json 索引
    const accountsIndexFile = path.join(accountsDir, 'accounts.json');
    if (fs.existsSync(accountsIndexFile)) {
      let accountsIndex: string[] = [];
      try {
        accountsIndex = JSON.parse(fs.readFileSync(accountsIndexFile, 'utf-8'));
      } catch { accountsIndex = []; }
      accountsIndex = accountsIndex.filter((id: string) => id !== accountId);
      fs.writeFileSync(accountsIndexFile, JSON.stringify(accountsIndex, null, 2));
      logger.info('[WechatClawBot] Updated accounts.json index');
    }

    // 触发 Gateway 热重载
    const openclawConfigFile = '/root/.openclaw/openclaw.json';
    if (fs.existsSync(openclawConfigFile)) {
      const openclawConfig = JSON.parse(fs.readFileSync(openclawConfigFile, 'utf-8'));
      openclawConfig.channelConfigUpdatedAt = new Date().toISOString();
      fs.writeFileSync(openclawConfigFile, JSON.stringify(openclawConfig, null, 2));
      logger.info('[WechatClawBot] Gateway hot reload triggered after account deletion');
    }

    if (deleted) {
      res.json({ success: true, message: '账号已删除: ' + accountId });
    } else {
      res.status(404).json({ success: false, error: '账号不存在: ' + accountId });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/wechat-clawbot/stats
 * 消息统计
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    // 微信Bot来源（iLink）
    const botUser = execToRows(db, "SELECT COUNT(*) as cnt FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE conversation_type = 'wechat_assistant') AND id LIKE 'wechat-msg%' AND role = 'user'");
    const botAgent = execToRows(db, "SELECT COUNT(*) as cnt FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE conversation_type = 'wechat_assistant') AND id LIKE 'wechat-msg%' AND role = 'agent'");
    // RC微信助手来源
    const rcUser = execToRows(db, "SELECT COUNT(*) as cnt FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE conversation_type = 'wechat_assistant') AND id NOT LIKE 'wechat-msg%' AND role = 'user'");
    const rcAgent = execToRows(db, "SELECT COUNT(*) as cnt FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE conversation_type = 'wechat_assistant') AND id NOT LIKE 'wechat-msg%' AND role = 'agent'");
    // 总计
    const total = execToRows(db, "SELECT COUNT(*) as cnt FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE conversation_type = 'wechat_assistant')");
    res.json({
      success: true,
      data: {
        total: total[0]?.cnt || 0,
        wechatBot: { received: botUser[0]?.cnt || 0, replied: botAgent[0]?.cnt || 0 },
        rcAssistant: { sent: rcUser[0]?.cnt || 0, replied: rcAgent[0]?.cnt || 0 },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
* GET /api/wechat-clawbot/sync-status
 * 获取消息同步状态
 */
router.get('/sync-status', (_req: Request, res: Response) => {
  try {
    const { ILinkMonitor } = require('../services/ILinkMonitor');
    const status = ILinkMonitor.getStatus();
    res.json({ success: true, data: status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/wechat-clawbot/sync-now
 * 手动触发一次消息同步
 */
router.post('/sync-now', async (_req: Request, res: Response) => {
  try {
    await wechatMessageBridge.syncOnce();
    res.json({ success: true, message: '同步完成' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/wechat-clawbot/conversations
 * 获取微信会话列表
 */
router.get('/conversations', (_req: Request, res: Response) => {
  try {
    const db = require('../db/client').getDb();
    const { execToRows } = require('../db/client');
    const rows = execToRows(db,
      `SELECT c.id, c.title, c.oc_session_key, c.created_at, c.last_message_at, c.status,
              u.username, u.nickname
       FROM conversations c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.conversation_type = 'wechat_assistant' OR c.scope_type = 'wechat'
       ORDER BY c.last_message_at DESC`);
    const conversations = rows.map((row: any) => ({
      id: row.id, title: row.title, oc_session_key: row.oc_session_key,
      created_at: row.created_at, last_message_at: row.last_message_at, status: row.status,
      username: row.nickname || row.username || '',
    }));
    res.json({ success: true, data: { conversations } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/wechat-clawbot/conversations/:id/messages
 * 获取指定微信会话的消息列表
 */
router.get('/conversations/:id/messages', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const db = require('../db/client').getDb();
    const result = db.exec(
      `SELECT id, role, content, token_count, created_at
       FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [id, limit]
    );
    const messages = result.length > 0
      ? result[0].values.map(row => ({
          id: row[0], role: row[1], content: row[2],
          token_count: row[3], created_at: row[4],
        })).reverse()
      : [];
    res.json({ success: true, data: { messages } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
