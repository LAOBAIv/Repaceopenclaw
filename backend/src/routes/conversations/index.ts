/**
 * conversations — 会话管理 API 路由
 *
 * 路由薄层，handler 逻辑在 ./handlers.ts
 */
import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import * as h from "./handlers";

const router = Router();
router.use(authenticate);

// ─── 列表 & 专属助手 ────────────────────────────────────────────────────
router.get("/", h.listConversations);
router.get("/platform-assistant", h.getPlatformAssistant);
router.get("/wechat-assistant", h.getWechatAssistant);

// ─── CRUD ───────────────────────────────────────────────────────────────
router.post("/", h.createConversation);
router.put("/:id", h.updateConversation);
router.delete("/:id", h.deleteConversation);
router.patch("/:id/status", h.updateConversationStatus);
router.post("/:id/switch-agent", h.switchAgent);

// ─── 消息 ───────────────────────────────────────────────────────────────
router.get("/:id/messages", h.getMessages);
router.post("/:id/messages", h.addMessage);

// ─── Agent 管理 ─────────────────────────────────────────────────────────
router.post("/:id/agents", h.addAgentToConversation);
router.delete("/:id/agents/:agentId", h.removeAgentFromConversation);

// ─── 生成 & 概述 ────────────────────────────────────────────────────────
router.post("/:id/generate", authenticate, h.generateReply);
router.post("/create-with-overview", authenticate, h.createWithOverview);

export default router;
