/**
 * WechatClawBot 类型定义
 * 包含所有接口和类型声明
 */

export type WsState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
export type SubTab = 'overview' | 'conversations' | 'push' | 'sync';

export interface StatusData {
  wsConnection: WsState;
  channelStatus: Record<string, unknown>; // [2026-05-24] 类型安全
  timestamp: string;
}

export interface ScanStatus {
  status: 'wait' | 'scaned' | 'confirmed' | 'expired';
  credentials?: {
    bot_token: string;
    ilink_bot_id: string;
    ilink_user_id: string;
  };
  baseurl?: string;
}

export interface BoundAccount {
  accountId: string;
  userId: string;
  hasToken: boolean;
  savedAt: string;
  rcUsername?: string;
  rcNickname?: string;
  rcDepartment?: string;
}

export interface Conversation {
  id: string;
  title: string;
  oc_session_key: string;
  created_at: string;
  last_message_at: string;
  status: string;
  username?: string;
}

export interface Message {
  id: string;
  role: string;
  content: string;
  token_count: number;
  created_at: string;
}

export interface SyncState {
  accountId: string;
  lastSync: string;
  messageCount: number;
  status: string;
}

export type QrType = 'image_base64' | 'image_url' | 'web_link';
