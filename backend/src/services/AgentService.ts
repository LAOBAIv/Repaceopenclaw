import { v4 as uuidv4 } from "uuid";
import { getDb, saveDb } from "../db/client";
import { AutoLLMAdapter } from "./llm/AutoLLMAdapter";
import { ILLMAdapter } from "./llm/LLMAdapter";


export interface Agent {
  id: string;
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
  // 对话记忆轮数（0 = 不限）
  memoryTurns: number;
  // 简单温度快捷覆盖（null 表示使用 CODE 渠道模型默认值）
  temperatureOverride: number | null;
  // Token 用量统计：累计消耗 token 总数
  tokenUsed: number;
  createdAt: string;
}

function rowToAgent(obj: any): Agent {
  return {
    id: obj.id,
    name: obj.name,
    color: obj.color,
    systemPrompt: obj.system_prompt,
    writingStyle: obj.writing_style,
    expertise: JSON.parse(obj.expertise || "[]"),
    description: obj.description || "",
    status: (obj.status || "idle") as Agent["status"],
    modelName: obj.model_name || "",
    modelProvider: obj.model_provider || "",
    temperature: obj.temperature ?? 0.7,
    maxTokens: obj.max_tokens ?? 4096,
    topP: obj.top_p ?? 1,
    frequencyPenalty: obj.frequency_penalty ?? 0,
    presencePenalty: obj.presence_penalty ?? 0,
    tokenProvider: obj.token_provider || "",
    tokenApiKey: obj.token_api_key || "",
    tokenBaseUrl: obj.token_base_url || "",
    outputFormat: obj.output_format || "纯文本",
    boundary: obj.boundary || "",
    memoryTurns: obj.memory_turns ?? 0,
    temperatureOverride: obj.temperature_override ?? null,
    tokenUsed: obj.token_used ?? 0,
    createdAt: obj.created_at,
  };
}

export const AgentService = {
  list(): Agent[] {
    const db = getDb();
    const result = db.exec("SELECT * FROM agents ORDER BY created_at DESC");
    if (!result.length) return [];
    const cols = result[0].columns;
    return result[0].values.map((row) => {
      const obj: any = {};
      cols.forEach((c, i) => (obj[c] = row[i]));
      return rowToAgent(obj);
    });
  },

  getById(id: string): Agent | null {
    const db = getDb();
    const result = db.exec(`SELECT * FROM agents WHERE id = ?`, [id]);
    if (!result.length || !result[0].values.length) return null;
    const cols = result[0].columns;
    const row = result[0].values[0];
    const obj: any = {};
    cols.forEach((c, i) => (obj[c] = row[i]));
    return rowToAgent(obj);
  },

  create(data: Omit<Agent, "id" | "createdAt">): Agent {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO agents (id, name, color, system_prompt, writing_style, expertise, description, status,
        model_name, model_provider, temperature, max_tokens, top_p, frequency_penalty, presence_penalty,
        token_provider, token_api_key, token_base_url,
        output_format, boundary, memory_turns, temperature_override,
        created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, data.name, data.color, data.systemPrompt, data.writingStyle,
        JSON.stringify(data.expertise), data.description || "", data.status || "idle",
        data.modelName || "", data.modelProvider || "",
        data.temperature ?? 0.7, data.maxTokens ?? 4096,
        data.topP ?? 1, data.frequencyPenalty ?? 0, data.presencePenalty ?? 0,
        data.tokenProvider || "", data.tokenApiKey || "", data.tokenBaseUrl || "",
        data.outputFormat || "纯文本", data.boundary || "",
        data.memoryTurns ?? 0, data.temperatureOverride ?? null,
        now,
      ]
    );
    saveDb();
    // 从数据库重新读取，确保返回的对象字段与 rowToAgent 完全一致（含默认值）
    return this.getById(id)!;
  },

  update(id: string, data: Partial<Omit<Agent, "id" | "createdAt">>): Agent | null {
    const db = getDb();
    const existing = this.getById(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    db.run(
      `UPDATE agents SET name=?, color=?, system_prompt=?, writing_style=?, expertise=?, description=?, status=?,
        model_name=?, model_provider=?, temperature=?, max_tokens=?, top_p=?, frequency_penalty=?, presence_penalty=?,
        token_provider=?, token_api_key=?, token_base_url=?,
        output_format=?, boundary=?, memory_turns=?, temperature_override=?
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
        id,
      ]
    );
    saveDb();
    return updated;
  },

  delete(id: string): boolean {
    const db = getDb();
    db.run(`DELETE FROM agents WHERE id=?`, [id]);
    saveDb();
    return true;
  },

  /**
   * 将本次调用消耗的 token 累加到 agents.token_used
   * 幂等安全：delta <= 0 时直接跳过
   */
  addTokenUsed(agentId: string, delta: number): void {
    if (delta <= 0) return;
    const db = getDb();
    db.run(`UPDATE agents SET token_used = token_used + ? WHERE id = ?`, [delta, agentId]);
    saveDb();
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
      // 用户配置的私有 Token — 优先使用
      tokenProvider: agent.tokenProvider,
      tokenApiKey: agent.tokenApiKey,
      tokenBaseUrl: agent.tokenBaseUrl,
      // 输出格式 & 能力边界
      outputFormat: agent.outputFormat,
      boundary: agent.boundary,
      // 记忆轮数 & 温度覆盖
      memoryTurns: agent.memoryTurns,
      temperatureOverride: agent.temperatureOverride,
    };

    // 路由策略：
    // - modelName 为空或 "auto"：走 AutoLLMAdapter，由平台按优先级自动选渠道和模型
    // - 其他具名模型（如 gpt-4o / deepseek-coder-v2）：也走 AutoLLMAdapter，
    //   AutoLLMAdapter 会优先从 token_channels 中匹配对应 provider 的渠道；
    //   全部渠道失败时降级到 Mock 保底，确保始终有输出。
    // !! 不要改回 mockAdapter，那样具名模型永远不走真实 LLM
    const adapter: ILLMAdapter = new AutoLLMAdapter();

    await adapter.generateStream(agentConfig, messages, onChunk, onComplete, onError);
  },
};
