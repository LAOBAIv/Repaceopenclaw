/**
 * DB 配置 — 根据环境变量选择数据库驱动
 *
 * DB_TYPE=sqlite (默认) → sql.js (开发/轻量部署)
 * DB_TYPE=postgres     → pg (生产环境)
 *
 * 环境变量:
 *   DB_TYPE=sqlite|postgres
 *   POSTGRES_HOST=localhost
 *   POSTGRES_PORT=5432
 *   POSTGRES_DB=repaceclaw
 *   POSTGRES_USER=postgres
 *   POSTGRES_PASSWORD=
 */

export interface DBConfig {
  type: "sqlite" | "postgres";
  // SQLite
  sqlitePath?: string;
  // PostgreSQL
  postgresHost?: string;
  postgresPort?: number;
  postgresDB?: string;
  postgresUser?: string;
  postgresPassword?: string;
  postgresSSL?: boolean;
}

export const dbConfig: DBConfig = {
  type: (process.env.DB_TYPE as "sqlite" | "postgres") || "sqlite",
  sqlitePath: process.env.SQLITE_PATH,
  postgresHost: process.env.POSTGRES_HOST || "localhost",
  postgresPort: parseInt(process.env.POSTGRES_PORT || "5432", 10),
  postgresDB: process.env.POSTGRES_DB || "repaceclaw",
  postgresUser: process.env.POSTGRES_USER || "postgres",
  postgresPassword: process.env.POSTGRES_PASSWORD || "",
  postgresSSL: process.env.POSTGRES_SSL === "true",
};
