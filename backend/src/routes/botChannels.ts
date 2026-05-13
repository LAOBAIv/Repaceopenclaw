import { Router, Request, Response } from "express";
import { getDb, saveDb } from "../db/client";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const router = Router();

const ALLOWED_TYPES = ["feishu", "wecom", "dingtalk"] as const;

const BotChannelSchema = z.object({
  channelType: z.enum(ALLOWED_TYPES),
  botId: z.string().default(""),
  secret: z.string().default(""),
  enabled: z.boolean().default(true),
});

function rowToBot(obj: any) {
  return {
    id: obj.id as string,
    channelType: obj.channel_type as string,
    botId: obj.bot_id as string,
    secret: obj.secret as string,
    enabled: !!obj.enabled,
    createdAt: obj.created_at as string,
    updatedAt: obj.updated_at as string,
  };
}

function listBots() {
  const db = getDb();
  const result = db.exec("SELECT * FROM bot_channels ORDER BY channel_type ASC");
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map((row) => {
    const obj: any = {};
    cols.forEach((c, i) => (obj[c] = row[i]));
    return rowToBot(obj);
  });
}

// GET /api/bot-channels
router.get("/", (_req: Request, res: Response) => {
  res.json({ data: listBots() });
});

// POST /api/bot-channels  — upsert by channelType
router.post("/", (req: Request, res: Response) => {
  const parsed = BotChannelSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const db = getDb();
  const { channelType, botId, secret, enabled } = parsed.data;
  const now = new Date().toISOString();

  const existing = db.exec("SELECT id FROM bot_channels WHERE channel_type=?", [channelType]);
  if (existing.length && existing[0].values.length) {
    const id = existing[0].values[0][0] as string;
    db.run(
      `UPDATE bot_channels SET bot_id=?, secret=?, enabled=?, updated_at=? WHERE id=?`,
      [botId, secret, enabled ? 1 : 0, now, id]
    );
    saveDb();
    res.json({ data: { id, channelType, botId, secret, enabled } });
  } else {
    const id = uuidv4();
    db.run(
      `INSERT INTO bot_channels (id, channel_type, bot_id, secret, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, channelType, botId, secret, enabled ? 1 : 0, now, now]
    );
    saveDb();
    res.status(201).json({ data: { id, channelType, botId, secret, enabled } });
  }
});

// GET /api/bot-channels/:type  — 获取单个渠道配置
router.get("/:type", (req: Request, res: Response) => {
  const db = getDb();
  const result = db.exec("SELECT * FROM bot_channels WHERE channel_type=?", [req.params.type]);
  if (!result.length || !result[0].values.length) {
    return res.json({ data: null });
  }
  const cols = result[0].columns;
  const obj: any = {};
  cols.forEach((c, i) => (obj[c] = result[0].values[0][i]));
  res.json({ data: rowToBot(obj) });
});

// DELETE /api/bot-channels/:type
router.delete("/:type", (req: Request, res: Response) => {
  const db = getDb();
  db.run("DELETE FROM bot_channels WHERE channel_type=?", [req.params.type]);
  saveDb();
  res.json({ success: true });
});

export default router;
