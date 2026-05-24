/**
 * MobileMultiAgentPanel 类型定义
 *
 * 包含 FlowNode 接口、makeFlowNode 工厂函数以及组件 Props 接口。
 */
import React from 'react';

/** 协作流程节点 */
export interface FlowNode {
  id: string;
  name: string;
  nodeType: 'serial' | 'parallel';
  agentIds: string[];
  desc: string;
}

/** 创建一个新的 FlowNode 实例 */
export function makeFlowNode(idx: number): FlowNode {
  return { id: `fn_${Date.now()}_${idx}`, name: '', nodeType: 'serial', agentIds: [], desc: '' };
}

/** 移动端多智能体协作面板 Props */
export interface MobileMultiAgentPanelProps {
  agents: Array<{ id: string; name: string; color?: string }>; // [2026-05-24] 类型安全
  currentAgentIds?: string[];
  currentAgentId?: string;
  collabNodes: FlowNode[];
  setCollabNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  isProject?: boolean;
  onInject?: (text: string) => void;
  onSwitchAgent?: (agentId: string, agentName: string, agentColor: string) => void;
}

/** 智能体选择器（底部弹框）Props */
export interface MobileAgentPickerProps {
  agents: Array<{ id: string; name: string; color?: string }>; // [2026-05-24] 类型安全
  selected: string[];
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}
