/**
 * Workspace 组件导出
 *
 * [2026-05-23] 迁移更新：新增 useFileTransfer hook 导出，
 * AgentPanel 改为 re-export（实际实现已拆分到 pages/ProjectWorkspace/AgentPanel/）
 */

export { SkillPanel } from './SkillPanel';
export { SchedulePanel } from './SchedulePanel';
export { ShortcutPanel } from './ShortcutPanel';
export { TagPanel, getTagColor, TAG_COLOR_POOL, PRESET_TAGS } from './TagPanel';
export { TaskTagPanel } from './TaskTagPanel';
export { AgentPanel, makeFlowNode, type FlowNode, type FlowNodeType } from './AgentPanel';
export { TabPanel } from './TabPanel';
export { PriorityModal } from './PriorityModal';
export { ChannelConfigModal } from './ChannelConfigModal';
export { FileTransferPanel } from './FileTransferPanel';
export { ChannelListPanel } from './ChannelListPanel';
export { useFileTransfer } from './useFileTransfer';

export {
  FUNCTION_TABS,
  CHANNEL_LIST,
  PRIORITY_OPTIONS,
  TAB_META,
  CHANNEL_TABS,
  CHANNEL_LABELS,
  getProgressColor,
  type ChannelType,
} from './constants';