/**
 * 消息格式转换 — 从 iLink 消息格式提取文本内容
 */

/**
 * 从 iLink 消息对象中提取用户消息文本
 * - type 1: 文本消息，提取 text_item.text
 * - type 2: 图片消息，标记为 [图片]
 */
export function extractMessageText(msg: unknown): string {
  const msgObj = msg as Record<string, unknown>;
  let userText = '';
  const items = (msgObj.item_list as Record<string, unknown>[]) || [];
  for (const item of items) {
    const itemObj = item as Record<string, unknown>;
    if ((itemObj.type as number) === 1 && (itemObj.text_item as Record<string, unknown>)?.text) {
      userText += (itemObj.text_item as Record<string, unknown>).text as string;
    } else if ((itemObj.type as number) === 2) {
      userText += '[图片]';
    }
  }
  return userText;
}

/**
 * 从 iLink 消息对象中提取创建时间
 */
export function extractMessageTimestamp(msg: unknown): string {
  const msgObj = msg as Record<string, unknown>;
  return (msgObj.create_time_ms as number)
    ? new Date(msgObj.create_time_ms as number).toISOString()
    : new Date().toISOString();
}
