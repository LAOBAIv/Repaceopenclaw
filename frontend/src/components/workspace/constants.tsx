/**
 * 常量和静态数据
 * 提取自 ProjectWorkspace 的静态配置
 */

import type { ProjectPriority } from '@/stores/projectKanbanStore';

// 功能标签列表
export const FUNCTION_TABS = ['消息渠道', '快捷指令', '技能应用', '定时任务', '多智能体', '文件快传', '任务标签'];

// 消息渠道列表
export const CHANNEL_LIST: { name: string; status: string; color: string }[] = [
  { name: '飞书',     status: '未连接', color: '#00b96b' },
  { name: '企业微信', status: '未连接', color: '#07c160' },
  { name: '钉钉',     status: '未连接', color: '#3a7dff' },
  { name: 'Telegram', status: '未连接', color: '#2aabee' },
  { name: 'Slack',    status: '未连接', color: '#4a154b' },
  { name: 'Discord',  status: '未连接', color: '#5865f2' },
  { name: 'WhatsApp', status: '未连接', color: '#25d366' },
  { name: '邮件',     status: '未连接', color: '#ea4335' },
];

// 优先级配置
export const PRIORITY_OPTIONS: { value: ProjectPriority; label: string; color: string; bg: string }[] = [
  { value: 'high', label: '高优先级', color: '#ef4444', bg: '#fef2f2' },
  { value: 'mid',  label: '中优先级', color: '#f59e0b', bg: '#fffbeb' },
  { value: 'low',  label: '低优先级', color: '#22c55e', bg: '#f0fdf4' },
];

// Tab 元信息
export const TAB_META: Record<string, { icon: React.ReactNode; subtitle: string; gradient: string }> = {
  '消息渠道': {
    gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    subtitle: '连接渠道后，智能体可接收并回复消息',
    icon: (
      <svg width="19" height="19" viewBox="0 0 17 17" fill="none">
        <path d="M2 3.5C2 2.67 2.67 2 3.5 2H10L15 7V13.5C15 14.33 14.33 15 13.5 15H3.5C2.67 15 2 14.33 2 13.5V3.5Z"
          fill="none" stroke="white" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M10 2V7H15" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 10H12M5 12.5H9" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  '快捷指令': {
    gradient: 'linear-gradient(135deg,#f59e0b,#f97316)',
    subtitle: '在输入框中输入 / 触发快捷指令',
    icon: (
      <svg width="19" height="19" viewBox="0 0 17 17" fill="none">
        <rect x="2" y="2" width="13" height="13" rx="3" stroke="white" strokeWidth="1.4"/>
        <path d="M5.5 8.5L7.5 10.5L11.5 6.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  '技能应用': {
    gradient: 'linear-gradient(135deg,#0ea5e9,#6366f1)',
    subtitle: '为智能体配置专属技能模块',
    icon: (
      <svg width="19" height="19" viewBox="0 0 17 17" fill="none">
        <path d="M8.5 2L10.5 6.5H15L11.5 9.5L13 14L8.5 11L4 14L5.5 9.5L2 6.5H6.5L8.5 2Z" stroke="white" strokeWidth="1.3" strokeLinejoin="round"/>
      </svg>
    ),
  },
  '定时任务': {
    gradient: 'linear-gradient(135deg,#f97316,#ef4444)',
    subtitle: '设置定期自动执行的任务计划',
    icon: (
      <svg width="19" height="19" viewBox="0 0 17 17" fill="none">
        <circle cx="8.5" cy="9" r="5.5" stroke="white" strokeWidth="1.4"/>
        <path d="M8.5 6V9.5L11 11" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6 2.5H11" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  '多智能体': {
    gradient: 'linear-gradient(135deg,#8b5cf6,#6366f1)',
    subtitle: '管理并配置项目关联的智能体',
    icon: (
      <svg width="19" height="19" viewBox="0 0 17 17" fill="none">
        <rect x="3" y="5" width="11" height="8" rx="2.5" stroke="white" strokeWidth="1.4"/>
        <circle cx="6" cy="9" r="1.2" fill="white"/>
        <circle cx="11" cy="9" r="1.2" fill="white"/>
        <path d="M6 3.5V5M11 3.5V5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M6 13V14.5M11 13V14.5" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  '文件快传': {
    gradient: 'linear-gradient(135deg,#3b82f6,#06b6d4)',
    subtitle: '上传文件作为智能体上下文参考资料',
    icon: (
      <svg width="19" height="19" viewBox="0 0 17 17" fill="none">
        <path d="M3 13V4.5C3 3.67 3.67 3 4.5 3H9L14 8V13C14 13.83 13.33 14.5 12.5 14.5H4.5C3.67 14.5 3 13.83 3 13Z"
          stroke="white" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M9 3V8H14" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8.5 10V13.5M7 11.5L8.5 10L10 11.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  '任务标签': {
    gradient: 'linear-gradient(135deg,#10b981,#06b6d4)',
    subtitle: '为会话建立标签，方便整理和搜索',
    icon: (
      <svg width="19" height="19" viewBox="0 0 17 17" fill="none">
        <path d="M2 9.5L6.5 3H13L15 9.5L8.5 15L2 9.5Z" stroke="white" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M7 7.5L10 10.5" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
};

// 渠道类型
export type ChannelType = 'feishu' | 'wecom' | 'dingtalk';

export const CHANNEL_TABS: { key: ChannelType; label: string; icon: string }[] = [
  { key: 'feishu',   label: '飞书',   icon: '🪶' },
  { key: 'wecom',    label: '企业微信', icon: '💬' },
  { key: 'dingtalk', label: '钉钉',   icon: '📎' },
];

export const CHANNEL_LABELS: Record<ChannelType, string> = {
  feishu: '飞书', wecom: '企业微信', dingtalk: '钉钉',
};

// 工具函数
export function getProgressColor(p: number) {
  if (p >= 80) return '#22c55e';
  if (p >= 50) return '#3b82f6';
  return '#f59e0b';
}