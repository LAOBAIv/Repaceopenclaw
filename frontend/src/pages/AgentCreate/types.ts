// [2026-05-18] 从 AgentCreate.tsx 拆分出类型定义

/* ─── 后端技能类型 ─────────────────────────────────────────── */
export interface BackendSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  type: 'builtin' | 'custom';
  enabled: boolean;
}

/* ─── CODE 渠道 + 模型预设 ────────────────────────────────── */
export interface CodeModel {
  id: string;        // 实际调用的模型 ID（如 doubao-pro-32k-241215）
  name: string;      // 显示名称
  contextWindow: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  badge?: string;
  desc?: string;
}

export interface CodeChannel {
  id: string;        // 对应 Token 渠道 id（如 'doubao'、'openai'）
  name: string;      // 渠道显示名称（如 '火山方舟'）
  provider: string;  // 厂商（如 '字节跳动'）
  badge?: string;
  desc: string;
  baseUrl: string;
  authType: 'Bearer' | 'ApiKey' | 'Basic';
  keyLabel?: string;
  keyPlaceholder?: string;
  models: CodeModel[];
  hasBackendKey?: boolean;  // 后台是否已配置 API Key
  isPreset?: boolean;        // 是否为平台预设渠道
}

/* ─── Token 本地缓存 ─── */
export interface TokenCache {
  apiKey: string;
  baseUrl: string;
  modelId?: string;
}
