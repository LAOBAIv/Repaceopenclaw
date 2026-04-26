/**
 * WorkspaceBuilder — 为 RepaceClaw 智能体动态生成 OpenClaw workspace 文件
 *
 * 每个智能体获得独立的 workspace，包含：
 *   SOUL.md    — persona（从 agent.systemPrompt 等生成）
 *   AGENTS.md  — operating instructions
 *   USER.md    — 所属用户信息
 *   IDENTITY.md — 名称/emoji/vibe
 *   TOOLS.md   — 工具使用备注
 */

import fs from 'fs';
import path from 'path';
import { getWorkspacePath } from './AgentMapper';
import type { Agent } from '../AgentService';

/**
 * 为智能体创建完整 workspace
 */
export async function createWorkspace(
  ocAgentId: string,
  agent: Agent,
  userId: string
): Promise<string> {
  const workspacePath = getWorkspacePath(ocAgentId);

  // 确保目录存在
  fs.mkdirSync(workspacePath, { recursive: true });

  // 写入 SOUL.md
  await writeSoulMd(workspacePath, agent);

  // 写入 AGENTS.md
  await writeAgentsMd(workspacePath, agent, userId);

  // 写入 USER.md（minimal）
  await writeUserMd(workspacePath, userId);

  // 写入 IDENTITY.md
  await writeIdentityMd(workspacePath, agent);

  // 写入 TOOLS.md（空模板）
  await writeToolsMd(workspacePath);

  return workspacePath;
}

/**
 * 删除 workspace
 */
export async function removeWorkspace(ocAgentId: string): Promise<void> {
  const workspacePath = getWorkspacePath(ocAgentId);
  if (fs.existsSync(workspacePath)) {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  }
}

/**
 * 更新 workspace（智能体配置变更时调用）
 */
export async function updateWorkspace(
  ocAgentId: string,
  agent: Agent,
  userId: string
): Promise<void> {
  // 如果 workspace 不存在，先创建
  const workspacePath = getWorkspacePath(ocAgentId);
  if (!fs.existsSync(workspacePath)) {
    await createWorkspace(ocAgentId, agent, userId);
    return;
  }

  // 更新关键文件
  await writeSoulMd(workspacePath, agent);
  await writeIdentityMd(workspacePath, agent);
}

// ─────────────────────────────────────────────
// 文件生成函数
// ─────────────────────────────────────────────

async function writeSoulMd(workspacePath: string, agent: Agent): Promise<void> {
  const lines: string[] = [];

  lines.push(`# SOUL.md - ${agent.name}`);
  lines.push('');

  // 主 system prompt
  if (agent.systemPrompt) {
    lines.push(agent.systemPrompt);
    lines.push('');
  }

  // 写作风格
  if (agent.writingStyle) {
    lines.push(`## 写作风格`);
    lines.push(agent.writingStyle);
    lines.push('');
  }

  // 专业领域
  if (agent.expertise && agent.expertise.length > 0) {
    lines.push(`## 专业领域`);
    agent.expertise.forEach((e) => lines.push(`- ${e}`));
    lines.push('');
  }

  // 输出格式
  if (agent.outputFormat && agent.outputFormat !== '纯文本') {
    lines.push(`## 输出格式要求`);
    lines.push(agent.outputFormat);
    lines.push('');
  }

  // 能力边界
  if (agent.boundary) {
    lines.push(`## 能力边界`);
    lines.push(agent.boundary);
    lines.push('');
  }

  fs.writeFileSync(path.join(workspacePath, 'SOUL.md'), lines.join('\n'));
}

async function writeAgentsMd(workspacePath: string, agent: Agent, userId: string): Promise<void> {
  const content = `# AGENTS.md - ${agent.name} 工作规范

## 身份
- 名称: ${agent.name}
- 所属用户: ${userId}
- 创建时间: ${agent.createdAt}

## 工作区
这是你的工作目录。所有文件操作默认在此目录下进行。

## 行为规范
- 遵循 SOUL.md 中定义的人格和回答风格
- 工具使用参考 TOOLS.md
- 用户信息参考 USER.md

## 模型参数
- 模型: ${agent.modelName || '默认'}
- 温度: ${agent.temperature}
- 最大 Token: ${agent.maxTokens}
`;

  fs.writeFileSync(path.join(workspacePath, 'AGENTS.md'), content);
}

async function writeUserMd(workspacePath: string, userId: string): Promise<void> {
  const content = `# USER.md - 用户信息

- **用户 ID:** ${userId}
- **备注:** 该智能体属于 RepaceClaw 平台用户

## 注意
更多用户信息可在 RepaceClaw 平台中查看。
`;

  fs.writeFileSync(path.join(workspacePath, 'USER.md'), content);
}

async function writeIdentityMd(workspacePath: string, agent: Agent): Promise<void> {
  const content = `# IDENTITY.md

- **Name:** ${agent.name}
- **Role:** ${agent.description || agent.name}
- **Expertise:** ${(agent.expertise || []).join(', ')}
- **Vibe:** ${agent.writingStyle || 'professional'}
- **Emoji:** 🤖
`;

  fs.writeFileSync(path.join(workspacePath, 'IDENTITY.md'), content);
}

async function writeToolsMd(workspacePath: string): Promise<void> {
  const content = `# TOOLS.md - 工具备注

## 可用工具
- read: 读取文件
- write: 创建或覆盖文件
- edit: 精确编辑文件
- exec: 执行 shell 命令
- web_search: 网络搜索
- web_fetch: 抓取网页内容

## 本地备注
在此添加工具使用的本地化配置和备注。
`;

  fs.writeFileSync(path.join(workspacePath, 'TOOLS.md'), content);
}
