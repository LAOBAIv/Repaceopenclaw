/**
 * 会话管理路由
 * GET  /api/sessions          — 获取会话索引列表（含自动同步）
 * GET  /api/sessions/:id       — 获取完整会话（含消息）
 * GET  /api/sessions/:id/preview — 获取会话预览（最近 N 条消息）
 * POST /api/sessions/sync     — 手动触发同步 OpenClaw sessions → DB
 */
import { Router, Request, Response } from 'express';
import { getDb, saveDb } from '../db/client';
import { scanOpenClawSessions, syncToDatabase, getAllSessions } from '../services/SessionSyncService';

const router = Router();

/**
 * GET /api/sessions — 获取会话索引列表
 * 自动同步 OpenClaw 会话后返回
 */
router.get('/', (req: Request, res: Response) => {
  const userId = (req as any).userId || '';
  const db = getDb();
  
  // 自动同步
  syncToDatabase(db, userId);
  saveDb();
  
  const sessions = getAllSessions(db, userId);
  res.json({ code: 0, data: sessions, msg: 'ok' });
});

/**
 * GET /api/sessions/:id — 获取完整会话（含所有消息）
 */
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  // 支持通过 conversation ID 或 OC session key 查询
  const convRows = db.exec(
    "SELECT * FROM conversations WHERE id = ? OR oc_session_key LIKE ?",
    [id, `%${id}%`]
  );
  if (!convRows[0]?.values?.length) {
    return res.status(404).json({ code: 404, data: null, msg: '会话不存在' });
  }

  const cols = convRows[0].columns;
  const conv = Object.fromEntries(cols.map((c, i) => [c, convRows[0].values[0][i]])) as any;

  // 获取消息列表
  const msgRows = db.exec(
    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
    [id]
  );

  const messages = (msgRows[0]?.values || []).map(row => {
    const msgCols = msgRows[0].columns;
    return Object.fromEntries(msgCols.map((c, i) => [c, row[i]]));
  });

  res.json({ code: 0, data: { ...conv, messages }, msg: 'ok' });
});

/**
 * GET /api/sessions/:id/preview — 获取会话预览（最近 N 条消息）
 */
router.get('/:id/preview', (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  const convRows = db.exec(
    "SELECT id, title, agent_id as agentId, oc_session_key as ocSessionKey, created_at FROM conversations WHERE id = ? OR oc_session_key LIKE ?",
    [id, `%${id}%`]
  );
  if (!convRows[0]?.values?.length) {
    return res.status(404).json({ code: 404, data: null, msg: '会话不存在' });
  }

  const cols = convRows[0].columns;
  const conv = Object.fromEntries(cols.map((c, i) => [c, convRows[0].values[0][i]])) as any;

  const msgRows = db.exec(
    "SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?",
    [id, limit]
  );

  const messages = (msgRows[0]?.values || []).map(row => ({
    id: row[0],
    role: row[1],
    content: row[2],
    createdAt: row[3],
  })).reverse();

  res.json({ code: 0, data: { ...conv, messages, hasMore: true }, msg: 'ok' });
});

/**
 * POST /api/sessions/sync — 手动触发同步
 */
router.post('/sync', (req: Request, res: Response) => {
  const userId = (req as any).userId || '';
  const db = getDb();
  const result = syncToDatabase(db, userId);
  saveDb();
  res.json({ 
    code: 0, 
    data: result, 
    msg: `同步完成：${result.synced}/${result.total} 个会话` + 
         (result.errors.length > 0 ? `，${result.errors.length} 个错误` : '')
  });
});

export default router;
