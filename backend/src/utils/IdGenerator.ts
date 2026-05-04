/**
 * RepaceClaw 业务编码生成器（双编码方案）
 *
 * 重要：
 * - UUID 负责“底层主键 / 外键关联”
 * - 本文件负责“业务编码 *_code”
 *
 * 当前约定：
 * - userCode:            u + 9位随机 = 10位
 * - taskCode/sessionCode userCode + '_' + 8位时间戳 + '_' + 2位随机码 = 21位
 * - agentCode:           8位字母数字
 * - messageCode:         taskCode + 6位序号 = 27位
 * - currentAgentCode:    taskCode + agentCode = 29位
 *
 * 注意：
 * 1. 这里生成的是“业务编码”，不是数据库主键。
 * 2. 现网仍存在历史 UUID / 旧紧凑编码混用数据，迁移期间需要同时兼容。
 * 3. 后续涉及 ID 规则的问题，以“UUID 做底层主键，短编码做业务主键”为准。
 */

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomString(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
  }
  return result;
}

/** 生成 8 位时间戳（MMDDHHmm） */
function timestamp8(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `${mm}${dd}${hh}${mi}`;
}

export const IdGenerator = {
  /** userCode — 10 位业务用户编码（u + 9 位随机） */
  userCode(): string {
    return 'u' + randomString(9);
  },

  /**
   * 兼容旧命名：userId() 现在等价于 userCode()。
   * 新代码应优先使用 userCode()，避免和 UUID 主键字段 user.id 混淆。
   */
  userId(): string {
    return this.userCode();
  },

  /** taskCode / sessionCode — 21 位业务任务/会话编码 */
  taskCode(userCode: string): string {
    return `${userCode}_${timestamp8()}_${randomString(2)}`;
  },

  /** 兼容旧命名：taskId() 现在等价于 taskCode() */
  taskId(userId: string): string {
    return this.taskCode(userId);
  },

  /** agentCode — 8 位业务智能体编码 */
  agentCode(): string {
    return randomString(8);
  },

  /** 兼容旧命名：agentId() 现在等价于 agentCode() */
  agentId(): string {
    return this.agentCode();
  },

  /** messageCode — taskCode + 6 位序号 */
  messageCode(taskCode: string, sequence: number): string {
    return `${taskCode}${String(sequence).padStart(6, '0')}`;
  },

  /** 兼容旧命名：messageId() 现在等价于 messageCode() */
  messageId(taskId: string, sequence: number): string {
    return this.messageCode(taskId, sequence);
  },

  /** currentAgentCode — taskCode + agentCode */
  currentAgentCode(taskCode: string, agentCode: string): string {
    return `${taskCode}${agentCode}`;
  },

  /** 验证 ID 格式 */
  validate: {
    userId(id: string): boolean {
      return /^u[A-Za-z0-9]{9}$/.test(id);
    },
    taskId(id: string): boolean {
      return /^[A-Za-z0-9]{10}_[0-9]{8}_[A-Za-z0-9]{2}$/.test(id);
    },
    agentCode(id: string): boolean {
      return /^[A-Za-z0-9]{8}$/.test(id);
    },
    agentId(id: string): boolean {
      return this.agentCode(id);
    },
    messageId(id: string): boolean {
      return /^[A-Za-z0-9]{10}_[0-9]{8}_[A-Za-z0-9]{2}[0-9]{6}$/.test(id);
    },
  },
};
