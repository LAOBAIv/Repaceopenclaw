import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { z } from 'zod';

import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { getDb, saveDb } from '../db/client';
import { sendCreated, sendNoContent, sendNotFound, sendSuccess, sendValidationError } from '../utils/response';
import FileContextService from '../services/FileContextService';

const router = Router();

const UploadSchema = z.object({
  fileName: z.string().min(1, '文件名不能为空'),
  mimeType: z.string().default('application/octet-stream'),
  base64: z.string().min(1, '文件内容不能为空'),
  projectId: z.string().optional(),
  conversationId: z.string().optional(),
  scopeType: z.enum(['user', 'department', 'enterprise']).default('user'),
  scopeId: z.string().optional(),
});

const MAX_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv', '.pdf', '.docx', '.md', '.txt', '.json', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);
const UPLOAD_ROOT = path.join(__dirname, '../../uploads');

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').trim();
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || '';
    const projectId = String(req.query.projectId || '').trim();
    const conversationId = String(req.query.conversationId || '').trim();
    // [2026-05-19] 新增筛选参数
    const startDate = String(req.query.startDate || '').trim();
    const endDate = String(req.query.endDate || '').trim();
    const fileType = String(req.query.type || '').trim(); // image / document / all
    const db = getDb();

    let sql = `SELECT id, user_id, project_id, conversation_id, original_name, stored_name, mime_type, extension, size_bytes, storage_path, status, created_at, updated_at
               FROM file_assets WHERE user_id=? AND status='uploaded'`;
    const params: unknown[] = [userId]; // [2026-05-24] 类型安全
    if (projectId) {
      sql += ' AND project_id=?';
      params.push(projectId);
    }
    if (conversationId) {
      sql += ' AND conversation_id=?';
      params.push(conversationId);
    }
    if (startDate) {
      sql += ' AND created_at >= ?';
      params.push(startDate + 'T00:00:00.000Z');
    }
    if (endDate) {
      sql += ' AND created_at <= ?';
      params.push(endDate + 'T23:59:59.999Z');
    }
    if (fileType === 'image') {
      sql += " AND extension IN ('.png','.jpg','.jpeg','.gif','.webp','.svg','.bmp')";
    } else if (fileType === 'document') {
      sql += " AND extension IN ('.xlsx','.xls','.csv','.pdf','.docx','.md','.txt','.json')";
    }
    sql += ' ORDER BY created_at DESC';

    const result = db.exec(sql, params);
    const rows = !result.length
      ? []
      : result[0].values.map((row: unknown[]) => ({ // [2026-05-24] 类型安全
          id: row[0],
          userId: row[1],
          projectId: row[2],
          conversationId: row[3],
          originalName: row[4],
          storedName: row[5],
          mimeType: row[6],
          extension: row[7],
          sizeBytes: Number(row[8] || 0),
          storagePath: row[9],
          status: row[10],
          createdAt: row[11],
          updatedAt: row[12],
        }));

    sendSuccess(res, rows);
  })
);

router.post(
  '/upload',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = UploadSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return sendValidationError(res, '上传参数错误', parsed.error.flatten());
    }

    const userId = req.user?.id || '';
    const { fileName, mimeType, base64, projectId = '', conversationId = '', scopeType = 'user', scopeId = '' } = parsed.data;
    const safeName = sanitizeFileName(fileName);
    const ext = path.extname(safeName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return sendValidationError(res, `暂不支持该文件格式：${ext || 'unknown'}`);
    }

    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length) {
      return sendValidationError(res, '文件内容为空');
    }
    if (buffer.length > MAX_SIZE_BYTES) {
      return sendValidationError(res, '文件过大，单文件最大 50MB');
    }

    const fileId = randomUUID();
    const now = new Date();
    const nowIso = now.toISOString();
    const dateDir = nowIso.slice(0, 10);
    // [2026-05-19] 多用户文件体系：按 scope 分目录
    let userDir: string;
    if (scopeType === 'department' && scopeId) {
      userDir = path.join(UPLOAD_ROOT, 'shared', scopeId, dateDir);
    } else if (scopeType === 'enterprise') {
      userDir = path.join(UPLOAD_ROOT, 'shared', 'enterprise', dateDir);
    } else {
      userDir = path.join(UPLOAD_ROOT, userId, dateDir);
    }
    ensureDir(userDir);

    const storedName = `${fileId}${ext}`;
    const absPath = path.join(userDir, storedName);
    fs.writeFileSync(absPath, buffer);

    const relPath = path.relative(path.join(__dirname, '../../'), absPath).replace(/\\/g, '/');
    const db = getDb();
    db.run(
      `INSERT INTO file_assets (
        id, user_id, project_id, conversation_id, original_name, stored_name, mime_type, extension, size_bytes, storage_path, scope_type, scope_id, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fileId,
        userId,
        projectId,
        conversationId,
        safeName,
        storedName,
        mimeType,
        ext,
        buffer.length,
        relPath,
        scopeType,
        scopeId || userId,
        'uploaded',
        nowIso,
        nowIso,
      ]
    );
    saveDb();

    sendCreated(res, {
      id: fileId,
      userId,
      projectId,
      conversationId,
      originalName: safeName,
      storedName,
      mimeType,
      extension: ext,
      sizeBytes: buffer.length,
      storagePath: relPath,
      status: 'uploaded',
      createdAt: nowIso,
      updatedAt: nowIso,
    }, '文件上传成功');
  })
);

router.get(
  '/auto-analysis',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || '';
    const conversationId = String(req.query.conversationId || '').trim();
    if (!conversationId) {
      return sendValidationError(res, '缺少 conversationId');
    }

    const prompt = await FileContextService.buildLatestFileAutoAnalysisPrompt(userId, conversationId);
    sendSuccess(res, { prompt });
  })
);

router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || '';
    const fileId = req.params.id;
    const db = getDb();
    const result = db.exec(
      `SELECT id, storage_path FROM file_assets WHERE id=? AND user_id=? LIMIT 1`,
      [fileId, userId]
    );
    if (!result.length || !result[0].values.length) {
      return sendNotFound(res, '文件');
    }

    // [2026-05-19] 软删除：标记 status='deleted'，不删除磁盘文件
    db.run(`UPDATE file_assets SET status='deleted', updated_at=? WHERE id=? AND user_id=?`,
      [new Date().toISOString(), fileId, userId]);
    saveDb();
    sendNoContent(res);
  })
);

// [2026-05-19] PUT /api/files/:id/associate - 关联文件到会话
router.put(
  '/:id/associate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || '';
    const fileId = req.params.id;
    const { conversationId } = req.body;
    if (!conversationId) {
      return sendValidationError(res, '缺少 conversationId');
    }
    const db = getDb();
    const result = db.exec(
      `SELECT id FROM file_assets WHERE id=? AND user_id=? AND status='uploaded' LIMIT 1`,
      [fileId, userId]
    );
    if (!result.length || !result[0].values.length) {
      return sendNotFound(res, '文件');
    }
    db.run(`UPDATE file_assets SET conversation_id=?, updated_at=? WHERE id=?`,
      [conversationId, new Date().toISOString(), fileId]);
    saveDb();
    sendSuccess(res, { id: fileId, conversationId });
  })
);

// [2026-05-19] PUT /api/files/:id/disassociate - 解除文件与会话的关联
router.put(
  '/:id/disassociate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || '';
    const fileId = req.params.id;
    const db = getDb();
    const result = db.exec(
      `SELECT id FROM file_assets WHERE id=? AND user_id=? AND status='uploaded' LIMIT 1`,
      [fileId, userId]
    );
    if (!result.length || !result[0].values.length) {
      return sendNotFound(res, '文件');
    }
    db.run(`UPDATE file_assets SET conversation_id='', updated_at=? WHERE id=?`,
      [new Date().toISOString(), fileId]);
    saveDb();
    sendSuccess(res, { id: fileId, conversationId: '' });
  })
);

export default router;
