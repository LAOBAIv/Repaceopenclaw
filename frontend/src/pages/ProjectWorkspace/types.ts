// [2026-05-18] 从 ProjectWorkspace.tsx 拆分出的共享类型和工具函数
export type FlowNodeType = 'serial' | 'parallel';

export interface FlowNode {
  id: string;
  name: string;
  nodeType: FlowNodeType;
  agentIds: string[];
  desc: string;
}

export function makeFlowNode(idx: number): FlowNode {
  return { id: `fn_${Date.now()}_${idx}`, name: `流程节点 ${idx + 1}`, nodeType: 'serial', agentIds: [], desc: '' };
}

export interface BrowserTab {
  key: string;
  title: string;
  conversationId?: string;
  agentId?: string;
  agentName?: string;
  color?: string;
}

export const AVAILABLE_MODELS = [
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', provider: 'anthropic' },
  { id: 'glm-5', label: 'GLM-5', provider: 'zhipu' },
  { id: 'glm-5.1', label: 'GLM-5.1', provider: 'zhipu' },
  { id: 'qwen3-max-2026-01-23', label: 'Qwen3 Max', provider: 'alibaba' },
  { id: 'qwen3.6-plus', label: 'Qwen3.6 Plus', provider: 'alibaba' },
  { id: 'kimi-k2.5', label: 'Kimi K2.5', provider: 'moonshot' },
  { id: 'minimax-m2.5', label: 'MiniMax M2.5', provider: 'minimax' },
  { id: 'doubao-pro-32k', label: 'Doubao Pro 32K', provider: 'doubao' },
  { id: 'qwen-max', label: 'Qwen Max', provider: 'alibaba' },
  { id: 'auto', label: '自动选择', provider: 'auto' },
];
