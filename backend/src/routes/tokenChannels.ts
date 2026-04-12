import { Router, Request, Response } from "express";
import { getDb, saveDb } from "../db/client";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import https from "https";
import http from "http";
import { authenticate, requireRole } from "../middleware/auth";

const router = Router();

const ChannelSchema = z.object({
  provider: z.string().min(1),
  modelName: z.string().default(""),
  baseUrl: z.string().default(""),
  apiKey: z.string().default(""),
  authType: z.enum(["Bearer", "ApiKey", "Basic"]).default("Bearer"),
  enabled: z.boolean().default(true),
  priority: z.number().default(0),
});

function listChannels() {
  const db = getDb();
  const result = db.exec("SELECT * FROM token_channels ORDER BY priority DESC, created_at ASC");
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map((row) => {
    const obj: any = {};
    cols.forEach((c, i) => (obj[c] = row[i]));
    return {
      id: obj.id,
      provider: obj.provider,
      modelName: obj.model_name || "",
      baseUrl: obj.base_url || "",
      apiKey: obj.api_key || "",
      authType: obj.auth_type || "Bearer",
      enabled: !!obj.enabled,
      priority: obj.priority ?? 0,
      createdAt: obj.created_at,
      updatedAt: obj.updated_at,
    };
  });
}

// GET /api/token-channels — 所有登录用户可查看
router.get("/", authenticate, (_req: Request, res: Response) => {
  res.json({ data: listChannels() });
});

// POST /api/token-channels — 仅管理员可管理
router.post("/", authenticate, requireRole(["super_admin", "admin"]), (req: Request, res: Response) => {
  const parsed = ChannelSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const db = getDb();
  const { provider, modelName, baseUrl, apiKey, authType, enabled, priority } = parsed.data;
  const now = new Date().toISOString();

  // Check if provider already exists
  const existing = db.exec("SELECT id FROM token_channels WHERE provider=?", [provider]);
  if (existing.length && existing[0].values.length) {
    const id = existing[0].values[0][0] as string;
    db.run(
      `UPDATE token_channels SET model_name=?, base_url=?, api_key=?, auth_type=?, enabled=?, priority=?, updated_at=? WHERE id=?`,
      [modelName, baseUrl, apiKey, authType, enabled ? 1 : 0, priority, now, id]
    );
    saveDb();
    res.json({ data: { id, provider, modelName, baseUrl, apiKey, authType, enabled, priority } });
  } else {
    const id = uuidv4();
    db.run(
      `INSERT INTO token_channels (id, provider, model_name, base_url, api_key, auth_type, enabled, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, provider, modelName, baseUrl, apiKey, authType, enabled ? 1 : 0, priority, now, now]
    );
    saveDb();
    res.status(201).json({ data: { id, provider, modelName, baseUrl, apiKey, authType, enabled, priority } });
  }
});

// DELETE /api/token-channels/:provider — 仅管理员
router.delete("/:provider", authenticate, requireRole(["super_admin", "admin"]), (req: Request, res: Response) => {
  const db = getDb();
  db.run("DELETE FROM token_channels WHERE provider=?", [req.params.provider]);
  saveDb();
  res.json({ success: true });
});

/**
 * P2-7: POST /api/token-channels/:id/test
 * Send a lightweight test request to the channel to verify connectivity.
 * Uses the channel's baseUrl and apiKey.
 */
router.post("/:id/test", authenticate, async (req: Request, res: Response) => {
  const db = getDb();
  const result = db.exec("SELECT * FROM token_channels WHERE id=?", [req.params.id]);
  if (!result.length || !result[0].values.length) {
    return res.status(404).json({ error: "Channel not found" });
  }
  const cols = result[0].columns;
  const obj: any = {};
  cols.forEach((c, i) => (obj[c] = result[0].values[0][i]));

  const baseUrl: string = obj.base_url || "";
  const apiKey: string = obj.api_key || "";
  const authType: string = obj.auth_type || "Bearer";

  if (!baseUrl) {
    return res.status(400).json({ error: "Channel has no base_url configured" });
  }

  // Build test URL — try /models or /v1/models (common OpenAI-compatible endpoints)
  let testUrl = baseUrl.replace(/\/$/, "") + "/models";

  try {
    const t0 = Date.now();
    const statusCode = await new Promise<number>((resolve, reject) => {
      const parsedUrl = new URL(testUrl);
      const lib = parsedUrl.protocol === "https:" ? https : http;

      const authHeader = authType === "Bearer"
        ? `Bearer ${apiKey}`
        : authType === "ApiKey"
        ? apiKey
        : Buffer.from(apiKey).toString("base64");

      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: "GET",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json",
        },
        timeout: 8000,
      };

      const testReq = lib.request(reqOptions, (proxyRes) => {
        // Consume body to avoid socket hang
        proxyRes.on("data", () => {});
        proxyRes.on("end", () => resolve(proxyRes.statusCode ?? 0));
      });
      testReq.on("error", (e) => reject(e));
      testReq.on("timeout", () => { testReq.destroy(); reject(new Error("Request timeout")); });
      testReq.end();
    });

    const latencyMs = Date.now() - t0;
    const ok = statusCode >= 200 && statusCode < 500; // 401/403 means reached server, key may be wrong

    res.json({
      data: {
        connected: ok,
        statusCode,
        latencyMs,
        note: statusCode === 401
          ? "Server reachable but API key is invalid"
          : statusCode === 200
          ? "Connection successful"
          : `HTTP ${statusCode}`,
      },
    });
  } catch (err: any) {
    res.json({
      data: {
        connected: false,
        statusCode: 0,
        latencyMs: null,
        note: err.message || "Connection failed",
      },
    });
  }
});

export default router;
