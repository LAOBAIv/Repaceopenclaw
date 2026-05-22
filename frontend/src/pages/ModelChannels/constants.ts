import React from 'react';

export interface Channel {
  id: string; provider: string; modelName: string; baseUrl: string; apiKey: string;
  authType: 'Bearer' | 'ApiKey' | 'Basic'; enabled: boolean; priority: number;
  isPreset?: boolean; temperature: number; maxTokens: number; topP: number;
  frequencyPenalty: number; presencePenalty: number;
}

export interface TestResult { connected: boolean; statusCode: number; latencyMs: number | null; note: string; }

export const PRESETS = [
  { label: '豆包', icon: '🫘', provider: 'doubao', modelName: 'doubao-pro-32k', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', authType: 'Bearer' as const, hint: '模型 ID 填方舟控制台 Endpoint ID（ep-xxxxxx）' },
  { label: 'DeepSeek', icon: '🔮', provider: 'deepseek', modelName: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1', authType: 'Bearer' as const, hint: '' },
  { label: '通义千问', icon: '🌟', provider: 'qwen', modelName: 'qwen-max', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', authType: 'Bearer' as const, hint: '' },
  { label: 'OpenAI', icon: '🤖', provider: 'openai', modelName: 'gpt-4o', baseUrl: 'https://api.openai.com/v1', authType: 'Bearer' as const, hint: '' },
  { label: 'Claude', icon: '🌀', provider: 'anthropic', modelName: 'claude-3-5-sonnet-20241022', baseUrl: 'https://api.anthropic.com/v1', authType: 'ApiKey' as const, hint: 'Key 填 sk-ant- 开头；认证选 ApiKey Header' },
  { label: '自定义', icon: '⚡', provider: '', modelName: '', baseUrl: '', authType: 'Bearer' as const, hint: '兼容 OpenAI Chat Completions 格式的任意服务' },
];

export const emptyForm = {
  provider: '', modelName: '', baseUrl: '', apiKey: '',
  authType: 'Bearer' as 'Bearer' | 'ApiKey' | 'Basic',
  enabled: true, priority: 0, temperature: 0.7,
  maxTokens: 4096, topP: 1, frequencyPenalty: 0, presencePenalty: 0,
};

export type FormState = typeof emptyForm;

export const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 4 };
export const inp: React.CSSProperties = { width: '100%', padding: '8px 11px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, outline: 'none', boxSizing: 'border-box', color: 'var(--text-primary)', background: '#fafafa' };
export const actBtn = (bg: string, c: string): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: bg, color: c, border: `1px solid ${c}22`, borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 500 });
