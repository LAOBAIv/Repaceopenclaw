import { Router, Request, Response } from "express";
import { UserService, User } from "../services/UserService";
import { authenticate, requireRole } from "../middleware/auth";
import { AuditService } from "../services/AuditService";
import { ConversationService } from "../services/ConversationService";
import { AgentService } from "../services/AgentService";
import { getDb, saveDb } from "../db/client";
import { logger } from "../utils/logger";
import { getErrorMessage } from "../types/ilink";

const router = Router();

/**
 * 新用户登录/注册后自动初始化微信助手会话（幂等）
 * - 已有 wechat_assistant 会话则跳过
 * - 无则自动创建
 */
function ensureWechatAssistantConversation(userId: string): void {
  try {
    const existing = ConversationService.list(userId).find(
      c => c.conversationType === 'wechat_assistant'
    );
    if (existing) return;

    const waAgent = AgentService.getByIdOrCode('rc-wechat-agent', userId);
    if (!waAgent) {
      logger.warn(`[WechatAssistant] agent rc-wechat-agent not found, skip init for user ${userId}`);
      return;
    }

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
    logger.info(`[WechatAssistant] Auto-created conversation ${conv.id} for user ${userId}`);
  } catch (err) {
    // 不阻断登录流程
    logger.error(`[WechatAssistant] Failed to init conversation for user ${userId}:`, err);
  }
}

// POST /api/auth/register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: "用户名、邮箱和密码不能为空" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "密码长度不能少于6位" });
    }
    const result = await UserService.register({ username, email, password });
    // 新用户注册后自动创建微信助手会话
    ensureWechatAssistantConversation(result.user.id);
    // 审计日志
    AuditService.log({
      userId: result.user.id,
      action: 'register',
      resource: 'user',
      resourceId: result.user.id,
      detail: { username, email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: (req as any).requestId,
    });
    res.status(201).json(result);
  } catch (err: unknown) {
    // [2026-05-24] 类型安全：any → unknown
    res.status(400).json({ error: getErrorMessage(err) });
  }
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, username, identifier, password } = req.body;
    const loginIdentifier = String(identifier || email || username || "").trim();
    if (!loginIdentifier || !password) {
      return res.status(400).json({ error: "账号和密码不能为空" });
    }
    const result = await UserService.login({ identifier: loginIdentifier, password });
    // 登录后确保微信助手会话存在（幂等，已有则跳过）
    ensureWechatAssistantConversation(result.user.id);
    // 审计日志
    AuditService.log({
      userId: result.user.id,
      action: 'login',
      resource: 'user',
      resourceId: result.user.id,
      detail: { identifier: loginIdentifier },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: (req as any).requestId,
    });
    res.json(result);
  } catch (err: unknown) {
    // [2026-05-24] 类型安全：any → unknown
    res.status(401).json({ error: getErrorMessage(err) });
  }
});

// GET /api/auth/me — 获取当前用户信息
router.get("/me", authenticate, (req: Request, res: Response) => {
  const user = UserService.getUserById((req as any).user.id);
  if (!user) return res.status(404).json({ error: "用户不存在" });
  // [2026-05-19] 微信扫码登录用户需要补全信息
  const needSetup = user.email?.endsWith('@wechat.local') || false;
  res.json({ ...user, needSetup });
});

// PUT /api/auth/me — 当前用户修改个人资料
router.put("/me", authenticate, (req: Request, res: Response) => {
  try {
    const { username, avatar, nickname } = req.body;
    const user = UserService.updateProfile((req as any).user.id, { username, avatar, nickname });
    if (!user) return res.status(404).json({ error: "用户不存在" });
    res.json(user);
  } catch (err: unknown) {
    // [2026-05-24] 类型安全：any → unknown
    res.status(400).json({ error: getErrorMessage(err) });
  }
});

// PUT /api/auth/password — 修改密码
router.put("/password", authenticate, async (req: Request, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: "原密码和新密码不能为空" });
    }
    await UserService.changePassword((req as any).user.id, oldPassword, newPassword);
    res.json({ message: "密码修改成功" });
  } catch (err: unknown) {
    // [2026-05-24] 类型安全：any → unknown
    res.status(400).json({ error: getErrorMessage(err) });
  }
});

// ── 组织成员列表（所有登录用户可用） ──────────────────────────────────────
// [2026-05-21] 群聊功能需要获取组织成员列表，不限制管理员
router.get("/members", authenticate, (_req: Request, res: Response) => {
  const users = UserService.listUsers();
  // 只返回安全字段，不暴露密码哈希
  const safeUsers = users.map((u: User) => ({ // [2026-05-24] 类型安全
    id: u.id,
    username: u.username,
    email: u.email,
    nickname: u.nickname,
    role: u.role,
    status: u.status,
    avatar: u.avatar,
    created_at: u.created_at,
  }));
  res.json({ data: safeUsers });
});

// ── 用户管理（管理员） ────────────────────────────────────────────────────────

// GET /api/auth/users — 获取用户列表
router.get("/users", authenticate, requireRole(["super_admin", "admin"]), (req: Request, res: Response) => {
  const users = UserService.listUsers();
  res.json(users);
});

// PUT /api/auth/users/:id — 更新用户角色/状态
router.put("/users/:id", authenticate, requireRole(["super_admin", "admin"]), (req: Request, res: Response) => {
  const { role, status, avatar } = req.body;
  const user = UserService.updateUser(req.params.id, { role, status, avatar });
  if (!user) return res.status(404).json({ error: "用户不存在" });
  res.json(user);
});

// [2026-05-17] PUT /api/auth/users/:id/reset-password — 管理员重置用户密码
router.put("/users/:id/reset-password", authenticate, requireRole(["super_admin", "admin"]), async (req: Request, res: Response) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: "新密码不能为空" });
    await UserService.resetPassword(req.params.id, newPassword);
    res.json({ message: "密码重置成功" });
  } catch (err: unknown) {
    // [2026-05-24] 类型安全：any → unknown
    res.status(400).json({ error: getErrorMessage(err) });
  }
});

// [2026-05-19] POST /api/auth/complete-setup — 微信扫码用户补全账号信息
router.post("/complete-setup", authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "账号、邮箱、密码不能为空" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "密码至少 6 位" });
  }

  try {
    const db = getDb();
    const now = new Date().toISOString();

    // 检查用户名是否已存在
    const existUsername = db.exec("SELECT id FROM users WHERE username=? AND id<>?", [username, userId]);
    if (existUsername.length && existUsername[0].values.length) {
      return res.status(400).json({ error: "该用户名已被使用" });
    }
    // 检查邮箱是否已存在
    const existEmail = db.exec("SELECT id FROM users WHERE email=? AND id<>?", [email, userId]);
    if (existEmail.length && existEmail[0].values.length) {
      return res.status(400).json({ error: "该邮箱已被注册" });
    }

    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 10);

    db.run(
      "UPDATE users SET username=?, email=?, password_hash=?, updated_at=? WHERE id=?",
      [username.trim(), email.trim(), passwordHash, now, userId]
    );
    saveDb();

    const user = UserService.getUserById(userId);
    res.json({ ...user, needSetup: false });
  } catch (err: unknown) {
    // [2026-05-24] 类型安全：any → unknown
    res.status(400).json({ error: getErrorMessage(err) || '设置失败' });
  }
});

export default router;
