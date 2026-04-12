/**
 * 智能体管理路由
 * 
 * 优化点：
 * 1. 使用统一的响应工具函数
 * 2. 使用 asyncHandler 包装异步路由
 * 3. 统一错误处理
 * 4. 类型安全
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { AgentService } from '../services/AgentService';
import { getDb } from '../db/client';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { 
  sendSuccess, 
  sendCreated, 
  sendNotFound, 
  sendValidationError 
} from '../utils/response';
import { Errors } from '../utils/errors';
import { TokenStats } from '../types';

const router = Router();

// ============ 验证 Schema ============

const AgentSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  color: z.string().default('#6366F1'),
  systemPrompt: z.string().default(''),
  writingStyle: z.string().default('balanced'),
  expertise: z.array(z.string()).default([]),
  description: z.string().default(''),
  status: z.enum(['active', 'idle', 'busy']).default('idle'),
  // 模型参数
  modelName: z.string().default(''),
  modelProvider: z.string().default(''),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(32768).default(4096),
  topP: z.number().min(0).max(1).default(1),
  frequencyPenalty: z.number().min(-2).max(2).default(0),
  presencePenalty: z.number().min(-2).max(2).default(0),
  // 用户配置的私有 Token 接入
  tokenProvider: z.string().default(''),
  tokenApiKey: z.string().default(''),
  tokenBaseUrl: z.string().default(''),
  // 输出格式 & 能力边界
  outputFormat: z.string().default('纯文本'),
  boundary: z.string().default(''),
  // 对话记忆轮数（0 = 不限）
  memoryTurns: z.number().min(0).default(0),
  // 简单温度快捷覆盖
  temperatureOverride: z.number().min(0).max(2).nullable().default(null),
  // Phase 3: 可见性 / Skill 管控 / 配额
  visibility: z.enum(['private', 'public', 'template']).default('private'),
  skillsConfig: z.record(z.string(), z.boolean()).optional(),
  quotaConfig: z.object({
    maxDailyTokens: z.number().optional(),
    maxDailyConversations: z.number().optional(),
    maxTokensPerMessage: z.number().optional(),
  }).optional(),
});

const AgentUpdateSchema = AgentSchema.partial();

// ============ 异步处理包装器 ============

// asyncHandler 已从 '../utils' 导入

// ============ 路由定义 ============

/**
 * GET /api/agents
 * 获取所有智能体列表
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const agents = AgentService.list(userId);
    sendSuccess(res, agents);
  })
);

/**
 * GET /api/agents/:id
 * 获取单个智能体详情
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const agent = AgentService.getById(req.params.id);
    if (!agent) {
      throw Errors.notFound('智能体');
    }
    sendSuccess(res, agent);
  })
);

/**
 * GET /api/agents/:id/token-stats
 * 获取智能体 Token 用量统计
 */
router.get(
  '/:id/token-stats',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const agent = AgentService.getById(req.params.id);
    if (!agent) {
      throw Errors.notFound('智能体');
    }

    const db = getDb();

    // 汇总消息统计
    const msgResult = db.exec(
      `SELECT COUNT(*) as msg_count, SUM(token_count) as total_tokens
       FROM messages WHERE agent_id = ? AND role = 'agent'`,
      [req.params.id]
    );
    
    const msgRow = msgResult.length && msgResult[0].values.length 
      ? msgResult[0].values[0] 
      : [0, 0];
    
    const messageCount = Number(msgRow[0]) || 0;
    const totalFromMessages = Number(msgRow[1]) || 0;

    // 按会话汇总
    const convResult = db.exec(
      `SELECT conversation_id,
              COUNT(*) as msg_count,
              SUM(token_count) as total_tokens
       FROM messages
       WHERE agent_id = ? AND role = 'agent'
       GROUP BY conversation_id
       ORDER BY total_tokens DESC`,
      [req.params.id]
    );

    const perConversation: Array<{
      conversationId: string;
      messageCount: number;
      totalTokens: number;
    }> = [];

    if (convResult.length && convResult[0].values.length) {
      const cols = convResult[0].columns;
      for (const row of convResult[0].values) {
        const obj: Record<string, unknown> = {};
        cols.forEach((c, i) => (obj[c] = row[i]));
        perConversation.push({
          conversationId: String(obj.conversation_id),
          messageCount: Number(obj.msg_count),
          totalTokens: Number(obj.total_tokens),
        });
      }
    }

    const stats: TokenStats = {
      agentId: req.params.id,
      agentName: agent.name,
      tokenUsed: agent.tokenUsed,
      tokenFromMessages: totalFromMessages,
      messageCount,
      avgTokenPerMsg: messageCount > 0 ? Math.round(totalFromMessages / messageCount) : 0,
      perConversation,
    };

    sendSuccess(res, stats);
  })
);

/**
 * POST /api/agents
 * 创建新智能体
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = AgentSchema.safeParse(req.body);
    
    if (!parsed.success) {
      throw Errors.validation('参数验证失败', parsed.error.flatten());
    }

    const userId = (req as any).user?.id;
    const agent = AgentService.create({ ...parsed.data, name: parsed.data.name, userId });
    sendCreated(res, agent, '智能体创建成功');
  })
);

/**
 * PUT /api/agents/:id
 * 更新智能体
 */
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = AgentUpdateSchema.safeParse(req.body);
    
    if (!parsed.success) {
      throw Errors.validation('参数验证失败', parsed.error.flatten());
    }

    const agent = AgentService.update(req.params.id, parsed.data);
    if (!agent) {
      throw Errors.notFound('智能体');
    }

    sendSuccess(res, agent, '智能体更新成功');
  })
);

/**
 * DELETE /api/agents/:id
 * 删除智能体
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const agent = AgentService.getById(req.params.id);
    if (!agent) {
      throw Errors.notFound('智能体');
    }

    AgentService.delete(req.params.id);
    sendSuccess(res, { id: req.params.id }, '智能体删除成功');
  })
);

export default router;
