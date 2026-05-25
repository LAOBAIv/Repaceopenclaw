/**
 * wechatClawBot — 微信 ClawBot API 路由
 *
 * 直接调用 iLink API 获取微信机器人二维码：
 *   - POST /api/wechat-clawbot/qrcode        — 获取扫码登录二维码
 *   - POST /api/wechat-clawbot/qrcode/status — 轮询扫码状态
 *   - POST /api/wechat-clawbot/channel/reset — 重置 IM 通道
 *   - GET  /api/wechat-clawbot/status         — 获取微信连接状态
 *   - GET  /api/wechat-clawbot/ws-status      — 获取 Gateway WebSocket 状态
 *   - GET  /api/wechat-clawbot/models         — 获取可用模型列表
 *   - GET  /api/wechat-clawbot/events         — SSE 实时事件流
 *   - GET  /api/wechat-clawbot/accounts       — 已绑定账号列表
 *   - DELETE /api/wechat-clawbot/accounts/:id — 删除已绑定账号
 *   - GET  /api/wechat-clawbot/stats          — 消息统计
 *   - GET  /api/wechat-clawbot/sync-status    — 同步状态
 *   - POST /api/wechat-clawbot/sync-now       — 手动同步
 *   - GET  /api/wechat-clawbot/conversations  — 微信会话列表
 *   - GET  /api/wechat-clawbot/conversations/:id/messages — 会话消息
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { clawBotClient } from '../services/ClawBotGatewayClient';
import { wechatMessageBridge } from '../services/WechatMessageBridge';
import { getDb, execToRows } from '../db/client';
import { ILinkResponse, getErrorMessage } from '../types/ilink';
import fs from 'fs';
import path from 'path';
import {
  callILink,
  callILinkGet,
  getBoundAccounts,
} from '../services/ClawBotILink';
import {
  broadcastSse,
  addSseClient,
  removeSseClient,
} from '../services/ClawBotSse';
import {
  cleanupQrcodeCache,
  setQrcodeCache,
  getQrcodeFromCache,
  fetchImageAsBase64DataUri,
  escapeXmlAttr,
  proxyToGateway,
  getWeixinAccounts,
} from '../services/ClawBotHelpers';

const router = Router();

const ILINK_BOT_TYPE = 3;

// ─── 路由 ────────────────────────────────────────────────────────────────

/**
 * POST /api/wechat-clawbot/qrcode
 */
router.post('/qrcode', async (req: Request, res: Response) => {
  try {
    logger.info('[WechatClawBot] Fetching QR code from iLink...');
    const boundAccounts = getBoundAccounts();
    const localTokenList = boundAccounts.map(a => a.token);
    logger.info('[WechatClawBot] local_token_list:', localTokenList);

    const result = await callILink(
      'POST',
      `/ilink/bot/get_bot_qrcode?bot_type=${ILINK_BOT_TYPE}`,
      { local_token_list: localTokenList }
    );

    if (result.status >= 400 || (result.data && (result.data as { ret?: number }).ret !== 0)) {
      const d = result.data as Record<string, unknown>;
      const errMsg = (d.msg as string) || (d.message as string) || 'iLink error';
      logger.error('[WechatClawBot] iLink error: ' + result.status + ' ' + errMsg);
      return res.status(result.status >= 400 ? result.status : 500).json({
        success: false, error: errMsg, detail: result.data,
      });
    }

    cleanupQrcodeCache();
    const ilinkData = result.data as Record<string, unknown>;
    const qrToken = ilinkData.qrcode as string;
    const originalQrUrl = (ilinkData.qrcode_url as string) || (ilinkData.qrcode_img_content as string);
    const qrImageContent = (ilinkData.qrcode_img_content as string) || null;

    if (!originalQrUrl) {
      logger.error('[WechatClawBot] iLink returned no qrcode_url or qrcode_img_content');
      return res.status(500).json({ success: false, error: 'iLink returned no qrcode URL', detail: ilinkData });
    }

    let displayType: 'image_base64' | 'image_url' | 'web_link' = 'web_link';
    let displayUrl = originalQrUrl;

    if (originalQrUrl.startsWith('data:')) {
      displayType = 'image_base64';
    } else if (originalQrUrl.match(/^https?:\/\/.*\.(png|jpg|jpeg|gif|svg|webp)/i)) {
      displayType = 'image_url';
    }

    const qrDisplayUrl = displayType === 'web_link'
      ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(originalQrUrl)}`
      : displayUrl;

    res.json({
      success: true,
      data: {
        qrcode: qrToken,
        qrcode_url: qrDisplayUrl,
        original_qrcode_url: originalQrUrl,
        qrcode_type: displayType,
        qrcode_img_content: qrImageContent,
      },
    });
  } catch (err: unknown) {
    logger.error('[WechatClawBot] QR code fetch failed: ' + getErrorMessage(err));
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * GET /api/wechat-clawbot/qrcode/image?id=xxx
 */
router.get('/qrcode/image', async (req: Request, res: Response) => {
  cleanupQrcodeCache();
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  const cached = id ? getQrcodeFromCache(id) : null;
  if (!cached?.qrserverUrl) {
    return res.status(404).send('QR code image not found or expired');
  }
  const dataUri = await fetchImageAsBase64DataUri(cached.qrserverUrl);
  if (!dataUri) return res.status(502).send('Failed to fetch QR code image from qrserver');

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
 */
router.post('/qrcode/status', async (req: Request, res: Response) => {
  const { qrcode } = req.body || {};
  if (!qrcode || typeof qrcode !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing required field: qrcode' });
  }
  try {
    const result = await callILinkGet(
      `/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}&bot_type=${ILINK_BOT_TYPE}`
    );
    logger.info('[WechatClawBot] QR status response: ' + JSON.stringify(result.data).substring(0, 200));

    const statusData = result.data as Record<string, unknown>;
    if (result.data && statusData.status) {
      const status = statusData.status as string;
      const baseUrl = (statusData.baseurl as string) || 'https://ilinkai.weixin.qq.com';

      if (status === 'confirmed' && statusData.bot_token) {
        try {
          const botId = statusData.ilink_bot_id as string;
          const botToken = statusData.bot_token as string;
          const userId = statusData.ilink_user_id as string;

          if (botId && botToken && userId) {
            const accountsDir = path.resolve('/root/.openclaw/openclaw-weixin/accounts');
            if (!fs.existsSync(accountsDir)) fs.mkdirSync(accountsDir, { recursive: true });

            const accountFile = path.join(accountsDir, `${botId}.json`);
            fs.writeFileSync(accountFile, JSON.stringify({
              token: botToken, savedAt: new Date().toISOString(),
              baseUrl, userId,
            }, null, 2));
            logger.info('[WechatClawBot] Account saved: ' + botId);

            const accountsIndexFile = path.join(accountsDir, 'accounts.json');
            let accountsIndex: string[] = [];
            if (fs.existsSync(accountsIndexFile)) {
              try { accountsIndex = JSON.parse(fs.readFileSync(accountsIndexFile, 'utf-8')); }
              catch { accountsIndex = []; }
            }
            if (!accountsIndex.includes(botId)) {
              accountsIndex.push(botId);
              fs.writeFileSync(accountsIndexFile, JSON.stringify(accountsIndex, null, 2));
              logger.info('[WechatClawBot] Account registered in index: ' + botId);
            }

            const openclawConfigFile = '/root/.openclaw/openclaw.json';
            if (fs.existsSync(openclawConfigFile)) {
              const openclawConfig = JSON.parse(fs.readFileSync(openclawConfigFile, 'utf-8'));
              openclawConfig.channelConfigUpdatedAt = new Date().toISOString();
              fs.writeFileSync(openclawConfigFile, JSON.stringify(openclawConfig, null, 2));
              logger.info('[WechatClawBot] Gateway hot reload triggered');
            }
          }
        } catch (saveErr: unknown) {
          logger.error('[WechatClawBot] Failed to save account: ' + getErrorMessage(saveErr));
        }
      }

      res.json({
        success: true,
        data: {
          status,
          credentials: status === 'confirmed' ? {
            bot_token: statusData.bot_token,
            ilink_bot_id: statusData.ilink_bot_id,
            ilink_user_id: statusData.ilink_user_id,
          } : undefined,
          baseurl: baseUrl,
        },
      });
    } else {
      res.json({ success: true, data: { status: 'expired' } });
    }
  } catch (err: unknown) {
    logger.error('[WechatClawBot] QR status poll failed: ' + getErrorMessage(err));
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * POST /api/wechat-clawbot/channel/reset
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
    res.json({ success: (result.data as { ret?: number })?.ret === 0, data: result.data });
  } catch (err: unknown) {
    logger.error('[WechatClawBot] Channel reset failed: ' + getErrorMessage(err));
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

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
          plugin: 'openclaw-weixin', channel: 'openclaw-weixin',
          active: activeAccounts.length > 0,
          accountCount: activeAccounts.length,
          accounts: activeAccounts.map(a => ({ accountId: a.accountId, userId: a.userId })),
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * GET /api/wechat-clawbot/ws-status
 */
router.get('/ws-status', (_req: Request, res: Response) => {
  res.json({ success: true, data: { state: clawBotClient.getState(), timestamp: new Date().toISOString() } });
});

/**
 * GET /api/wechat-clawbot/models
 */
router.get('/models', async (_req: Request, res: Response) => {
  try {
    const result = await proxyToGateway('GET', '/v1/models', undefined, 10000);
    res.json(result.data);
  } catch (err: unknown) {
    logger.error('[WechatClawBot] Models fetch failed: ' + getErrorMessage(err));
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * GET /api/wechat-clawbot/events — SSE 实时事件流
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

  const client = (event: string, payload: string) => {
    res.write('event: ' + event + '\ndata: ' + payload + '\n\n');
  };

  addSseClient(client);
  const keepalive = setInterval(() => {
    try { res.write(': keepalive\n\n'); }
    catch { cleanup(); }
  }, 15000);

  function cleanup() { clearInterval(keepalive); removeSseClient(client); }
  req.on('close', cleanup);
  req.on('error', cleanup);
});

/**
 * GET /api/wechat-clawbot/accounts
 */
router.get('/accounts', (_req: Request, res: Response) => {
  try {
    const accounts = getWeixinAccounts();
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
      const rowObj = row as Record<string, unknown>;
      const key = (rowObj.bot_id || rowObj.wechat_openid) as string;
      const info = { username: (rowObj.username as string) || '', nickname: (rowObj.nickname as string) || '', department: (rowObj.department as string) || '' };
      bindingMap.set(key, info);
      if (rowObj.wechat_openid) bindingMap.set(rowObj.wechat_openid as string, info);
    }
    res.json({
      success: true,
      data: {
        accounts: accounts.map(a => {
          const binding = bindingMap.get(a.accountId) || bindingMap.get(a.userId);
          return {
            accountId: a.accountId, userId: a.userId, hasToken: a.hasToken, savedAt: a.savedAt,
            rcUsername: binding?.username || '', rcNickname: binding?.nickname || '',
            rcDepartment: binding?.department || '',
          };
        }),
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * DELETE /api/wechat-clawbot/accounts/:accountId
 */
router.delete('/accounts/:accountId', (req: Request, res: Response) => {
  const { accountId } = req.params;
  try {
    const accountsDir = path.resolve('/root/.openclaw/openclaw-weixin/accounts');
    const accountFiles = [`${accountId}.json`, `${accountId}.context-tokens.json`, `${accountId}.sync.json`];
    let deleted = false;
    for (const file of accountFiles) {
      const filePath = path.join(accountsDir, file);
      if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); deleted = true; logger.info('[WechatClawBot] Deleted: ' + file); }
    }

    const accountsIndexFile = path.join(accountsDir, 'accounts.json');
    if (fs.existsSync(accountsIndexFile)) {
      let accountsIndex: string[] = [];
      try { accountsIndex = JSON.parse(fs.readFileSync(accountsIndexFile, 'utf-8')); }
      catch { accountsIndex = []; }
      accountsIndex = accountsIndex.filter((id: string) => id !== accountId);
      fs.writeFileSync(accountsIndexFile, JSON.stringify(accountsIndex, null, 2));
    }

    const openclawConfigFile = '/root/.openclaw/openclaw.json';
    if (fs.existsSync(openclawConfigFile)) {
      const openclawConfig = JSON.parse(fs.readFileSync(openclawConfigFile, 'utf-8'));
      openclawConfig.channelConfigUpdatedAt = new Date().toISOString();
      fs.writeFileSync(openclawConfigFile, JSON.stringify(openclawConfig, null, 2));
    }

    if (deleted) res.json({ success: true, message: '账号已删除: ' + accountId });
    else res.status(404).json({ success: false, error: '账号不存在: ' + accountId });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * GET /api/wechat-clawbot/stats
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const botUser = execToRows(db, "SELECT COUNT(*) as cnt FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE conversation_type = 'wechat_assistant') AND id LIKE 'wechat-msg%' AND role = 'user'");
    const botAgent = execToRows(db, "SELECT COUNT(*) as cnt FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE conversation_type = 'wechat_assistant') AND id LIKE 'wechat-msg%' AND role = 'agent'");
    const rcUser = execToRows(db, "SELECT COUNT(*) as cnt FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE conversation_type = 'wechat_assistant') AND id NOT LIKE 'wechat-msg%' AND role = 'user'");
    const rcAgent = execToRows(db, "SELECT COUNT(*) as cnt FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE conversation_type = 'wechat_assistant') AND id NOT LIKE 'wechat-msg%' AND role = 'agent'");
    const total = execToRows(db, "SELECT COUNT(*) as cnt FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE conversation_type = 'wechat_assistant')");
    res.json({
      success: true, data: {
        total: total[0]?.cnt || 0,
        wechatBot: { received: botUser[0]?.cnt || 0, replied: botAgent[0]?.cnt || 0 },
        rcAssistant: { sent: rcUser[0]?.cnt || 0, replied: rcAgent[0]?.cnt || 0 },
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * GET /api/wechat-clawbot/sync-status
 */
router.get('/sync-status', (_req: Request, res: Response) => {
  try {
    const { ILinkMonitor } = require('../services/ILinkMonitor');
    res.json({ success: true, data: ILinkMonitor.getStatus() });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * POST /api/wechat-clawbot/sync-now
 */
router.post('/sync-now', async (_req: Request, res: Response) => {
  try {
    await wechatMessageBridge.syncOnce();
    res.json({ success: true, message: '同步完成' });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * GET /api/wechat-clawbot/conversations
 */
router.get('/conversations', (_req: Request, res: Response) => {
  try {
    const db = require('../db/client').getDb();
    const rows = execToRows(db,
      `SELECT c.id, c.title, c.oc_session_key, c.created_at, c.last_message_at, c.status,
              u.username, u.nickname
       FROM conversations c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.conversation_type = 'wechat_assistant' OR c.scope_type = 'wechat'
       ORDER BY c.last_message_at DESC`);
    res.json({ success: true, data: { conversations: rows.map((row: Record<string, unknown>) => ({
      id: row.id, title: row.title, oc_session_key: row.oc_session_key,
      created_at: row.created_at, last_message_at: row.last_message_at, status: row.status,
      username: row.nickname || row.username || '',
    }))}});
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * GET /api/wechat-clawbot/conversations/:id/messages
 */
router.get('/conversations/:id/messages', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const db = require('../db/client').getDb();
    const result = db.exec(
      `SELECT id, role, content, token_count, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?`,
      [id, limit]
    );
    const messages = result.length > 0
      ? result[0].values.map(row => ({ id: row[0], role: row[1], content: row[2], token_count: row[3], created_at: row[4] })).reverse()
      : [];
    res.json({ success: true, data: { messages } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

export default router;
