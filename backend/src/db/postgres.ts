/**
 * PostgreSQL 初始化 + sql.js 兼容层
 *
 * 让现有服务层代码无需修改即可运行在 PostgreSQL 上。
 * 通过模拟 sql.js Database 接口的核心方法（exec/run/prepare），
 * 服务层可以继续调用 db.exec(sql, params)、db.run(sql, params)、
 * db.prepare(sql).get(params) 等同步 API。
 *
 * 使用 deasync 将 pg 的异步 query 转为同步调用。
 *
 * 用法:
 *   DB_TYPE=postgres POSTGRES_HOST=... POSTGRES_DB=... \
 *   node dist/index.js
 */

import { Pool, PoolClient } from "pg";
import { logger } from '../utils/logger';
import deasync from "deasync";
import { dbConfig } from "./config";

let pool: Pool;
let client: PoolClient;
let _initialized = false;

/** sql.js Database 兼容接口 */
export interface PGDatabase {
  exec(sql: string, params?: any[]): { columns: string[]; values: any[][] }[];
  run(sql: string, params?: any[]): void;
  prepare(sql: string): {
    get: (params?: any[]) => Record<string, any> | undefined;
    all: (params?: any[]) => Record<string, any>[];
    run: (params?: any[]) => void;
  };
  close(): void;
}

/** 初始化 PostgreSQL（在 index.ts 的 main() 中调用） */
export async function initPostgresSync(): Promise<PGDatabase> {
  if (_initialized) return getPGDb();

  pool = new Pool({
    host: dbConfig.postgresHost || "localhost",
    port: dbConfig.postgresPort || 5432,
    database: dbConfig.postgresDB || "repaceclaw",
    user: dbConfig.postgresUser || "postgres",
    password: dbConfig.postgresPassword || "",
    ssl: dbConfig.postgresSSL ? { rejectUnauthorized: false } : false,
    max: 1,
    idleTimeoutMillis: 30000,
  });

  // 测试连接
  await pool.query("SELECT 1");
  logger.info(`[PG] Connected to ${dbConfig.postgresDB}@${dbConfig.postgresHost}:${dbConfig.postgresPort}`);

  // 获取持久连接（用于同步调用）
  client = await pool.connect();

  // 建表
  const fs = require("fs");
  const path = require("path");
  const schemaPath = path.join(__dirname, "../scripts/schema-postgres.sql");
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, "utf-8");
    await client.query(schema);
    logger.info("[PG] Schema initialized");
  }

  // Seed 默认数据
  await seedDefaults();

  _initialized = true;
  return getPGDb();
}

function getPGDb(): PGDatabase {
  return {
    /** SELECT — 返回 sql.js 兼容格式 {columns, values}[] */
    exec(sql: string, params?: any[]): { columns: string[]; values: any[][] }[] {
      const rows = _syncQuery(sql, params);
      if (!rows.length) return [];
      const columns = Object.keys(rows[0]);
      const values = rows.map(r => columns.map(c => r[c]));
      return [{ columns, values }];
    },

    /** INSERT / UPDATE / DELETE */
    run(sql: string, params?: any[]): void {
      _syncQuery(sql, params);
    },

    /** 预编译语句（兼容 sql.js prepare 接口） */
    prepare(sql: string) {
      return {
        get: (params?: any[]) => _syncQuery(sql, params)[0],
        all: (params?: any[]) => _syncQuery(sql, params),
        run: (params?: any[]) => { _syncQuery(sql, params); },
      };
    },

    close(): void {
      client.release();
      pool.end();
    },
  };
}

/** 同步查询包装器（使用 deasync 阻塞等待 Promise） */
function _syncQuery(sql: string, params?: any[]): Record<string, any>[] {
  let done = false;
  let result: Record<string, any>[] = [];
  let error: Error | null = null;

  client.query(sql, params)
    .then(res => { result = res.rows; })
    .catch(err => { error = err; })
    .finally(() => { done = true; });

  deasync.loopWhile(() => !done);

  if (error) throw error;
  return result;
}

/** 种子数据（最小化，与 SQLite 版本保持一致） */
async function seedDefaults() {
  const now = new Date().toISOString();
  const { count } = (await client.query("SELECT COUNT(*) FROM skills")).rows[0];
  if (parseInt(count) > 0) return;

  const skills = [
    { id: "skill-web-search", name: "网络搜索", description: "实时联网搜索", category: "search", type: "builtin", config: JSON.stringify({ engine: "google", maxResults: 10, safeSearch: true }) },
    { id: "skill-code-executor", name: "代码执行", description: "沙箱执行代码", category: "code", type: "builtin", config: JSON.stringify({ timeout: 30, languages: ["python", "javascript"], sandbox: true }) },
    { id: "skill-image-understanding", name: "图像理解", description: "图片解析/OCR", category: "vision", type: "builtin", config: JSON.stringify({ ocrEnabled: true }) },
    { id: "skill-memory", name: "长期记忆", description: "跨会话记忆", category: "memory", type: "builtin", config: JSON.stringify({ maxMemories: 1000 }) },
  ];

  for (const s of skills) {
    await client.query(
      `INSERT INTO skills (id, name, description, category, type, config, enabled, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,1,$7,$7)`,
      [s.id, s.name, s.description, s.category, s.type, s.config, now]
    );
  }
  logger.info("[PG] Default data seeded");
}
