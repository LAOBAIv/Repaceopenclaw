/**
 * AgentPanel/constants — AgentPanel 子组件共享类型与常量
 *
 * 职责：重新导出 FlowNode 相关类型/工具函数及可用模型列表，
 * 供 AgentPanel 子组件统一引用，避免跨目录 import。
 */
export { makeFlowNode, AVAILABLE_MODELS } from '../types';
export type { FlowNode, FlowNodeType, BrowserTab } from '../types';
