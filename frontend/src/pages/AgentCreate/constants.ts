// [2026-05-18] 从 AgentCreate.tsx 拆分出常量定义

import type { CodeChannel } from './types';

export const STYLE_TAGS  = ['极简简洁', '详细全面', '口语化', '正式专业'];
export const OUTPUT_TAGS = ['纯文本', 'Markdown', 'Markdown+完整代码', '结构化JSON'];

export const AGENT_TYPE_OPTIONS = [
  { value: 'dev', label: '工程开发类', desc: '对应 rc-dev-agent' },
  { value: 'data', label: '数据分析类', desc: '对应 rc-data-agent' },
  { value: 'creative', label: '内容生成类', desc: '对应 rc-creative-agent' },
  { value: 'pm', label: '项目管理类', desc: '对应 rc-pm-agent' },
  { value: 'research', label: '知识推理类', desc: '对应 rc-research-agent' },
  { value: 'ops', label: '平台策略类', desc: '对应 rc-ops-agent' },
  { value: 'decision', label: '决策支持类', desc: '对应 rc-decision-agent' },
  { value: 'general', label: '通用助手类', desc: '对应 rc-general-agent' },
] as const;

/* ─── 角标颜色 ─────────────────────────────────────────────── */
export const BADGE_COLOR: Record<string, { bg: string; color: string }> = {
  推荐:  { bg: '#e6f4ff', color: '#1677ff' },
  高性能: { bg: '#fff7e6', color: '#d48806' },
  新:    { bg: '#f6ffed', color: '#389e0d' },
  默认:  { bg: '#f0f0f0', color: '#666' },
  后台:  { bg: '#fff0f6', color: '#c41d7f' },
  预设:  { bg: '#fef3c7', color: '#d97706' },
};

// CODE 渠道现在完全由管理后台「模型渠道」配置提供
// 这里仅保留一个加载中占位渠道，避免 selectedChannel 为空导致渲染崩溃
export const CODE_CHANNELS: CodeChannel[] = [{
  id: '__loading__',
  name: '加载中…',
  provider: 'loading',
  badge: '默认',
  desc: '正在从管理后台加载渠道配置…',
  baseUrl: '',
  authType: 'Bearer' as const,
  models: [{ id: 'loading', name: '加载中…', contextWindow: '-', maxTokens: 4096, temperature: 0.7, topP: 0.95, frequencyPenalty: 0, presencePenalty: 0, desc: '' }],
}];
