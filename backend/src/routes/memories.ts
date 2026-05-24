/**
 * 向量记忆 API 路由
 *
 * POST   /api/memories              — 创建记忆
 * GET    /api/memories              — 列表查询
 * GET    /api/memories/:id          — 获取详情
 * PUT    /api/memories/:id          — 更新记忆
 * DELETE /api/memories/:id          — 删除记忆
 * POST   /api/memories/search       — 语义检索
 * GET    /api/memories/stats        — 统计信息
 */

import { Router, Request, Response } from 'express';
import { MemoryService, type CreateMemoryInput } from '../services/memory/MemoryService';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/memories — 创建记忆
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: '未登录' });
      return;
    }

    const input: CreateMemoryInput = {
      userId,
      ...req.body,
    };

    if (!input.content) {
      res.status(400).json({ error: 'content 是必填字段' });
      return;
    }

    const memory = await MemoryService.create(input);
    logger.info(`[Memory API] Created: ${memory.id.slice(0, 8)}... by user ${userId}`);
    res.json(memory);
  })
);

/**
 * GET /api/memories — 列表查询
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: '未登录' });
      return;
    }

    const { memories, total } = MemoryService.list({
      userId,
      agentId: req.query.agentId as string | undefined,
      category: req.query.category as string | undefined,
      source: req.query.source as string | undefined,
      limit: Math.min(parseInt(req.query.limit as string) || 50, 100),
      offset: parseInt(req.query.offset as string) || 0,
    });

    res.json({ memories, total });
  })
);

/**
 * GET /api/memories/:id — 获取详情
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const memory = MemoryService.getById(req.params.id);
    if (!memory) {
      res.status(404).json({ error: '记忆不存在' });
      return;
    }
    res.json(memory);
  })
);

/**
 * PUT /api/memories/:id — 更新记忆
 */
router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const memory = await MemoryService.update(req.params.id, req.body);
    if (!memory) {
      res.status(404).json({ error: '记忆不存在' });
      return;
    }
    res.json(memory);
  })
);

/**
 * DELETE /api/memories/:id — 删除记忆
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const deleted = MemoryService.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: '记忆不存在' });
      return;
    }
    res.json({ success: true });
  })
);

/**
 * POST /api/memories/search — 语义检索
 */
router.post(
  '/search',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: '未登录' });
      return;
    }

    const { query, agentId, category, topK } = req.body;
    if (!query) {
      res.status(400).json({ error: 'query 是必填字段' });
      return;
    }

    const results = await MemoryService.search({
      query,
      userId,
      agentId,
      category,
      topK: Math.min(topK || 5, 20),
    });

    res.json({ results, query });
  })
);

/**
 * GET /api/memories/stats — 统计信息
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: '未登录' });
      return;
    }

    const stats = MemoryService.getStats(userId);
    res.json(stats);
  })
);

export default router;
