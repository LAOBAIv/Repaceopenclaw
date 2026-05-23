/**
 * MobileWorkspace 常量与类型定义
 *
 * 包含颜色常量、可用模型列表、导航菜单项、智能体类型选项等。
 * 从原 MobileWorkspace.tsx 提取，供子组件共享使用。
 */

import {
  Sparkles, MessageSquare, Library, PlusCircle,
  Bot, Network, Wrench, Puzzle,
} from 'lucide-react';

/* ─────────────────────────────────────────────
 * 颜色常量
 * ───────────────────────────────────────────── */
export const COLORS = {
  bg: '#0f0f0f',
  bgSecondary: '#1a1a1a',
  bgTertiary: '#262626',
  textPrimary: '#f5f5f5',
  textSecondary: '#a3a3a3',
  textMuted: '#737373',
  accent: '#6366f1',
  accentLight: 'rgba(99,102,241,0.15)',
  border: '#333333',
  danger: '#ef4444',
};

/* ─────────────────────────────────────────────
 * 可用模型列表（用于移动端模型切换）
 * ───────────────────────────────────────────── */
export const AVAILABLE_MODELS = [
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', provider: 'anthropic' },
  { id: 'glm-5', label: 'GLM-5', provider: 'zhipu' },
  { id: 'glm-5.1', label: 'GLM-5.1', provider: 'zhipu' },
  { id: 'qwen3-max-2026-01-23', label: 'Qwen3 Max', provider: 'alibaba' },
  { id: 'qwen3.6-plus', label: 'Qwen3.6 Plus', provider: 'alibaba' },
  { id: 'kimi-k2.5', label: 'Kimi K2.5', provider: 'moonshot' },
  { id: 'minimax-m2.5', label: 'MiniMax M2.5', provider: 'minimax' },
  { id: 'doubao-pro-32k', label: 'Doubao Pro 32K', provider: 'doubao' },
  { id: 'qwen-max', label: 'Qwen Max', provider: 'alibaba' },
  { id: 'auto', label: '自动选择', provider: 'auto' },
];

/* ─────────────────────────────────────────────
 * PC端侧边栏导航菜单（对应 AppShell NAV_ITEMS，不含会话列表）
 * ───────────────────────────────────────────── */
export type MobileNavItem = {
  action?: string;
  to?: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
};

export const NAV_ITEMS: MobileNavItem[] = [
  { action: 'home',      icon: Sparkles,      label: 'RepaceClaw' },
  { action: 'sessions',  icon: MessageSquare, label: '会话列表' },
  { to: '/mobile/agent-library',  icon: Library,    label: 'Agent 模板库' },
  { to: '/mobile/agent-create',   icon: PlusCircle, label: '智能体创建' },
  { to: '/mobile/agents',         icon: Bot,        label: '智能体管理' },
  { to: '/console',               icon: Network,    label: '项目协作' },
  { to: '/skill-settings',        icon: Wrench,     label: '技能设置' },
  { to: '/plugin-settings',       icon: Puzzle,     label: '插件设置' },
];

/* ─────────────────────────────────────────────
 * 智能体类型选项（用于创建/编辑智能体）
 * ───────────────────────────────────────────── */
export const AGENT_TYPE_OPTIONS = [
  { id: 'dev',      label: '开发/工程类' },
  { id: 'data',     label: '数据分析类' },
  { id: 'creative', label: '内容/创作类' },
  { id: 'pm',       label: '产品/管理类' },
  { id: 'research', label: 'AI/研究类' },
  { id: 'ops',      label: '运营类' },
  { id: 'decision', label: '决策类' },
  { id: 'general',  label: '通用/助手类' },
];

/* ─────────────────────────────────────────────
 * 颜色选项（用于创建/编辑智能体）
 * ───────────────────────────────────────────── */
export const COLOR_OPTIONS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#3b82f6', '#a855f7', '#64748b',
];

/** 移动端视图类型 */
export type MobileView = 'workspace' | 'sessions' | 'agent-library' | 'agent-create' | 'agents';
