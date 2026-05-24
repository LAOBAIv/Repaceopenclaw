import { v4 as uuidv4 } from "uuid";
import fs from 'fs';
import { logger } from '../utils/logger';
import { getDb, saveDb } from "../db/client";
import { IdGenerator } from '../utils/IdGenerator';
import { OpenClawAdapter } from "./llm/OpenClawAdapter";
import { ILLMAdapter } from "./llm/LLMAdapter";
import * as AgentBridge from "./AgentBridge";
import { toOpenClawAgentId } from './AgentBridge/AgentMapper';


export interface Agent {
  id: string;
  /** 系统保留智能体:平台级公共服务智能体 */
  isSystem?: boolean;
  /** 业务智能体编码:8 位,同一用户下唯一 */
  agentCode?: string;
  /** 所属用户 ID */
  userId?: string;
  name: string;
  color: string;
  systemPrompt: string;
  writingStyle: string;
  expertise: string[];
  description: string;
  status: "active" | "idle" | "busy";
  modelName: string;
  modelProvider: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  // 用户配置的私有 Token 接入
  tokenProvider: string;
  tokenApiKey: string;
  tokenBaseUrl: string;
  // 输出格式 & 能力边界
  outputFormat: string;
  boundary: string;
  // 对话记忆轮数(0 = 不限)
  memoryTurns: number;
  // 简单温度快捷覆盖(null 表示使用 CODE 渠道模型默认值)
  temperatureOverride: number | null;
  // Token 用量统计:累计消耗 token 总数
  tokenUsed: number;
  // Phase 3: 可见性 / Skill 管控 / 配额
  visibility: 'private' | 'public' | 'template' | 'system';
  skillsConfig: Record<string, boolean>;
  quotaConfig: { maxDailyTokens?: number; maxDailyConversations?: number; maxTokensPerMessage?: number };
  // Route C: OpenClaw agentId 映射
  openclawAgentId: string | null;
  /** 业务类型:dev | data | creative | pm | research | ops | decision | general */
  agentType?: string;
  createdAt: string;
}

// [2026-05-24] 类型安全:any → DbRow(DB 行映射,保留属性访问)
// [2026-05-24] 类型安全:any → unknown
export interface DbRow { [key: string]: unknown }

function rowToAgent(obj: DbRow): Agent {
  // [2026-05-24] 类型安全:unknown 索引签名需要断言后访问属性
  const r = obj as Record<string, unknown>;
  const isPlatformAssistant = r.id === 'platform-assistant'
    || r.id === 'repaceclaw-platform-assistant'
    || r.id === '24cf6cc5-da0d-48df-814e-11582e398007'
    || r.openclaw_agent_id === 'repaceclaw-platform-assistant';

  return {
    id: r.id as string,
    agentCode: r.agent_code as string | undefined,
    userId: r.user_id as string | undefined,
    name: r.name as string,
    color: r.color as string,
    systemPrompt: r.system_prompt as string,
    writingStyle: r.writing_style as string,
    expertise: JSON.parse((r.expertise as string) || "[]"),
    description: (r.description as string) || "",
    status: ((r.status as string) || "idle") as Agent["status"],
    modelName: (r.model_name as string) || "",
    modelProvider: (r.model_provider as string) || "",
    temperature: (r.temperature as number) ?? 0.7,
    maxTokens: (r.max_tokens as number) ?? 4096,
    topP: (r.top_p as number) ?? 1,
    frequencyPenalty: (r.frequency_penalty as number) ?? 0,
    presencePenalty: (r.presence_penalty as number) ?? 0,
    tokenProvider: (r.token_provider as string) || "",
    tokenApiKey: (r.token_api_key as string) || "",
    tokenBaseUrl: (r.token_base_url as string) || "",
    outputFormat: isPlatformAssistant ? 'Markdown' : ((r.output_format as string) || '纯文本'),
    boundary: (r.boundary as string) || "",
    memoryTurns: (r.memory_turns as number) ?? 0,
    temperatureOverride: (r.temperature_override as number | null) ?? null,
    tokenUsed: (r.token_used as number) ?? 0,
    visibility: ((r.visibility as string) || 'private') as Agent['visibility'],
    skillsConfig: JSON.parse((r.skills_config as string) || '{}'),
    quotaConfig: JSON.parse((r.quota_config as string) || '{}'),
    openclawAgentId: (r.openclaw_agent_id as string) || null,
    agentType: (r.agent_type as string) || 'general',
    createdAt: r.created_at as string,
    isSystem: false,
  };
}

function loadPlatformAssistantRuntimeConfig() {
  try {
    const raw = fs.readFileSync('/root/.openclaw/openclaw.json', 'utf-8');
    const obj = JSON.parse(raw);
    // [2026-05-24] 类型安全：any → unknown
    const agent = (obj?.agents?.list || []).find((a: unknown) => ((a as Record<string, unknown>)?.id) === 'repaceclaw-platform-assistant');
    return {
      name: ((agent as Record<string, unknown>)?.name as string) || 'RepaceClaw 平台助手',
      workspace: ((agent as Record<string, unknown>)?.workspace as string) || '/root/.openclaw/workspace',
      model: ((agent as Record<string, unknown>)?.model as string) || 'linkApi/claude-opus-4-6',
      skills: Array.isArray((agent as Record<string, unknown>)?.skills) ? (agent as Record<string, unknown>).skills as unknown[] : [],
      agentDir: ((agent as Record<string, unknown>)?.agentDir as string) || '/root/.openclaw/agents/repaceclaw-platform-assistant/agent',
    };
  } catch {
    return {
      name: 'RepaceClaw 平台助手',
      workspace: '/root/.openclaw/workspace',
      model: 'linkApi/claude-opus-4-6',
      skills: [],
      agentDir: '/root/.openclaw/agents/repaceclaw-platform-assistant/agent',
    };
  }
}

function buildPlatformAssistantAgent(): Agent {
  const runtime = loadPlatformAssistantRuntimeConfig();
  // 从 DB 读取真实 UUID,保证 list() / getById() / 前端引用使用同一个 id
  let dbId = 'repaceclaw-platform-assistant';
  try {
    const db = getDb();
    const result = db.exec(`SELECT id FROM agents WHERE openclaw_agent_id = 'repaceclaw-platform-assistant' AND name LIKE '%平台助手%' LIMIT 1`);
    if (result.length && result[0].values.length) {
      dbId = result[0].values[0][0] as string;
    }
  } catch {}
  return {
    id: dbId,
    agentCode: 'platform-assistant',
    userId: '',
    name: runtime.name,
    color: '#2563eb',
    systemPrompt: '平台级全域服务智能体,负责平台答疑、使用帮助、功能说明。',
    writingStyle: 'professional',
    expertise: ['platform', 'help', 'guide', ...runtime.skills.map(String)],
    description: `平台公共服务智能体,对所有登录用户开放,用于解答 RepaceClaw 平台使用问题。工作区:${runtime.workspace}`,
    status: 'active',
    modelName: `openclaw/repaceclaw-platform-assistant`,
    modelProvider: 'openclaw',
    temperature: 0.3,
    maxTokens: 4096,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    tokenProvider: '',
    tokenApiKey: '',
    tokenBaseUrl: '',
    outputFormat: 'Markdown',
    boundary: '仅回答平台功能、操作说明、使用帮助,不代替用户业务智能体执行私人任务。',
    memoryTurns: 0,
    temperatureOverride: null,
    tokenUsed: 0,
    visibility: 'public',
    skillsConfig: {},
    quotaConfig: {},
    openclawAgentId: 'repaceclaw-platform-assistant',
    createdAt: new Date(0).toISOString(),
    isSystem: true,
  };
}

function buildWechatAssistantAgent(): Agent {
  // ── 微信助手智能体配置(系统级公共智能体)──
  // 创建日期:2026-05-12
  // 用途:工作台内微信助手会话 Tab,用户点击后直接对话
  // 特征:visibility=public, 所有用户可见
  // 执行端:OpenClaw rc-wechat-agent(独立 workspace)
  // 会话 Key:agent:rc-wechat-agent:rc:{conversationId}
  // [2026-05-23] 修复:用 agent_code 查询(稳定),不依赖 openclaw_agent_id(会被 syncAllAgents 重置)
  const db = getDb();
  const result = db.exec(`SELECT * FROM agents WHERE agent_code = 'rc-wechat-agent' LIMIT 1`);
  if (!result.length || !result[0].values.length) {
    return null;
  }
  const cols = result[0].columns;
  const row = result[0].values[0];
  // [2026-05-24] 类型安全:any → Record<string, unknown>
  const r: Record<string, unknown> = {};
  cols.forEach((c, i) => { r[c] = row[i]; });
  // [2026-05-24] 类型安全：any → DbRow（unknown 索引签名需断言）
  const d = r as Record<string, unknown>;
  return {
    id: d.id as string,
    agentCode: (d.agent_code as string) || 'rc-wechat-agent',
    userId: (d.user_id as string) || '',
    name: (d.name as string) || '微信助手',
    color: (d.color as string) || '#2563eb',
    systemPrompt: (d.system_prompt as string) || '',
    writingStyle: (d.writing_style as string) || 'professional',
    expertise: JSON.parse((d.expertise as string) || '[]'),
    description: (d.description as string) || '',
    status: ((d.status as string) || 'active') as Agent["status"],
    modelName: (d.model_name as string) || 'qwen3.6-plus',
    modelProvider: (d.model_provider as string) || 'linkApi',
    temperature: (d.temperature as number) ?? 0.7,
    maxTokens: (d.max_tokens as number) ?? 4096,
    topP: (d.top_p as number) ?? 1,
    frequencyPenalty: (d.frequency_penalty as number) ?? 0,
    presencePenalty: (d.presence_penalty as number) ?? 0,
    tokenProvider: (d.token_provider as string) || '',
    tokenApiKey: (d.token_api_key as string) || '',
    tokenBaseUrl: (d.token_base_url as string) || '',
    outputFormat: (d.output_format as string) || 'Markdown',
    boundary: (d.boundary as string) || '',
    memoryTurns: (d.memory_turns as number) ?? 0,
    temperatureOverride: (d.temperature_override as number | null) ?? null,
    tokenUsed: (d.token_used as number) ?? 0,
    visibility: ((d.visibility as string) || 'public') as Agent['visibility'],
    skillsConfig: JSON.parse((d.skills_config as string) || '{}'),
    quotaConfig: JSON.parse((d.quota_config as string) || '{}'),
    openclawAgentId: (d.openclaw_agent_id as string) || 'rc-wechat-agent',
    createdAt: d.created_at as string,
    isSystem: true,
  };
}

export const AgentService = {
  isWechatAssistantId(id?: string | null) {
    if (!id) return false;
    // [2026-05-23] 增加硬编码 UUID 匹配,避免 buildWechatAssistantAgent 返回 null 时漏判
    if (id === 'rc-wechat-agent' || id === 'wechat-assistant' || id === '151194a0-385e-4fc6-8aca-c1622e5967f8') return true;
    try {
      const runtime = buildWechatAssistantAgent();
      if (!runtime) return false;
      return id === runtime.id || id === runtime.agentCode || id === runtime.openclawAgentId;
    } catch {
      return false;
    }
  },
  isPlatformAssistantId(id?: string | null) {
    // 同时识别 alias / 旧硬编码 UUID / 运行时真实 DB id,兼容迁移前后。
    if (!id) return false;
    if (id === 'platform-assistant' || id === 'repaceclaw-platform-assistant' || id === '24cf6cc5-da0d-48df-814e-11582e398007') {
      return true;
    }
    try {
      const runtime = buildPlatformAssistantAgent();
      return id === runtime.id || id === runtime.agentCode || id === runtime.openclawAgentId;
    } catch {
      return false;
    }
  },
  list(userId?: string): Agent[] {
    const db = getDb();
    let sql = "SELECT * FROM agents";
    // [2026-05-24] 类型安全:any → unknown
    const params: unknown[] = [];
    if (userId) {
      // 返回用户自己的 agent + public agent + system agent(如微信助手)
      sql += " WHERE user_id = ? OR visibility = 'public' OR visibility = 'system'";
      params.push(userId);
    }
    sql += " ORDER BY created_at DESC";
    const result = db.exec(sql, params.length ? params : undefined);
    let agents = !result.length ? [] : result[0].values.map((row) => {
      // [2026-05-24] 类型安全:any → Record<string, unknown>
      const obj: Record<string, unknown> = {};
      result[0].columns.forEach((c, i) => (obj[c] = row[i]));
      return rowToAgent(obj);
    });

    if (!userId) {
      // 未认证时也要返回平台助手(公共服务,全局可见)
      const platformAssistant = buildPlatformAssistantAgent();
      const exists = agents.some((a) => a.id === platformAssistant.id || a.openclawAgentId === platformAssistant.openclawAgentId);
      if (!exists) agents.unshift(platformAssistant);
      return agents.map((a) => this.isPlatformAssistantId(a.id) ? { ...a, isSystem: true } : a);
    }

    // 已认证:平台助手在列表中可见(标记 isSystem=true),但不可编辑/删除/选中
    // 用户只能通过专属入口打开会话沟通,不能作为协作者添加到其他会话
    const platformAssistant = buildPlatformAssistantAgent();
    const exists = agents.some((a) => a.id === platformAssistant.id || a.openclawAgentId === platformAssistant.openclawAgentId);
    if (!exists) {
      agents.unshift(platformAssistant);
    }
    const wechatAssistant = buildWechatAssistantAgent();
    // [2026-05-16] 防止 buildWechatAssistantAgent 返回 null 导致空指针
    if (wechatAssistant) {
      const wechatExists = agents.some((a) => a.id === wechatAssistant.id || a.openclawAgentId === wechatAssistant.openclawAgentId);
      if (!wechatExists) {
        agents.unshift(wechatAssistant);
      }
    }
    // 标记为系统级
    agents = agents.map((a) =>
      this.isPlatformAssistantId(a.id) || this.isWechatAssistantId(a.id)
        ? { ...a, isSystem: true }
        : a
    );

    return agents;
  },

  getById(id: string): Agent | null {
    if (id === 'platform-assistant' || id === 'repaceclaw-platform-assistant') {
      return buildPlatformAssistantAgent();
    }
    if (id === 'rc-wechat-agent' || id === 'wechat-assistant') {
      return buildWechatAssistantAgent();
    }
    const db = getDb();
    const result = db.exec(`SELECT * FROM agents WHERE id = ?`, [id]);
    if (!result.length || !result[0].values.length) return null;
    const cols = result[0].columns;
    const row = result[0].values[0];
    // [2026-05-24] 类型安全:any → Record<string, unknown>
    const obj: Record<string, unknown> = {};
    cols.forEach((c, i) => (obj[c] = row[i]));
    return rowToAgent(obj);
  },

  /**
   * Dual-code Phase 2:接口层允许同时传 UUID 或 agent_code。
   * 注意 agent_code 只保证"同一用户下唯一",所以优先要求调用方传 userId。
   */
  getByIdOrCode(idOrCode: string, userId?: string): Agent | null {
    if (idOrCode === 'platform-assistant' || idOrCode === 'repaceclaw-platform-assistant') {
      return buildPlatformAssistantAgent();
    }
    if (idOrCode === 'rc-wechat-agent' || idOrCode === 'wechat-assistant') {
      return buildWechatAssistantAgent();
    }
    const byId = this.getById(idOrCode);
    if (byId) return byId;

    const db = getDb();
    const sql = userId
      ? `SELECT * FROM agents WHERE user_id = ? AND agent_code = ? LIMIT 1`
      : `SELECT * FROM agents WHERE agent_code = ? LIMIT 1`;
    const params = userId ? [userId, idOrCode] : [idOrCode];
    const result = db.exec(sql, params);
    if (!result.length || !result[0].values.length) return null;
    const cols = result[0].columns;
    const row = result[0].values[0];
    // [2026-05-24] 类型安全:any → Record<string, unknown>
    const obj: Record<string, unknown> = {};
    cols.forEach((c, i) => (obj[c] = row[i]));
    return rowToAgent(obj);
  },

  /** 将 UUID/agent_code 统一解析成真实 UUID,便于后续更新/删除/外键写入。 */
  resolveId(idOrCode: string, userId?: string): string | null {
    return this.getByIdOrCode(idOrCode, userId)?.id || null;
  },

  /** 通过 OpenClaw Agent ID 查找 RepaceClaw agent */
  getByOpenClawAgentId(ocAgentId: string): Agent | null {
    const db = getDb();
    const result = db.exec(`SELECT * FROM agents WHERE openclaw_agent_id = ?`, [ocAgentId]);
    if (!result.length || !result[0].values.length) return null;
    const cols = result[0].columns;
    const row = result[0].values[0];
    // [2026-05-24] 类型安全:any → Record<string, unknown>
    const obj: Record<string, unknown> = {};
    cols.forEach((c, i) => (obj[c] = row[i]));
    return rowToAgent(obj);
  },

  create(data: Partial<Agent> & { name: string; userId?: string }): Agent {
    const db = getDb();
    // Dual-code Phase 1:底层主键切回 UUID;agent_code 负责业务标识。
    const id = uuidv4();
    const agentCode = IdGenerator.agentCode();
    const now = new Date().toISOString();

    // Phase 3: 高危 Skill 默认禁用
    const defaultSkillsConfig: Record<string, boolean> = {
      exec: false,
      shell: false,
      file_write: false,
      browser: false,
      web_search: true,
      file_read: true,
      image_generation: false,
    };
    const skillsConfig = data.skillsConfig || defaultSkillsConfig;

    // Phase 3: 默认配额
    const quotaConfig = data.quotaConfig || {};
    const agentType = data.agentType || 'general';
    const openclawAgentId = data.openclawAgentId || toOpenClawAgentId(agentType);

    db.run(
      `INSERT INTO agents (id, agent_code, name, color, system_prompt, writing_style, expertise, description, status,
        model_name, model_provider, temperature, max_tokens, top_p, frequency_penalty, presence_penalty,
        token_provider, token_api_key, token_base_url,
        output_format, boundary, memory_turns, temperature_override, user_id,
        visibility, skills_config, quota_config, openclaw_agent_id, agent_type,
        created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, agentCode, data.name, data.color, data.systemPrompt, data.writingStyle,
        JSON.stringify(data.expertise), data.description || "", data.status || "idle",
        data.modelName || "", data.modelProvider || "",
        data.temperature ?? 0.7, data.maxTokens ?? 4096,
        data.topP ?? 1, data.frequencyPenalty ?? 0, data.presencePenalty ?? 0,
        data.tokenProvider || "", data.tokenApiKey || "", data.tokenBaseUrl || "",
        data.outputFormat || "纯文本", data.boundary || "",
        data.memoryTurns ?? 0, data.temperatureOverride ?? null,
        data.userId || "",
        data.visibility || "private",
        JSON.stringify(skillsConfig),
        JSON.stringify(quotaConfig),
        openclawAgentId,
        agentType,
        now,
      ]
    );
    saveDb();
    // 从数据库重新读取,确保返回的对象字段与 rowToAgent 完全一致(含默认值)
    const agent = this.getById(id)!;

    // Route C Phase 1: 注册到 OpenClaw
    if (data.userId && agent) {
      AgentBridge.registerAgent(data.userId, agent).catch((err) => {
        logger.error(`[AgentService] Failed to register agent ${id} to OpenClaw:`, err.message);
      });
    }

    return agent;
  },

  // [2026-05-24] 类型安全:any → unknown
  update(id: string, data: Record<string, unknown>): Agent | null {
    const db = getDb();
    const existing = this.getById(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };

    // 平台助手改为统一 Markdown 输出,但仍然禁止回落到"预览+完整代码"。
    // 历史上这个字段多次被其它编辑链路/脏数据回写,直接导致助手回复重新出现:
    // - 预览
    // - 完整答复
    // 所以写入层继续做硬保护:平台助手固定为 Markdown,而不是任由 DB 脏写。
    if (this.isPlatformAssistantId(existing.id) || this.isPlatformAssistantId(existing.openclawAgentId)) {
      updated.outputFormat = 'Markdown';
    }

    const resolvedAgentType = updated.agentType || 'general';
    const resolvedOpenClawAgentId = updated.isSystem
      ? updated.openclawAgentId
      : toOpenClawAgentId(resolvedAgentType);
    db.run(
      `UPDATE agents SET name=?, color=?, system_prompt=?, writing_style=?, expertise=?, description=?, status=?,
        model_name=?, model_provider=?, temperature=?, max_tokens=?, top_p=?, frequency_penalty=?, presence_penalty=?,
        token_provider=?, token_api_key=?, token_base_url=?,
        output_format=?, boundary=?, memory_turns=?, temperature_override=?,
        visibility=?, skills_config=?, quota_config=?, openclaw_agent_id=?, agent_type=?
       WHERE id=?`,
      [
        updated.name, updated.color, updated.systemPrompt, updated.writingStyle,
        JSON.stringify(updated.expertise), updated.description, updated.status,
        updated.modelName || "", updated.modelProvider || "",
        updated.temperature ?? 0.7, updated.maxTokens ?? 4096,
        updated.topP ?? 1, updated.frequencyPenalty ?? 0, updated.presencePenalty ?? 0,
        updated.tokenProvider || "", updated.tokenApiKey || "", updated.tokenBaseUrl || "",
        updated.outputFormat || "纯文本", updated.boundary || "",
        updated.memoryTurns ?? 0, updated.temperatureOverride ?? null,
        updated.visibility || "private",
        JSON.stringify(updated.skillsConfig || {}),
        JSON.stringify(updated.quotaConfig || {}),
        resolvedOpenClawAgentId,
        resolvedAgentType,
        id,
      ]
    );
    saveDb();

    // Route C Phase 1: 如果 systemPrompt、writingStyle、expertise、outputFormat、boundary、modelName 有变更,更新 OpenClaw workspace
    const relevantFields = ['systemPrompt', 'writingStyle', 'expertise', 'outputFormat', 'boundary', 'modelName', 'modelProvider'];
    const hasRelevantChange = relevantFields.some(f => data[f] !== undefined);
    if (hasRelevantChange && existing.userId) {
      AgentBridge.updateAgent(existing.userId, id, updated).catch((err) => {
        logger.error(`[AgentService] Failed to update agent ${id} mapping:`, err.message);
      });
    }

    return updated;
  },

  delete(id: string): boolean {
    const db = getDb();
    const existing = this.getById(id);

    // Route C Phase 1: 先从 OpenClaw 注销
    if (existing && existing.userId) {
      AgentBridge.unregisterAgent(existing.userId, id).catch((err) => {
        logger.error(`[AgentService] Failed to unregister agent ${id} from OpenClaw:`, err.message);
      });
    }

    db.run(`DELETE FROM agents WHERE id=?`, [id]);
    saveDb();
    return true;
  },

  /**
   * 将本次调用消耗的 token 累加到 agents.token_used
   * 幂等安全:delta <= 0 时直接跳过
   */
  addTokenUsed(agentId: string, delta: number): void {
    if (delta <= 0) return;
    const db = getDb();
    db.run(`UPDATE agents SET token_used = token_used + ? WHERE id = ?`, [delta, agentId]);
    saveDb();
  },

  // ── 配额检查与用量统计 ────────────────────────────────────────────────

  /** 检查配额是否超限,返回 { allowed, reason } */
  checkQuota(
    agentId: string,
    userId: string,
  ): { allowed: boolean; reason?: string } {
    const agent = this.getById(agentId);
    if (!agent) return { allowed: false, reason: 'Agent 不存在' };
    const qc = agent.quotaConfig || {};
    if (!qc.maxDailyTokens && !qc.maxDailyConversations) return { allowed: true };

    const db = getDb();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const row = db.getRow(
      `SELECT tokens_used, conv_count FROM usage_stats
       WHERE user_id = ? AND agent_id = ? AND date = ?`,
      [userId, agentId, today],
    ) as { tokens_used: number; conv_count: number } | undefined;

    const tokensUsed = row?.tokens_used ?? 0;
    const convCount = row?.conv_count ?? 0;

    if (qc.maxDailyTokens && tokensUsed >= qc.maxDailyTokens) {
      return { allowed: false, reason: `今日 Token 用量已达上限 (${qc.maxDailyTokens})` };
    }
    if (qc.maxDailyConversations && convCount >= qc.maxDailyConversations) {
      return { allowed: false, reason: `今日对话次数已达上限 (${qc.maxDailyConversations})` };
    }
    return { allowed: true };
  },

  /** 获取单日 maxTokensPerMessage 限制 */
  getMaxTokensPerMessage(agentId: string): number | null {
    const agent = this.getById(agentId);
    if (!agent) return null;
    return agent.quotaConfig?.maxTokensPerMessage ?? null;
  },

  /** 记录一次对话的 token 消耗和对话次数 */
  recordUsage(userId: string, agentId: string, tokenCount: number): void {
    if (tokenCount <= 0) return;
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    try {
      db.run(
        `INSERT INTO usage_stats (id, user_id, agent_id, date, tokens_used, conv_count, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)
         ON CONFLICT(user_id, agent_id, date)
         DO UPDATE SET tokens_used = tokens_used + ?, conv_count = conv_count + 1, updated_at = ?`,
        [`usage_${userId}_${agentId}_${today}`, userId, agentId, today, tokenCount, now, tokenCount, now],
      );
      saveDb();
    } catch (err) {
      logger.error('[AgentService] recordUsage error:', err);
    }
  },

  async generateStream(
    agentId: string,
    messages: Array<{ role: string; content: string }>,
    onChunk: (chunk: string) => void,
    onComplete: (tokenCount: number) => void,
    onError: (err: Error) => void
  ) {
    const agent = this.getById(agentId);
    if (!agent) {
      onError(new Error(`Agent ${agentId} not found`));
      return;
    }

    const agentConfig = {
      id: agent.id,
      name: agent.name,
      systemPrompt: agent.systemPrompt,
      writingStyle: agent.writingStyle,
      expertise: agent.expertise,
      modelName: agent.modelName,
      modelProvider: agent.modelProvider,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      topP: agent.topP,
      frequencyPenalty: agent.frequencyPenalty,
      presencePenalty: agent.presencePenalty,
      tokenProvider: agent.tokenProvider,
      tokenApiKey: agent.tokenApiKey,
      tokenBaseUrl: agent.tokenBaseUrl,
      outputFormat: agent.outputFormat,
      boundary: agent.boundary,
      memoryTurns: agent.memoryTurns,
      temperatureOverride: agent.temperatureOverride,
    };

    // V1 强制统一:所有 RepaceClaw 智能体执行一律经 OpenClaw Gateway。
    // - 不再允许 tokenApiKey / token_channels 直连外部模型绕过 Gateway
    // - 所有请求统一带 x-openclaw-message-channel: repaceclaw
    logger.info(`[AgentService] Agent "${agent.name}" → OpenClawAdapter (gateway-forced)`);
    const adapter: ILLMAdapter = new OpenClawAdapter();
    await adapter.generateStream(agentConfig, messages, onChunk, onComplete, onError);
  },
};
