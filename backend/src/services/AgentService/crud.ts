import { v4 as uuidv4 } from "uuid";
import { logger } from '../../utils/logger';
import { getDb, saveDb } from "../../db/client";
import { IdGenerator } from '../../utils/IdGenerator';
import { OpenClawAdapter } from "../llm/OpenClawAdapter";
import { ILLMAdapter } from "../llm/LLMAdapter";
import * as AgentBridge from "../AgentBridge";
import { toOpenClawAgentId } from '../AgentBridge/AgentMapper';
import { rowToAgent, buildPlatformAssistantAgent, buildWechatAssistantAgent, type Agent } from './helpers';

export const AgentCrud = {
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
};
