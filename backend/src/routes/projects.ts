import { Router, Request, Response } from "express";
import { ProjectService, WorkflowNode } from "../services/ProjectService";
import { getDb, saveDb } from "../db/client";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { ensureOwnership } from "../middleware/ownership";

const router = Router();

const WorkflowNodeSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  nodeType: z.enum(["serial", "parallel"]),
  agentIds: z.array(z.string()).default([]),
  taskDesc: z.string().default(""),
});

const ProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  tags: z.array(z.string()).default([]),
  status: z.enum(["active", "archived"]).optional(),
  // Workflow fields (from AgentConsole)
  goal: z.string().optional(),
  priority: z.enum(["high", "mid", "low"]).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  decisionMaker: z.string().optional(),
  workflowNodes: z.array(WorkflowNodeSchema).optional(),
  createdBy: z.string().optional(),
});

const DocumentSchema = z.object({
  parentId: z.string().optional(),
  title: z.string().min(1),
});

const DocumentUpdateSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  assignedAgentIds: z.array(z.string()).optional(),
  parentId: z.string().nullable().optional(),
  order: z.number().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: Static-prefixed routes (/documents/...) MUST be registered BEFORE
// dynamic-segment routes (/:id) to prevent Express from swallowing "documents"
// as an :id param.
// ─────────────────────────────────────────────────────────────────────────────

// ── Document version history (P1-3) ─────────────────────────────────────────
// Must be before /documents/:docId to avoid Express mis-routing "versions" as docId

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

/** GET /api/projects/documents/:docId/versions — 获取文档历史版本列表 */
router.get("/documents/:docId/versions", authenticate, (req: Request, res: Response) => {
  const db = getDb();
  const rows = execToRows(db, "SELECT id, document_id, snapshot_at FROM document_versions WHERE document_id=? ORDER BY snapshot_at DESC", [req.params.docId]);
  res.json({ data: rows.map(r => ({ id: r.id, documentId: r.document_id, snapshotAt: r.snapshot_at })) });
});

/** POST /api/projects/documents/:docId/versions — 手动创建版本快照 */
router.post("/documents/:docId/versions", authenticate, (req: Request, res: Response) => {
  const db = getDb();
  // Get current document content
  const docRows = execToRows(db, "SELECT content FROM documents WHERE id=?", [req.params.docId]);
  if (!docRows.length) return res.status(404).json({ error: "Document not found" });
  const content = docRows[0].content || "";
  const id = uuidv4();
  const now = new Date().toISOString();
  db.run("INSERT INTO document_versions (id, document_id, content, snapshot_at) VALUES (?,?,?,?)",
    [id, req.params.docId, content, now]);
  saveDb();
  res.status(201).json({ data: { id, documentId: req.params.docId, snapshotAt: now } });
});

/** GET /api/projects/documents/:docId/versions/:versionId — 获取特定版本内容 */
router.get("/documents/:docId/versions/:versionId", authenticate, (req: Request, res: Response) => {
  const db = getDb();
  const rows = execToRows(db, "SELECT * FROM document_versions WHERE id=? AND document_id=?", [req.params.versionId, req.params.docId]);
  if (!rows.length) return res.status(404).json({ error: "Version not found" });
  const r = rows[0];
  res.json({ data: { id: r.id, documentId: r.document_id, content: r.content, snapshotAt: r.snapshot_at } });
});

// ── Document node CRUD (static prefix) ──────────────────────────────────────
router.put("/documents/:docId", authenticate, (req: Request, res: Response) => {
  const parsed = DocumentUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const doc = ProjectService.updateDocument(req.params.docId, parsed.data);
  if (!doc) return res.status(404).json({ error: "Document not found" });
  res.json({ data: doc });
});

router.delete("/documents/:docId", authenticate, (req: Request, res: Response) => {
  ProjectService.deleteDocument(req.params.docId);
  res.json({ success: true });
});

// Projects CRUD
router.get("/", authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  res.json({ data: ProjectService.list(userId) });
});

router.post("/", authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const parsed = ProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { title, description, tags, status, goal, priority, startTime, endTime, decisionMaker, createdBy } = parsed.data;
  const workflowNodes = (parsed.data.workflowNodes || []) as WorkflowNode[];
  res.status(201).json({
    data: ProjectService.create({ title, description, tags, status, goal, priority, startTime, endTime, decisionMaker, workflowNodes, createdBy, userId }),
  });
});

router.get("/:id", authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const p = ProjectService.getById(req.params.id);
  if (!p) return res.status(404).json({ error: "Project not found" });
  // 越权检查
  if (p.createdBy && (req as any).user?.role !== "admin" && (req as any).user?.role !== "super_admin") {
    if (p.createdBy !== userId && (p as any).user_id && (p as any).user_id !== userId) {
      return res.status(403).json({ error: "无权限访问此项目" });
    }
  }
  res.json({ data: p });
});

router.put("/:id", authenticate, ensureOwnership("project"), (req: Request, res: Response) => {
  const parsed = ProjectSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const p = ProjectService.update(req.params.id, parsed.data as any);
  if (!p) return res.status(404).json({ error: "Project not found" });
  res.json({ data: p });
});

router.delete("/:id", authenticate, ensureOwnership("project"), (req: Request, res: Response) => {
  ProjectService.delete(req.params.id);
  res.json({ success: true });
});

// Document tree under a project
router.get("/:id/documents", authenticate, (req: Request, res: Response) => {
  res.json({ data: ProjectService.getDocumentTree(req.params.id) });
});

router.post("/:id/documents", authenticate, (req: Request, res: Response) => {
  const parsed = DocumentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { title, parentId } = parsed.data;
  const doc = ProjectService.createDocument({ projectId: req.params.id, title, parentId });
  res.status(201).json({ data: doc });
});

export default router;
