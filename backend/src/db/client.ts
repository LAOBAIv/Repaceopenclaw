// Database client - [2026-05-22] 切换到 better-sqlite3 via SqliteCompat 兼容层
// 原 sql.js 内存模式导致生产数据丢失，现改为磁盘直写 + WAL
import path from "path";
import fs from "fs";
import { dbConfig } from "./config";
import { IdGenerator } from "../utils/IdGenerator";
import { SqliteCompat, DbLike } from "./sqlite-compat"; // [2026-05-24] 类型安全
import logger from "../utils/logger";
import { getErrorMessage } from "../types/ilink";
// [2026-05-23] 大函数已拆分到独立文件
import { createTables } from './schema';
import { seedDefaultData } from './seed';
import { backfillBusinessCodes } from './backfill';

/** 安全执行 ALTER/CREATE 等幂等 DDL，只静默 "duplicate column" 类错误，其他异常打日志 */
export function safeAlter(db: DbLike, sql: string): void { // [2026-05-24] 类型安全
  try {
    db.run(sql);
  } catch (e: unknown) { // [2026-05-24] 类型安全：any → unknown
    const msg = (getErrorMessage(e) || '').toLowerCase();
    if (msg.includes('duplicate column') || msg.includes('already exists')) return;
    logger.warn(`[DB Migration] DDL failed: ${sql.slice(0, 80)}... | ${getErrorMessage(e)}`);
  }
}

let db: DbLike | undefined; // [2026-05-24] 类型安全
const DB_PATH = path.join(__dirname, "../../data/platform.db");

/** 统一初始化入口：根据 DB_TYPE 选择驱动 */
export async function initDb(): Promise<DbLike> { // [2026-05-24] 类型安全
  if (dbConfig.type === "postgres") {
    const { initPostgresSync } = await import("./postgres");
    const pgDb = await initPostgresSync();
    (globalThis as Record<string, unknown>).__pgDb = pgDb; // [2026-05-24] 类型安全
    return pgDb as unknown as DbLike; // [2026-05-24] P1 修复：PGDatabase 实现 DbLike
  }

  if (db) return db;
  db = new SqliteCompat(DB_PATH);

  createTables(db);
  seedDefaultData(db);
  backfillBusinessCodes(db);
  saveDb();

  return db;
}

export function execToRows(db: DbLike, sql: string, params?: unknown[]): Record<string, unknown>[] { // [2026-05-24] 类型安全
  const result = params ? db.exec(sql, params) : db.exec(sql);
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map((row: unknown[]) => { // [2026-05-24] 类型安全
    const obj: Record<string, unknown> = {}; // [2026-05-24] 类型安全
    cols.forEach((c: string, i: number) => (obj[c] = row[i]));
    return obj;
  });
}

export function saveDb() {
  // [2026-05-22] better-sqlite3 每次写入自动持久化，不再需要手动 export
  return;
}

export function getDb(): DbLike { // [2026-05-24] 类型安全
  if (dbConfig.type === "postgres") {
    return (globalThis as Record<string, unknown>).__pgDb as DbLike; // [2026-05-24] P1 修复
  }
  if (!db) throw new Error('Database not initialized'); // [2026-05-24] P1 修复
  return db;
}
