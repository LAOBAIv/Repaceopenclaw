/**
 * AgentBridge — RepaceClaw ↔ OpenClaw 桥接层
 *
 * 统一入口，导出所有桥接服务
 */

export {
  toOpenClawAgentId,
  fromOpenClawAgentId,
  getWorkspacePath,
  getAgentDir,
} from './AgentMapper';

export {
  createWorkspace,
  removeWorkspace,
  updateWorkspace,
} from './WorkspaceBuilder';

export {
  addAgent as syncAgentConfig,
  removeAgent as removeAgentConfig,
  updateAgentModel,
  addBinding,
  restartGateway,
  listRegisteredAgents,
} from './ConfigSync';

export {
  registerAgent,
  unregisterAgent,
  updateAgent,
  syncAllAgents,
} from './AgentRegistry';
