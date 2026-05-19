import { Router, Request, Response } from "express";
import { getDb, saveDb, execToRows } from "../db/client";
import { UserService } from "../services/UserService";
import { ConversationService } from "../services/ConversationService";
import { AgentService } from "../services/AgentService";
import { AuditService } from "../services/AuditService";
import { logger } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";
import { IdGenerator } from "../utils/IdGenerator";

const router = Router();

// 登录状态缓存：{ scene → { status, userId?, token?, createdAt } }
const loginStates = new Map<string, {
  status: 'pending' | 'scanned' | 'success' | 'expired';
  userId?: string;
  token?: string;
  createdAt: number;
}>();

// 清理过期登录状态（10分钟过期）
function cleanupLoginStates() {
  const now = Date.now();
  for (const [scene, data] of loginStates.entries()) {
    if (now - data.createdAt > 10 * 60 * 1000) {
      loginStates.delete(scene);
    }
  }
}

/**
 * POST /api/auth/wechat/qrcode
 * 生成微信扫码登录二维码
 * 返回：{ scene, qrcodeUrl, expiresIn }
 */
router.post("/qrcode", (req: Request, res: Response) => {
  cleanupLoginStates();

  const scene = uuidv4().replace(/-/g, '').substring(0, 16);
  loginStates.set(scene, {
    status: 'pending',
    createdAt: Date.now(),
  });

  // 构建微信授权 URL（需要配置微信公众号/开放平台）
  // 这里返回一个通用的扫码提示 URL，实际需要根据微信开放平台文档构建
  const redirectUri = encodeURIComponent(`${process.env.APP_URL || 'https://repaceclaw.com'}/api/auth/wechat/callback`);
  const appId = process.env.WECHAT_APP_ID || '';
  const qrcodeUrl = appId
    ? `https://open.weixin.qq.com/connect/qrconnect?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=${scene}#wechat_redirect`
    : '';

  logger.info(`[WechatLogin] Generated QR code scene: ${scene}`);

  res.json({
    data: {
      scene,
      qrcodeUrl,
      expiresIn: 600, // 10分钟
    },
  });
});

/**
 * GET /api/auth/wechat/status/:scene
 * 查询微信扫码登录状态
 */
router.get("/status/:scene", (req: Request, res: Response) => {
  const { scene } = req.params;
  const state = loginStates.get(scene);

  if (!state) {
    return res.json({ data: { status: 'expired' } });
  }

  // 检查是否过期
  if (Date.now() - state.createdAt > 10 * 60 * 1000) {
    loginStates.delete(scene);
    return res.json({ data: { status: 'expired' } });
  }

  if (state.status === 'success' && state.userId && state.token) {
    // 登录成功后清除缓存
    loginStates.delete(scene);
    return res.json({
      data: {
        status: 'success',
        user: UserService.getUserById(state.userId),
        token: state.token,
      },
    });
  }

  res.json({ data: { status: state.status } });
});

/**
 * POST /api/auth/wechat/callback
 * 微信扫码回调处理
 * 微信授权后携带 code 和 state(scene) 回调
 */
router.post("/callback", async (req: Request, res: Response) => {
  const { code, state: scene, openid, userInfo } = req.body;

  if (!scene || !loginStates.has(scene)) {
    return res.status(400).json({ error: "无效的登录请求" });
  }

  const loginState = loginStates.get(scene)!;

  try {
    // 如果有 openid，直接使用（微信网页授权会返回）
    // 否则需要通过 code 换取 openid（需要调用微信 API）
    let wechatOpenid = openid;

    if (!wechatOpenid && code) {
      // TODO: 调用微信 API 用 code 换取 openid 和 access_token
      // 这里需要配置微信开放平台/公众号的 appid 和 secret
      const appId = process.env.WECHAT_APP_ID || '';
      const appSecret = process.env.WECHAT_APP_SECRET || '';

      if (appId && appSecret) {
        try {
          const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;
          const response = await fetch(tokenUrl);
          const data: any = await response.json();

          if (data.errcode) {
            throw new Error(data.errmsg || '微信授权失败');
          }

          wechatOpenid = data.openid;
        } catch (err: any) {
          logger.error(`[WechatLogin] Failed to exchange code for openid: ${err.message}`);
          loginState.status = 'expired';
          return res.status(500).json({ error: "微信授权失败" });
        }
      } else {
        logger.warn('[WechatLogin] WECHAT_APP_ID or WECHAT_APP_SECRET not configured');
        loginState.status = 'expired';
        return res.status(500).json({ error: "微信配置不完整" });
      }
    }

    if (!wechatOpenid) {
      loginState.status = 'expired';
      return res.status(400).json({ error: "缺少微信标识" });
    }

    const db = getDb();
    const now = new Date().toISOString();

    // 检查该微信是否已绑定用户
    const existingBinding = execToRows(
      db,
      `SELECT user_id FROM user_wechat_bindings WHERE wechat_openid = ?`,
      [wechatOpenid]
    );

    let userId: string;
    let token: string;

    if (existingBinding.length > 0) {
      // 已有绑定，直接登录
      userId = existingBinding[0].user_id;
      const user = UserService.getUserById(userId);

      if (!user || user.status !== 'active') {
        loginState.status = 'expired';
        return res.status(403).json({ error: "账号已被禁用" });
      }

      // 更新最后登录时间
      db.run("UPDATE users SET last_login_at=?, updated_at=? WHERE id=?", [now, now, userId]);
      saveDb();

      token = UserService.generateToken(user);

      logger.info(`[WechatLogin] User ${userId} logged in via WeChat`);
    } else {
      // 未绑定，自动创建新用户
      const username = `wx_${wechatOpenid.substring(0, 8)}`;
      const email = `${wechatOpenid}@wechat.local`;

      // 生成随机密码（用户后续可修改）
      const randomPassword = require('crypto').randomBytes(16).toString('hex');

      const registerResult = await UserService.register({
        username,
        email,
        password: randomPassword,
        role: 'user',
      });

      userId = registerResult.user.id;
      token = registerResult.token;

      // 绑定微信
      const bindingId = uuidv4();
      db.run(
        `INSERT INTO user_wechat_bindings (id, user_id, bot_id, wechat_openid, bound_at) VALUES (?, ?, ?, ?, ?)`,
        [bindingId, userId, '', wechatOpenid, now]
      );
      saveDb();

      // 自动创建微信助手会话
      try {
        const waAgent = AgentService.getByIdOrCode('rc-wechat-agent', userId);
        if (waAgent) {
          const conv = ConversationService.create({
            agentIds: [waAgent.id],
            title: '微信助手',
            createdBy: userId,
            userId,
            currentAgentId: waAgent.id,
            scopeType: 'user',
            scopeId: userId,
            memoryPolicy: 'private',
            conversationType: 'wechat_assistant',
          });

          const ocSessionKey = `agent:rc-wechat-agent:rc:${conv.id}`;
          ConversationService.bindOpenClawSession(conv.id, ocSessionKey, waAgent.id, [waAgent.id]);
          logger.info(`[WechatLogin] Auto-created WeChat assistant conversation for user ${userId}`);
        }
      } catch (err: any) {
        logger.error(`[WechatLogin] Failed to create assistant conversation: ${err.message}`);
      }

      // 审计日志
      AuditService.log({
        userId,
        action: 'register',
        resource: 'user',
        resourceId: userId,
        detail: { username, email, method: 'wechat' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: (req as any).requestId,
      });

      logger.info(`[WechatLogin] New user ${userId} created and bound to WeChat ${wechatOpenid}`);
    }

    // 更新登录状态
    loginState.status = 'success';
    loginState.userId = userId;
    loginState.token = token;

    res.json({
      data: {
        status: 'success',
        user: UserService.getUserById(userId),
        token,
      },
    });
  } catch (err: any) {
    logger.error(`[WechatLogin] Callback error: ${err.message}`);
    loginState.status = 'expired';
    res.status(500).json({ error: "登录失败" });
  }
});

/**
 * POST /api/auth/wechat/bind
 * 已登录用户绑定微信（用于账号设置页面）
 */
router.post("/bind", async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "未认证" });

  const { openid, code } = req.body;
  let wechatOpenid = openid;

  if (!wechatOpenid && code) {
    // 通过 code 换取 openid
    const appId = process.env.WECHAT_APP_ID || '';
    const appSecret = process.env.WECHAT_APP_SECRET || '';

    if (!appId || !appSecret) {
      return res.status(500).json({ error: "微信配置不完整" });
    }

    try {
      const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;
      const response = await fetch(tokenUrl);
      const data: any = await response.json();

      if (data.errcode) {
        return res.status(400).json({ error: data.errmsg || '微信授权失败' });
      }

      wechatOpenid = data.openid;
    } catch (err: any) {
      return res.status(500).json({ error: "微信授权失败" });
    }
  }

  if (!wechatOpenid) {
    return res.status(400).json({ error: "缺少微信标识" });
  }

  const db = getDb();
  const now = new Date().toISOString();

  // 检查是否已绑定其他用户
  const existing = execToRows(
    db,
    `SELECT user_id FROM user_wechat_bindings WHERE wechat_openid = ?`,
    [wechatOpenid]
  );

  if (existing.length > 0 && existing[0].user_id !== userId) {
    return res.status(409).json({ error: "该微信已绑定到其他用户" });
  }

  // 创建或更新绑定
  const bindingId = uuidv4();
  db.run(
    `INSERT OR REPLACE INTO user_wechat_bindings (id, user_id, bot_id, wechat_openid, bound_at) VALUES (?, ?, ?, ?, ?)`,
    [bindingId, userId, '', wechatOpenid, now]
  );
  saveDb();

  logger.info(`[WechatLogin] User ${userId} bound to WeChat ${wechatOpenid}`);
  res.json({ data: { bound: true, wechatOpenid, boundAt: now } });
});

export default router;
