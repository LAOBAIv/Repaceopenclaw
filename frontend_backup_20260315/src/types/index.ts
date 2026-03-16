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
}

export interface Project {
  id: string;
  title: string;
  description: string;
  tags: string[];
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  projectId: string | null;
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
  agentId: string;
  agentName: string;
  agentColor: string;
  messages: Message[];
  isStreaming: boolean;
  streamingMessageId?: string;
  streamingContent?: string;
}

/** Alias for ConversationPanel — used in UI components */
export type OpenPanel = ConversationPanel;


