/**
 * AgentKanban 常量定义
 *
 * 存放列配置（COL_CONFIG）和标签颜色池（TAG_COLOR_POOL）。
 */
import { Loader2, CheckCircle2, Trash2 } from 'lucide-react';
import type { SessionColumn } from '@/stores/sessionKanbanStore';

export const COL_CONFIG: Record<SessionColumn, { label: string; color: string; bg: string; icon: typeof Loader2 | typeof CheckCircle2 | typeof Trash2 }> = {
  progress: { label: '进行中', color: '#f59e0b', bg: '#fffbeb', icon: Loader2 },
  done:     { label: '已完成', icon: CheckCircle2, color: '#22c55e', bg: '#f0fdf4' },
  deleted:  { label: '已删除', icon: Trash2, color: '#ef4444', bg: '#fef2f2' },
};

export const TAG_COLOR_POOL = [
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  { bg: '#fdf4ff', border: '#e9d5ff', text: '#7c3aed' },
  { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
];
