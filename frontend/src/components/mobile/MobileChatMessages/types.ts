/**
 * MobileChatMessages 类型定义
 *
 * 提取自 MobileChatMessages.tsx，包含消息数据结构与组件 props 接口。
 */
import React from 'react';

/** 单条聊天消息 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  agentId?: string;
  createdAt?: string;
  streaming?: boolean;
  agentName?: string;
  agentColor?: string;
  modelName?: string;
}

/** MobileChatMessages 主组件 props */
export interface MobileChatMessagesProps {
  messages: ChatMessage[];
  defaultAgentName?: string;
  defaultAgentColor?: string;
  defaultModelName?: string;
  showAvatar?: boolean;
  showTime?: boolean;
  emptyPlaceholder?: React.ReactNode;
  className?: string;
  /** 当前面板是否活跃（活跃时自动滚到底部） */
  isActive?: boolean;
}

/** MobileMessageRow 单条消息行 props */
export interface MobileMessageRowProps {
  msg: ChatMessage;
  defaultAgentName?: string;
  defaultAgentColor?: string;
  defaultModelName?: string;
  showAvatar?: boolean;
  showTime?: boolean;
}
