/**
 * 项目页面工具函数
 */

/** 将 ISO 日期字符串格式化为中文本地时间 */
export function formatDate(iso: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
