// init.ts — initDb 入口函数，组合 tables + migrations
import type { DbLike } from '../sqlite-compat';
import { createTables } from './tables';
import { runMigrations } from './migrations';

export function initDb(db: DbLike): void {
  createTables(db);
  runMigrations(db);
}
