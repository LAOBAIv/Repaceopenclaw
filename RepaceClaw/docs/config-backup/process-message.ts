/**
 * process-message.ts — 微信消息处理（RC 代理模式）
 *
 * 🔧 2026-05-14 重构：
 *   改造前：插件收到消息 → Gateway 内部 dispatchReplyFromConfig → 自动生成 session key
 *   改造后：插件收到消息 → POST 给 RC 后端 → RC 用统一 session key 调 Gateway → 返回回复
 *
 * 链路：
 *   微信用户 → iLink → 插件收消息 → POST /api/wechat/incoming → RC 后端处理
 *   → RC 调 Gateway（统一 session key）→ 回复 → 插件发回微信
 *
 * 优势：
 *   - session key 统一为 agent:rc-wechat-agent:rc:{conversationId}
 *   - 消息自动进 RC DB
 *   - RC 前端实时可见
 *   - 和其他八大智能体完全一致的链路
 */

import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

import type { WeixinMessage } from "../api/types.js";
import { MessageItemType } from "../api/types.js";
import { logger } from "../util/logger.js";

import { sendMessageWeixin } from "./send.js";
import { setContextToken, getContextTokenFromMsgContext, weixinMessageToMsgContext } from "./inbound.js";

// ─── RC 后端配置 ─────────────────────────────────────────────────────────────

const RC_BACKEND_URL = process.env.RC_BACKEND_URL || 'http://127.0.0.1:3001';
const RC_INBOUND_API_KEY = process.env.RC_INBOUND_API_KEY || 'repaceclaw-wechat-inbound-2026';

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

/** Dependencies for processOneMessage, injected by the monitor loop. */
export type ProcessMessageDeps = {
  accountId: string;
  config: import("openclaw/plugin-sdk/core").OpenClawConfig;
  channelRuntime: any;
  baseUrl: string;
  cdnBaseUrl: string;
  token?: string;
  typingTicket?: string;
  log: (msg: string) => void;
  errLog: (m: string) => void;
};

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/** 从 item_list 提取文本内容 */
function extractTextBody(itemList?: import("../api/types.js").MessageItem[]): string {
  if (!itemList?.length) return "";
  for (const item of itemList) {
    if (item.type === MessageItemType.TEXT && item.text_item?.text != null) {
      return String(item.text_item.text);
    }
  }
  return "";
}

/** 判断消息是否包含图片 */
function hasImage(itemList?: import("../api/types.js").MessageItem[]): boolean {
  if (!itemList?.length) return false;
  return itemList.some(i => i.type === MessageItemType.IMAGE);
}

/**
 * 调用 RC 后端 /api/wechat/incoming
 * 同步调用，等待回复
 */
function callRcIncoming(payload: {
  ilinkUserId: string;
  text: string;
  messageType: number;
  hasImage: boolean;
  timestamp: number;
  contextToken?: string;
}): Promise<{ ok: boolean; reply?: string; error?: string }> {
  return new Promise((resolve) => {
    try {
      const url = new URL(`${RC_BACKEND_URL}/api/wechat/incoming`);
      const body = JSON.stringify({
        ...payload,
        authHeader: RC_INBOUND_API_KEY,
      });

      const lib = url.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: url.hostname,
        port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 120000, // 2 分钟超时（等待 agent 回复）
      }, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch {
            resolve({ ok: false, error: `Invalid JSON response: ${data.substring(0, 100)}` });
          }
        });
      });

      req.on('error', (err: Error) => {
        resolve({ ok: false, error: `Request error: ${err.message}` });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, error: 'Request timeout (120s)' });
      });

      req.write(body);
      req.end();
    } catch (err: any) {
      resolve({ ok: false, error: `Setup error: ${err.message}` });
    }
  });
}

// ─── 主处理函数 ───────────────────────────────────────────────────────────────

/**
 * 处理单条微信消息
 *
 * 🔧 2026-05-14 重构：不再走 Gateway 内部 dispatchReplyFromConfig
 * 改为 POST 给 RC 后端，由 RC 统一管理 session key 和消息存储
 */
export async function processOneMessage(
  full: WeixinMessage,
  deps: ProcessMessageDeps,
): Promise<void> {
  const fromUserId = full.from_user_id ?? "";
  const textBody = extractTextBody(full.item_list);
  const messageHasImage = hasImage(full.item_list);
  const contextToken = full.context_token;

  // 保存 context_token（用于后续发送回复）
  if (contextToken && fromUserId) {
    setContextToken(deps.accountId, fromUserId, contextToken);
  }

  // 消息内容（文本 or 媒体标记）
  const messageText = textBody || (messageHasImage ? '[图片]' : '[媒体消息]');

  logger.info(
    `[RC-proxy] Received message from=${fromUserId} text="${messageText.substring(0, 50)}" hasImage=${messageHasImage}`,
  );

  // ─── 转发给 RC 后端处理 ─────────────────────────────────────────────────
  const result = await callRcIncoming({
    ilinkUserId: fromUserId,
    text: messageText,
    messageType: full.item_list?.[0]?.type ?? 1,
    hasImage: messageHasImage,
    timestamp: full.create_time_ms ?? Date.now(),
    contextToken,
  });

  if (!result.ok || !result.reply) {
    logger.error(`[RC-proxy] RC backend error: ${result.error || 'no reply'}`);
    // 降级：发送错误提示
    try {
      await sendMessageWeixin({
        to: fromUserId,
        text: '⚠️ 消息处理中，请稍后再试。',
        opts: { baseUrl: deps.baseUrl, token: deps.token, contextToken },
      });
    } catch (sendErr) {
      logger.error(`[RC-proxy] Failed to send error notice: ${String(sendErr)}`);
    }
    return;
  }

  // ─── 发送回复到微信 ─────────────────────────────────────────────────────
  logger.info(`[RC-proxy] Sending reply to=${fromUserId} text="${result.reply.substring(0, 50)}..."`);

  try {
    await sendMessageWeixin({
      to: fromUserId,
      text: result.reply,
      opts: { baseUrl: deps.baseUrl, token: deps.token, contextToken },
    });
    logger.info(`[RC-proxy] Reply sent OK to=${fromUserId}`);
  } catch (err) {
    logger.error(`[RC-proxy] Failed to send reply: ${String(err)}`);
  }
}
