/**
 * MobileChatMessages 导出入口
 *
 * 此文件作为兼容层，将导入转发到 MobileChatMessages/ 目录下的拆分模块。
 * 外部消费者无需修改 import 路径。
 */
export { MobileChatMessages, default } from './MobileChatMessages/index';
export type { ChatMessage, MobileChatMessagesProps, MobileMessageRowProps } from './MobileChatMessages/types';
