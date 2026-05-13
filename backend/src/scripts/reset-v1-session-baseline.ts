import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';

const DB_PATH = path.join(__dirname, '../../data/platform.db');
const BACKUP_DIR = path.join(__dirname, '../../backups');

async function main() {
  if (process.env.ENABLE_V1_SESSION_RESET !== 'true') {
    throw new Error('V1 session reset is disabled. Set ENABLE_V1_SESSION_RESET=true to run intentionally.');
  }

  const pruneUsers = process.argv.includes('--prune-users');
  const clearAgents = process.argv.includes('--clear-agents');

  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`DB not found: ${DB_PATH}`);
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const backupPath = path.join(BACKUP_DIR, `platform.db.reset-v1-session-${Date.now()}.sqlite`);
  fs.copyFileSync(DB_PATH, backupPath);

  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(DB_PATH));

  const userRows = db.exec(`SELECT id, username, role, created_at FROM users ORDER BY created_at ASC`);
  const users = (userRows[0]?.values || []).map((row) => ({
    id: String(row[0]),
    username: String(row[1]),
    role: String(row[2]),
    createdAt: String(row[3]),
  }));
  const keeper = users.find((u) => u.role === 'super_admin');
  if (!keeper) {
    throw new Error('No super_admin user found; aborting');
  }

  db.run('BEGIN');
  try {
    // V1 会话基线清理：只清 RepaceClaw 自己的会话数据，不触碰 OpenClaw main 代理数据。
    db.run(`DELETE FROM messages`);
    db.run(`DELETE FROM conversation_agents`);
    db.run(`DELETE FROM session_mapping`);
    db.run(`DELETE FROM session_tabs`);
    db.run(`DELETE FROM conversations`);

    if (clearAgents) {
      db.run(`DELETE FROM agent_plugins`);
      db.run(`DELETE FROM agent_registry_log`);
      db.run(`DELETE FROM agents`);
    }

    if (pruneUsers) {
      // 仅保留一个超级管理员账号；其余用户全部删除。
      // 注意：本脚本不清 OpenClaw main 代理及其外部文件数据。
      db.run(`DELETE FROM users WHERE id <> ?`, [keeper.id]);
    }

    db.run('COMMIT');
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }

  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));

  console.log(JSON.stringify({
    ok: true,
    backupPath,
    keptSuperAdmin: keeper,
    cleared: {
      sessions: true,
      usersPruned: pruneUsers,
      agentsCleared: clearAgents,
    },
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
