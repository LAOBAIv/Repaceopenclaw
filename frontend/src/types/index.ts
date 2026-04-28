// Core types for the multi-agent platform
// 架构版本: v2 — taskId/sessionId 1:1 绑定，ID 编码规范化

export interface Agent {
  /** 8 位字母数字，同一用户下唯一 */
  id: string;
  name: string;
  color: string;
  systemPrompt: string;
  writingStyle: string;
  expertise: string[];
  description?: string;
  status?: "active" | "idle" | "busy";
  modelName?: string;
  modelProvider?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  tokenProvider?: string;
  tokenApiKey?: string;
  tokenBaseUrl?: string;
  outputFormat?: string;
  boundary?: string;
  memoryTurns?: number;
  temperatureOverride?: number | null;
  tokenUsed?: number;
  visibility?: 'private' | 'public' | 'template';
  skillsConfig?: Record<string, boolean>;
  quotaConfig?: {
    maxDailyTokens?: number;
    maxDailyConversations?: number;
    maxTokensPerMessage?: number;
  };
  createdAt: string;
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

/**
 * 会话（Session）
 * taskId 与 sessionId 严格 1:1，两者同值
 */
export interface Conversation {
  /** 会话 ID，格式同 taskId（21 位） */
  id: string;
  /** 关联任务 ID（= id，1:1 冗余便于查询） */
  taskId: string;
  projectId: string | null;
  /** 参与此会话的智能体 id 列表（≥1） */
  agentIds: string[];
  /** 当前正在对话的智能体 ID */
  currentAgentId: string;
  /** @deprecated 兼容字段，新代码使用 agentIds */
  agentId: string;
  title: string;
  createdAt: string;
}

export interface Message {
  /** taskId + 6 位序号（27 位），例: u5a9B2xK7m_04281200_a3000001 */
  id: string;
  /** 所属会话 ID（= taskId） */
  conversationId: string;
  role: "user" | "agent";
  content: string;
  /** 发送者 agentId（用户消息为空） */
  agentId?: string;
  createdAt: string;
  streaming?: boolean;
}

/** 前端会话面板（UI 层） */
export interface ConversationPanel {
  id: string;
  conversationId: string;
  agentId: string;
  agentIds: string[];
  agentName: string;
  agentColor: string;
  messages: Message[];
  isStreaming: boolean;
  streamingMessageId?: string;
  streamingContent?: string;
  systemBanner?: string;
}

export type OpenPanel = ConversationPanel;

export interface DocumentNode {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  content: string;
  nodeOrder: number;
  assignedAgentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentTemplate {
  id: string;
  name: string;
  category: string;
  emoji: string;
  color: string;
  vibe: string;
  description: string;
  systemPrompt: string;
  writingStyle: string;
  expertise: string[];
  outputFormat: string;
  githubSource: string;
  createdAt: string;
}
