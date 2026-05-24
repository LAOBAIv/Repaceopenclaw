/**
 * sqlite-compat.ts
 * [2026-05-20] better-sqlite3 兼容层
 * 
 * 问题：sql.js 是纯内存数据库，写入后需要手动 export() + writeFileSync 持久化。
 *   如果进程异常退出或 saveDb() 调用时机不对，数据会丢失。
 *   生产环境中已发生多次数据丢失（消息写入内存成功但磁盘文件无数据）。
 * 
 * 解决方案：替换为 better-sqlite3，直接操作磁盘文件，每次写入立即持久化。
 *   使用 WAL 模式提升并发读写性能。
 * 
 * 兼容层：包装 better-sqlite3 为 sql.js 兼容接口，避免修改 500+ 处调用代码。
 *   - db.exec(sql, params?) → 返回 [{columns: [...], values: [[...]]}]
 *   - db.run(sql, params?) → 执行写操作
 *   - db.export() → 返回数据库文件 Buffer（兼容旧代码，实际不再需要）
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { getErrorMessage } from "../types/ilink";

export interface SqlJsCompatResult {
  columns: string[];
  values: any[][];
}

export class SqliteCompat {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  /**
   * 兼容 sql.js 的 exec 接口
   * sql.js: db.exec(sql, params) → [{columns, values}]
   */
  exec(sql: string, params?: any[]): SqlJsCompatResult[] {
    try {
      const stmt = this.db.prepare(sql);
      if (this.isReadQuery(sql)) {
        const rows = params ? stmt.all(...params) : stmt.all();
        if (rows.length === 0) return [];
        const columns = Object.keys(rows[0]);
        const values = rows.map(row => columns.map(col => (row as any)[col]));
        return [{ columns, values }];
      } else {
        // 写操作也可能通过 exec 调用（如 CREATE TABLE）
        if (params) {
          stmt.run(...params);
        } else {
          stmt.run();
        }
        return [];
      }
    } catch (e: unknown) { // [2026-05-24] 类型安全：any → unknown
      // sql.js 对不存在的表等返回空数组，better-sqlite3 会抛异常
      if (getErrorMessage(e)?.includes('no such table')) return [];
      throw e;
    }
  }

  /**
   * 兼容 sql.js 的 run 接口
   * sql.js: db.run(sql, params) → void
   */
  run(sql: string, params?: any[]): void {
    const stmt = this.db.prepare(sql);
    if (params) {
      stmt.run(...params);
    } else {
      stmt.run();
    }
  }

  /**
   * 兼容 sql.js 的 export 接口（实际不再需要，数据已在磁盘）
   */
  export(): Buffer {
    return fs.readFileSync(this.dbPath);
  }

  /** 关闭数据库连接 */
  close(): void {
    this.db.close();
  }

  /** 获取底层 better-sqlite3 实例（高级用法） */
  raw(): Database.Database {
    return this.db;
  }

  private isReadQuery(sql: string): boolean {
    const trimmed = sql.trim().toUpperCase();
    return trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('EXPLAIN');
  }
}
