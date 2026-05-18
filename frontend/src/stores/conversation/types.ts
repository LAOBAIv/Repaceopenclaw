// [2026-05-18] 从 conversationStore.ts 拆分出类型定义
import { Message } from '../../types';

export interface ConversationPanel {
  id: string;
  conversationId: string;
  /** 会话业务编码,展示/排障优先用它 */
  sessionCode?: string;
  /** 当前面板"主"agentId */
  agentId: string;
  /** 当前智能体业务编码 */
  currentAgentCode?: string;
  /** 参与此会话的所有 agentIds */
  agentIds: string[];
  agentName: string;
  agentColor: string;
  messages: Message[];
  isStreaming: boolean;
  streamingMessageId?: string;
  streamingContent?: string;
  /** 协作任务启动提示,仅前端展示,不存库,用户可关闭 */
  systemBanner?: string;
  /** 会话类型：general（普通）| wechat_assistant（微信助手） */
  conversationType?: 'general' | 'wechat_assistant';
}

/** 顶部会话 Tab 数据结构 - 唯一 Tab 数据源 */
export interface SessionTab {
  /** 唯一 id:'home' 或 conversationId */
  id: string;
  /** Tab 类型 */
  type: 'home' | 'session' | 'wechat';
  /** Tab 标题(智能体名称、项目名称或"新会话 N") */
  title: string;
  /** 绑定的会话 panel id(home/wechat tab 为 null) */
  panelId: string | null;
  /** Tab 颜色(智能体颜色,home tab 无) */
  color?: string;
  /** 是否正在 streaming */
  isStreaming?: boolean;
  /** 绑定的会话 ID(与 panelId 相同,冗余字段便于查询) */
  conversationId?: string;
  /** 会话业务编码 */
  sessionCode?: string;
  /** 关联的智能体 ID */
  agentId?: string;
  /** 当前智能体业务编码 */
  currentAgentCode?: string;
  /** 关联的智能体名称 */
  agentName?: string;
  /** 关联的智能体颜色 */
  agentColor?: string;
  /** 最近一次改名前的标题,用于把“旧标题 -> 新标题”的变化带给后端上下文 */
  previousTitle?: string;
}
