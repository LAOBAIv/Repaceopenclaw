// helpers.ts — 工具函数（权限校验、参数校验等）
import { z } from 'zod';

// ============ 验证 Schema ============

export const AgentSchema = z.object({
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
  // RC -> OC 执行分类
  agentType: z.enum(['dev', 'data', 'creative', 'pm', 'research', 'ops', 'decision', 'general']).default('general'),
  // Phase 3: 可见性 / Skill 管控 / 配额
  visibility: z.enum(['private', 'public', 'template']).default('private'),
  skillsConfig: z.record(z.string(), z.boolean()).optional(),
  quotaConfig: z.object({
    maxDailyTokens: z.number().optional(),
    maxDailyConversations: z.number().optional(),
    maxTokensPerMessage: z.number().optional(),
  }).optional(),
});

export const AgentUpdateSchema = AgentSchema.partial();

/** 检查用户是否为管理员 */
export function isAdmin(role: string): boolean {
  return role === 'admin' || role === 'super_admin';
}
