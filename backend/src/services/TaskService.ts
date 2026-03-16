import { v4 as uuidv4 } from "uuid";
import { getDb, saveDb } from "../db/client";

export type TaskColumn = "todo" | "progress" | "review" | "done";
export type TaskPriority = "high" | "mid" | "low";

export interface Task {
  id: string;
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
  createdAt: string;
  updatedAt: string;
}

function execToRows(db: any, sql: string, params?: any[]): any[] {
  const result = params ? db.exec(sql, params) : db.exec(sql);
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map((row: any[]) => {
    const obj: any = {};
    cols.forEach((c: string, i: number) => (obj[c] = row[i]));
    return obj;
  });
}

const rowToTask = (obj: any): Task => ({
  id: obj.id,
  title: obj.title,
  description: obj.description,
  columnId: obj.column_id as TaskColumn,
  priority: obj.priority as TaskPriority,
  tags: JSON.parse(obj.tags || "[]"),
  agent: obj.agent || "",
  agentColor: obj.agent_color || "#6366F1",
  agentId: obj.agent_id || "",
  dueDate: obj.due_date || "",
  commentCount: obj.comment_count || 0,
  fileCount: obj.file_count || 0,
  sortOrder: obj.sort_order || 0,
  createdAt: obj.created_at,
  updatedAt: obj.updated_at,
});

export const TaskService = {
  /** 获取所有任务，按列分组 */
  listGrouped(): Record<TaskColumn, Task[]> {
    const db = getDb();
    const rows = execToRows(db, "SELECT * FROM tasks ORDER BY column_id, sort_order ASC");
    const tasks = rows.map(rowToTask);
    const grouped: Record<TaskColumn, Task[]> = { todo: [], progress: [], review: [], done: [] };
    for (const t of tasks) grouped[t.columnId].push(t);
    return grouped;
  },

  /** 获取单列任务 */
  listByColumn(columnId: TaskColumn): Task[] {
    const db = getDb();
    const rows = execToRows(db, "SELECT * FROM tasks WHERE column_id=? ORDER BY sort_order ASC", [columnId]);
    return rows.map(rowToTask);
  },

  getById(id: string): Task | null {
    const db = getDb();
    const rows = execToRows(db, "SELECT * FROM tasks WHERE id=?", [id]);
    if (!rows.length) return null;
    return rowToTask(rows[0]);
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
  }): Task {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const col = data.columnId || "todo";
    // Compute sort order: max in column + 1
    const orderRows = execToRows(db, "SELECT MAX(sort_order) as m FROM tasks WHERE column_id=?", [col]);
    const sortOrder = (orderRows[0]?.m ?? -1) + 1;

    db.run(
      `INSERT INTO tasks (id, title, description, column_id, priority, tags, agent, agent_color, agent_id, due_date, comment_count, file_count, sort_order, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
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
        now, now,
      ]
    );
    saveDb();
    return {
      id, title: data.title, description: data.description || "",
      columnId: col, priority: data.priority || "mid",
      tags: data.tags || [], agent: data.agent || "",
      agentColor: data.agentColor || "#6366F1",
      agentId: data.agentId || "",
      dueDate: data.dueDate || "",
      commentCount: 0, fileCount: 0,
      sortOrder, createdAt: now, updatedAt: now,
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
  }>): Task | null {
    const db = getDb();
    const existing = this.getById(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    const now = new Date().toISOString();
    db.run(
      `UPDATE tasks SET title=?, description=?, column_id=?, priority=?, tags=?, agent=?, agent_color=?, agent_id=?, due_date=?, comment_count=?, file_count=?, sort_order=?, updated_at=? WHERE id=?`,
      [
        updated.title, updated.description, updated.columnId, updated.priority,
        JSON.stringify(updated.tags), updated.agent, updated.agentColor, updated.agentId,
        updated.dueDate, updated.commentCount, updated.fileCount, updated.sortOrder,
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
