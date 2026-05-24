/**
 * GroupChat 类型定义
 * 定义消息和智能体的数据结构
 */

/** 聊天消息 */
export interface Message {
  id: string;
  senderType: 'human' | 'agent';
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

/** 智能体 */
export interface Agent {
  id: string;
  name: string;
  avatar: string;
}
