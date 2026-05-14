/**
 * wechatIncoming.ts — 微信消息入站处理（RC 代理模式）
 *
 * 🔧 2026-05-14 新增
 * 链路：openclaw-weixin 插件 → POST /api/wechat/incoming → 本模块处理
 *
 * 职责：
 *   1. 接收插件转发的微信消息
 *   2. 查找/创建 RC conversation（统一 session key）
 *   3. 写入用户消息到 RC DB
 *   4. 调用 Gateway /v1/chat/completions（统一 session key）
 *   5. 写入助手回复到 RC DB
 *   6. WS push 到 RC 前端
 *   7. 返回回复文本给插件（插件负责发回微信）
 *
 * Session key 格式：agent:rc-wechat-agent:rc:{conversationId}
 * 与其他八大智能体完全一致
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import https from 'https';
import http from 'http';
import { logger } from '../utils/logger';
import { getDb, saveDb } from '../db/client';
import { pushToConversation } from '../ws/wsHandler';
import { resolveOpenClawGateway } from '../utils/openclawGateway';

const router = Router();

// 🔧 鉴权密钥（插件和 RC 后端共享）
const INBOUND_API_KEY = process.env.WECHAT_INBOUND_API_KEY || 'repaceclaw-wechat-inbound-2026';

// 🔧 OC Agent ID
const OC_AGENT_ID = 'rc-wechat-agent';

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/**
 * 构建统一的 session key（与其他八大智能体一致）
 */
function buildSessionKey(conversationId: string): string {
  return `agent:${OC_AGENT_ID}:rc:${conversationId}`;
}

/**
 * 查找或创建微信用户的 RC conversation
 * 每个 ilink_user_id 对应一个独立的 conversation
 * 🔧 2026-05-14: session key 统一为 agent:rc-wechat-agent:rc:{convId}
 */
function getOrCreateConversation(ilinkUserId: string): { conversationId: string; sessionKey: string } {
  const db = getDb();

  // 查找已有的微信用户会话（scope_type='wechat', scope_id=ilinkUserId）
  const existing = db.exec(
    `SELECT id, oc_session_key FROM conversations 
     WHERE current_agent_code = 'rc-wechat-agent' 
     AND scope_type = 'wechat' 
     AND scope_id = ?
     ORDER BY last_message_at DESC LIMIT 1`,
    [ilinkUserId]
  );

  if (existing.length > 0 && existing[0].values.length > 0) {
    const convId = existing[0].values[0][0] as string;
    let sessionKey = existing[0].values[0][1] as string;

    // 🔧 确保 session key 是统一格式
    const expectedKey = buildSessionKey(convId);
    if (sessionKey !== expectedKey) {
      db.run('UPDATE conversations SET oc_session_key = ? WHERE id = ?', [expectedKey, convId]);
      saveDb();
      sessionKey = expectedKey;
      logger.info(`[WechatIncoming] Fixed session key for conv=${convId}`);
    }

    return { conversationId: convId, sessionKey };
  }

  // 创建新会话
  const conversationId = uuidv4();
  const sessionKey = buildSessionKey(conversationId);
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO conversations (
      id, user_id, title, oc_session_key, agent_id, agent_ids, current_agent_id,
      created_at, last_message_at, status, scope_type, scope_id, memory_policy,
      session_code, current_agent_code
    ) VALUES (?, 'admin', '微信助手', ?, 'rc-wechat-agent', '["rc-wechat-agent"]', 'rc-wechat-agent',
      ?, ?, 'in_progress', 'wechat', ?, 'private', ?, 'rc-wechat-agent')`,
    [conversationId, sessionKey, now, now, ilinkUserId, `wx-${conversationId.slice(0, 8)}`]
  );
  saveDb();

  logger.info(`[WechatIncoming] Created conversation ${conversationId} for ${ilinkUserId}`);
  return { conversationId, sessionKey };
}

/**
 * 保存消息到 RC DB + WS push 到前端
 */
function saveMessage(conversationId: string, role: string, content: string, agentId?: string): string {
  const db = getDb();
  const messageId = uuidv4();
  const messageCode = `wx-${role}-${messageId.slice(0, 8)}`;
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO messages (id, user_id, conversation_id, role, content, agent_id, token_count, created_at, message_code)
     VALUES (?, 'admin', ?, ?, ?, ?, 0, ?, ?)`,
    [messageId, conversationId, role, content, agentId || null, now, messageCode]
  );
  db.run(`UPDATE conversations SET last_message_at = ? WHERE id = ?`, [now, conversationId]);
  saveDb();

  // WS push 到 RC 前端
  pushToConversation(conversationId, {
    type: role === 'user' ? 'wechat_user_message' : 'wechat_agent_message',
    conversationId,
    message: {
      id: messageId,
      role,
      content,
      agentId: agentId || null,
      createdAt: now,
    },
  });

  return messageId;
}

/**
 * 调用 Gateway /v1/chat/completions（SSE 流式）
 * 使用统一的 session key
 */
async function callGateway(sessionKey: string, userMessage: string): Promise<string> {
  const { url: gatewayUrl, token: gatewayToken } = resolveOpenClawGateway();

  if (!gatewayUrl) {
    throw new Error('Gateway URL not configured');
  }

  const url = new URL(gatewayUrl + '/v1/chat/completions');
  const body = JSON.stringify({
    model: `openclaw/${OC_AGENT_ID}`,
    messages: [{ role: 'user', content: userMessage }],
    stream: true,
  });

  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;

    const req = lib.request({
      hostname: url.hostname,
      port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
        'X-OpenClaw-Session-Key': sessionKey,
        'X-OpenClaw-Message-Channel': 'repaceclaw',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 120000,
    }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        let errBody = '';
        res.on('data', (d: Buffer) => { errBody += d.toString(); });
        res.on('end', () => {
          reject(new Error(`Gateway HTTP ${res.statusCode}: ${errBody.substring(0, 200)}`));
        });
        return;
      }

      let fullText = '';
      res.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(l => l.trim().startsWith('data: '));
        for (const line of lines) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) fullText += delta;
          } catch { /* skip */ }
        }
      });

      res.on('end', () => {
        if (fullText) resolve(fullText);
        else reject(new Error('Gateway returned empty response'));
      });
    });

    req.on('error', (err: Error) => reject(new Error(`Gateway error: ${err.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Gateway timeout (120s)')); });

    req.write(body);
    req.end();
  });
}

// ─── 路由 ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/wechat/incoming
 *
 * 接收 openclaw-weixin 插件转发的微信消息
 * 处理流程：查找/创建会话 → 存消息 → 调 Gateway → 存回复 → 返回回复文本
 */
router.post('/incoming', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { ilinkUserId, text, messageType, hasImage, timestamp, contextToken, authHeader } = req.body;

    // 鉴权
    if (authHeader !== INBOUND_API_KEY) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    if (!ilinkUserId || !text) {
      return res.status(400).json({ ok: false, error: 'Missing ilinkUserId or text' });
    }

    logger.info(`[WechatIncoming] Received: from=${ilinkUserId} text="${text.substring(0, 50)}"`);

    // 1. 查找/创建 conversation（统一 session key）
    const { conversationId, sessionKey } = getOrCreateConversation(ilinkUserId);
    logger.info(`[WechatIncoming] Conv=${conversationId.substring(0, 8)} sessionKey=${sessionKey}`);

    // 2. 保存用户消息到 RC DB + push 前端
    saveMessage(conversationId, 'user', text);

    // 3. 调用 Gateway 获取 agent 回复
    let reply: string;
    try {
      reply = await callGateway(sessionKey, text);
      logger.info(`[WechatIncoming] Gateway reply: "${reply.substring(0, 50)}..." (${Date.now() - startTime}ms)`);
    } catch (err: any) {
      logger.error(`[WechatIncoming] Gateway error: ${err.message}`);
      reply = '⚠️ 处理消息时出错，请稍后再试。';
    }

    // 4. 保存助手回复到 RC DB + push 前端
    saveMessage(conversationId, 'assistant', reply, 'rc-wechat-agent');

    // 5. 返回回复给插件（插件负责发回微信）
    const elapsed = Date.now() - startTime;
    logger.info(`[WechatIncoming] Done: conv=${conversationId.substring(0, 8)} elapsed=${elapsed}ms`);

    res.json({
      ok: true,
      reply,
      conversationId,
      sessionKey,
      elapsed,
    });
  } catch (err: any) {
    logger.error(`[WechatIncoming] Error: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
