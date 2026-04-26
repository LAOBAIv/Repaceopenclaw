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
import fs from 'fs';
import { getDb, saveDb } from '../../db/client';
import { toOpenClawAgentId, getWorkspacePath } from './AgentMapper';
import * as WorkspaceBuilder from './WorkspaceBuilder';
import * as ConfigSync from './ConfigSync';
import type { Agent } from '../AgentService';

// ─────────────────────────────────────────────
// 注册/注销主流程
// ─────────────────────────────────────────────

/**
 * 注册智能体到 OpenClaw
 */
export async function registerAgent(
  userId: string,
  agent: Agent
): Promise<{ success: boolean; ocAgentId: string; error?: string }> {
  const ocAgentId = toOpenClawAgentId(userId, agent.id);

  try {
    // 1. 解析模型配置
    const modelName = resolveModel(agent);

    // 2. 创建 workspace（SOUL.md / AGENTS.md / IDENTITY.md 等）
    await WorkspaceBuilder.createWorkspace(ocAgentId, agent, userId);

    // 3. 写入 openclaw.json agents.list
    await ConfigSync.addAgent(ocAgentId, modelName);

    // 4. 更新数据库映射
    const db = getDb();
    db.run(
      'UPDATE agents SET openclaw_agent_id = ? WHERE id = ?',
      [ocAgentId, agent.id]
    );
    saveDb();

    // 5. 记录日志
    await logRegistry(agent.id, 'register', 'success');

    logger.info(`[AgentRegistry] ✅ Registered: ${agent.name} → ${ocAgentId}`);
    return { success: true, ocAgentId };
  } catch (error: any) {
    logger.error(`[AgentRegistry] ❌ Register failed for ${agent.name}:`, error.message);
    await logRegistry(agent.id, 'register', `failed: ${error.message}`);
    return { success: false, ocAgentId, error: error.message };
  }
}

/**
 * 注销智能体（删除时调用）
 */
export async function unregisterAgent(
  userId: string,
  agentId: string
): Promise<{ success: boolean; error?: string }> {
  const ocAgentId = toOpenClawAgentId(userId, agentId);

  try {
    // 1. 从 openclaw.json 移除
    await ConfigSync.removeAgent(ocAgentId);

    // 2. 删除 workspace
    await WorkspaceBuilder.removeWorkspace(ocAgentId);

    // 3. 清空数据库映射
    const db = getDb();
    db.run(
      'UPDATE agents SET openclaw_agent_id = NULL WHERE id = ?',
      [agentId]
    );
    saveDb();

    // 4. 记录日志
    await logRegistry(agentId, 'unregister', 'success');

    logger.info(`[AgentRegistry] ✅ Unregistered: ${agentId} → ${ocAgentId}`);
    return { success: true };
  } catch (error: any) {
    logger.error(`[AgentRegistry] ❌ Unregister failed for ${agentId}:`, error.message);
    await logRegistry(agentId, 'unregister', `failed: ${error.message}`);
    return { success: false, error: error.message };
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
  const ocAgentId = toOpenClawAgentId(userId, agentId);

  try {
    const modelName = resolveModel(agent);

    // 1. 更新 workspace（SOUL.md / IDENTITY.md）
    await WorkspaceBuilder.updateWorkspace(ocAgentId, agent, userId);

    // 2. 更新 openclaw.json 中的模型配置
    if (modelName) {
      await ConfigSync.updateAgentModel(ocAgentId, modelName);
    }

    // 3. 记录日志
    await logRegistry(agentId, 'update', 'success');

    logger.info(`[AgentRegistry] ✅ Updated: ${agentId} → ${ocAgentId}`);
    return { success: true };
  } catch (error: any) {
    logger.error(`[AgentRegistry] ❌ Update failed for ${agentId}:`, error.message);
    await logRegistry(agentId, 'update', `failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────
// 批量同步（重启后补偿 / 首次初始化）
// ─────────────────────────────────────────────

/**
 * 全量同步：确保数据库中的所有 agent 都已注册到 OpenClaw
 * 适用场景：服务启动时、Gateway 重启后
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
    // Get userId from DB directly
    const dbRow = db.exec('SELECT user_id FROM agents WHERE id = ?', [agent.id]);
    const userId = (dbRow.length && dbRow[0].values.length) ? String(dbRow[0].values[0][0] || '') : '';
    const ocAgentId = toOpenClawAgentId(userId, agent.id);
    const workspacePath = getWorkspacePath(ocAgentId);

    try {
      const workspacePath = getWorkspacePath(ocAgentId);
      if (fs.existsSync(workspacePath)) {
        // workspace 已存在，检查 openclaw.json 中是否有记录
        const registered = ConfigSync.listRegisteredAgents();
        const exists = registered.some((a) => a.id === ocAgentId);
        if (!exists) {
          // openclaw.json 中丢失，重新注册
          await ConfigSync.addAgent(ocAgentId, resolveModel(agent));
        }
        report.registered++;
      } else {
        // workspace 丢失，重新创建
        await WorkspaceBuilder.createWorkspace(ocAgentId, agent, userId);
        await ConfigSync.addAgent(ocAgentId, resolveModel(agent));
        report.registered++;
      }
    } catch (error: any) {
      report.errors.push({ agentId: agent.id, error: error.message });
    }
  }

  report.missing = report.total - report.registered - report.errors.length;
  logger.info(`[AgentRegistry] Sync complete: ${report.registered}/${report.total} registered, ${report.errors.length} errors`);
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
 */
function rowToAgent(obj: any): Agent {
  return {
    id: obj.id,
    name: obj.name,
    color: obj.color,
    systemPrompt: obj.system_prompt,
    writingStyle: obj.writing_style,
    expertise: JSON.parse(obj.expertise || '[]'),
    description: obj.description || '',
    status: (obj.status || 'idle') as Agent['status'],
    modelName: obj.model_name || '',
    modelProvider: obj.model_provider || '',
    temperature: obj.temperature ?? 0.7,
    maxTokens: obj.max_tokens ?? 4096,
    topP: obj.top_p ?? 1,
    frequencyPenalty: obj.frequency_penalty ?? 0,
    presencePenalty: obj.presence_penalty ?? 0,
    tokenProvider: obj.token_provider || '',
    tokenApiKey: obj.token_api_key || '',
    tokenBaseUrl: obj.token_base_url || '',
    outputFormat: obj.output_format || '纯文本',
    boundary: obj.boundary || '',
    memoryTurns: obj.memory_turns ?? 0,
    temperatureOverride: obj.temperature_override ?? null,
    tokenUsed: obj.token_used ?? 0,
    visibility: (obj.visibility || 'private') as Agent['visibility'],
    skillsConfig: JSON.parse(obj.skills_config || '{}'),
    quotaConfig: JSON.parse(obj.quota_config || '{}'),
    openclawAgentId: obj.openclaw_agent_id || null,
    createdAt: obj.created_at,
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
