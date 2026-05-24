import { v4 as uuidv4 } from "uuid";
import { getDb, saveDb } from "../db/client";
import { IdGenerator } from "../utils/IdGenerator";
import type { DbLike } from '../db/sqlite-compat'; // [2026-05-24] P1 修复

// [2026-05-24] P1 修复：使用统一 DbLike 接口
type BetterSqlite3Db = DbLike;

export type TaskColumn = "todo" | "progress" | "review" | "done";
export type TaskPriority = "high" | "mid" | "low";

export interface Task {
  id: string;
  /** 业务任务编码：21 位 */
  taskCode?: string;
  title: string;
  description: string;
  columnId: TaskColumn;
  priority: TaskPriority;
  tags: string[];
  agent: string;
  agentColor: string;
  /** NEW: precise agent UUID reference */
  agentId: string;
  dueDate: string;
  commentCount: number;
  fileCount: number;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// [2026-05-24] P1 修复：已迁移到顶部 type BetterSqlite3Db = DbLike

function execToRows(db: BetterSqlite3Db, sql: string, params?: unknown[]): Record<string, unknown>[] { // [2026-05-24] 类型安全
  const result = params ? db.exec(sql, params) : db.exec(sql);
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {}; // [2026-05-24] 类型安全：any → Record<string, unknown>
    cols.forEach((c: string, i: number) => (obj[c] = row[i]));
    return obj;
  });
}

// [2026-05-24] 类型安全：Record<string, unknown> 安全取值辅助
const rv = (r: Record<string, unknown>, k: string): string | undefined => r[k] as string | undefined;
const rn = (r: Record<string, unknown>, k: string): number | undefined => r[k] as number | undefined;

const rowToTask = (obj: Record<string, unknown>): Task => ({ // [2026-05-24] 类型安全
  id: rv(obj, 'id')!,
  taskCode: rv(obj, 'task_code') || undefined,
  title: rv(obj, 'title')!,
  description: rv(obj, 'description')!,
  columnId: rv(obj, 'column_id') as TaskColumn,
  priority: rv(obj, 'priority') as TaskPriority,
  tags: JSON.parse(rv(obj, 'tags') || "[]"),
  agent: rv(obj, 'agent') || "",
  agentColor: rv(obj, 'agent_color') || "#6366F1",
  agentId: rv(obj, 'agent_id') || "",
  dueDate: rv(obj, 'due_date') || "",
  commentCount: rn(obj, 'comment_count') || 0,
  fileCount: rn(obj, 'file_count') || 0,
  sortOrder: rn(obj, 'sort_order') || 0,
  createdBy: rv(obj, 'created_by') || null,
  createdAt: rv(obj, 'created_at')!,
  updatedAt: rv(obj, 'updated_at')!,
});

export const TaskService = {
  /** 获取所有任务，按列分组 */
  listGrouped(userId?: string): Record<TaskColumn, Task[]> {
    const db = getDb();
    let sql = "SELECT * FROM tasks";
    const params: unknown[] = []; // [2026-05-24] 类型安全
    if (userId) {
      sql += " WHERE user_id = ?";
      params.push(userId);
    }
    sql += " ORDER BY column_id, sort_order ASC";
    const rows = execToRows(db, sql, params.length ? params : undefined);
    const tasks = rows.map(rowToTask);
    const grouped: Record<TaskColumn, Task[]> = { todo: [], progress: [], review: [], done: [] };
    for (const t of tasks) grouped[t.columnId].push(t);
    return grouped;
  },

  /** 获取单列任务 */
  listByColumn(columnId: TaskColumn, userId?: string): Task[] {
    const db = getDb();
    let sql = "SELECT * FROM tasks WHERE column_id=?";
    const params: unknown[] = [columnId]; // [2026-05-24] 类型安全
    if (userId) {
      sql += " AND user_id = ?";
      params.push(userId);
    }
    sql += " ORDER BY sort_order ASC";
    const rows = execToRows(db, sql, params);
    return rows.map(rowToTask);
  },

  getById(id: string): Task | null {
    const db = getDb();
    const rows = execToRows(db, "SELECT * FROM tasks WHERE id=?", [id]);
    if (!rows.length) return null;
    return rowToTask(rows[0]);
  },

  /**
   * Dual-code Phase 2：接口层允许同时传 UUID 或 task_code。
   * task_code 当前是全局唯一，因此这里可直接解析。
   */
  getByIdOrCode(idOrCode: string): Task | null {
    const byId = this.getById(idOrCode);
    if (byId) return byId;
    const db = getDb();
    const rows = execToRows(db, "SELECT * FROM tasks WHERE task_code=?", [idOrCode]);
    if (!rows.length) return null;
    return rowToTask(rows[0]);
  },

  /** 将 UUID/task_code 统一解析成真实 UUID。 */
  resolveId(idOrCode: string): string | null {
    return this.getByIdOrCode(idOrCode)?.id || null;
  },

  create(data: {
    title: string;
    description?: string;
    columnId?: TaskColumn;
    priority?: TaskPriority;
    tags?: string[];
    agent?: string;
    agentColor?: string;
    agentId?: string;
    dueDate?: string;
    createdBy?: string;
    userId?: string;
  }): Task {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const col = data.columnId || "todo";
    // Compute sort order: max in column + 1
    const orderRows = execToRows(db, "SELECT MAX(sort_order) as m FROM tasks WHERE column_id=?", [col]);
    const sortOrder = ((orderRows[0]?.m as number) ?? -1) + 1; // [2026-05-24] 类型安全

    // Dual-code Phase 1：任务创建开始双写 UUID + taskCode。
    // taskCode 尽量挂在真实 user_code 下面，便于后续按用户维度检索/排障。
    const userCodeRow = data.userId ? execToRows(db, "SELECT user_code FROM users WHERE id=?", [data.userId])[0] : null;
    const taskCode = IdGenerator.taskCode((userCodeRow?.user_code as string) || IdGenerator.userCode()); // [2026-05-24] 类型安全

    db.run(
      `INSERT INTO tasks (id, task_code, title, description, column_id, priority, tags, agent, agent_color, agent_id, due_date, comment_count, file_count, sort_order, created_by, user_id, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        taskCode,
        data.title,
        data.description || "",
        col,
        data.priority || "mid",
        JSON.stringify(data.tags || []),
        data.agent || "",
        data.agentColor || "#6366F1",
        data.agentId || "",
        data.dueDate || "",
        0, 0,
        sortOrder,
        data.createdBy || null,
        data.userId || "",
        now, now,
      ]
    );
    saveDb();
    return {
      id, taskCode, title: data.title, description: data.description || "",
      columnId: col, priority: data.priority || "mid",
      tags: data.tags || [], agent: data.agent || "",
      agentColor: data.agentColor || "#6366F1",
      agentId: data.agentId || "",
      dueDate: data.dueDate || "",
      commentCount: 0, fileCount: 0,
      sortOrder, createdBy: data.createdBy || null, createdAt: now, updatedAt: now,
    };
  },

  update(id: string, data: Partial<{
    title: string;
    description: string;
    columnId: TaskColumn;
    priority: TaskPriority;
    tags: string[];
    agent: string;
    agentColor: string;
    agentId: string;
    dueDate: string;
    commentCount: number;
    fileCount: number;
    sortOrder: number;
    createdBy: string;
  }>): Task | null {
    const db = getDb();
    const existing = this.getById(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    const now = new Date().toISOString();
    db.run(
      `UPDATE tasks SET title=?, description=?, column_id=?, priority=?, tags=?, agent=?, agent_color=?, agent_id=?, due_date=?, comment_count=?, file_count=?, sort_order=?, created_by=?, updated_at=? WHERE id=?`,
      [
        updated.title, updated.description, updated.columnId, updated.priority,
        JSON.stringify(updated.tags), updated.agent, updated.agentColor, updated.agentId,
        updated.dueDate, updated.commentCount, updated.fileCount, updated.sortOrder,
        updated.createdBy || null,
        now, id,
      ]
    );
    saveDb();
    return { ...updated, updatedAt: now };
  },

  /** 批量更新排序（拖拽后调用） */
  reorder(items: Array<{ id: string; columnId: TaskColumn; sortOrder: number }>): void {
    const db = getDb();
    const now = new Date().toISOString();
    for (const item of items) {
      db.run(
        "UPDATE tasks SET column_id=?, sort_order=?, updated_at=? WHERE id=?",
        [item.columnId, item.sortOrder, now, item.id]
      );
    }
    saveDb();
  },

  delete(id: string): boolean {
    const db = getDb();
    db.run("DELETE FROM tasks WHERE id=?", [id]);
    saveDb();
    return true;
  },
};
