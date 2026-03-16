import { Router, Request, Response } from "express";
import { getDb } from "../db/client";

const router = Router();

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

/**
 * P1-5: GET /api/search?q=关键词
 * Cross-table fuzzy search across agents, projects, tasks, documents.
 * Returns: { agents: [], projects: [], tasks: [], documents: [] }
 */
router.get("/", (req: Request, res: Response) => {
  const q = ((req.query.q as string) || "").trim();
  if (!q) {
    return res.json({ data: { agents: [], projects: [], tasks: [], documents: [] } });
  }

  const db = getDb();
  const like = `%${q}%`;

  const agents = execToRows(db,
    `SELECT id, name, description, status, color FROM agents WHERE name LIKE ? OR description LIKE ? ORDER BY created_at DESC LIMIT 20`,
    [like, like]
  ).map(r => ({ id: r.id, name: r.name, description: r.description, status: r.status, color: r.color }));

  const projects = execToRows(db,
    `SELECT id, title, description, status, priority FROM projects WHERE title LIKE ? OR description LIKE ? OR goal LIKE ? ORDER BY updated_at DESC LIMIT 20`,
    [like, like, like]
  ).map(r => ({ id: r.id, title: r.title, description: r.description, status: r.status, priority: r.priority }));

  const tasks = execToRows(db,
    `SELECT id, title, description, column_id, priority FROM tasks WHERE title LIKE ? OR description LIKE ? ORDER BY created_at DESC LIMIT 20`,
    [like, like]
  ).map(r => ({ id: r.id, title: r.title, description: r.description, columnId: r.column_id, priority: r.priority }));

  const documents = execToRows(db,
    `SELECT id, project_id, title, content FROM documents WHERE title LIKE ? OR content LIKE ? ORDER BY updated_at DESC LIMIT 20`,
    [like, like]
  ).map(r => ({ id: r.id, projectId: r.project_id, title: r.title, contentPreview: (r.content || "").slice(0, 120) }));

  res.json({ data: { agents, projects, tasks, documents } });
});

export default router;
