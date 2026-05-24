/**
 * MobileChatMessages 工具函数
 *
 * 包含消息时间格式化、头像首字母获取等辅助函数。
 */

/** 将 ISO 时间字符串格式化为 HH:MM */
export function formatMessageTime(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

/** 获取名称首字母，用于头像显示 */
export function getInitial(name?: string): string {
  if (!name) return 'A';
  return name.charAt(0);
}
