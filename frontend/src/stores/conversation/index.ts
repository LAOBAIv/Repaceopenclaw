// [2026-05-18] conversationStore 模块入口
// [2026-05-23] 迁移清理：删除本地 conversationStore.ts（1,600 行旧版本），
// 改为从上层 stores/conversationStore.ts（1,434 行在用版本）re-export
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
} from '../conversationStore';
