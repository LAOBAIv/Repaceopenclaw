// Database client - [2026-05-22] 切换到 better-sqlite3 via SqliteCompat 兼容层
// 原 sql.js 内存模式导致生产数据丢失，现改为磁盘直写 + WAL
import path from "path";
import fs from "fs";
import { dbConfig } from "./config";
import { IdGenerator } from "../utils/IdGenerator";
import { SqliteCompat } from "./sqlite-compat";
import logger from "../utils/logger";

/** 安全执行 ALTER/CREATE 等幂等 DDL，只静默 "duplicate column" 类错误，其他异常打日志 */
function safeAlter(db: any, sql: string): void {
  try {
    db.run(sql);
  } catch (e: any) {
    const msg = (e?.message || '').toLowerCase();
    // SQLite: "duplicate column name" / "already exists"
    if (msg.includes('duplicate column') || msg.includes('already exists')) return;
    logger.warn(`[DB Migration] DDL failed: ${sql.slice(0, 80)}... | ${e.message}`);
  }
}

let db: any;
const DB_PATH = path.join(__dirname, "../../data/platform.db");

/** 统一初始化入口：根据 DB_TYPE 选择驱动 */
export async function initDb(): Promise<any> {
  // PostgreSQL 模式
  if (dbConfig.type === "postgres") {
    const { initPostgresSync } = await import("./postgres");
    const pgDb = await initPostgresSync();
    // 将 pgDb 挂载到全局 _pgDb，供 getDb() 返回
    (globalThis as any).__pgDb = pgDb;
    return pgDb;
  }

  // SQLite 模式（默认）— 使用 better-sqlite3 兼容层
  if (db) return db;

  db = new SqliteCompat(DB_PATH);
  // WAL + foreign_keys 已在 SqliteCompat 构造函数中设置

  createTables(db);
  // Seed default skills & plugins on first run (idempotent — skips if already present)
  seedDefaultData(db);
  // Dual-code Phase 1: 回填 *_code 字段，但不动现有 UUID 主键关系。
  // 目标是让“新数据开始双写、老数据尽快可读”，同时避免一次性大迁移把现网跑挂。
  backfillBusinessCodes(db);
  saveDb();

  return db;
}

export function execToRows(db: any, sql: string, params?: any[]): any[] {
  const result = params ? db.exec(sql, params) : db.exec(sql);
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map((row: any[]) => {
    const obj: any = {};
    cols.forEach((c: string, i: number) => (obj[c] = row[i]));
    return obj;
  });
}

// [2026-05-23] 大函数已拆分到独立文件
import { createTables } from './schema';
import { seedDefaultData } from './seed';
import { backfillBusinessCodes } from './backfill';


export function saveDb() {
  // [2026-05-22] better-sqlite3 每次写入自动持久化，不再需要手动 export
  // 保留函数签名避免修改 500+ 处调用
  return;
}

/**
 * 统一获取数据库实例
 * SQLite 模式：返回 sql.js Database
 * PostgreSQL 模式：返回 PGDatabase（兼容 sql.js 接口）
 */
export function getDb(): any {
  if (dbConfig.type === "postgres") {
    return (globalThis as any).__pgDb;
  }
  return db;
}
