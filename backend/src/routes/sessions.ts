/**
 * 会话管理路由（V1）
 *
 * 说明：
 * - conversations + messages 是 RepaceClaw 会话唯一真源
 * - /api/sessions 仅提供“会话视图/索引”兼容接口，不再依赖 OpenClaw 本地 session 文件扫描
 */
import { Router, Request, Response } from 'express';
import { ConversationService } from '../services/ConversationService';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user?.id || '';
  const sessions = ConversationService.getSessionIndex(userId);
  res.json({ code: 0, data: sessions, msg: 'ok' });
});

router.get('/:id', authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user?.id || '';
  const conv = ConversationService.getByIdOrCode(req.params.id, userId);
  if (!conv) {
    return res.status(404).json({ code: 404, data: null, msg: '会话不存在' });
  }
  const messages = ConversationService.getMessages(conv.id).map((m) => ({
    id: m.id,
    messageCode: m.messageCode,
    conversation_id: m.conversationId,
    role: m.role,
    content: m.content,
    created_at: m.createdAt,
  }));
  const idx = ConversationService.getSessionIndex(userId).find((s) => s.id === conv.id);
  res.json({ code: 0, data: { ...(idx || {}), ...conv, messages }, msg: 'ok' });
});

router.get('/:id/preview', authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user?.id || '';
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const conv = ConversationService.getByIdOrCode(req.params.id, userId);
  if (!conv) {
    return res.status(404).json({ code: 404, data: null, msg: '会话不存在' });
  }
  const idx = ConversationService.getSessionIndex(userId).find((s) => s.id === conv.id);
  const allMessages = ConversationService.getMessages(conv.id);
  const messages = allMessages.slice(-limit).map((m) => ({
    id: m.id,
    messageCode: m.messageCode,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
  }));
  res.json({
    code: 0,
    data: {
      ...(idx || {}),
      id: conv.id,
      title: conv.title,
      agentIds: conv.agentIds,
      agentId: conv.agentId,
      currentAgentId: conv.currentAgentId,
      sessionCode: conv.sessionCode,
      currentAgentCode: conv.currentAgentCode,
      messages,
      hasMore: allMessages.length > messages.length,
    },
    msg: 'ok',
  });
});

router.post('/sync', authenticate, (_req: Request, res: Response) => {
  res.json({
    code: 0,
    data: { synced: 0, total: 0, errors: [] },
    msg: 'V1 已关闭 OpenClaw 本地 session 文件同步；当前以 RepaceClaw conversations/messages 为唯一真源',
  });
});

export default router;
