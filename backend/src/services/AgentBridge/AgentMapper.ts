/**
 * AgentMapper — RepaceClaw agent ↔ OpenClaw agentId 双向映射
 *
 * 策略：按业务类型（agent_type）映射到对应的 OpenClaw agent
 * 
 * 类型映射表：
 *   dev      → rc-dev-agent        开发/工程
 *   data     → rc-data-agent       数据分析
 *   creative → rc-creative-agent   内容/创作
 *   pm       → rc-pm-agent         产品/管理
 *   research → rc-research-agent   AI/研究
 *   ops      → rc-ops-agent        运营
 *   decision → rc-decision-agent   决策
 *   general  → rc-general-agent    通用/助手
 * 
 * 平台助手（repaceclaw-platform-assistant）独立存在，不走此映射。
 */

/**
 * 业务类型 → OpenClaw agentId 映射表
 */
const AGENT_TYPE_MAP: Record<string, string> = {
  dev: 'rc-dev-agent',
  data: 'rc-data-agent',
  creative: 'rc-creative-agent',
  pm: 'rc-pm-agent',
  research: 'rc-research-agent',
  ops: 'rc-ops-agent',
  decision: 'rc-decision-agent',
  general: 'rc-general-agent',
};

/**
 * 默认类型（未指定 agent_type 时使用）
 */
const DEFAULT_AGENT_TYPE = 'general';

/**
 * 将 RepaceClaw 业务智能体映射到 OpenClaw agentId
 * 
 * @param agentType 业务类型（dev/data/creative/pm/research/ops/decision/general）
 * @returns OpenClaw agentId
 */
export function toOpenClawAgentId(agentType?: string): string {
  const type = agentType || DEFAULT_AGENT_TYPE;
  return AGENT_TYPE_MAP[type] || AGENT_TYPE_MAP[DEFAULT_AGENT_TYPE];
}

/**
 * 从 OpenClaw agentId 反推业务类型
 */
export function fromOpenClawAgentId(ocAgentId: string): string | null {
  for (const [type, id] of Object.entries(AGENT_TYPE_MAP)) {
    if (id === ocAgentId) return type;
  }
  return null;
}

/**
 * 获取对应类型智能体的工作区路径
 */
export function getWorkspacePath(ocAgentId: string): string {
  return `/root/.openclaw/agents/${ocAgentId}/agent`;
}

/**
 * 获取对应类型智能体的 agent 目录
 */
export function getAgentDir(ocAgentId: string): string {
  return `/root/.openclaw/agents/${ocAgentId}/agent`;
}

/**
 * 获取所有 OpenClaw agentId 列表
 */
export function getAllOpenClawAgentIds(): string[] {
  return Object.values(AGENT_TYPE_MAP);
}

/**
 * 获取所有业务类型列表
 */
export function getAllAgentTypes(): string[] {
  return Object.keys(AGENT_TYPE_MAP);
}
