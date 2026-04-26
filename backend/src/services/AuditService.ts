import { v4 as uuidv4 } from "uuid";
import { logger } from '../utils/logger';
import { getDb, saveDb } from "../db/client";

export interface AuditLogInput {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  detail?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export const AuditService = {
  /** 记录审计日志 */
  log(input: AuditLogInput): void {
    try {
      const db = getDb();
      const id = uuidv4();
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO audit_logs (id, user_id, action, resource, resource_id, detail, ip_address, user_agent, request_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.userId,
          input.action,
          input.resource,
          input.resourceId || null,
          JSON.stringify(input.detail || {}),
          input.ipAddress || null,
          input.userAgent || null,
          input.requestId || null,
          now,
        ]
      );
      saveDb();
    } catch (err) {
      logger.error("[AuditService] Failed to log audit:", err);
    }
  },

  /** 获取审计日志（管理员） */
  list(options: { userId?: string; resource?: string; limit?: number; offset?: number } = {}) {
    const db = getDb();
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    let sql = "SELECT * FROM audit_logs";
    const params: any[] = [];
    const conditions: string[] = [];

    if (options.userId) {
      conditions.push("user_id = ?");
      params.push(options.userId);
    }
    if (options.resource) {
      conditions.push("resource = ?");
      params.push(options.resource);
    }

    if (conditions.length) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const result = db.exec(sql, params);
    if (!result.length) return [];
    const cols = result[0].columns;
    return result[0].values.map((row) => {
      const obj: any = {};
      cols.forEach((c, i) => (obj[c] = row[i]));
      return obj;
    });
  },
};
