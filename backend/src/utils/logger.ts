/**
 * 生产级日志模块
 * - 分级：error / warn / info / debug
 * - 按天切割，保留 30 天
 * - 敏感信息自动脱敏（password / api_key / token）
 * - requestId 全链路追踪
 * - 彩色控制台输出（dev）+ JSON 文件输出（prod）
 */
import fs from "fs";
import path from "path";

export type LogLevel = "error" | "warn" | "info" | "debug";

const LOG_LEVELS: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };
const LOG_DIR = path.join(__dirname, "../../logs");
const RETENTION_DAYS = 30;

// 环境变量控制：NODE_ENV=production 输出到文件，dev 输出到控制台
const isProd = process.env.NODE_ENV === "production";
const minLevel = (process.env.LOG_LEVEL || "info") as LogLevel;

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// 清理过期日志（默认关闭，显式启用才执行）
function cleanupOldLogs() {
  try {
    const files = fs.readdirSync(LOG_DIR);
    const now = Date.now();
    for (const f of files) {
      if (!f.startsWith("repaceclaw-") || !f.endsWith(".log")) continue;
      const dateStr = f.replace("repaceclaw-", "").replace(".log", "");
      const fileDate = new Date(dateStr).getTime();
      if (now - fileDate > RETENTION_DAYS * 86400000) {
        fs.unlinkSync(path.join(LOG_DIR, f));
      }
    }
  } catch {}
}
if (process.env.ENABLE_LOG_CLEANUP === "true") {
  cleanupOldLogs();
}

function getLogFilePath(): string {
  const today = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `repaceclaw-${today}.log`);
}

function format(level: LogLevel, message: string, meta?: Record<string, any>): string {
  const ts = new Date().toISOString();
  const entry: any = { level, timestamp: ts, message };

  // 自动注入 requestId（如果上下文中有）
  if (globalThis.__requestId) entry.requestId = globalThis.__requestId;

  // 合并 meta
  if (meta) Object.assign(entry, meta);

  return JSON.stringify(entry);
}

// 敏感字段脱敏
const SENSITIVE_KEYS = ["password", "api_key", "apikey", "token", "secret", "authorization", "password_hash"];
function sanitize(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  const sanitized = { ...obj };
  for (const key of Object.keys(sanitized)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.some(s => lower.includes(s))) {
      sanitized[key] = "***REDACTED***";
    } else if (typeof sanitized[key] === "object") {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }
  return sanitized;
}

// 控制台颜色
const COLORS: Record<LogLevel, string> = {
  error: "\x1b[31m", // red
  warn: "\x1b[33m",  // yellow
  info: "\x1b[36m",  // cyan
  debug: "\x1b[90m", // gray
};
const RESET = "\x1b[0m";

function write(level: LogLevel, message: string, meta?: Record<string, any>) {
  if (LOG_LEVELS[level] > LOG_LEVELS[minLevel]) return;

  const sanitizedMeta = meta ? sanitize(meta) : undefined;
  const line = format(level, message, sanitizedMeta);

  if (isProd) {
    // 生产：写入文件
    fs.appendFileSync(getLogFilePath(), line + "\n");
  } else {
    // 开发：彩色控制台
    const ts = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    const prefix = `${COLORS[level]}[${level.toUpperCase()}]${RESET}`;
    const metaStr = sanitizedMeta ? ` ${JSON.stringify(sanitizedMeta)}` : "";
    console.log(`${prefix} ${ts} — ${message}${metaStr}`);
  }
}

export const logger = {
  error: (msg: string, meta?: Record<string, any>) => write("error", msg, meta),
  warn: (msg: string, meta?: Record<string, any>) => write("warn", msg, meta),
  info: (msg: string, meta?: Record<string, any>) => write("info", msg, meta),
  debug: (msg: string, meta?: Record<string, any>) => write("debug", msg, meta),
};

// 导出供中间件注入 requestId
declare global {
  var __requestId: string | undefined;
}

export default logger;
