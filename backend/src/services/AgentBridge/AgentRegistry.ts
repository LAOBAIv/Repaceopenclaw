/**
 * AgentRegistry — Agent 注册/注销编排器
 *
 * 职责：
 *   1. 调用 WorkspaceBuilder 创建/删除独立 workspace
 *   2. 调用 ConfigSync 注册/移除 openclaw.json 中的 agent
 *   3. 记录注册日志到 agent_registry_log 表
 *
 * 调用时机：
 *   - AgentService.create() → registerAgent()
 *   - AgentService.update() → updateAgent() （仅当 model/workspace 变更时）
 *   - AgentService.delete() → unregisterAgent()
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { getDb, saveDb } from '../../db/client';
import { toOpenClawAgentId } from './AgentMapper';
import * as ConfigSync from './ConfigSync';
import type { Agent } from '../AgentService';

// ─────────────────────────────────────────────
// 注册/注销主流程
// ─────────────────────────────────────────────

/**
 * 注册智能体到 OpenClaw
 * 
 * 按 agent_type 映射到对应的 OpenClaw agent：
 *   dev → rc-dev-agent, data → rc-data-agent, 等等
 */
export async function registerAgent(
  userId: string,
  agent: Agent
): Promise<{ success: boolean; ocAgentId: string; error?: string }> {
  // 按业务类型映射到对应的 OpenClaw agent
  const ocAgentId = toOpenClawAgentId(agent.agentType);

  try {
    // 1. 更新数据库映射（同时保存 openclaw_agent_id 和 agent_type）
    const db = getDb();
    db.run(
      'UPDATE agents SET openclaw_agent_id = ?, agent_type = ? WHERE id = ?',
      [ocAgentId, agent.agentType || 'general', agent.id]
    );
    saveDb();

    // 2. 记录日志
    await logRegistry(agent.id, 'register', 'success');

    logger.info(`[AgentRegistry] ✅ Registered: ${agent.name} (${agent.agentType || 'general'}) → ${ocAgentId}`);
    return { success: true, ocAgentId };
  } catch (error: unknown) { // [2026-05-24] 类型安全
    logger.error(`[AgentRegistry] ❌ Register failed for ${agent.name}:`, { message: error instanceof Error ? error.message : String(error) }); // [2026-05-24] 类型安全
    await logRegistry(agent.id, 'register', `failed: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, ocAgentId, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 注销智能体（删除时调用）
 */
export async function unregisterAgent(
  userId: string,
  agentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 清空数据库映射
    const db = getDb();
    db.run(
      'UPDATE agents SET openclaw_agent_id = NULL WHERE id = ?',
      [agentId]
    );
    saveDb();

    // 记录日志
    await logRegistry(agentId, 'unregister', 'success');

    logger.info(`[AgentRegistry] ✅ Unregistered: ${agentId}`);
    return { success: true };
  } catch (error: unknown) { // [2026-05-24] 类型安全
    logger.error(`[AgentRegistry] ❌ Unregister failed for ${agentId}:`, { message: error instanceof Error ? error.message : String(error) }); // [2026-05-24] 类型安全
    await logRegistry(agentId, 'unregister', `failed: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 更新智能体配置（model 或 systemPrompt 变更时调用）
 */
export async function updateAgent(
  userId: string,
  agentId: string,
  agent: Agent
): Promise<{ success: boolean; error?: string }> {
  const ocAgentId = toOpenClawAgentId(agent.agentType);

  try {
    // 按类型映射到对应的 OpenClaw agent
    const db = getDb();
    db.run(
      'UPDATE agents SET openclaw_agent_id = ?, agent_type = ? WHERE id = ?',
      [ocAgentId, agent.agentType || 'general', agentId]
    );
    saveDb();

    // 记录日志
    await logRegistry(agentId, 'update', 'success');

    logger.info(`[AgentRegistry] ✅ Updated: ${agentId} (${agent.agentType || 'general'}) → ${ocAgentId}`);
    return { success: true };
  } catch (error: unknown) { // [2026-05-24] 类型安全
    logger.error(`[AgentRegistry] ❌ Update failed for ${agentId}:`, { message: error instanceof Error ? error.message : String(error) }); // [2026-05-24] 类型安全
    await logRegistry(agentId, 'update', `failed: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ─────────────────────────────────────────────
// 批量同步（重启后补偿 / 首次初始化）
// ─────────────────────────────────────────────

/**
 * 全量同步：确保数据库中的所有 agent 都已注册到 OpenClaw
 * 适用场景：服务启动时、Gateway 重启后
 *
 * 🛡️ 2026-05-03 性能优化：
 * 1. 循环外一次性读取 openclaw.json（从 N 次降到 1 次）
 * 2. 用 agent.userId 替代循环内查数据库（消除 N+1 查询）
 * 3. 内存中维护已注册列表，避免 addAgent 后判断过时
 */
export async function syncAllAgents(): Promise<{
  total: number;
  registered: number;
  missing: number;
  errors: Array<{ agentId: string; error: string }>;
}> {
  const db = getDb();
  const result = db.exec('SELECT * FROM agents');

  const agents: Agent[] = [];
  if (result.length && result[0].values.length) {
    const cols = result[0].columns;
    for (const row of result[0].values) {
      const obj: Record<string, unknown> = {};
      cols.forEach((c, i) => { obj[c] = row[i]; });
      agents.push(rowToAgent(obj));
    }
  }

  const report = { total: agents.length, registered: 0, missing: 0, errors: [] as Array<{ agentId: string; error: string }> };

  for (const agent of agents) {
    try {
      // 跳过独立绑定的全局智能体（不走 agent_type 映射链路）
      if (agent.openclawAgentId === 'repaceclaw-platform-assistant') continue;
      // [2026-05-16] 稳定方案：用 agent_code 识别微信助手，固定其 openclaw_agent_id
      if ((agent as unknown as Record<string, unknown>).agentCode === 'rc-wechat-agent' || agent.id === '151194a0-385e-4fc6-8aca-c1622e5967f8') { // [2026-05-24] 类型安全
        // 确保微信助手的 openclaw_agent_id 始终为 rc-wechat-agent
        if (agent.openclawAgentId !== 'rc-wechat-agent') {
          db.run('UPDATE agents SET openclaw_agent_id = ? WHERE id = ?', ['rc-wechat-agent', agent.id]);
          saveDb();
        }
        continue;
      }
      // 按类型映射
      const ocAgentId = toOpenClawAgentId(agent.agentType);
      db.run('UPDATE agents SET openclaw_agent_id = ?, agent_type = ? WHERE id = ?', [ocAgentId, agent.agentType || 'general', agent.id]);
      report.registered++;
    } catch (error: unknown) { // [2026-05-24] 类型安全
      report.errors.push({ agentId: agent.id, error: error instanceof Error ? error.message : String(error) }); // [2026-05-24] 类型安全
    }
  }

  saveDb();
  report.missing = report.total - report.registered - report.errors.length;
  logger.info(`[AgentRegistry] Sync complete: ${report.registered}/${report.total} mapped by type, ${report.errors.length} errors`);
  return report;
}

// ─────────────────────────────────────────────
// 内部工具函数
// ─────────────────────────────────────────────

/**
 * 解析 agent 配置为 OpenClaw model ref 格式 (provider/model)
 */
function resolveModel(agent: Agent): string | undefined {
  // 优先级：tokenProvider+modelName > modelProvider+modelName > 默认
  if (agent.tokenProvider && agent.modelName) {
    return `${agent.tokenProvider}/${agent.modelName}`;
  }
  if (agent.modelProvider && agent.modelName) {
    return `${agent.modelProvider}/${agent.modelName}`;
  }
  // 默认使用 linkApi/qwen3.6-plus（openclaw.json defaults）
  return undefined; // 使用 defaults
}

/**
 * row → Agent（与 AgentService 中的 rowToAgent 保持一致）
 *
 * 🛡️ 2026-05-03 修复：加上 userId 字段，
 * 避免 syncAllAgents() 循环内重复查数据库（N+1 问题）。
 */
function rowToAgent(obj: Record<string, unknown>): Agent { // [2026-05-24] 类型安全
  const v = (k: string) => obj[k] as string | undefined; // [2026-05-24] 类型安全
  const vn = (k: string) => obj[k] as number | undefined; // [2026-05-24] 类型安全
  return {
    id: v('id')!,
    name: v('name')!,
    color: v('color')!,
    systemPrompt: v('system_prompt')!,
    writingStyle: v('writing_style')!,
    expertise: JSON.parse(v('expertise') || '[]'),
    description: v('description') || '',
    status: (v('status') || 'idle') as Agent['status'],
    modelName: v('model_name') || '',
    modelProvider: v('model_provider') || '',
    temperature: vn('temperature') ?? 0.7,
    maxTokens: vn('max_tokens') ?? 4096,
    topP: vn('top_p') ?? 1,
    frequencyPenalty: vn('frequency_penalty') ?? 0,
    presencePenalty: vn('presence_penalty') ?? 0,
    tokenProvider: v('token_provider') || '',
    tokenApiKey: v('token_api_key') || '',
    tokenBaseUrl: v('token_base_url') || '',
    outputFormat: v('output_format') || '纯文本',
    boundary: v('boundary') || '',
    memoryTurns: vn('memory_turns') ?? 0,
    temperatureOverride: vn('temperature_override') ?? null,
    tokenUsed: vn('token_used') ?? 0,
    visibility: (v('visibility') || 'private') as Agent['visibility'],
    skillsConfig: JSON.parse(v('skills_config') || '{}'),
    quotaConfig: JSON.parse(v('quota_config') || '{}'),
    openclawAgentId: v('openclaw_agent_id') || null,
    userId: v('user_id') || '',
    agentType: v('agent_type') || 'general',  // 新增：业务类型
    createdAt: v('created_at')!,
  };
}

/**
 * 记录注册日志到 agent_registry_log 表
 */
async function logRegistry(
  agentId: string,
  action: 'register' | 'unregister' | 'update',
  result: string
): Promise<void> {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO agent_registry_log (id, agent_id, action, result, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, agentId, action, result, now]
  );
  saveDb();
}
