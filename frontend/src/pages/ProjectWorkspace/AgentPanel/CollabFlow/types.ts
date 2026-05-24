/**
 * CollabFlow/types — 协作流程组件类型定义
 *
 * 职责：定义 CollabFlow 组件的 Props 接口。
 */
import type { Agent, ConversationPanel } from '@/types';
import type { FlowNode } from '../../types';

/** CollabFlow 组件 Props */
export interface CollabFlowProps {
  /** 协作流程节点列表 */
  nodes: FlowNode[];
  /** 节点列表 setter */
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  /** 全部可用智能体 */
  allAgents: Agent[];
  /** 已打开的面板 */
  openPanels: ConversationPanel[];
  /** 当前是否为项目模式 */
  isProject: boolean;
  /** 切换到指定面板 */
  onSwitchPanel: (panelId: string) => void;
  /** 打开新面板 */
  onOpenPanel: (agentId: string, agentName: string, agentColor: string, initialMessage?: string) => void;
  /** 关闭面板 */
  onClosePanel: (panelId: string) => void;
  /** 升级为项目回调 */
  onUpgradeToProject?: (newAgentNames: string[]) => void;
}
