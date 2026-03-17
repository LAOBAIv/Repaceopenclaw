// Core types for the multi-agent writing platform

export interface Agent {
  id: string;
  name: string;
  color: string;
  systemPrompt: string;
  writingStyle: string;
  expertise: string[];
  description?: string;
  status?: "active" | "idle" | "busy";
  createdAt: string;
  // CODE 模型参数
  modelName?: string;
  modelProvider?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  // 用户为该智能体配置的私有 Token 接入
  tokenProvider?: string;
  tokenApiKey?: string;
  tokenBaseUrl?: string;
  // 输出格式 & 能力边界
  outputFormat?: string;
  boundary?: string;
  // 对话记忆轮数（0 = 不限）
  memoryTurns?: number;
  // 简单温度快捷覆盖（null = 使用模型默认）
  temperatureOverride?: number | null;
}

export interface WorkflowNode {
  id: string;
  name: string;
  nodeType: 'serial' | 'parallel';
  agentIds: string[];
  taskDesc: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  tags: string[];
  status: "active" | "archived";
  goal?: string;
  priority?: 'high' | 'mid' | 'low';
  startTime?: string;
  endTime?: string;
  decisionMaker?: string;
  workflowNodes?: WorkflowNode[];
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  projectId: string | null;
  /** 参与此会话的智能体 id 列表（≥1） */
  agentIds: string[];
  /**
   * @deprecated 兼容字段：等于 agentIds[0]，新代码请使用 agentIds
   */
  agentId: string;
  title: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "agent";
  content: string;
  agentId?: string;
  createdAt: string;
  streaming?: boolean; // client-side only, for streaming state
}

export interface ConversationPanel {
  id: string; // panel id (= conversationId)
  conversationId: string;
  /** 当前面板"主" agentId（单智能体对话时即为唯一 agent；多智能体时为发起者） */
  agentId: string;
  /** 参与此会话的所有 agentIds */
  agentIds: string[];
  agentName: string;
  agentColor: string;
  messages: Message[];
  isStreaming: boolean;
  streamingMessageId?: string;
  streamingContent?: string;
  /** 协作任务启动提示，仅前端展示，不存库，用户可关闭 */
  systemBanner?: string;
}

/** Alias for ConversationPanel — used in UI components */
export type OpenPanel = ConversationPanel;


