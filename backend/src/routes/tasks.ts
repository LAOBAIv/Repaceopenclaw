import { Router, Request, Response } from "express";
import { TaskService, TaskColumn, TaskPriority } from "../services/TaskService";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { ensureOwnership } from "../middleware/ownership";

const router = Router();

const COLUMNS: TaskColumn[] = ["todo", "progress", "review", "done"];

const TaskCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  columnId: z.enum(["todo", "progress", "review", "done"]).default("todo"),
  priority: z.enum(["high", "mid", "low"]).default("mid"),
  tags: z.array(z.string()).default([]),
  agent: z.string().default(""),
  agentColor: z.string().default("#6366F1"),
  agentId: z.string().default(""),
  dueDate: z.string().default(""),
  createdBy: z.string().optional(),
});

const TaskUpdateSchema = TaskCreateSchema.partial().extend({
  sortOrder: z.number().optional(),
  commentCount: z.number().optional(),
  fileCount: z.number().optional(),
  createdBy: z.string().optional(),
});

const ReorderSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    columnId: z.enum(["todo", "progress", "review", "done"]),
    sortOrder: z.number(),
  })),
});

/** GET /api/tasks — 所有任务，按列分组 */
router.get("/", authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  res.json({ data: TaskService.listGrouped(userId) });
});

/** GET /api/tasks/column/:columnId — 获取单列任务 */
router.get("/column/:columnId", authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const col = req.params.columnId as TaskColumn;
  if (!COLUMNS.includes(col)) return res.status(400).json({ error: "Invalid column" });
  res.json({ data: TaskService.listByColumn(col, userId) });
});

/** POST /api/tasks/reorder — 批量更新排序（拖拽后调用） */
router.post("/reorder", authenticate, (req: Request, res: Response) => {
  const parsed = ReorderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  TaskService.reorder(parsed.data.items as Array<{ id: string; columnId: TaskColumn; sortOrder: number }>);
  res.json({ success: true });
});

/** GET /api/tasks/:id */
router.get("/:id", authenticate, (req: Request, res: Response) => {
  const task = TaskService.getById(req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json({ data: task });
});

/** POST /api/tasks */
router.post("/", authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const parsed = TaskCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const task = TaskService.create({ ...parsed.data, userId } as Parameters<typeof TaskService.create>[0]);
  res.status(201).json({ data: task });
});

/** PUT /api/tasks/:id */
router.put("/:id", authenticate, ensureOwnership("task"), (req: Request, res: Response) => {
  const parsed = TaskUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const updated = TaskService.update(req.params.id, parsed.data as any);
  if (!updated) return res.status(404).json({ error: "Task not found" });
  res.json({ data: updated });
});

/** DELETE /api/tasks/:id */
router.delete("/:id", authenticate, ensureOwnership("task"), (req: Request, res: Response) => {
  TaskService.delete(req.params.id);
  res.json({ success: true });
});

export default router;
