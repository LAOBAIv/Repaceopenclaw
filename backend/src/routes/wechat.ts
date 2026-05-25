import { Router, Request, Response } from "express";
import { getDb, saveDb } from "../db/client";
import { authenticate } from "../middleware/auth";
import { logger } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";
import { getErrorMessage } from "../types/ilink";

const router = Router();

// 所有接口需要登录
router.use(authenticate);

/**
 * GET /api/wechat/binding
 * 查询当前用户的微信 bot 绑定状态
 */
router.get("/binding", (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "未认证" });

  const row = getDb().queryOne<Record<string, unknown>>( // [2026-05-24] 类型安全
    `SELECT id, user_id, conversation_id, bot_id, bot_name, status, bound_at, created_at
     FROM wechat_bindings WHERE user_id = ?`,
    [userId]
  );

  if (!row) {
    return res.json({ data: { status: "unbound", botId: null, botName: null, boundAt: null } });
  }

  res.json({
    data: {
      id: row.id,
      status: row.status,
      botId: row.bot_id || null,
      botName: row.bot_name || null,
      conversationId: row.conversation_id,
      boundAt: row.bound_at || null,
      createdAt: row.created_at,
    },
  });
});

/**
 * POST /api/wechat/binding
 * 绑定微信 bot（每用户唯一，重复调用为更新）
 * Body: { botId: string, botName?: string }
 */
router.post("/binding", (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "未认证" });

  const { botId, botName } = req.body;
  if (!botId) return res.status(400).json({ error: "botId 不能为空" });

  const now = new Date().toISOString();

  // 查是否已有绑定记录
  const existing = getDb().queryOne(
    `SELECT id FROM wechat_bindings WHERE user_id = ?`,
    [userId]
  );

  if (existing) {
    // 更新绑定
    getDb().run(
      `UPDATE wechat_bindings SET bot_id=?, bot_name=?, status='bound', bound_at=? WHERE user_id=?`,
      [botId, botName || "", now, userId]
    );
    logger.info(`[WechatBinding] User ${userId} updated binding to bot ${botId}`);
  } else {
    // 新建绑定记录（conversation_id 从微信助手会话获取）
    const { ConversationService } = require("../services/ConversationService");
    const wechatConv = ConversationService.list(userId).find(
      (c: Record<string, unknown>) => c.conversationType === "wechat_assistant" // [2026-05-24] 类型安全
    );
    getDb().run(
      `INSERT INTO wechat_bindings (id, user_id, conversation_id, bot_id, bot_name, status, bound_at, created_at)
       VALUES (?,?,?,?,?,'bound',?,?)`,
      [uuidv4(), userId, wechatConv?.id || "", botId, botName || "", now, now]
    );
    logger.info(`[WechatBinding] User ${userId} created binding to bot ${botId}`);
  }

  saveDb();
  res.json({ data: { status: "bound", botId, botName: botName || "", boundAt: now } });
});

/**
 * DELETE /api/wechat/binding
 * 解绑微信 bot
 */
router.delete("/binding", (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "未认证" });

  getDb().run(
    `UPDATE wechat_bindings SET bot_id='', bot_name='', status='unbound', bound_at=NULL WHERE user_id=?`,
    [userId]
  );
  saveDb();
  logger.info(`[WechatBinding] User ${userId} unbound wechat bot`);
  res.json({ data: { status: "unbound" } });
});

// ─── [2026-05-16] 用户微信绑定管理（user_wechat_bindings 表） ─────────────────────

// [2026-05-16] 绑定验证码缓存：{ code → { userId, createdAt } }
const bindingCodes = new Map<string, { userId: string; createdAt: number }>();

// [2026-05-16] 清理过期验证码（5分钟过期）
function cleanupBindingCodes() {
  const now = Date.now();
  for (const [code, data] of bindingCodes.entries()) {
    if (now - data.createdAt > 5 * 60 * 1000) bindingCodes.delete(code);
  }
}

// [2026-05-16] 导出给 wechatIncoming.ts 使用
export function getBindingCodes() { return bindingCodes; }

/**
 * GET /api/wechat/user-bindingV
 * 获取当前用户的微信绑定状态
 */
router.get("/user-binding", (req: Request, res: Response) => {
  const userId = req.user?.id;
  try {
    const rows = getDb().exec(
      `SELECT id, bot_id, wechat_openid, bound_at FROM user_wechat_bindings WHERE user_id = ?`,
      [userId]
    );
    if (rows.length > 0 && rows[0].values.length > 0) {
      const [id, botId, wechatOpenid, boundAt] = rows[0].values[0];
      res.json({ data: { bound: true, id, botId, wechatOpenid, boundAt } });
    } else {
      res.json({ data: { bound: false } });
    }
  } catch (err: unknown) {
    // [2026-05-24] 类型安全：any → unknown
    logger.error(`[UserWechatBinding] Query failed: ${getErrorMessage(err)}`);
    res.status(500).json({ error: "查询失败" });
  }
});

/**
 * POST /api/wechat/user-binding
 * 创建/更新当前用户的微信绑定
 * body: { wechatOpenid, botId }
 */
router.post("/user-binding", (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { wechatOpenid, botId } = req.body;
  if (!wechatOpenid) {
    return res.status(400).json({ error: "缺少 wechatOpenid" });
  }
  const db = getDb();
  const now = new Date().toISOString();
  try {
    // [2026-05-16] 检查该微信是否已绑定到其他用户
    const existing = db.exec(
      `SELECT user_id FROM user_wechat_bindings WHERE wechat_openid = ?`,
      [wechatOpenid]
    );
    if (existing.length > 0 && existing[0].values.length > 0) {
      const existingUserId = existing[0].values[0][0] as string;
      if (existingUserId !== userId) {
        return res.status(409).json({ error: "该微信已绑定到其他用户" });
      }
      // 已是当前用户，更新
      db.run(
        `UPDATE user_wechat_bindings SET bot_id = ?, bound_at = ? WHERE wechat_openid = ? AND user_id = ?`,
        [botId || '', now, wechatOpenid, userId]
      );
    } else {
      // 新绑定
      const id = require('crypto').randomUUID();
      db.run(
        `INSERT INTO user_wechat_bindings (id, user_id, bot_id, wechat_openid, bound_at) VALUES (?, ?, ?, ?, ?)`,
        [id, userId, botId || '', wechatOpenid, now]
      );
    }
    saveDb();
    logger.info(`[UserWechatBinding] User ${userId} bound to wechat ${wechatOpenid}`);
    res.json({ data: { bound: true, wechatOpenid, boundAt: now } });
  } catch (err: unknown) {
    // [2026-05-24] 类型安全：any → unknown
    logger.error(`[UserWechatBinding] Bind failed: ${getErrorMessage(err)}`);
    res.status(500).json({ error: "绑定失败" });
  }
});

/**
 * DELETE /api/wechat/user-binding
 * 解绑当前用户的微信
 */
router.delete("/user-binding", (req: Request, res: Response) => {
  const userId = req.user?.id;
  try {
    getDb().run(
      `DELETE FROM user_wechat_bindings WHERE user_id = ?`,
      [userId]
    );
    saveDb();
    logger.info(`[UserWechatBinding] User ${userId} unbound wechat`);
    res.json({ data: { bound: false } });
  } catch (err: unknown) {
    // [2026-05-24] 类型安全：any → unknown
    logger.error(`[UserWechatBinding] Unbind failed: ${getErrorMessage(err)}`);
    res.status(500).json({ error: "解绑失败" });
  }
});

/**
 * POST /api/wechat/user-binding/code
 * [2026-05-16] 生成绑定验证码，用户在微信中发送此验证码完成绑定
 */
router.post("/user-binding/code", (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "未认证" });

  cleanupBindingCodes();

  // 检查是否已有未过期的验证码
  for (const [code, data] of bindingCodes.entries()) {
    if (data.userId === userId) {
      return res.json({ data: { code, expiresIn: Math.max(0, 300 - Math.floor((Date.now() - data.createdAt) / 1000)) } });
    }
  }

  // 生成 6 位数字验证码
  const code = String(Math.floor(100000 + Math.random() * 900000));
  bindingCodes.set(code, { userId, createdAt: Date.now() });
  logger.info(`[UserWechatBinding] Generated binding code ${code} for user ${userId}`);
  res.json({ data: { code, expiresIn: 300 } });
});

export default router;
