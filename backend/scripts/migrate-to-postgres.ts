/**
 * SQLite → PostgreSQL 迁移脚本
 * 
 * 用法:
 *   DB_TYPE=postgres POSTGRES_HOST=xxx POSTGRES_DB=xxx POSTGRES_USER=xxx POSTGRES_PASSWORD=xxx \
 *   npx tsx scripts/migrate-to-postgres.ts
 * 
 * 流程:
 *   1. 读取 SQLite 数据库
 *   2. 连接 PostgreSQL
 *   3. 逐表导出导入（保留外键关系顺序）
 */
import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";

// PostgreSQL 配置
const pgConfig = {
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
  database: process.env.POSTGRES_DB || "repaceclaw",
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "",
};

const SQLITE_PATH = path.join(__dirname, "../data/platform.db");

// 表迁移顺序（外键依赖顺序）
const TABLE_ORDER = [
  "users",
  "agents",
  "token_channels",
  "skills",
  "plugins",
  "agent_skills",
  "agent_plugins",
  "projects",
  "tasks",
  "documents",
  "document_versions",
  "conversations",
  "conversation_agents",
  "messages",
  "audit_logs",
  "agent_registry_log",
  "channel_accounts",
  "agent_templates",
  "bot_channels",
  "session_tabs",
  "session_mapping",
  "usage_stats",
];

async function main() {
  console.log("🔄 RepaceClaw SQLite → PostgreSQL 迁移工具");
  console.log(`   源: ${SQLITE_PATH}`);
  console.log(`   目标: pg://${pgConfig.user}@${pgConfig.host}:${pgConfig.port}/${pgConfig.database}`);

  // 加载 SQLite
  if (!fs.existsSync(SQLITE_PATH)) {
    console.error("❌ SQLite 数据库不存在:", SQLITE_PATH);
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const buf = fs.readFileSync(SQLITE_PATH);
  const sqliteDb = new SQL.Database(buf);

  // 连接 PostgreSQL
  let pg: any;
  try {
    const { Pool } = require("pg");
    pg = new Pool(pgConfig);
    await pg.query("SELECT 1");
    console.log("✅ PostgreSQL 连接成功");
  } catch (err: any) {
    console.error("❌ PostgreSQL 连接失败:", err.message);
    process.exit(1);
  }

  // 逐表迁移
  let totalRows = 0;
  for (const table of TABLE_ORDER) {
    try {
      // 从 SQLite 读取
      const result = sqliteDb.exec(`SELECT * FROM ${table}`);
      if (!result.length || !result[0].values.length) {
        console.log(`   ⏭️  ${table}: 空表，跳过`);
        continue;
      }

      const columns = result[0].columns;
      const rows = result[0].values;

      // 清空目标表（幂等）
      await pg.query(`DELETE FROM ${table}`);

      // 批量插入
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
      const colNames = columns.join(", ");
      const sql = `INSERT INTO ${table} (${colNames}) VALUES (${placeholders})`;

      let inserted = 0;
      for (const row of rows) {
        await pg.query(sql, row as any[]);
        inserted++;
      }

      console.log(`   ✅ ${table}: ${inserted} 行`);
      totalRows += inserted;
    } catch (err: any) {
      console.error(`   ❌ ${table}: ${err.message}`);
    }
  }

  console.log(`\n🎉 迁移完成！共迁移 ${totalRows} 行数据`);
  console.log("   请设置环境变量 DB_TYPE=postgres 切换到 PostgreSQL");

  await pg.end();
  sqliteDb.close();
}

main().catch(console.error);
