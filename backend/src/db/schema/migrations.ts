// migrations.ts — 所有迁移逻辑（ALTER TABLE, 索引创建, 数据迁移, 种子数据）
import { saveDb, safeAlter } from '../client';
import type { DbLike } from '../sqlite-compat';

export function runMigrations(db: DbLike): void {
  // ── Agents 列迁移 ──
  safeAlter(db, "ALTER TABLE agents ADD COLUMN description TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN status TEXT NOT NULL DEFAULT 'idle'");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN model_name TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN model_provider TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN temperature REAL NOT NULL DEFAULT 0.7");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN max_tokens INTEGER NOT NULL DEFAULT 4096");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN top_p REAL NOT NULL DEFAULT 1");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN frequency_penalty REAL NOT NULL DEFAULT 0");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN presence_penalty REAL NOT NULL DEFAULT 0");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN agent_code TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_user_agent_code ON agents(user_id, agent_code)");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN token_provider TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN token_api_key TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN token_base_url TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN output_format TEXT NOT NULL DEFAULT '纯文本'");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN boundary TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN memory_turns INTEGER NOT NULL DEFAULT 0");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN temperature_override REAL DEFAULT NULL");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN token_used INTEGER NOT NULL DEFAULT 0");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN skills_config TEXT NOT NULL DEFAULT '{}'");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN quota_config TEXT NOT NULL DEFAULT '{}'");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN openclaw_agent_id TEXT");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN agent_type TEXT NOT NULL DEFAULT 'general'");

  // ── 微信助手智能体种子数据 ──
  const wechatExists = db.exec("SELECT id FROM agents WHERE agent_code = 'rc-wechat-agent' LIMIT 1");
  if (!wechatExists.length || !wechatExists[0].values.length) {
    const wechatId = require('uuid').v4();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO agents (id, name, color, system_prompt, writing_style, expertise, description,
        status, model_name, model_provider, temperature, max_tokens, top_p, frequency_penalty, presence_penalty,
        token_used, created_at, user_id, agent_code, token_provider, token_api_key, token_base_url,
        output_format, boundary, memory_turns, visibility, skills_config, quota_config,
        openclaw_agent_id, agent_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        wechatId, '微信助手', '#2563eb', '微信智能助手，服务于微信用户，提供对话、问答、任务处理等能力。',
        'professional', JSON.stringify(['wechat', 'assistant', 'help']), '微信助手智能体，通过微信渠道为用户提供智能对话服务。',
        'active', 'qwen3.6-plus', 'linkApi', 0.7, 4096, 1, 0, 0,
        0, now, '', 'rc-wechat-agent', '', '', '',
        'Markdown', '通过微信渠道与用户对话，提供专业、友好的智能助手服务。', 0, 'public', '{}', '{}',
        'rc-wechat-agent', 'general',
      ]
    );
    saveDb();
  }

  // ── Token Channels 列迁移 ──
  safeAlter(db, "ALTER TABLE token_channels ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE token_channels ADD COLUMN is_preset INTEGER NOT NULL DEFAULT 0");

  // ── Projects 列迁移 ──
  safeAlter(db, "ALTER TABLE projects ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE projects ADD COLUMN goal TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE projects ADD COLUMN priority TEXT NOT NULL DEFAULT 'mid'");
  safeAlter(db, "ALTER TABLE projects ADD COLUMN start_time TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE projects ADD COLUMN end_time TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE projects ADD COLUMN decision_maker TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE projects ADD COLUMN workflow_nodes TEXT NOT NULL DEFAULT '[]'");
  safeAlter(db, "ALTER TABLE projects ADD COLUMN created_by TEXT");

  // ── Tasks 列迁移 ──
  safeAlter(db, "ALTER TABLE tasks ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE tasks ADD COLUMN task_code TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_task_code ON tasks(task_code)");
  safeAlter(db, "ALTER TABLE tasks ADD COLUMN agent_id TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE tasks ADD COLUMN created_by TEXT");

  // ── File Assets 索引 ──
  safeAlter(db, "CREATE INDEX IF NOT EXISTS idx_file_assets_user_created ON file_assets(user_id, created_at)");
  safeAlter(db, "CREATE INDEX IF NOT EXISTS idx_file_assets_project ON file_assets(project_id)");
  safeAlter(db, "CREATE INDEX IF NOT EXISTS idx_file_assets_conversation ON file_assets(conversation_id)");

  // ── Conversations 列迁移 ──
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN task_id TEXT UNIQUE");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN created_by TEXT");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN agent_id TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN agent_ids TEXT NOT NULL DEFAULT '[]'");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN current_agent_id TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN session_code TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN current_agent_code TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "CREATE INDEX IF NOT EXISTS idx_conversations_session_code ON conversations(session_code)");
  safeAlter(db, "CREATE INDEX IF NOT EXISTS idx_conversations_current_agent_code ON conversations(current_agent_code)");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN status TEXT NOT NULL DEFAULT 'in_progress'");
  safeAlter(db, "CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status)");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN scope_type TEXT NOT NULL DEFAULT 'user'");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN scope_id TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN memory_policy TEXT NOT NULL DEFAULT 'private'");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN summary TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN last_message_at TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN oc_session_key TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "CREATE INDEX IF NOT EXISTS idx_conversations_oc_session_key ON conversations(oc_session_key)");
  safeAlter(db, "CREATE INDEX IF NOT EXISTS idx_conversations_scope ON conversations(scope_type, scope_id)");

  // ── Conversation Agents 数据迁移 ──
  try {
    const existing = db.exec(`
      SELECT c.id as conv_id, c.agent_id, c.created_at
      FROM conversations c
      WHERE c.agent_id IS NOT NULL AND c.agent_id != ''
        AND NOT EXISTS (
          SELECT 1 FROM conversation_agents ca WHERE ca.conversation_id = c.id
        )
    `);
    if (existing.length && existing[0].values.length) {
      for (const row of existing[0].values) {
        const [convId, agentId, createdAt] = row as string[];
        db.run(
          `INSERT OR IGNORE INTO conversation_agents (conversation_id, agent_id, joined_at) VALUES (?,?,?)`,
          [convId, agentId, createdAt]
        );
      }
    }
  } catch { /* 旧库无 agent_id 列时静默跳过 */ }

  // ── Messages 列迁移 ──
  safeAlter(db, "ALTER TABLE messages ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE messages ADD COLUMN message_code TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "DROP INDEX IF EXISTS idx_messages_message_code");
  safeAlter(db, "CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_message_code ON messages(message_code) WHERE message_code != ''");
  safeAlter(db, "ALTER TABLE messages ADD COLUMN token_count INTEGER NOT NULL DEFAULT 0");

  // ── Memories 索引 ──
  safeAlter(db, "CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id)");
  safeAlter(db, "CREATE INDEX IF NOT EXISTS idx_memories_user_agent ON memories(user_id, agent_id)");
  safeAlter(db, "CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category)");
  safeAlter(db, "CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC)");

  // ── Bot Channels 索引 ──
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS bot_channels_type ON bot_channels(channel_type)`);

  // ── Users 列迁移 ──
  safeAlter(db, "ALTER TABLE users ADD COLUMN user_code TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_code ON users(user_code)");
  safeAlter(db, "ALTER TABLE users ADD COLUMN nickname TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname) WHERE nickname != ''");

  // ── Departments 索引 ──
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_code ON departments(department_code)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_departments_parent_id ON departments(parent_id)`);

  // ── Roles 索引 ──
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_code ON roles(role_code)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_roles_scope ON roles(scope_type, scope_id)`);

  // ── Permission Templates 索引 ──
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_permission_templates_code ON permission_templates(template_code)`);

  // ── User Org Scope 索引 ──
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_org_scope_unique ON user_org_scope(user_id, department_id, role_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_org_scope_user ON user_org_scope(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_org_scope_department ON user_org_scope(department_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_org_scope_role ON user_org_scope(role_id)`);

  // ── User Proxy Grants 索引 ──
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_proxy_grants_unique ON user_proxy_grants(user_id, agent_id, grant_type, scope_type, scope_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_proxy_grants_user ON user_proxy_grants(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_proxy_grants_agent ON user_proxy_grants(agent_id)`);

  // ── User Data Grants 索引 ──
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_data_grants_unique ON user_data_grants(user_id, resource_type, resource_id, grant_type, scope_type, scope_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_data_grants_user ON user_data_grants(user_id)`);

  // ── Session Tabs 索引 ──
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS session_tabs_user_key ON session_tabs(user_id, browser_tab_key)`);

  // ── Session Mapping 列迁移 + 索引 ──
  safeAlter(db, "ALTER TABLE session_mapping ADD COLUMN channel TEXT NOT NULL DEFAULT 'repaceclaw'");
  db.run(`CREATE INDEX IF NOT EXISTS session_mapping_conv_id ON session_mapping(conversation_id)`);

  // ── Usage Stats 索引 ──
  db.run(`CREATE INDEX IF NOT EXISTS usage_stats_date ON usage_stats(date)`);
}
