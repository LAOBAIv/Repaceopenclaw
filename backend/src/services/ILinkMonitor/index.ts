/**
 * ILinkMonitor — iLink 微信消息长轮询
 *
 * 链路：微信bot → iLink → RC(long-poll) → OC Gateway(AI) → RC → iLink → 微信bot
 */
export { ILinkConfig, loadConfig, loadSyncBuf, saveSyncBuf, getAppId, buildBaseInfo } from './config';
export { getUpdates, sendMessage, sendTyping, getConfig, downloadImageAsBase64 } from './api';
export { handleIncomingMessage } from './handler';
export { startILinkMonitor, stopILinkMonitor, getILinkStatus, updatePollStatus } from './poll';

// 兼容旧版命名空间导出
import { startILinkMonitor, stopILinkMonitor } from './poll';
import { sendMessage, sendTyping } from './api';
import { getILinkStatus } from './poll';

export const ILinkMonitor = {
  start: startILinkMonitor,
  stop: stopILinkMonitor,
  sendMessage,
  sendTyping,
  getStatus: getILinkStatus,
};
