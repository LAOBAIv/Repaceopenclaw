// [2026-05-18] 从 client.ts 拆分出表结构定义（DDL）
import { saveDb } from './client';
import logger from '../utils/logger';

/** 安全执行 ALTER/CREATE 等幂等 DDL，只静默 "duplicate column" 类错误 */
function safeAlter(db: any, sql: string): void {
  try {
    db.run(sql);
  } catch (e: any) {
    const msg = (e?.message || '').toLowerCase();
    if (msg.includes('duplicate column') || msg.includes('already exists')) return;
    logger.warn(`[DB Schema] DDL failed: ${sql.slice(0, 80)}... | ${e.message}`);
  }
}

/** 创建所有表结构（幂等，CREATE IF NOT EXISTS） */
export function createTables(db: any) {
  db.run(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366F1',
      system_prompt TEXT NOT NULL DEFAULT '',
      writing_style TEXT NOT NULL DEFAULT 'balanced',
      expertise TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'idle',
      model_name TEXT NOT NULL DEFAULT '',
      model_provider TEXT NOT NULL DEFAULT '',
      temperature REAL NOT NULL DEFAULT 0.7,
      max_tokens INTEGER NOT NULL DEFAULT 4096,
      top_p REAL NOT NULL DEFAULT 1,
      frequency_penalty REAL NOT NULL DEFAULT 0,
      presence_penalty REAL NOT NULL DEFAULT 0,
      token_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  // Migrate: add columns if they don't exist (idempotent)
  safeAlter(db, "ALTER TABLE agents ADD COLUMN description TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN status TEXT NOT NULL DEFAULT 'idle'");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN model_name TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN model_provider TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN temperature REAL NOT NULL DEFAULT 0.7");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN max_tokens INTEGER NOT NULL DEFAULT 4096");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN top_p REAL NOT NULL DEFAULT 1");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN frequency_penalty REAL NOT NULL DEFAULT 0");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN presence_penalty REAL NOT NULL DEFAULT 0");
  // Migrate: add user_id to agents (Phase 1: 多租户隔离)
  safeAlter(db, "ALTER TABLE agents ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
  // Dual-code Phase 1: agent_code 作为业务智能体编码，底层主键仍保留 id(UUID)
  safeAlter(db, "ALTER TABLE agents ADD COLUMN agent_code TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_user_agent_code ON agents(user_id, agent_code)");
  // Token 接入字段：用户为该智能体配置的私有 API Key
  safeAlter(db, "ALTER TABLE agents ADD COLUMN token_provider TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN token_api_key TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN token_base_url TEXT NOT NULL DEFAULT ''");
  // 输出格式 & 能力边界（2026-03 新增）
  safeAlter(db, "ALTER TABLE agents ADD COLUMN output_format TEXT NOT NULL DEFAULT '纯文本'");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN boundary TEXT NOT NULL DEFAULT ''");
  // 对话记忆轮数（0 = 不限）；temperature_override 为简单温度快捷覆盖（空字符串表示使用模型默认）
  safeAlter(db, "ALTER TABLE agents ADD COLUMN memory_turns INTEGER NOT NULL DEFAULT 0");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN temperature_override REAL DEFAULT NULL");
  // Token 用量统计：累计该智能体消耗的 token 总数（每次 agent 回复后累加）
  safeAlter(db, "ALTER TABLE agents ADD COLUMN token_used INTEGER NOT NULL DEFAULT 0");

  // Phase 3: Agent 可见性 / Skill 管控 / 配额
  safeAlter(db, "ALTER TABLE agents ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN skills_config TEXT NOT NULL DEFAULT '{}'");
  safeAlter(db, "ALTER TABLE agents ADD COLUMN quota_config TEXT NOT NULL DEFAULT '{}'");
  // Route C Phase 1: Agent 桥接层 — OpenClaw agentId 映射
  safeAlter(db, "ALTER TABLE agents ADD COLUMN openclaw_agent_id TEXT");
  // RC 分类 -> OC 执行桶。历史库若缺失此列，会导致 /api/agents/routing-overview 与编辑更新链直接报错。
  safeAlter(db, "ALTER TABLE agents ADD COLUMN agent_type TEXT NOT NULL DEFAULT 'general'");

  // Route C Phase 1: Agent 注册日志表

  // ── 微信助手智能体：DB 幂等插入 ──
  // 目的：系统级智能体落入 agents 表，支持模型切换等标准操作
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

  // Migrate: add user_id to token_channels (Phase 2: 多租户隔离)
  safeAlter(db, "ALTER TABLE token_channels ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
  // Migrate: add is_preset (标记平台预设渠道)
  safeAlter(db, "ALTER TABLE token_channels ADD COLUMN is_preset INTEGER NOT NULL DEFAULT 0");

  // Token channels: stores API keys for each LLM provider
  db.run(`
    CREATE TABLE IF NOT EXISTS token_channels (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      model_name TEXT NOT NULL DEFAULT '',
      base_url TEXT NOT NULL DEFAULT '',
      api_key TEXT NOT NULL DEFAULT '',
      auth_type TEXT NOT NULL DEFAULT 'Bearer',
      enabled INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      goal TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'mid',
      start_time TEXT NOT NULL DEFAULT '',
      end_time TEXT NOT NULL DEFAULT '',
      decision_maker TEXT NOT NULL DEFAULT '',
      workflow_nodes TEXT NOT NULL DEFAULT '[]',
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Migrate: add user_id to projects (Phase 2: 多租户隔离)
  safeAlter(db, "ALTER TABLE projects ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
  // Migrate: add workflow columns to existing projects table (idempotent)
  safeAlter(db, "ALTER TABLE projects ADD COLUMN goal TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE projects ADD COLUMN priority TEXT NOT NULL DEFAULT 'mid'");
  safeAlter(db, "ALTER TABLE projects ADD COLUMN start_time TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE projects ADD COLUMN end_time TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE projects ADD COLUMN decision_maker TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE projects ADD COLUMN workflow_nodes TEXT NOT NULL DEFAULT '[]'");
  safeAlter(db, "ALTER TABLE projects ADD COLUMN created_by TEXT");

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      column_id TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'mid',
      tags TEXT NOT NULL DEFAULT '[]',
      agent TEXT NOT NULL DEFAULT '',
      agent_color TEXT NOT NULL DEFAULT '#6366F1',
      agent_id TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL DEFAULT '',
      comment_count INTEGER NOT NULL DEFAULT 0,
      file_count INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  // Migrate: add user_id to tasks (Phase 2: 多租户隔离)
  safeAlter(db, "ALTER TABLE tasks ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
  // Dual-code Phase 1: task_code 作为业务任务编码（session_code 将与之对齐）
  safeAlter(db, "ALTER TABLE tasks ADD COLUMN task_code TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_task_code ON tasks(task_code)");
  // Migrate: add agent_id and created_by to existing tasks table (idempotent)
  safeAlter(db, "ALTER TABLE tasks ADD COLUMN agent_id TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE tasks ADD COLUMN created_by TEXT");

  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      parent_id TEXT,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      node_order INTEGER NOT NULL DEFAULT 0,
      assigned_agent_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS document_versions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      content TEXT NOT NULL,
      snapshot_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    )
  `);

  // 文件资产表：按 user_id 做强隔离，承载上传文档元数据；原始文件落盘到 uploads/user_id/... 目录。
  db.run(`
    CREATE TABLE IF NOT EXISTS file_assets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL DEFAULT '',
      conversation_id TEXT NOT NULL DEFAULT '',
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT '',
      extension TEXT NOT NULL DEFAULT '',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      storage_path TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'uploaded',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  safeAlter(db, "CREATE INDEX IF NOT EXISTS idx_file_assets_user_created ON file_assets(user_id, created_at)");
  safeAlter(db, "CREATE INDEX IF NOT EXISTS idx_file_assets_project ON file_assets(project_id)");
  safeAlter(db, "CREATE INDEX IF NOT EXISTS idx_file_assets_conversation ON file_assets(conversation_id)");

  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      task_id TEXT UNIQUE,
      title TEXT NOT NULL DEFAULT 'New Conversation',
      created_by TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    )
  `);
  // Migrate: add user_id to conversations (Phase 1: 多租户隔离)
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
  // Migrate: add task_id and created_by columns (idempotent)
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN task_id TEXT UNIQUE");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN created_by TEXT");
  // 兼容旧服务层：当前仍有创建/更新逻辑会写 conversations.agent_id / agent_ids 快照列。
  // 历史某些库是先建了精简版 conversations 表，再逐步演进；如果这里只补 current_agent_id 而没补旧快照列，
  // 会在创建平台助手等新会话时直接报 “table conversations has no column named agent_id / agent_ids”，表现为前端发送按钮可点、但会话永远发不出去。
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN agent_id TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN agent_ids TEXT NOT NULL DEFAULT '[]'");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN current_agent_id TEXT NOT NULL DEFAULT ''");
  // Dual-code Phase 1: session_code / current_agent_code 作为业务会话编码与业务当前智能体编码
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN session_code TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN current_agent_code TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "CREATE INDEX IF NOT EXISTS idx_conversations_session_code ON conversations(session_code)");
  safeAlter(db, "CREATE INDEX IF NOT EXISTS idx_conversations_current_agent_code ON conversations(current_agent_code)");
  // Status: 会话状态（in_progress | completed | archived）
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN status TEXT NOT NULL DEFAULT 'in_progress'");
  safeAlter(db, "CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status)");
  // V1 Session 基础字段：为后续共享/独享、组织作用域、摘要聚合预留，但当前先只在会话层落结构。
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN scope_type TEXT NOT NULL DEFAULT 'user'");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN scope_id TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN memory_policy TEXT NOT NULL DEFAULT 'private'");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN summary TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN last_message_at TEXT NOT NULL DEFAULT ''");
  // RC -> OC 会话绑定真相源。历史部分库缺这列，会导致 bindOpenClawSession() 在用户消息入库后直接抛错，
  // 表现为“自己的消息能看到，但智能体永远没回复”。
  safeAlter(db, "ALTER TABLE conversations ADD COLUMN oc_session_key TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "CREATE INDEX IF NOT EXISTS idx_conversations_oc_session_key ON conversations(oc_session_key)");
  safeAlter(db, "CREATE INDEX IF NOT EXISTS idx_conversations_scope ON conversations(scope_type, scope_id)");

  // Migrate: drop old agent_id column (SQLite does not support DROP COLUMN before 3.35;
  // we simply ignore it — the column stays but is no longer used)
  // New designs read agent list from conversation_agents table instead.

  // conversation_agents: 一个会话可包含多个智能体（多对多关联）
  db.run(`
    CREATE TABLE IF NOT EXISTS conversation_agents (
      conversation_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      PRIMARY KEY (conversation_id, agent_id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    )
  `);

  // Migrate: populate conversation_agents from existing conversations.agent_id (idempotent)
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

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      agent_id TEXT,
      token_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `);
  // Migrate: add user_id to messages (Phase 1: 多租户隔离)
  safeAlter(db, "ALTER TABLE messages ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
  // Dual-code Phase 1: message_code 作为业务消息编码，底层主键仍为 id(UUID)
  safeAlter(db, "ALTER TABLE messages ADD COLUMN message_code TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_message_code ON messages(message_code)");
  // Migrate: add token_count to existing messages table (idempotent)
  safeAlter(db, "ALTER TABLE messages ADD COLUMN token_count INTEGER NOT NULL DEFAULT 0");

  // ── Audit Logs（操作审计日志）────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      action     TEXT NOT NULL,
      resource   TEXT NOT NULL,
      resource_id TEXT,
      detail     TEXT NOT NULL DEFAULT '{}',
      ip_address TEXT,
      user_agent TEXT,
      request_id TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // ── Agent Registry Log（OpenClaw 注册日志）───────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS agent_registry_log (
      id          TEXT PRIMARY KEY,
      agent_id    TEXT NOT NULL,
      action      TEXT NOT NULL,          -- register / unregister / update
      result      TEXT,
      created_at  TEXT NOT NULL
    )
  `);

  // ── Channel Accounts（渠道账号路由）─────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS channel_accounts (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL DEFAULT '',
      agent_id    TEXT NOT NULL,
      channel     TEXT NOT NULL,          -- feishu / telegram / discord / whatsapp
      account_id  TEXT NOT NULL,          -- 渠道侧账号标识
      status      TEXT NOT NULL DEFAULT 'active',
      config      TEXT NOT NULL DEFAULT '{}',
      created_at  TEXT NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    )
  `);

  // ── Agent Templates（agency-agents 导入的专业角色模板库）───────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS agent_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'engineering',
      emoji TEXT NOT NULL DEFAULT '🤖',
      color TEXT NOT NULL DEFAULT '#6366F1',
      vibe TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      system_prompt TEXT NOT NULL DEFAULT '',
      writing_style TEXT NOT NULL DEFAULT 'balanced',
      expertise TEXT NOT NULL DEFAULT '[]',
      output_format TEXT NOT NULL DEFAULT '纯文本',
      github_source TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )
  `);

  // ── Bot Channels（飞书 / 企业微信 / 钉钉 Bot 接入）───────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS bot_channels (
      id TEXT PRIMARY KEY,
      channel_type TEXT NOT NULL,
      bot_id TEXT NOT NULL DEFAULT '',
      secret TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  // unique index: one row per channel_type
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS bot_channels_type ON bot_channels(channel_type)`);

  // ── Skills ──────────────────────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'general',
      type TEXT NOT NULL DEFAULT 'builtin',
      config TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // agent_skills: 技能与智能体的关联表（多对多）
  db.run(`
    CREATE TABLE IF NOT EXISTS agent_skills (
      agent_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      bound_at TEXT NOT NULL,
      PRIMARY KEY (agent_id, skill_id),
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    )
  `);

  // ── Users ────────────────────────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      avatar TEXT NOT NULL DEFAULT '',
      last_login_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  // Dual-code Phase 1: user_code 作为 10 位业务用户编码，底层主键仍为 id(UUID)
  safeAlter(db, "ALTER TABLE users ADD COLUMN user_code TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_code ON users(user_code)");
  // [2026-05-17] 添加 nickname 字段（账号昵称，不可重复）
  safeAlter(db, "ALTER TABLE users ADD COLUMN nickname TEXT NOT NULL DEFAULT ''");
  safeAlter(db, "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname) WHERE nickname != ''");

  // ── V1 Organization / Permission Foundation ────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      department_code TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      parent_id TEXT,
      owner_user_id TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL
    )
  `);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_code ON departments(department_code)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_departments_parent_id ON departments(parent_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      role_code TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      scope_type TEXT NOT NULL DEFAULT 'department',
      scope_id TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      permissions_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_code ON roles(role_code)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_roles_scope ON roles(scope_type, scope_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS permission_templates (
      id TEXT PRIMARY KEY,
      template_code TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      template_type TEXT NOT NULL DEFAULT 'base',
      config_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_permission_templates_code ON permission_templates(template_code)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_org_scope (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      department_id TEXT,
      role_id TEXT,
      permission_template_id TEXT,
      title TEXT NOT NULL DEFAULT '',
      is_primary INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      joined_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL,
      FOREIGN KEY (permission_template_id) REFERENCES permission_templates(id) ON DELETE SET NULL
    )
  `);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_org_scope_unique ON user_org_scope(user_id, department_id, role_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_org_scope_user ON user_org_scope(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_org_scope_department ON user_org_scope(department_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_org_scope_role ON user_org_scope(role_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_proxy_grants (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      grant_type TEXT NOT NULL DEFAULT 'use',
      scope_type TEXT NOT NULL DEFAULT 'direct',
      scope_id TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    )
  `);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_proxy_grants_unique ON user_proxy_grants(user_id, agent_id, grant_type, scope_type, scope_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_proxy_grants_user ON user_proxy_grants(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_proxy_grants_agent ON user_proxy_grants(agent_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_data_grants (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL DEFAULT '',
      grant_type TEXT NOT NULL DEFAULT 'read',
      scope_type TEXT NOT NULL DEFAULT 'direct',
      scope_id TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_data_grants_unique ON user_data_grants(user_id, resource_type, resource_id, grant_type, scope_type, scope_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_data_grants_user ON user_data_grants(user_id)`);

  // ── Plugins ─────────────────────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS plugins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      version TEXT NOT NULL DEFAULT '1.0.0',
      author TEXT NOT NULL DEFAULT '',
      homepage TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'general',
      config TEXT NOT NULL DEFAULT '{}',
      manifest TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      installed_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // agent_plugins: 插件与智能体的关联表（多对多）
  db.run(`
    CREATE TABLE IF NOT EXISTS agent_plugins (
      agent_id TEXT NOT NULL,
      plugin_id TEXT NOT NULL,
      bound_at TEXT NOT NULL,
      PRIMARY KEY (agent_id, plugin_id),
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
      FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
    )
  `);

  // ── Session Tabs（BrowserTab ↔ SessionTab 绑定关系）───────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS session_tabs (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL DEFAULT '',
      browser_tab_key TEXT NOT NULL,
      title           TEXT NOT NULL DEFAULT '',
      conversation_id TEXT NOT NULL DEFAULT '',
      agent_id        TEXT NOT NULL DEFAULT '',
      agent_name      TEXT NOT NULL DEFAULT '',
      color           TEXT NOT NULL DEFAULT '#9ca3af',
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    )
  `);
  // 同一用户下 browser_tab_key 唯一
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS session_tabs_user_key ON session_tabs(user_id, browser_tab_key)`);

  // ── Session Mapping（OpenClaw session ↔ RepaceClaw conversation 映射）───
  db.run(`
    CREATE TABLE IF NOT EXISTS session_mapping (
      id              TEXT PRIMARY KEY,
      oc_session_key  TEXT NOT NULL UNIQUE,
      conversation_id TEXT NOT NULL DEFAULT '',
      session_file    TEXT NOT NULL DEFAULT '',
      agent_id        TEXT NOT NULL DEFAULT '',
      agent_ids       TEXT NOT NULL DEFAULT '[]',
      channel         TEXT NOT NULL DEFAULT 'repaceclaw',
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    )
  `);
  safeAlter(db, "ALTER TABLE session_mapping ADD COLUMN channel TEXT NOT NULL DEFAULT 'repaceclaw'");
  db.run(`CREATE INDEX IF NOT EXISTS session_mapping_conv_id ON session_mapping(conversation_id)`);

  // ── 用量统计（配额限制基础）─────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS usage_stats (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL DEFAULT '',
      agent_id    TEXT NOT NULL DEFAULT '',
      date        TEXT NOT NULL,          -- YYYY-MM-DD
      tokens_used INTEGER NOT NULL DEFAULT 0,
      conv_count  INTEGER NOT NULL DEFAULT 0,
      updated_at  TEXT NOT NULL,
      UNIQUE(user_id, agent_id, date)
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS usage_stats_date ON usage_stats(date)`);
}

