/**
 * ConfigSync — 动态同步 OpenClaw 配置 (openclaw.json)
 *
 * 负责：
 *   - 在 agents.list 中添加/移除 agent
 *   - 添加/移除 bindings（渠道路由）
 *   - 触发 Gateway 重启以加载新配置
 */

import fs from 'fs';
import { logger } from '../../utils/logger';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getWorkspacePath, getAgentDir } from './AgentMapper';

const execAsync = promisify(exec);

const OPENCLAW_CONFIG_PATH = '/root/.openclaw/openclaw.json';

// ─────────────────────────────────────────────
// openclaw.json 配置结构（我们关心的部分）
// ─────────────────────────────────────────────

interface OpenClawConfig {
  agents?: {
    defaults?: Record<string, unknown>;
    list?: Array<{
      id: string;
      workspace?: string;
      agentDir?: string;
      model?: string;
      name?: string;
      [key: string]: unknown;
    }>;
  };
  bindings?: Array<{
    agentId: string;
    match: Record<string, unknown>;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

/**
 * 读取 openclaw.json（支持 JSON5 注释）
 */
function readConfig(): OpenClawConfig {
  const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8');
  // 移除注释（简单处理：移除 // 开头的行和行尾注释）
  const cleaned = raw
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  return JSON.parse(cleaned);
}

/**
 * 写回 openclaw.json（格式化输出）
 */
function writeConfig(config: OpenClawConfig): void {
  const backupPath = `${OPENCLAW_CONFIG_PATH}.bak.${Date.now()}`;
  fs.copyFileSync(OPENCLAW_CONFIG_PATH, backupPath);

  const content = JSON.stringify(config, null, 2);
  fs.writeFileSync(OPENCLAW_CONFIG_PATH, content, 'utf-8');
}

/**
 * 向 openclaw.json 注册一个 agent
 */
export async function addAgent(
  ocAgentId: string,
  modelName?: string
): Promise<void> {
  const config = readConfig();

  if (!config.agents) config.agents = {};
  if (!config.agents.list) config.agents.list = [];

  // 检查是否已存在
  const existing = config.agents.list.find((a) => a.id === ocAgentId);
  if (existing) {
    // 更新 workspace 和 model
    existing.workspace = getWorkspacePath(ocAgentId);
    existing.agentDir = getAgentDir(ocAgentId);
    if (modelName) existing.model = modelName;
  } else {
    config.agents.list.push({
      id: ocAgentId,
      workspace: getWorkspacePath(ocAgentId),
      agentDir: getAgentDir(ocAgentId),
      ...(modelName ? { model: modelName } : {}),
    });
  }

  writeConfig(config);
  logger.info(`[ConfigSync] Agent registered: ${ocAgentId}`);
}

/**
 * 从 openclaw.json 移除一个 agent
 */
export async function removeAgent(ocAgentId: string): Promise<void> {
  const config = readConfig();

  if (!config.agents?.list) return;

  const before = config.agents.list.length;
  config.agents.list = config.agents.list.filter((a) => a.id !== ocAgentId);

  if (config.agents.list.length < before) {
    writeConfig(config);
    logger.info(`[ConfigSync] Agent removed: ${ocAgentId}`);
  }

  // 同时移除相关 bindings
  if (config.bindings) {
    const beforeBindings = config.bindings.length;
    config.bindings = config.bindings.filter((b) => b.agentId !== ocAgentId);
    if (config.bindings.length < beforeBindings) {
      writeConfig(config);
    }
  }
}

/**
 * 更新 agent 的模型配置
 */
export async function updateAgentModel(
  ocAgentId: string,
  modelName: string
): Promise<void> {
  const config = readConfig();

  if (!config.agents?.list) return;

  const agent = config.agents.list.find((a) => a.id === ocAgentId);
  if (agent) {
    agent.model = modelName;
    writeConfig(config);
    logger.info(`[ConfigSync] Agent model updated: ${ocAgentId} → ${modelName}`);
  }
}

/**
 * 添加渠道 binding（消息路由）
 */
export async function addBinding(
  ocAgentId: string,
  match: Record<string, unknown>
): Promise<void> {
  const config = readConfig();

  if (!config.bindings) config.bindings = [];

  // 检查是否已存在相同的 binding
  const existing = config.bindings.find(
    (b) => b.agentId === ocAgentId && JSON.stringify(b.match) === JSON.stringify(match)
  );
  if (existing) return;

  config.bindings.push({ agentId: ocAgentId, match });
  writeConfig(config);
  logger.info(`[ConfigSync] Binding added: ${ocAgentId} → ${JSON.stringify(match)}`);
}

/**
 * 触发 Gateway 重启以加载新配置
 * 可选调用，避免频繁重启
 */
export async function restartGateway(): Promise<void> {
  try {
    logger.info('[ConfigSync] Restarting Gateway...');
    await execAsync('openclaw gateway restart');
    logger.info('[ConfigSync] Gateway restarted successfully');
  } catch (error: any) {
    logger.error('[ConfigSync] Gateway restart failed:', error.message);
    // 不抛异常，允许注册继续（下次重启自动生效）
  }
}

/**
 * 获取当前 openclaw.json 中已注册的 agent 列表
 */
export function listRegisteredAgents(): Array<{ id: string; model?: string; workspace?: string }> {
  const config = readConfig();
  return (config.agents?.list || []).map((a) => ({
    id: a.id,
    model: a.model,
    workspace: a.workspace,
  }));
}
