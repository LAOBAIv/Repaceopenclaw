// [2026-05-18] conversationStore 模块入口
export type { ConversationPanel, SessionTab } from './types';
export {
  PLATFORM_ASSISTANT_IDS,
  WECHAT_ASSISTANT_IDS,
  isPlatformAssistantAgent,
  isWechatAssistantAgent,
  isGlobalAssistantConversationLike,
  resolveConversationCurrentAgent,
  resolveConversationAgentIds,
  isConversationNotFoundError,
} from './helpers';
export {
  useConversationStore,
  getWsInstance,
  subscribeConversationWs,
  sendConversationMessageOverWs,
} from './conversationStore';
