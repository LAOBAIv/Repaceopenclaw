// index.ts — re-export 所有导出，保持外部 import 不变
export { createTables } from './tables';
export { runMigrations } from './migrations';
export { initDb } from './init';
