/**
 * System Stats 路由
 * GET /api/system/stats       - 系统状态概览
 * GET /api/system/stats/raw   - 原始数据（供前端图表使用）
 */
import { Router, Request, Response } from 'express';
import { SystemStatsService } from '../services/SystemStatsService';

const router = Router();

/**
 * GET /api/system/stats
 * 返回格式化的人类可读系统状态
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const stats = SystemStatsService.getFormattedStats();
    res.json({
      code: 0,
      data: stats,
      msg: 'ok',
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      data: null,
      msg: error instanceof Error ? error.message : 'Failed to get system stats',
    });
  }
});

/**
 * GET /api/system/stats/raw
 * 返回原始字节数据（供前端自行格式化/画图）
 */
router.get('/raw', (req: Request, res: Response) => {
  try {
    const stats = SystemStatsService.getStats();
    res.json({
      code: 0,
      data: stats,
      msg: 'ok',
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      data: null,
      msg: error instanceof Error ? error.message : 'Failed to get raw system stats',
    });
  }
});

export default router;
