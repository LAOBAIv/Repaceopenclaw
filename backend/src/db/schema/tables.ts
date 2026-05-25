// tables.ts — 所有 CREATE TABLE 语句（按表分组）
import type { DbLike } from '../sqlite-compat';

export function createTables(db: DbLike): void {
  // ── Agents ──
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

  // ── Token Channels ──
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

  // ── Projects ──
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

  // ── Tasks ──
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

  // ── Documents ──
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

  // ── Document Versions ──
  db.run(`
    CREATE TABLE IF NOT EXISTS document_versions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      content TEXT NOT NULL,
      snapshot_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    )
  `);

  // ── File Assets ──
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

  // ── Conversations ──
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

  // ── Conversation Agents ──
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

  // ── Messages ──
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

  // ── Memories ──
  db.run(`
    CREATE TABLE IF NOT EXISTS memories (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      agent_id        TEXT,
      conversation_id TEXT,
      category        TEXT NOT NULL DEFAULT 'other',
      title           TEXT,
      content         TEXT NOT NULL,
      source          TEXT NOT NULL DEFAULT 'manual',
      importance      INTEGER NOT NULL DEFAULT 5,
      access_count    INTEGER NOT NULL DEFAULT 0,
      last_access     TEXT,
      created_at      TEXT NOT NULL
    )
  `);

  // ── Memory Vectors ──
  db.run(`
    CREATE TABLE IF NOT EXISTS memory_vectors (
      memory_id  TEXT PRIMARY KEY,
      vector     TEXT NOT NULL,
      model      TEXT NOT NULL DEFAULT 'text-embedding-3-small',
      dimension  INTEGER NOT NULL DEFAULT 1536,
      FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
    )
  `);

  // ── Audit Logs ──
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

  // ── Agent Registry Log ──
  db.run(`
    CREATE TABLE IF NOT EXISTS agent_registry_log (
      id          TEXT PRIMARY KEY,
      agent_id    TEXT NOT NULL,
      action      TEXT NOT NULL,
      result      TEXT,
      created_at  TEXT NOT NULL
    )
  `);

  // ── Channel Accounts ──
  db.run(`
    CREATE TABLE IF NOT EXISTS channel_accounts (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL DEFAULT '',
      agent_id    TEXT NOT NULL,
      channel     TEXT NOT NULL,
      account_id  TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'active',
      config      TEXT NOT NULL DEFAULT '{}',
      created_at  TEXT NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    )
  `);

  // ── Agent Templates ──
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

  // ── Bot Channels ──
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

  // ── Skills ──
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

  // ── Agent Skills ──
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

  // ── Users ──
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

  // ── Departments ──
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

  // ── Roles ──
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

  // ── Permission Templates ──
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

  // ── User Org Scope ──
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

  // ── User Proxy Grants ──
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

  // ── User Data Grants ──
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

  // ── Plugins ──
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

  // ── Agent Plugins ──
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

  // ── Session Tabs ──
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

  // ── Session Mapping ──
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

  // ── Usage Stats ──
  db.run(`
    CREATE TABLE IF NOT EXISTS usage_stats (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL DEFAULT '',
      agent_id    TEXT NOT NULL DEFAULT '',
      date        TEXT NOT NULL,
      tokens_used INTEGER NOT NULL DEFAULT 0,
      conv_count  INTEGER NOT NULL DEFAULT 0,
      updated_at  TEXT NOT NULL,
      UNIQUE(user_id, agent_id, date)
    )
  `);
}
