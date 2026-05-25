// [2026-05-18] conversationStore 模块入口
// [2026-05-25] 重构：conversationStore.ts (1432 行) 拆分为多模块
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
export { useConversationStore } from './store';
export {
  getWsInstance,
  subscribeConversationWs,
  sendConversationMessageOverWs,
} from './wsUtils';
