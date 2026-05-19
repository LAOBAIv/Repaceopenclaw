/**
 * POST /api/wechat-incoming
 *
 * [2026-05-16] 新增：OC 微信插件 RC-proxy 入口
 *
 * 链路说明：
 *   微信用户 → iLink → OC Gateway（openclaw-weixin 插件）
 *   → OC 插件 POST /api/wechat-incoming（本端点）
 *   → RC 后端调 OC Gateway /v1/chat/completions 获取 AI 回复
 *   → 存 messages 表 + 记录用量
 *   → 返回 { ok: true, reply: "..." } 给 OC 插件
 *   → OC 插件调 iLink 回复微信用户
 *
 * 认证方式：body.authHeader = RC_INBOUND_API_KEY（内部 API Key，非用户 JWT）
 * 不挂 authenticate 中间件
 */
import { Router, Request, Response } from "express";
import { getDb, saveDb } from "../db/client";
import { logger } from "../utils/logger";
import { resolveOpenClawGateway } from "../utils/openclawGateway";
import { getBindingCodes } from "./wechat"; // [2026-05-16] 绑定验证码缓存
import { broadcastToConversation } from "../ws/wsHandler"; // [2026-05-16] 推送消息到前端
import http from "http";
import https from "https";
import crypto from "crypto";

const router = Router();

// [2026-05-16] 内部 API Key，与 OC 插件 process-message.ts 中的 RC_INBOUND_API_KEY 一致
const INBOUND_API_KEY = process.env.RC_INBOUND_API_KEY || "repaceclaw-wechat-inbound-2026";

// [2026-05-16] Session key 前缀，遵循标准格式 agent:{ocAgentId}:rc:{conversationId}
const SESSION_PREFIX = "agent:rc-wechat-agent:rc";

/**
 * POST /api/wechat-incoming
 * 接收 OC 微信插件转发的用户消息，调 Gateway 获取回复
 */
router.post("/", async (req: Request, res: Response) => {
  const { ilinkUserId, text, messageType, hasImage, imageBase64, timestamp, contextToken, authHeader } = req.body;

  // [2026-05-16] API Key 验证
  if (!authHeader || authHeader !== INBOUND_API_KEY) {
    logger.warn(`[WechatIncoming] Invalid API key from ${req.ip}`);
    return res.status(401).json({ ok: false, error: "未授权" });
  }

  if (!ilinkUserId || !text) {
    return res.status(400).json({ ok: false, error: "缺少 ilinkUserId 或 text" });
  }

  logger.info(`[WechatIncoming] Processing message from=${ilinkUserId} text="${text.substring(0, 50)}"`);

  try {
    // [2026-05-16] 检测是否为绑定验证码（6位数字）
    const trimmedText = text.trim();
    if (/^\d{6}$/.test(trimmedText)) {
      const bindingCodes = getBindingCodes();
      const bindData = bindingCodes.get(trimmedText);
      if (bindData && Date.now() - bindData.createdAt < 5 * 60 * 1000) {
        // 验证码匹配，执行绑定
        const db = getDb();
        const now = new Date().toISOString();
        // 检查是否已绑定到其他用户
        const existing = db.exec(
          `SELECT user_id FROM user_wechat_bindings WHERE wechat_openid = ?`,
          [ilinkUserId]
        );
        if (existing.length > 0 && existing[0].values.length > 0) {
          const existingUser = existing[0].values[0][0] as string;
          if (existingUser !== bindData.userId) {
            // 已绑定到其他用户，更新绑定
            db.run(`UPDATE user_wechat_bindings SET user_id = ?, bound_at = ? WHERE wechat_openid = ?`,
              [bindData.userId, now, ilinkUserId]);
          }
          // 已是同一用户，无需操作
        } else {
          // 新绑定
          const id = crypto.randomUUID();
          db.run(
            `INSERT INTO user_wechat_bindings (id, user_id, bot_id, wechat_openid, bound_at) VALUES (?, ?, '', ?, ?)`,
            [id, bindData.userId, ilinkUserId, now]
          );
        }
        saveDb();
        bindingCodes.delete(trimmedText);
        logger.info(`[WechatIncoming] Binding success: wechat ${ilinkUserId} → user ${bindData.userId}`);
        return res.json({ ok: true, reply: "\u2705 绑定成功！您的微信已与 RC 账户关联。" });
      }
    }

    // [2026-05-16] 获取或创建会话（通过绑定关系确定归属用户）
    const { conversationId, userId: boundUserId } = getOrCreateConversation(ilinkUserId);
    const sessionKey = `${SESSION_PREFIX}:${conversationId}`;
    const createdAt = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

    // [2026-05-16] 存用户消息
    saveMessage(conversationId, boundUserId, "user", text, createdAt);

    // [2026-05-16] 推送用户消息到前端
    broadcastToConversation(conversationId, {
      type: "new_message",
      message: {
        id: `wechat-user-${crypto.randomUUID()}`,
        conversationId,
        role: "user",
        content: text,
        createdAt,
      },
    });

    // [2026-05-16] 调 OC Gateway 获取 AI 回复
    const reply = await callGateway(
      [{ role: "user", content: text }],
      sessionKey
    );

    // [2026-05-16] 添加 RC 链路标识前缀，确认消息走了完整 RC 通道
    const formattedReply = `R.P.C.I.S\n${reply}`;

    // [2026-05-16] 存助手回复（带 R.P.C.I.S 标识）
    const replyTime = new Date().toISOString();
    saveMessage(conversationId, boundUserId, "agent", formattedReply, replyTime);

    // [2026-05-16] 通过 WebSocket 推送给前端，让微信助手面板实时显示新消息
    const agentMsgId = `wechat-reply-${crypto.randomUUID()}`;
    broadcastToConversation(conversationId, {
      type: "new_message",
      message: {
        id: agentMsgId,
        conversationId,
        role: "agent",
        content: formattedReply,
        agentId: "rc-wechat-agent",
        createdAt: replyTime,
      },
    });

    logger.info(`[WechatIncoming] Reply ready for=${ilinkUserId} text="${formattedReply.substring(0, 50)}..."`);
    res.json({ ok: true, reply: formattedReply });
  } catch (err: any) {
    logger.error(`[WechatIncoming] Error processing message: ${err.message}`);
    res.json({ ok: false, error: err.message || "处理失败" });
  }
});

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/**
 * [2026-05-16] 获取或创建微信会话
 * 逻辑与 WechatMessageBridge.getOrCreateConversation 一致
 */
function getOrCreateConversation(ilinkUserId: string): { conversationId: string; userId: string } {
  const db = getDb();
  const now = new Date().toISOString();

  // [2026-05-16] 查找绑定的 RC 用户
  let boundUserId = 'admin';
  try {
    const binding = db.exec(
      `SELECT user_id FROM user_wechat_bindings WHERE wechat_openid = ? LIMIT 1`,
      [ilinkUserId]
    );
    if (binding.length > 0 && binding[0].values.length > 0) {
      boundUserId = binding[0].values[0][0] as string;
      logger.info(`[WechatIncoming] Found binding: ${ilinkUserId} → user ${boundUserId}`);
    } else {
      logger.warn(`[WechatIncoming] No binding for ${ilinkUserId}, using admin`);
    }
  } catch (err) {
    logger.warn("[WechatIncoming] Query binding failed", err);
  }

  // [2026-05-16] 统一查找逻辑：优先 scope_type=wechat，兼容 conversation_type=wechat_assistant
  try {
    const existing = db.exec(
      `SELECT id FROM conversations WHERE user_id = ? AND (scope_type = 'wechat' OR conversation_type = 'wechat_assistant') ORDER BY created_at DESC LIMIT 1`,
      [boundUserId]
    );
    if (existing.length > 0 && existing[0].values.length > 0) {
      return { conversationId: existing[0].values[0][0] as string, userId: boundUserId };
    }
  } catch (err) {
    logger.warn("[WechatIncoming] Query conversation failed", err);
  }

  // [2026-05-16] 创建新会话
  const conversationId = crypto.randomUUID();
  const ocSessionKey = `${SESSION_PREFIX}:${conversationId}`;

  try {
    db.run(
      `INSERT INTO conversations (id, user_id, title, oc_session_key, agent_id, created_at, last_message_at, status, scope_type, scope_id)
       VALUES (?, ?, '微信助手', ?, 'rc-wechat-agent', ?, ?, 'in_progress', 'wechat', ?)`,
      [conversationId, boundUserId, ocSessionKey, now, now, ilinkUserId]
    );
    saveDb();
    logger.info(`[WechatIncoming] Created conversation ${conversationId} for user ${boundUserId} wechat ${ilinkUserId}`);
  } catch (err: any) {
    if (!err.message?.includes("UNIQUE") && !err.message?.includes("PRIMARY KEY")) {
      logger.warn("[WechatIncoming] Insert conversation failed", err);
    }
  }

  return { conversationId, userId: boundUserId };
}

/**
 * [2026-05-16] 存消息到 messages 表
 */
function saveMessage(conversationId: string, userId: string, role: string, content: string, createdAt: string): void {
  const db = getDb();
  const messageId = `wechat-msg-${crypto.randomUUID()}`;
  try {
    db.run(
      `INSERT OR IGNORE INTO messages (id, user_id, conversation_id, role, content, agent_id, token_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [messageId, userId, conversationId, role, content, (role === "assistant" || role === "agent") ? "rc-wechat-agent" : null, createdAt]
    );
    db.run(`UPDATE conversations SET last_message_at = ? WHERE id = ?`, [createdAt, conversationId]);
    saveDb();
    logger.info(`[WechatIncoming] saveMessage OK: id=${messageId.slice(0,12)} conv=${conversationId.slice(0,8)} role=${role}`);
  } catch (err: any) {
    logger.error(`[WechatIncoming] saveMessage FAILED: ${err.message}`);
  }
}

/**
 * [2026-05-16] 调 OC Gateway /v1/chat/completions 获取 AI 回复
 * SSE 流式接收，拼接完整回复后返回
 */
function callGateway(
  messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image?: { url: string } }> }>,
  sessionKey: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const { url: gatewayUrl, token: gatewayToken } = resolveOpenClawGateway();
    const url = new URL(gatewayUrl + "/v1/chat/completions");
    const body = JSON.stringify({
      model: "openclaw/rc-wechat-agent",
      messages,
      stream: true,
    });

    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gatewayToken}`,
          "X-OpenClaw-Session-Key": sessionKey,
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 120000,
      },
      (res) => {
        let fullText = "";
        res.on("data", (chunk: Buffer) => {
          const lines = chunk.toString().split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) fullText += delta;
            } catch {
              // 忽略解析错误
            }
          }
        });
        res.on("end", () => {
          if (fullText) {
            resolve(fullText);
          } else {
            reject(new Error("Gateway 返回空回复"));
          }
        });
        res.on("error", (err: Error) => reject(err));
      }
    );

    req.on("error", (err: Error) => reject(new Error(`Gateway 连接失败: ${err.message}`)));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Gateway 请求超时 (120s)"));
    });

    req.write(body);
    req.end();
  });
}

export default router;

// [2026-05-18] 供 ILinkMonitor 调用的消息处理函数（复用路由中的核心逻辑）
// [2026-05-19] 新增 imageUrls 参数，支持图片消息
export async function handleILinkMessage(
  ilinkUserId: string,
  text: string,
  timestamp?: number,
  imageUrls?: string[]
): Promise<string | null> {
  try {
    const { conversationId, userId: boundUserId } = getOrCreateConversation(ilinkUserId);
    const sessionKey = `${SESSION_PREFIX}:${conversationId}`;
    const createdAt = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

    // 存用户消息（图片用标记表示）
    const displayText = imageUrls?.length
      ? `${text}\n[图片 x${imageUrls.length}]`
      : text;
    saveMessage(conversationId, boundUserId, "user", displayText, createdAt);

    // [2026-05-19] 构建消息内容：有图片时用 vision 格式，无图片时用纯文本
    let messageContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;

    if (imageUrls && imageUrls.length > 0) {
      // Vision 格式：文本 + 图片
      const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
      parts.push({ type: 'text', text });
      for (const url of imageUrls) {
        parts.push({ type: 'image_url', image_url: { url } });
      }
      messageContent = parts;
    } else {
      messageContent = text;
    }

    // 调 OC Gateway 获取 AI 回复
    const reply = await callGateway(
      [{ role: "user", content: messageContent }],
      sessionKey
    );

    const formattedReply = `R.P.C.I.S\n${reply}`;

    // 存助手回复
    const replyTime = new Date().toISOString();
    saveMessage(conversationId, boundUserId, "agent", formattedReply, replyTime);

    return formattedReply;
  } catch (e: any) {
    logger.error(`[handleILinkMessage] Error: ${e.message}`);
    return null;
  }
}
