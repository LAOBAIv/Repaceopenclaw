/**
 * RepaceClaw ID 生成器
 *
 * 编码规则：
 * userId:          10 位随机字母数字
 * taskId:          userId + _ + 8位时间戳(秒) + _ + 2位随机码  = 21 位
 * sessionId:       = taskId  = 21 位
 * agentId:         8 位随机字母数字
 * messageId:       taskId + 6位序号  = 27 位
 * currentAgentId:  taskId + agentId  = 29 位
 */

const ALPHANUM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LOWER_ALPHA_NUM = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** 生成 n 位随机字母数字 */
function randomStr(n: number, charset = ALPHANUM): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += charset[Math.floor(Math.random() * charset.length)];
  }
  return s;
}

/** 8 位时间戳（秒级，从 2025-01-01 起算，约可用到 2056 年） */
function shortTimestamp(): string {
  const base = 1735689600; // 2025-01-01 00:00:00 UTC
  const now = Math.floor(Date.now() / 1000) - base;
  return now.toString(36).padStart(8, '0');
}

/** 生成 userId（10 位） */
export function generateUserId(): string {
  return randomStr(10);
}

/** 生成 taskId（21 位） */
export function generateTaskId(userId: string): string {
  return `${userId}_${shortTimestamp()}_${randomStr(2)}`;
}

/** sessionId = taskId */
export function getSessionId(taskId: string): string {
  return taskId;
}

/** 生成 agentId（8 位小写+数字，便于阅读） */
export function generateAgentId(): string {
  return randomStr(8, LOWER_ALPHA_NUM);
}

/** 生成 messageId（27 位） */
export function generateMessageId(taskId: string, seq: number): string {
  return `${taskId}${seq.toString().padStart(6, '0')}`;
}

/** 生成 currentAgentId（29 位） */
export function generateCurrentAgentId(taskId: string, agentId: string): string {
  return `${taskId}${agentId}`;
}

/** 从 messageId 提取 taskId（前 21 位） */
export function getTaskIdFromMessageId(messageId: string): string {
  return messageId.slice(0, 21);
}

/** 从 messageId 提取序号（后 6 位） */
export function getSeqFromMessageId(messageId: string): number {
  return parseInt(messageId.slice(21), 10);
}

/** 从 currentAgentId 提取 agentId（后 8 位） */
export function getAgentIdFromCurrentAgentId(currentAgentId: string): string {
  return currentAgentId.slice(21);
}
