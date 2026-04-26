/**
 * Session Tabs 路由
 * POST /api/session-tabs/upsert  — 创建/更新单个 tab
 * POST /api/session-tabs/batch  — 批量保存所有 tabs
 * GET  /api/session-tabs        — 获取用户所有 tabs
 * DELETE /api/session-tabs/:key — 删除指定 tab
 */
import { Router, Request, Response } from 'express';
import { SessionTabService } from '../db/client';

const router = Router();

/** GET /api/session-tabs — 获取用户的所有 session tabs */
router.get('/', (req: Request, res: Response) => {
  const userId = (req as any).userId || '';
  const tabs = SessionTabService.list(userId);
  res.json({ code: 0, data: tabs, msg: 'ok' });
});

/** POST /api/session-tabs/upsert — 创建或更新单个 tab */
router.post('/upsert', (req: Request, res: Response) => {
  const userId = (req as any).userId || '';
  const { browser_tab_key, title, conversation_id, agent_id, agent_name, color } = req.body;
  const id = `stab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tab = SessionTabService.upsert({
    id,
    user_id: userId,
    browser_tab_key,
    title: title || '新标签页',
    conversation_id: conversation_id || '',
    agent_id: agent_id || '',
    agent_name: agent_name || '',
    color: color || '#9ca3af',
  });
  res.json({ code: 0, data: tab, msg: 'ok' });
});

/** POST /api/session-tabs/batch — 批量保存所有 tabs */
router.post('/batch', (req: Request, res: Response) => {
  const userId = (req as any).userId || '';
  const { tabs } = req.body;
  if (!Array.isArray(tabs)) {
    return res.status(400).json({ code: 400, data: null, msg: 'tabs 必须是数组' });
  }
  const results = SessionTabService.batchUpsert(userId, tabs);
  res.json({ code: 0, data: results, msg: 'ok' });
});

/** DELETE /api/session-tabs/:key — 删除指定 tab */
router.delete('/:key', (req: Request, res: Response) => {
  const userId = (req as any).userId || '';
  const { key } = req.params;
  SessionTabService.delete(userId, key);
  res.json({ code: 0, data: null, msg: 'deleted' });
});

export default router;
