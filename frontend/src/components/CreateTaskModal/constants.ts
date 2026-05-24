/**
 * CreateTaskModal 常量定义
 * 包含优先级选项等静态配置
 */

import type { ProjectPriority } from '@/stores/projectKanbanStore';

/** 优先级选项配置 */
export const PRIORITY_OPTIONS: { value: ProjectPriority; label: string; color: string; bg: string }[] = [
  { value: 'high', label: '高优先级', color: '#ef4444', bg: '#fef2f2' },
  { value: 'mid',  label: '中优先级', color: '#f59e0b', bg: '#fffbeb' },
  { value: 'low',  label: '低优先级', color: '#22c55e', bg: '#f0fdf4' },
];
