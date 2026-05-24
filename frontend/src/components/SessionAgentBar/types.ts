/**
 * SessionAgentBar 类型定义
 * 包含组件 Props 和内部状态类型
 */

/** 参与智能体信息 */
export interface Participant {
  id: string;
  name: string;
  color: string;
}

/** 会话变更回调参数 */
export interface ConversationChange {
  id: string;
  agentIds: string[];
  currentAgentId: string;
  agentId: string;
}

/** SessionAgentBar 组件 Props */
export interface SessionAgentBarProps {
  conversationId: string;
  participants: Participant[];
  onParticipantsChange?: (conversation?: ConversationChange) => void;
  isWechatAssistant?: boolean;
}

/** 微信绑定状态 */
export interface WechatBinding {
  bound: boolean;
  wechatOpenid?: string;
  boundAt?: string;
}

/** 模型选项 */
export interface ModelOption {
  id: string;
  label: string;
}
