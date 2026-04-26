/**
 * AgentMapper — RepaceClaw userId:agentId ↔ OpenClaw agentId 双向映射
 *
 * 命名规则:
 *   OpenClaw agentId = "rc_{userId}_{agentId}"
 *   rc = RepaceClaw 前缀，避免与 OpenClaw 原生 agent 冲突
 */

const OC_PREFIX = 'rc';

/**
 * 将 RepaceClaw 的 userId + agentId 转换为 OpenClaw agentId
 */
export function toOpenClawAgentId(userId: string, agentId: string): string {
  return `${OC_PREFIX}_${userId}_${agentId}`;
}

/**
 * 从 OpenClaw agentId 解析出 userId 和 agentId
 * @returns null 如果不是 RepaceClaw 管理的 agent
 */
export function fromOpenClawAgentId(ocAgentId: string): { userId: string; agentId: string } | null {
  if (!ocAgentId.startsWith(`${OC_PREFIX}_`)) return null;

  const parts = ocAgentId.split('_');
  if (parts.length < 3) return null;

  // rc_{userId}_{agentId} — userId 和 agentId 都可能包含下划线
  // 约定: rc_ 后面第一段是 userId，剩余部分是 agentId
  const userId = parts[1];
  const agentId = parts.slice(2).join('_');

  return { userId, agentId };
}

/**
 * 生成 workspace 路径
 */
export function getWorkspacePath(ocAgentId: string): string {
  return `/root/.openclaw/workspace-${ocAgentId}`;
}

/**
 * 生成 agentDir 路径
 */
export function getAgentDir(ocAgentId: string): string {
  return `/root/.openclaw/agents/${ocAgentId}/agent`;
}
