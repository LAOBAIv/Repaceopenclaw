import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';

import { useProjectStore } from '@/stores/projectStore';
import { useConversationStore } from '@/stores/conversationStore';
import { useAgentStore } from '@/stores/agentStore';
import { MessageBubble } from '@/components/conversation/MessageBubble';
import { useTaskStore } from '@/stores/taskStore';
import { useProjectKanbanStore, type ProjectPriority } from '@/stores/projectKanbanStore';
import { showToast } from '@/components/Toast';
import { projectsApi } from '@/api/projects';
import { CreateItemModal } from '@/components/CreateItemModal';

/* ─── 功能标签列表 ─────────────────────────────────────────── */
const FUNCTION_TABS = ['消息渠道', '飞书配对', '快捷指令', '技能', '定时任务', '智能体', '文件快传', '标签管理', '优先级'];

/* ─── 新建项目/任务类型 ───────────────────────────────────── */
interface CreateItemModalState {
  open: boolean;
  type: 'project' | 'task' | null;
}






function getProgressColor(p: number) {
  if (p >= 80) return '#22c55e';
  if (p >= 50) return '#3b82f6';
  return '#f59e0b';
}

/* ─── 优先级配置 ───────────────────────────────────────────── */
const PRIORITY_OPTIONS: { value: ProjectPriority; label: string; color: string; bg: string }[] = [
  { value: 'high', label: '高优先级', color: '#ef4444', bg: '#fef2f2' },
  { value: 'mid',  label: '中优先级', color: '#f59e0b', bg: '#fffbeb' },
  { value: 'low',  label: '低优先级', color: '#22c55e', bg: '#f0fdf4' },
];

/* ─── 浮动面板内容组件 ─────────────────────────────────────── */

/* 每个 tab 的元信息 */
const TAB_META: Record<string, { icon: React.ReactNode; subtitle: string; gradient: string }> = {
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
  '飞书配对': {
    gradient: 'linear-gradient(135deg,#00b96b,#06d6a0)',
    subtitle: '绑定飞书账号，自动同步消息与日历',
    icon: (
      <svg width="19" height="19" viewBox="0 0 17 17" fill="none">
        <circle cx="8.5" cy="8.5" r="5.5" stroke="white" strokeWidth="1.4"/>
        <path d="M6 8.5L8 10.5L11 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
  '标签管理': {
    gradient: 'linear-gradient(135deg,#ec4899,#a855f7)',
    subtitle: '管理项目标签，标签将同步至项目列表',
    icon: (
      <svg width="19" height="19" viewBox="0 0 17 17" fill="none">
        <path d="M2 9.5L7.5 3H14V9.5L8.5 15L2 9.5Z" stroke="white" strokeWidth="1.4" strokeLinejoin="round"/>
        <circle cx="11" cy="6" r="1.2" fill="white"/>
      </svg>
    ),
  },
  '技能': {
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
  '智能体': {
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
};

/* ─── 定时任务面板 ──────────────────────────────────────────── */
/* ─── 技能面板 ──────────────────────────────────────────────── */
function SkillPanel({ onInject }: { taskName?: string; onInject?: (text: string) => void }) {
  const SKILL_GROUPS: { label: string; items: { key: string; cmd: string; hint: string }[] }[] = [
    {
      label: '信息获取',
      items: [
        { key: '联网搜索', cmd: '/skill search', hint: '实时搜索互联网，获取最新新闻、数据与资料。' },
        { key: '知识库检索', cmd: '/skill kb', hint: '从项目知识库中检索相关文档，增强回答准确性。' },
        { key: '图片识别', cmd: '/skill vision', hint: '上传图片后自动识别内容、提取文字或描述画面。' },
      ],
    },
    {
      label: '数据与代码',
      items: [
        { key: '代码执行', cmd: '/skill code', hint: '在沙箱中运行 Python / JavaScript 代码并返回结果。' },
        { key: '文件解析', cmd: '/skill file', hint: '解析 PDF、Word、Excel 等文件，提取其中的文字与数据。' },
        { key: '数据分析', cmd: '/skill analyze', hint: '对表格或数据集进行统计、趋势分析与洞察总结。' },
        { key: '图表生成', cmd: '/skill chart', hint: '根据数据自动生成折线图、柱状图、饼图等可视化图表。' },
      ],
    },
    {
      label: '协作与通知',
      items: [
        { key: '邮件发送', cmd: '/skill email', hint: '通过绑定邮箱自动撰写并发送邮件，支持附件。' },
        { key: '日历同步', cmd: '/skill calendar', hint: '读取或写入日历事件，自动安排日程与提醒。' },
      ],
    },
  ];

  return (
    <div style={{ fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif', background: '#fff' }}>

      {/* ── 顶部引导文案 ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 9,
        paddingBottom: 16,
        borderBottom: '1px solid #f0f0f0',
        marginBottom: 20,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
          <path d="M8.5 2L10.5 6.5H15L11.5 9.5L13 14L8.5 11L4 14L5.5 9.5L2 6.5H6.5L8.5 2Z"/>
        </svg>
        <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.75 }}>
          点击技能按钮，将对应指令带入对话框，让智能体调用该能力。可同时点击多个后一起发送。
        </span>
      </div>

      {/* ── 技能分组 ── */}
      {SKILL_GROUPS.map((group, gi) => (
        <div key={group.label} style={{ marginBottom: gi < SKILL_GROUPS.length - 1 ? 18 : 0 }}>
          {/* 组标题 */}
          <div style={{
            fontSize: 11, color: '#9ca3af', fontWeight: 500,
            marginBottom: 10, letterSpacing: '0.02em',
          }}>
            {group.label}
          </div>
          {/* 横向按钮组 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {group.items.map(item => (
              <button
                key={item.key}
                onClick={() => onInject?.(item.cmd)}
                title={item.hint}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#f3f4f6',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: '#374151',
                  fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                  fontWeight: 400,
                  transition: 'background 0.12s',
                  outline: 'none',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#e0e7ff';
                  (e.currentTarget as HTMLButtonElement).style.color = '#4f46e5';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6';
                  (e.currentTarget as HTMLButtonElement).style.color = '#374151';
                }}
              >
                <span style={{
                  fontSize: 10, padding: '1px 5px', borderRadius: 4,
                  background: 'rgba(99,102,241,0.1)', color: '#6366f1',
                  fontFamily: 'monospace', letterSpacing: '0.02em',
                  fontWeight: 600,
                }}>{item.cmd.split(' ').pop()}</span>
                {item.key}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* ── 底部操作按钮 ── */}
      <button
        onClick={() => onInject?.('/skill list')}
        style={{
          marginTop: 20,
          width: '100%',
          height: 40,
          fontSize: 13,
          fontWeight: 400,
          border: 'none',
          borderRadius: 8,
          background: '#f3f4f6',
          cursor: 'pointer',
          color: '#374151',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          transition: 'background 0.12s',
          outline: 'none',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#e5e7eb'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
        查看全部可用技能
      </button>
    </div>
  );
}

function SchedulePanel({
  onFillInput,
  onSend,
}: {
  onFillInput?: (text: string) => void;
  onSend?: (text: string) => void;
}) {
  const GROUPS: { label: string; items: string[] }[] = [
    {
      label: '重复提醒示例',
      items: ['日程预告', 'Email 查看', '运行报告', '每月事项提醒'],
    },
    {
      label: '定时提醒示例',
      items: ['会议提醒', '临时提醒', '家人生日', '就医提醒'],
    },
    {
      label: '实时追踪示例',
      items: ['黄金价格', '世界新闻', '股价追踪'],
    },
  ];

  return (
    <div style={{ fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif', background: '#fff' }}>

      {/* ── 顶部引导文案 ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 9,
        paddingBottom: 16,
        borderBottom: '1px solid #f0f0f0',
        marginBottom: 20,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
          <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 4.9 11.9c-.6.6-1.4 1.6-1.9 3.1H9c-.5-1.5-1.3-2.5-1.9-3.1A7 7 0 0 1 12 2z"/>
        </svg>
        <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.75 }}>
          不用记命令，不用写代码，像聊天一样，直接设置定时任务。只需要说清楚 3 件事：什么时候执行，做什么任务，要不要重复。
        </span>
      </div>

      {/* ── 示例分组 ── */}
      {GROUPS.map((group, gi) => (
        <div key={group.label} style={{ marginBottom: gi < GROUPS.length - 1 ? 18 : 0 }}>
          {/* 组标题 */}
          <div style={{
            fontSize: 11, color: '#9ca3af', fontWeight: 500,
            marginBottom: 10, letterSpacing: '0.02em',
          }}>
            {group.label}
          </div>
          {/* 横向按钮组 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {group.items.map(item => (
              <button
                key={item}
                onClick={() => onFillInput?.(item)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#f3f4f6',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: '#374151',
                  fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                  fontWeight: 400,
                  transition: 'background 0.12s',
                  outline: 'none',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#e5e7eb'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* ── 底部操作按钮 ── */}
      <button
        onClick={() => onSend?.('查看当前配置的定时任务，简要描述任务内容')}
        style={{
          marginTop: 20,
          width: '100%',
          height: 40,
          fontSize: 13,
          fontWeight: 400,
          border: 'none',
          borderRadius: 8,
          background: '#f3f4f6',
          cursor: 'pointer',
          color: '#374151',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.12s',
          outline: 'none',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#e5e7eb'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; }}
      >
        查看我的定时任务
      </button>
    </div>
  );
}

/* ─── 快捷指令面板 ──────────────────────────────────────────── */
function ShortcutPanel({ onInject }: { taskName?: string; onInject?: (text: string) => void }) {
  const SHORTCUT_GROUPS: { label: string; items: { label: string; cmd: string; hint: string }[] }[] = [
    {
      label: '对话控制',
      items: [
        { label: '新对话', cmd: '/new', hint: '清空当前对话，开启一段全新的会话。' },
        { label: '查看上下文', cmd: '/context', hint: '展示当前对话已记住的上下文内容与 Token 用量。' },
        { label: '清空上下文', cmd: '/clear', hint: '清除本次对话的历史上下文，释放记忆空间。' },
        { label: '总结对话', cmd: '/summary', hint: '对当前对话内容生成简洁的摘要与关键结论。' },
      ],
    },
    {
      label: '系统查询',
      items: [
        { label: '系统状态', cmd: '/status', hint: '查看当前系统运行状态，包括模型、工具、连接情况。' },
        { label: '查看计划', cmd: '/plan', hint: '查看智能体当前正在执行或待执行的任务计划。' },
        { label: '工具列表', cmd: '/tools', hint: '查看当前可调用的工具，例如浏览器、文件、代码执行等。' },
      ],
    },
    {
      label: '任务操作',
      items: [
        { label: '暂停任务', cmd: '/pause', hint: '暂停智能体当前正在执行的任务。' },
        { label: '继续执行', cmd: '/resume', hint: '恢复被暂停的任务继续执行。' },
        { label: '取消任务', cmd: '/cancel', hint: '取消当前任务，停止所有相关操作。' },
      ],
    },
  ];

  return (
    <div style={{ fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif', background: '#fff' }}>

      {/* ── 顶部引导文案 ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 9,
        paddingBottom: 16,
        borderBottom: '1px solid #f0f0f0',
        marginBottom: 20,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
          <rect x="2" y="2" width="20" height="20" rx="4"/>
          <path d="M8 12l3 3 5-5"/>
        </svg>
        <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.75 }}>
          点击按钮将指令带入对话框，或直接在输入框中输入 / 触发快捷指令。
        </span>
      </div>

      {/* ── 指令分组 ── */}
      {SHORTCUT_GROUPS.map((group, gi) => (
        <div key={group.label} style={{ marginBottom: gi < SHORTCUT_GROUPS.length - 1 ? 18 : 0 }}>
          {/* 组标题 */}
          <div style={{
            fontSize: 11, color: '#9ca3af', fontWeight: 500,
            marginBottom: 10, letterSpacing: '0.02em',
          }}>
            {group.label}
          </div>
          {/* 横向按钮组 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {group.items.map(item => (
              <button
                key={item.label}
                onClick={() => onInject?.(item.cmd)}
                title={item.hint}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#f3f4f6',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: '#374151',
                  fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                  fontWeight: 400,
                  transition: 'background 0.12s',
                  outline: 'none',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#fef3c7';
                  (e.currentTarget as HTMLButtonElement).style.color = '#b45309';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6';
                  (e.currentTarget as HTMLButtonElement).style.color = '#374151';
                }}
              >
                <span style={{
                  fontSize: 10, padding: '1px 5px', borderRadius: 4,
                  background: 'rgba(245,158,11,0.12)', color: '#d97706',
                  fontFamily: 'monospace', letterSpacing: '0.02em',
                  fontWeight: 600,
                }}>{item.cmd}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* ── 底部操作按钮 ── */}
      <button
        onClick={() => onInject?.('/help')}
        style={{
          marginTop: 20,
          width: '100%',
          height: 40,
          fontSize: 13,
          fontWeight: 400,
          border: 'none',
          borderRadius: 8,
          background: '#f3f4f6',
          cursor: 'pointer',
          color: '#374151',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          transition: 'background 0.12s',
          outline: 'none',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#e5e7eb'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        查看全部指令帮助
      </button>
    </div>
  );
}

/* ─── 标签管理面板 ──────────────────────────────────────────── */
// 标签颜色池
const TAG_COLOR_POOL: { bg: string; border: string; text: string }[] = [
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  { bg: '#fdf4ff', border: '#e9d5ff', text: '#7c3aed' },
  { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
  { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
  { bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1' },
  { bg: '#fafaf9', border: '#e7e5e4', text: '#44403c' },
];

function getTagColor(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_COLOR_POOL[h % TAG_COLOR_POOL.length];
}

// 预设标签
const PRESET_TAGS = ['优先级高', '待跟进', '已完成', '阻塞中', 'Bug', 'Feature', '文档', '重构'];




function TagPanel({
  tags, onAddTag, onRemoveTag, taskName,
}: {
  tags?: string[];
  onAddTag?: (tag: string) => void;
  onRemoveTag?: (tag: string) => void;
  taskName?: string;
}) {
  // 本地维护已选标签（初始化为外部传入的 tags）
  const [localTags, setLocalTags] = useState<string[]>(tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    tagInputRef.current?.focus();
  }, []);

  // 添加标签（去重）
  function addTag(raw: string) {
    const t = raw.trim();
    if (!t || localTags.includes(t)) return;
    const next = [...localTags, t];
    setLocalTags(next);
    onAddTag?.(t);
  }

  // 移除标签
  function removeTag(tag: string) {
    setLocalTags(prev => prev.filter(t => t !== tag));
    onRemoveTag?.(tag);
  }

  // 点击预设标签：已选则取消，未选则添加
  function togglePreset(pt: string) {
    if (localTags.includes(pt)) {
      removeTag(pt);
    } else {
      addTag(pt);
    }
  }

  function commitTag() {
    addTag(tagInput);
    setTagInput('');
  }

  return (
    <div style={{ fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif' }}>

      {/* ── 顶部：已选标签展示区 ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 7, alignContent: 'flex-start',
        minHeight: 52, marginBottom: 16,
        padding: '10px 12px',
        background: '#fafafa',
        border: '1.5px solid #e5e7eb',
        borderRadius: 10,
        transition: 'border-color 0.15s',
      }}
        onClick={() => tagInputRef.current?.focus()}
      >
        {localTags.length === 0 ? (
          <span style={{ fontSize: 12, color: '#d1d5db', lineHeight: '24px', userSelect: 'none' }}>
            点击下方标签或输入自定义标签后展示在这里
          </span>
        ) : localTags.map(tag => {
          const c = getTagColor(tag);
          return (
            <span key={tag} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 12, padding: '3px 8px 3px 10px', borderRadius: 20,
              background: c.bg, color: c.text, border: `1px solid ${c.border}`,
              fontWeight: 500, lineHeight: 1.5,
            }}>
              {tag}
              <button
                onClick={e => { e.stopPropagation(); removeTag(tag); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '0 1px', lineHeight: 1, color: c.text,
                  opacity: 0.45, fontSize: 15,
                  display: 'flex', alignItems: 'center',
                  transition: 'opacity 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.45'; }}
                title="移除此标签"
              >×</button>
            </span>
          );
        })}
      </div>

      {/* ── 快捷预设标签（可点击切换）── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 8 }}>
          快捷标签
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PRESET_TAGS.map(pt => {
            const selected = localTags.includes(pt);
            const c = getTagColor(pt);
            return (
              <button
                key={pt}
                onClick={() => togglePreset(pt)}
                style={{
                  padding: '4px 11px', borderRadius: 20, fontSize: 12,
                  border: `1px solid ${selected ? c.border : '#e5e7eb'}`,
                  background: selected ? c.bg : '#fff',
                  color: selected ? c.text : '#6b7280',
                  cursor: 'pointer',
                  fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                  fontWeight: selected ? 600 : 400,
                  transition: 'all 0.12s',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  outline: 'none',
                }}
                onMouseEnter={e => {
                  if (!selected) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = c.border;
                    (e.currentTarget as HTMLButtonElement).style.background = c.bg + 'cc';
                    (e.currentTarget as HTMLButtonElement).style.color = c.text;
                  }
                }}
                onMouseLeave={e => {
                  if (!selected) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb';
                    (e.currentTarget as HTMLButtonElement).style.background = '#fff';
                    (e.currentTarget as HTMLButtonElement).style.color = '#6b7280';
                  }
                }}
              >
                {selected ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <span style={{ fontSize: 12, lineHeight: 1, opacity: 0.5 }}>+</span>
                )}
                {pt}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 自定义输入 ── */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          ref={tagInputRef}
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commitTag(); }
          }}
          placeholder="输入自定义标签，Enter 确认"
          style={{
            flex: 1, height: 38, fontSize: 13, padding: '0 14px',
            border: '1.5px solid #e5e7eb', borderRadius: 8, outline: 'none',
            fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif', color: '#374151',
            transition: 'border-color 0.15s', boxSizing: 'border-box',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; }}
          onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
        />
        <button
          onClick={commitTag}
          style={{
            height: 38, padding: '0 18px', fontSize: 13, fontWeight: 600,
            border: 'none', borderRadius: 8,
            background: '#6366f1', color: '#fff', cursor: 'pointer',
            fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
            transition: 'background 0.15s',
            display: 'inline-flex', alignItems: 'center',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#4f46e5'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#6366f1'; }}
        >添加</button>
      </div>

      {/* ── 项目信息栏 ── */}
      {taskName && (
        <div style={{
          marginTop: 12, display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 12px', background: '#f3f4f6', borderRadius: 8,
          fontSize: 12, color: '#6b7280',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>标签将同步至项目 <b style={{ color: '#374151' }}>{taskName}</b> 看板列表</span>
        </div>
      )}
    </div>
  );
}

/* ─── 智能体面板（切换 / 协作 两子Tab） ─────────────────── */


/* 协作流程节点类型 */
type FlowNodeType = 'serial' | 'parallel';
interface FlowNode {
  id: string;
  name: string;
  nodeType: FlowNodeType;
  agentIds: string[];
  desc: string;
}
function makeFlowNode(idx: number): FlowNode {
  return { id: `fn_${Date.now()}_${idx}`, name: '', nodeType: 'serial', agentIds: [], desc: '' };
}

/* ── 添加节点浮层菜单（Portal 挂到 body，zIndex 99999） ── */
function AddFlowNodeMenu({
  anchorRef,
  onAdd,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onAdd: (t: FlowNodeType) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ left: r.left + r.width / 2, top: r.top });
    }
    function handler(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [anchorRef, onClose]);

  if (!pos) return null;
  const MENU_W = 260;

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: Math.max(8, pos.left - MENU_W / 2),
        top: pos.top - 10,
        transform: 'translateY(-100%)',
        zIndex: 99999,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        boxShadow: '0 6px 24px rgba(0,0,0,0.13)',
        padding: 8,
        display: 'flex',
        gap: 8,
        width: MENU_W,
      }}
    >
      {/* 小三角（朝下） */}
      <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 10, height: 6, overflow: 'hidden' }}>
        <div style={{ width: 10, height: 10, background: '#fff', border: '1px solid #e5e7eb', transform: 'rotate(45deg) translate(-3px,-3px)' }} />
      </div>

      <button
        onClick={() => { onAdd('serial'); onClose(); }}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
          padding: '10px 0', borderRadius: 8, border: '1.5px solid #e5e7eb',
          background: '#fff', cursor: 'pointer',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#374151'; e.currentTarget.style.background = '#f5f7fa'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff'; }}
      >
        {/* ArrowDown SVG */}
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
        </svg>
        <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>下行节点</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>串行向下执行</span>
      </button>

      <button
        onClick={() => { onAdd('parallel'); onClose(); }}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
          padding: '10px 0', borderRadius: 8, border: '1.5px solid #e5e7eb',
          background: '#fff', cursor: 'pointer',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = '#f5f3ff'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff'; }}
      >
        {/* GitBranch SVG */}
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
        </svg>
        <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>并行节点</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>与上节点并行</span>
      </button>
    </div>,
    document.body
  );
}

/* ── 智能体多选弹窗（inline，挂到 TabPanel 内的 Portal） ── */
function AgentPickerModal({
  agentList,
  selected,
  onClose,
  onConfirm,
}: {
  agentList: import('../types').Agent[];
  selected: string[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const [draft, setDraft] = useState<Set<string>>(() => new Set(selected));
  function toggle(id: string) {
    setDraft(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  return createPortal(
    <div
      onMouseDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12,
          width: 660, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 96px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
          marginBottom: 32,
        }}>
        {/* 头部 */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#1a202c' }}>
            选择智能体
            <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400, marginLeft: 6 }}>已选 {draft.size} 个</span>

          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2, fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        {/* 列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          {agentList.map(agent => {
            const sel = draft.has(agent.id);
            const ac = agent.color ?? '#6366f1';
            return (
              <div
                key={agent.id}
                onClick={() => toggle(agent.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  border: `1.5px solid ${sel ? ac : '#e5e7eb'}`,
                  background: sel ? ac + '0d' : '#fff',
                  transition: 'all 0.12s',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: ac + '22', border: `1.5px solid ${ac}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: ac, fontWeight: 700, fontSize: 11,
                }}>{agent.name.charAt(0)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#1a202c' }}>{agent.name}</div>
                  {agent.modelName && (
                    <div style={{ fontSize: 11, color: '#6366f1', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {agent.modelProvider ? `${agent.modelProvider} · ` : ''}{agent.modelName}
                      {agent.temperature != null ? ` · T=${agent.temperature}` : ''}
                      {agent.maxTokens != null ? ` · ${agent.maxTokens}tk` : ''}
                    </div>
                  )}
                </div>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  border: `1.5px solid ${sel ? ac : '#d1d5db'}`,
                  background: sel ? ac : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {sel && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
              </div>
            );
          })}
        </div>
        {/* 底部按钮 */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '6px 16px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>取消</button>
          <button onClick={() => onConfirm([...draft])} style={{ padding: '6px 18px', borderRadius: 7, border: 'none', background: '#374151', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>确认</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function AgentPanel({
  agents,
  agentStatusMap,
  taskName,
  matchedProject,
  onInject,
  incomingAgentNames,
  openPanels,
  activePanelId,
  onSwitchPanel,
  onOpenPanel,
  onClosePanel,
  currentProjectId,
  backendProjectId,
  collabNodes,
  setCollabNodes,
  isProject,
  participatingAgentNames,
  onUpgradeToProject,
  onDowngradeToTask,
  onRemoveAgent,
}: {
  agents?: import('../types').Agent[];
  agentStatusMap: Record<string, { label: string; color: string }>;
  taskName?: string;
  matchedProject?: import('../stores/projectKanbanStore').KanbanProject | null;
  onInject?: (text: string) => void;
  incomingAgentNames?: string[];
  openPanels: import('../types').ConversationPanel[];
  activePanelId: string | null;
  onSwitchPanel: (panelId: string) => void;
  onOpenPanel: (agentId: string, agentName: string, agentColor: string, initialMessage?: string) => void;
  onClosePanel: (panelId: string) => void;
  currentProjectId?: string;
  /** 后端数据库中项目的真实 UUID，用于保存 workflowNodes */
  backendProjectId?: string;
  collabNodes: FlowNode[];
  setCollabNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  /** 当前是项目（true）还是任务（false），任务模式显示协作Tab但带升级入口 */
  isProject: boolean;
  /** 当前参与会话的智能体名称列表 */
  participatingAgentNames?: string[];
  /** 任务升级为项目回调 */
  onUpgradeToProject?: (newAgentNames: string[]) => void;
  /** 项目降级为任务回调 */
  onDowngradeToTask?: (keptAgentName: string) => void;
  /** 从项目中移出一个智能体（不降级）回调 */
  onRemoveAgent?: (removedAgentName: string) => void;
}) {
  const [subTab, setSubTab] = useState<'switch'|'collab'>('switch');

  /* ── 智能体列表过滤 ── */
  const allAgents = agents ?? [];
  // 切换 Tab 始终显示全量智能体，供用户自由切换对话；
  // incomingAgentNames 仅用于协作 Tab 中推导"参与协作的智能体"，不影响切换列表
  const agentList = allAgents;

  /* ══════════ 协作 Tab：FlowNode 流程节点 ══════════ */
  // nodes/setNodes 是外层持久化状态的别名，关闭弹窗后数据不会丢失
  const nodes = collabNodes;
  const setNodes = setCollabNodes;
  const [pickerNodeId, setPickerNodeId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  function addNode(type: FlowNodeType) {
    setNodes(prev => {
      if (type === 'parallel') {
        let count = 0;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].nodeType === 'serial') { count++; break; }
          count++;
        }
        if (count >= 3) { showToast('同一层最多并行 3 个节点', 'warning'); return prev; }
      }
      return [...prev, {
        id: `fn_${Date.now()}`,
        name: '',
        nodeType: type,
        agentIds: [],
        desc: '',
      }];
    });
  }
  function removeNode(id: string) {
    setNodes(prev => prev.filter(n => n.id !== id));
  }
  function updateNode(id: string, patch: Partial<FlowNode>) {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n));
  }
  function moveNode(idx: number, dir: -1 | 1) {
    setNodes(prev => {
      const arr = [...prev];
      const t = idx + dir;
      if (t < 0 || t >= arr.length) return arr;
      [arr[idx], arr[t]] = [arr[t], arr[idx]];
      return arr;
    });
  }
  function confirmAgents(nodeId: string, ids: string[]) {
    updateNode(nodeId, { agentIds: ids });
    setPickerNodeId(null);
  }

  function applyCollab() {
    // 校验：所有节点的任务目标必须填写
    const emptyNodeIdx = nodes.findIndex(n => n.name.trim() === '');
    if (emptyNodeIdx !== -1) {
      showToast(`请填写节点 ${emptyNodeIdx + 1} 的任务目标`, 'error');
      return;
    }

    // 构建协作上下文：所有节点的概览（供每个智能体了解整体分工）
    const allNodes = nodes.filter(n => n.agentIds.length > 0);
    const contextLines = allNodes.map((n, i) => {
      const assignedNames = n.agentIds
        .map(id => allAgents.find(a => a.id === id)?.name ?? id)
        .join('、');
      const type = n.nodeType === 'parallel' ? '[并行]' : '[串行]';
      return `  ${i + 1}. ${type} ${n.name}（负责：${assignedNames}）`;
    }).join('\n');

    // ── 保存 workflowNodes 到后端，确保刷新后可以恢复 ──
    if (backendProjectId) {
      const workflowNodes = nodes.map(n => ({
        id: n.id,
        name: n.name,
        nodeType: n.nodeType,
        agentIds: n.agentIds,
        taskDesc: n.name,  // 节点名称即为任务目标，存入数据库作为 AI 提示词依据
      }));
      projectsApi.update(backendProjectId, { workflowNodes }).catch(() => {
        showToast('协作节点保存失败，刷新后可能丢失', 'error');
      });
    }

    // 关闭不在协作列表中的面板
    const allAgentIds = [...new Set(nodes.flatMap(n => n.agentIds))];
    openPanels.forEach(p => {
      if (!allAgentIds.includes(p.agentId)) onClosePanel(p.id);
    });

    // 按节点维度，为每个智能体生成专属初始消息
    nodes.forEach(node => {
      if (node.agentIds.length === 0) return;
      node.agentIds.forEach(agentId => {
        const a = allAgents.find(ag => ag.id === agentId);
        if (!a) return;

        // 构建发给该智能体的初始消息
        const lines: string[] = [];
        lines.push(`【协作任务启动】`);
        lines.push(`你被分配到${node.nodeType === 'parallel' ? '并行' : '串行'}节点「${node.name}」。`);
        lines.push(`\n⚑ 本节点任务目标（必须完成，完成后请明确告知）：\n${node.name}`);
        if (allNodes.length > 1) {
          lines.push(`\n整体协作流程如下：\n${contextLines}`);
        }
        lines.push(`\n请严格围绕上述任务目标执行，完成后主动汇报结果。`);
        const initialMessage = lines.join('\n');

        const existingPanel = openPanels.find(p => p.agentId === agentId);
        if (existingPanel) {
          // 面板已存在：切换激活并补发初始消息
          onSwitchPanel(existingPanel.id);
        } else {
          onOpenPanel(a.id, a.name, a.color, initialMessage);
        }
      });
    });
  }

  const pickerNode = pickerNodeId ? nodes.find(n => n.id === pickerNodeId) : null;

  /**
   * Tab 显示规则：
   * - 项目模式（isProject=true）：
   *     只显示「协作」Tab，不显示「切换智能体」
   *     （切换智能体是任务模式的功能；项目弹窗的核心是管理协作节点分工）
   * - 任务模式（isProject=false）：
   *     显示「切换智能体」+ 「协作」两个 Tab
   *     （用户可以自由切换当前对话的智能体，也可以升级为项目并配置协作）
   */
  const subTabs: { key: 'switch'|'collab'; label: string }[] = isProject
    ? [{ key: 'collab', label: '协作' }]
    : [
        { key: 'switch', label: '切换智能体' },
        { key: 'collab', label: '协作' },
      ];

  /**
   * 项目模式下只有「协作」一个 Tab，强制锁定到 'collab'；
   * 任务模式下保持用户自选的 subTab 状态
   */
  const activeSubTab = isProject ? 'collab' : subTab;

  return (
    <div style={{ fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif' }}>

      {/*
       * 子 Tab 切换条：
       * 项目模式下只有「协作」一个 Tab，不渲染切换条（单 Tab 没必要）；
       * 任务模式下有「切换智能体」和「协作」两个 Tab，正常渲染切换条
       */}
      {!isProject && (
        <div style={{
          display: 'flex', gap: 4, marginBottom: 14,
          background: '#f3f4f6', borderRadius: 8, padding: 3,
        }}>
          {subTabs.map(t => (
            <button key={t.key} onClick={() => setSubTab(t.key)} style={{
              flex: 1, padding: '5px 0', borderRadius: 6, border: 'none',
              background: activeSubTab === t.key ? '#fff' : 'transparent',
              color: activeSubTab === t.key ? '#374151' : '#9ca3af',
              fontWeight: activeSubTab === t.key ? 700 : 400,
              fontSize: 13, cursor: 'pointer',
              boxShadow: activeSubTab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
              fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
            }}>{t.label}</button>
          ))}
        </div>
      )}

      {/* ══════════ 切换 Tab：多列网格 ══════════ */}
      {activeSubTab === 'switch' && (
        <div>
          {agentList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: '#d1d5db' }}>
              暂无可用智能体
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 8,
            }}>
              {agentList.map(agent => {
                const statusInfo = agentStatusMap[agent.status ?? 'idle'] ?? { label: '离线', color: '#9ca3af' };
                const existingPanel = openPanels.find(p => p.agentId === agent.id);
                const isActive = existingPanel?.id === activePanelId;
                const accentColor = agent.color ?? '#6366f1';
                return (
                  <button
                    key={agent.id}
                    onClick={() => {
                      if (existingPanel) { onSwitchPanel(existingPanel.id); }
                      else { onOpenPanel(agent.id, agent.name, agent.color); }
                    }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                      padding: '10px 11px', borderRadius: 9, border: '1.5px solid',
                      borderColor: isActive ? accentColor : '#e5e7eb',
                      background: isActive ? accentColor + '0d' : '#fafafa',
                      cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                      fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                      width: '100%', boxSizing: 'border-box',
                      position: 'relative',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = accentColor + '88';
                        (e.currentTarget as HTMLButtonElement).style.background = accentColor + '08';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb';
                        (e.currentTarget as HTMLButtonElement).style.background = '#fafafa';
                      }
                    }}
                  >
                    {/* 右上角状态标注：当前 / 切换（只在已激活或已开启时显示） */}
                    {(isActive || existingPanel) && (
                      <span style={{
                        position: 'absolute', top: 7, right: 8,
                        fontSize: 10, padding: '1px 6px', borderRadius: 20, flexShrink: 0,
                        background: isActive ? accentColor + '18' : '#f3f4f6',
                        color: isActive ? accentColor : '#9ca3af',
                        fontWeight: 600,
                      }}>
                        {isActive ? '当前' : '切换'}
                      </span>
                    )}

                    {/* 头像 + 状态点 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        background: accentColor + '22', border: `1.5px solid ${accentColor}44`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: accentColor, fontWeight: 700, fontSize: 12,
                      }}>{agent.name.charAt(0)}</div>
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: statusInfo.color,
                        boxShadow: `0 0 0 2px ${statusInfo.color}33`,
                      }} />
                    </div>

                    {/* 名称 */}
                    <div style={{
                      fontSize: 13, fontWeight: 600, lineHeight: 1.3,
                      color: isActive ? accentColor : '#1a202c',
                      width: '100%', paddingRight: 36,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{agent.name}</div>

                    {/* 模型 */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      padding: '2px 6px', borderRadius: 4,
                      background: isActive ? accentColor + '18' : '#f3f4f6',
                      fontSize: 10, color: isActive ? accentColor : '#6b7280',
                      fontWeight: 500, maxWidth: '100%',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                      </svg>
                      {agent.modelName ?? 'Auto'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════ 协作 Tab：FlowNode 流程节点 ══════════ */}
      {activeSubTab === 'collab' && (
        <div>
          {/* 提示文字 */}
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10, lineHeight: 1.5 }}>
            {isProject
              ? '管理参与协作的智能体，配置流程节点分工后开启协作。'
              : '配置协作流程节点后可升级为项目，开启多智能体协同工作。'}
          </div>



          {/* 节点渲染：分组成行（serial 开新行，parallel 并入当前行） */}
          {(() => {
            const rows: FlowNode[][] = [];
            nodes.forEach(n => {
              if (n.nodeType === 'serial' || rows.length === 0) {
                rows.push([n]);
              } else {
                rows[rows.length - 1].push(n);
              }
            });
            const globalIdx = (nodeId: string) => nodes.findIndex(n => n.id === nodeId);

            return rows.map((row, rowIdx) => (
              <div key={row[0].id + '-row'}>
                {/* 串行向下箭头 */}
                {rowIdx > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0', color: '#d1d5db' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                    </svg>
                  </div>
                )}

                {/* 一行内可能有多个节点（并行） */}
                <div style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
                  {row.map((node, colIdx) => {
                    const gIdx = globalIdx(node.id);
                    const isParallel = node.nodeType === 'parallel';
                    return (
                      <div key={node.id} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'stretch' }}>
                        {/* 并行节点间竖线 + 符号 */}
                        {colIdx > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 22, flexShrink: 0, gap: 2 }}>
                            <div style={{ flex: 1, width: 1, background: '#c7d2fe', minHeight: 16 }} />
                            <span style={{ fontSize: 13, color: '#818cf8', fontWeight: 700, lineHeight: 1 }}>⇋</span>
                            <div style={{ flex: 1, width: 1, background: '#c7d2fe', minHeight: 16 }} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* 节点卡片 */}
                          <div style={{
                            border: `1px solid ${isParallel ? '#a5b4fc' : '#e5e7eb'}`,
                            borderRadius: 9, background: '#fff', overflow: 'hidden',
                          }}>
                            {/* 节点 Header */}
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              padding: '6px 9px', borderBottom: `1px solid ${isParallel ? '#e0e7ff' : '#f0f0f0'}`,
                              background: isParallel ? '#f5f3ff' : '#fafafa',
                            }}>
                              {/* 序号圆圈 */}
                              <div style={{
                                width: 17, height: 17, borderRadius: '50%', flexShrink: 0,
                                background: isParallel ? '#6366f1' : '#374151',
                                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 9, fontWeight: 700,
                              }}>{gIdx + 1}</div>

                              {/* 并行标签 */}
                              {isParallel && (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 3,
                                  padding: '1px 6px', borderRadius: 20, flexShrink: 0,
                                  fontSize: 10, background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd',
                                }}>
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
                                  </svg>
                                  并行
                                </span>
                              )}

                              {/* 节点名称/任务目标（必填，可编辑） */}
                              <input
                                value={node.name}
                                onChange={e => updateNode(node.id, { name: e.target.value })}
                                placeholder="请描述你的节点目标（必填）"
                                style={{
                                  flex: 1, border: 'none',
                                  borderBottom: `1.5px solid ${node.name.trim() === '' ? '#fca5a5' : 'transparent'}`,
                                  outline: 'none', minWidth: 0,
                                  fontSize: 12, fontWeight: 600, color: '#374151',
                                  background: 'transparent',
                                  borderRadius: 0,
                                  fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                                  transition: 'border-color 0.15s',
                                }}
                                onFocus={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderRadius = '4px'; e.currentTarget.style.padding = '1px 4px'; }}
                                onBlur={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.padding = '0'; e.currentTarget.style.borderRadius = '0'; }}
                              />

                              {/* 上移 */}
                              <button
                                onClick={() => moveNode(gIdx, -1)}
                                disabled={gIdx === 0}
                                title="上移"
                                style={{ background: 'none', border: 'none', padding: '0 1px', cursor: gIdx === 0 ? 'default' : 'pointer', color: gIdx === 0 ? '#e5e7eb' : '#9ca3af', display: 'flex', lineHeight: 1 }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                              </button>
                              {/* 下移 */}
                              <button
                                onClick={() => moveNode(gIdx, 1)}
                                disabled={gIdx === nodes.length - 1}
                                title="下移"
                                style={{ background: 'none', border: 'none', padding: '0 1px', cursor: gIdx === nodes.length - 1 ? 'default' : 'pointer', color: gIdx === nodes.length - 1 ? '#e5e7eb' : '#9ca3af', display: 'flex', lineHeight: 1 }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                              </button>
                              {/* 删除 */}
                              <button
                                onClick={() => removeNode(node.id)}
                                title="删除节点"
                                style={{ background: 'none', border: 'none', padding: '0 1px', cursor: 'pointer', color: '#d1d5db', display: 'flex', lineHeight: 1, transition: 'color 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = '#d1d5db'; }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                                </svg>
                              </button>
                            </div>

                            {/* 节点 Body */}
                            <div style={{ padding: '9px 10px' }}>

                              {/* 分配智能体 */}
                              <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>
                                  分配智能体
                                  <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: 4 }}>（可多选）</span>
                                </label>

                                {node.agentIds.length === 0 ? (
                                  /* 未选状态：全宽虚线按钮，引导选择 */
                                  <button
                                    onClick={() => setPickerNodeId(node.id)}
                                    style={{
                                      width: '100%', padding: '7px 0', borderRadius: 7,
                                      border: '1.5px dashed #d1d5db',
                                      background: 'transparent', color: '#9ca3af', fontSize: 12,
                                      cursor: 'pointer', fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                      transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => {
                                      (e.currentTarget as HTMLButtonElement).style.borderColor = '#6366f1';
                                      (e.currentTarget as HTMLButtonElement).style.color = '#6366f1';
                                      (e.currentTarget as HTMLButtonElement).style.background = '#f5f3ff';
                                    }}
                                    onMouseLeave={e => {
                                      (e.currentTarget as HTMLButtonElement).style.borderColor = '#d1d5db';
                                      (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af';
                                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                                    }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                                      <circle cx="9" cy="7" r="4"/>
                                      <line x1="19" y1="8" x2="19" y2="14"/>
                                      <line x1="22" y1="11" x2="16" y2="11"/>
                                    </svg>
                                    选择智能体
                                  </button>
                                ) : (
                                  /* 已选状态：头像列表 + 编辑按钮行 */
                                  <div style={{
                                    display: 'flex', alignItems: 'center', gap: 5,
                                    padding: '5px 8px', borderRadius: 7,
                                    border: '1px solid #e0e7ff', background: '#f5f3ff',
                                  }}>
                                    {/* 已选智能体头像 + 名字 */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap', minWidth: 0 }}>
                                      {node.agentIds.map(aid => {
                                        const a = allAgents.find(x => x.id === aid);
                                        if (!a) return null;
                                        const ac = a.color ?? '#6366f1';
                                        return (
                                          <span
                                            key={aid}
                                            style={{
                                              display: 'inline-flex', alignItems: 'center', gap: 3,
                                              padding: '1px 6px 1px 3px', borderRadius: 20,
                                              fontSize: 11, background: ac + '15',
                                              border: `1px solid ${ac}30`, color: ac, fontWeight: 500,
                                            }}
                                          >
                                            <div style={{
                                              width: 14, height: 14, borderRadius: '50%',
                                              background: ac, display: 'flex', alignItems: 'center',
                                              justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 700,
                                            }}>{a.name.charAt(0)}</div>
                                            {a.name}
                                          </span>
                                        );
                                      })}
                                    </div>
                                    {/* 右侧编辑按钮 */}
                                    <button
                                      onClick={() => setPickerNodeId(node.id)}
                                      title="修改智能体"
                                      style={{
                                        flexShrink: 0, padding: '3px 7px', borderRadius: 5,
                                        border: 'none', background: 'rgba(99,102,241,0.12)',
                                        color: '#6366f1', fontSize: 11, cursor: 'pointer',
                                        fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                                        display: 'flex', alignItems: 'center', gap: 3,
                                        transition: 'background 0.12s',
                                      }}
                                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.22)'; }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.12)'; }}
                                    >
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                      </svg>
                                      编辑
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}

          {/* 添加节点按钮 */}
          <div style={{ position: 'relative', marginTop: 10 }}>
            <button
              ref={addBtnRef}
              onClick={() => setShowAddMenu(v => !v)}
              style={{
                width: '100%', padding: '7px 0',
                border: `1.5px dashed ${showAddMenu ? '#374151' : '#d1d5db'}`,
                borderRadius: 8, background: showAddMenu ? '#f5f7fa' : 'transparent',
                color: showAddMenu ? '#374151' : '#6b7280',
                fontSize: 12, cursor: 'pointer',
                fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#374151'; e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = '#f5f7fa'; }}
              onMouseLeave={e => {
                if (!showAddMenu) {
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.color = '#6b7280';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              添加流程节点
            </button>
            {showAddMenu && (
              <AddFlowNodeMenu
                anchorRef={addBtnRef}
                onAdd={addNode}
                onClose={() => setShowAddMenu(false)}
              />
            )}
          </div>

          {/* 开启协作按钮 */}
          <button
            onClick={applyCollab}
            disabled={nodes.every(n => n.agentIds.length === 0)}
            style={{
              marginTop: 12, width: '100%', height: 36, borderRadius: 8, border: 'none',
              background: nodes.some(n => n.agentIds.length > 0) ? '#6366f1' : '#e5e7eb',
              color: nodes.some(n => n.agentIds.length > 0) ? '#fff' : '#9ca3af',
              fontSize: 13, fontWeight: 700,
              cursor: nodes.some(n => n.agentIds.length > 0) ? 'pointer' : 'not-allowed',
              fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
              transition: 'background 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            {nodes.some(n => n.agentIds.length > 0) ? '开启协作' : '请先为节点分配智能体'}
          </button>

          {/* 项目模式：所有节点均无智能体时，显示降级提示 */}
          {isProject && nodes.every(n => n.agentIds.length === 0) && onDowngradeToTask && (
            <div style={{
              marginTop: 10, padding: '10px 12px', borderRadius: 8,
              background: '#fff7ed', border: '1.5px solid #fed7aa',
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <svg style={{ flexShrink: 0, marginTop: 1 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#c2410c', marginBottom: 4 }}>
                  所有节点均未分配智能体
                </div>
                <div style={{ fontSize: 11, color: '#9a3412', lineHeight: 1.5 }}>
                  项目中没有任何智能体参与，将自动降级为普通任务。
                </div>
                <button
                  onClick={() => {
                    const firstAgent = allAgents[0];
                    if (firstAgent && onDowngradeToTask) onDowngradeToTask(firstAgent.name);
                  }}
                  style={{
                    marginTop: 7, padding: '4px 12px', borderRadius: 6,
                    border: '1.5px solid #f97316', background: '#fff',
                    color: '#c2410c', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fff7ed'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                >
                  确认降级为任务
                </button>
              </div>
            </div>
          )}

          {/* 任务模式：升级为项目按钮 */}
          {!isProject && onUpgradeToProject && (() => {
            // 收集节点中所有已选智能体名称
            const selectedAgentIds = [...new Set(nodes.flatMap(n => n.agentIds))];
            const selectedNames = selectedAgentIds
              .map(id => agentList.find(a => a.id === id)?.name)
              .filter(Boolean) as string[];
            const canUpgrade = selectedNames.length >= 2;
            return (
              <button
                onClick={() => { if (canUpgrade) onUpgradeToProject(selectedNames); }}
                disabled={!canUpgrade}
                title={canUpgrade ? '将当前任务升级为多智能体协作项目' : '需在流程节点中分配至少2个不同智能体'}
                style={{
                  marginTop: 8, width: '100%', height: 36, borderRadius: 8,
                  border: `1.5px solid ${canUpgrade ? '#f59e0b' : '#e5e7eb'}`,
                  background: canUpgrade ? '#fffbeb' : '#f9fafb',
                  color: canUpgrade ? '#92400e' : '#9ca3af',
                  fontSize: 13, fontWeight: 700,
                  cursor: canUpgrade ? 'pointer' : 'not-allowed',
                  fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
                onMouseEnter={e => { if (canUpgrade) { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.borderColor = '#d97706'; } }}
                onMouseLeave={e => { if (canUpgrade) { e.currentTarget.style.background = '#fffbeb'; e.currentTarget.style.borderColor = '#f59e0b'; } }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17 11 12 6 7 11"/><line x1="12" y1="6" x2="12" y2="18"/>
                </svg>
                {canUpgrade ? `升级为项目（${selectedNames.length}个智能体）` : '分配≥2个智能体后可升级为项目'}
              </button>
            );
          })()}

          {/* 智能体选择弹窗 */}
          {pickerNode && (
            <AgentPickerModal
              agentList={allAgents}
              selected={pickerNode.agentIds}
              onClose={() => setPickerNodeId(null)}
              onConfirm={ids => confirmAgents(pickerNode.id, ids)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function TabPanel({
  tab, onClose,
  tags, onAddTag, onRemoveTag,
  agents, tasks, taskName,
  onInject, onSend,
  matchedProject,
  incomingAgentNames,
  openPanels,
  activePanelId,
  onSwitchPanel,
  onOpenAgentPanel,
  onCloseAgentPanel,
  currentProjectId,
  backendProjectId,
  collabNodes,
  setCollabNodes,
  isProject,
  participatingAgentNames,
  onUpgradeToProject,
  onDowngradeToTask,
  onRemoveAgent,
}: {
  tab: string;
  onClose: () => void;
  tags?: string[];
  onAddTag?: (tag: string) => void;
  onRemoveTag?: (tag: string) => void;
  agents?: import('../types').Agent[];
  tasks?: import('../stores/taskStore').Task[];
  taskName?: string;
  onInject?: (text: string) => void;
  onSend?: (text: string) => void;
  matchedProject?: import('../stores/projectKanbanStore').KanbanProject | null;
  /** 来自看板跳转的智能体名称列表，透传给 AgentPanel 使用 */
  incomingAgentNames?: string[];
  openPanels: import('../types').ConversationPanel[];
  activePanelId: string | null;
  onSwitchPanel: (panelId: string) => void;
  onOpenAgentPanel: (agentId: string, agentName: string, agentColor: string, initialMessage?: string) => void;
  onCloseAgentPanel: (panelId: string) => void;
  currentProjectId?: string;
  /** 后端数据库中项目的真实 UUID，用于保存 workflowNodes */
  backendProjectId?: string;
  /** 协作流程节点（持久化，由外层维护） */
  collabNodes: FlowNode[];
  setCollabNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  /** 当前是项目（true）还是任务（false），控制协作 Tab 的显示 */
  isProject: boolean;
  /** 当前参与会话的智能体名称列表 */
  participatingAgentNames?: string[];
  /** 任务升级为项目回调 */
  onUpgradeToProject?: (newAgentNames: string[]) => void;
  /** 项目降级为任务回调 */
  onDowngradeToTask?: (keptAgentName: string) => void;
  /** 从项目中移出一个智能体（不降级）回调 */
  onRemoveAgent?: (removedAgentName: string) => void;
}) {
  /* ── 消息渠道列表（飞书/企业微信/钉钉 Bot 接入状态）从后端动态读取 ── */
  type BotChannelStatus = { name: string; channelType: ChannelType; status: string; color: string };
  const [channelList, setChannelList] = useState<BotChannelStatus[]>([
    { name: '飞书',   channelType: 'feishu',   status: '未连接', color: '#9ca3af' },
    { name: '企业微信', channelType: 'wecom',  status: '未连接', color: '#9ca3af' },
    { name: '钉钉',   channelType: 'dingtalk', status: '未连接', color: '#9ca3af' },
  ]);
  const [showChannelConfigFor, setShowChannelConfigFor] = useState<ChannelType | null>(null);

  // 仅在消息渠道 Tab 激活时拉取后端已配置的 Bot 渠道列表
  useEffect(() => {
    if (tab !== '消息渠道') return;
    fetch('/api/bot-channels')
      .then(r => r.ok ? r.json() : null)
      .then((json: { data: Array<{ channelType: string; botId: string; enabled: boolean }> } | null) => {
        if (!json?.data) return;
        const typeMap: Record<string, boolean> = {};
        json.data.forEach(ch => { typeMap[ch.channelType] = ch.enabled && !!ch.botId; });
        setChannelList(prev => prev.map(ch => ({
          ...ch,
          status: typeMap[ch.channelType] ? '已连接' : '未连接',
          color: typeMap[ch.channelType] ? '#22c55e' : '#9ca3af',
        })));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // CHANNEL_LIST 兼容性别名（渲染时使用 channelList）
  const CHANNEL_LIST = channelList;

  /* 文件快传状态 */
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: string; type: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);

  function simulateUpload(fileName: string) {
    const ext = fileName.split('.').pop()?.toUpperCase() ?? 'FILE';
    setUploadedFiles(prev => [...prev, { name: fileName, size: `${(Math.random() * 2 + 0.1).toFixed(1)} MB`, type: ext }]);
  }

  /* 智能体状态映射 */
  const agentStatusMap: Record<string, { label: string; color: string }> = {
    active: { label: '在线', color: '#22c55e' },
    idle:   { label: '空闲', color: '#3b82f6' },
    busy:   { label: '忙碌', color: '#f59e0b' },
  };

  const meta = TAB_META[tab] ?? {
    gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    subtitle: '',
    icon: <svg width="19" height="19" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="white" strokeWidth="1.4"/></svg>,
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 12px', borderRadius: 8, background: '#f9fafb',
    marginBottom: 7, fontSize: 13, color: '#374151',
    border: '1px solid #f0f0f0',
  };
  const badgeStyle = (color: string): React.CSSProperties => ({
    fontSize: 11, padding: '2px 8px', borderRadius: 4,
    background: color + '18', color,
  });

  return (
    /* 遮罩层 */
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        overflowY: 'auto',
      }}
    >
      {/* 弹窗主体 */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
          width: 660,
          maxWidth: 'calc(100vw - 32px)',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
          animation: 'tabPanelModalIn 0.2s cubic-bezier(0.34,1.4,0.64,1)',
          overflow: 'clip',
          marginBottom: 32,
        }}
      >
        {/* ── 头部 ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '22px 28px 18px',
          borderBottom: '1px solid #f0f0f0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: meta.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {meta.icon}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a202c', lineHeight: 1.3 }}>
                {tab}
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 3, lineHeight: 1.4 }}>
                {meta.subtitle}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: 'none', background: '#f3f4f6', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#9ca3af', fontSize: 18, lineHeight: 1,
              transition: 'background 0.15s, color 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e5e7eb'; e.currentTarget.style.color = '#374151'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#9ca3af'; }}
          >×</button>
        </div>

        {/* ── 内容区 ── */}
        <div style={{ padding: '20px 28px', maxHeight: '70vh', overflowY: 'auto' }}>

          {tab === '消息渠道' && (
            <div>
              {CHANNEL_LIST.map(ch => (
                <div key={ch.name} style={itemStyle}>
                  <span style={{ fontWeight: 500 }}>{ch.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={badgeStyle(ch.color)}>{ch.status}</span>
                    <button
                      onClick={() => setShowChannelConfigFor(ch.channelType)}
                      style={{
                        fontSize: 12, padding: '4px 14px', borderRadius: 6,
                        border: '1.5px solid #e5e7eb', background: '#fff',
                        cursor: 'pointer', color: '#374151',
                        fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                      }}
                    >{ch.status === '已连接' ? '编辑' : '连接'}</button>
                  </div>
                </div>
              ))}
              {/* 在 TabPanel 内部弹出对应渠道的 Bot 配置弹窗 */}
              {showChannelConfigFor && (
                <ChannelConfigModal
                  initialChannel={showChannelConfigFor}
                  onClose={() => {
                    setShowChannelConfigFor(null);
                    // 关闭后重新拉取状态
                    fetch('/api/bot-channels')
                      .then(r => r.ok ? r.json() : null)
                      .then((json: { data: Array<{ channelType: string; botId: string; enabled: boolean }> } | null) => {
                        if (!json?.data) return;
                        const typeMap: Record<string, boolean> = {};
                        json.data.forEach(c => { typeMap[c.channelType] = c.enabled && !!c.botId; });
                        setChannelList(prev => prev.map(c => ({
                          ...c,
                          status: typeMap[c.channelType] ? '已连接' : '未连接',
                          color: typeMap[c.channelType] ? '#22c55e' : '#9ca3af',
                        })));
                      })
                      .catch(() => {});
                  }}
                />
              )}
            </div>
          )}

          {tab === '飞书配对' && (
            <div>
              <div style={itemStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: 'linear-gradient(135deg,#00b96b,#06d6a0)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 17 17" fill="none">
                      <circle cx="8.5" cy="8.5" r="5.5" stroke="white" strokeWidth="1.4"/>
                      <path d="M6 8.5L8 10.5L11 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1a202c' }}>飞书账号绑定</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>未绑定 · 点击右侧按钮开始</div>
                  </div>
                </div>
                <button style={{
                  fontSize: 13, padding: '6px 18px', borderRadius: 7, border: 'none',
                  background: '#00b96b', color: '#fff', cursor: 'pointer', fontWeight: 600,
                  fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                }}>立即绑定</button>
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 10, padding: '12px 14px', background: '#f9fafb', borderRadius: 8, lineHeight: 1.7 }}>
                <div style={{ fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>绑定后可获得：</div>
                {['在飞书群中 @ 智能体自动回复', '飞书日历事件自动同步至项目', '消息推送与任务提醒通知'].map(tip => (
                  <div key={tip} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#00b96b', fontSize: 14, lineHeight: 1 }}>✓</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
              {taskName && (
                <div style={{ marginTop: 10, padding: '9px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 12, color: '#16a34a' }}>
                  绑定后，飞书消息将关联至当前项目：<b>{taskName}</b>
                </div>
              )}
            </div>
          )}

          {tab === '快捷指令' && (
            <ShortcutPanel
              taskName={taskName}
              onInject={text => { if (onInject) { onInject(text); onClose(); } }}
            />
          )}

          {tab === '文件快传' && (
            <div>
              <div
                style={{
                  border: `2px dashed ${dragOver ? '#3b82f6' : '#d1d5db'}`,
                  borderRadius: 10, padding: '28px 20px',
                  textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? '#f0f7ff' : 'transparent',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#3b82f6'; (e.currentTarget as HTMLDivElement).style.background = '#f0f7ff'; }}
                onMouseLeave={e => { if (!dragOver) { (e.currentTarget as HTMLDivElement).style.borderColor = '#d1d5db'; (e.currentTarget as HTMLDivElement).style.background = 'transparent'; } }}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(false);
                  Array.from(e.dataTransfer.files).forEach(f => simulateUpload(f.name));
                }}
                onClick={() => simulateUpload(`示例文档_${Date.now().toString().slice(-4)}.pdf`)}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" style={{ margin: '0 auto 8px', display: 'block', opacity: 0.6 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>点击或拖拽文件到此处</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>支持 PDF、Word、TXT、Markdown，最大 10MB</div>
              </div>
              {uploadedFiles.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 8 }}>
                    已上传文件（{uploadedFiles.length}）
                  </div>
                  {uploadedFiles.map((f, i) => (
                    <div key={i} style={{ ...itemStyle, marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 6, flexShrink: 0,
                          background: 'linear-gradient(135deg,#3b82f6,#06b6d4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, color: '#fff', fontWeight: 700,
                        }}>{f.type}</div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{f.name}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{f.size}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => setUploadedFiles(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, lineHeight: 1, padding: '2px 4px' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; }}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
              {uploadedFiles.length === 0 && (
                <div style={{ textAlign: 'center', fontSize: 12, color: '#d1d5db', marginTop: 12 }}>
                  暂无上传文件，上传后将作为智能体上下文参考
                </div>
              )}
            </div>
          )}

          {tab === '标签管理' && (
            <TagPanel
              key={tags?.join(',') ?? ''}
              tags={tags}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
              taskName={taskName}
            />
          )}

          {tab === '技能' && (
            <SkillPanel
              taskName={taskName}
              onInject={text => { if (onInject) { onInject(text); onClose(); } }}
            />
          )}

          {tab === '定时任务' && (
            <SchedulePanel
              onFillInput={text => { if (onInject) { onInject(text); onClose(); } }}
              onSend={text => { if (onSend) { onSend(text); onClose(); } }}
            />
          )}

          {tab === '智能体' && (
            <AgentPanel
              agents={agents}
              agentStatusMap={agentStatusMap}
              taskName={taskName}
              matchedProject={matchedProject}
              incomingAgentNames={incomingAgentNames}
              openPanels={openPanels}
              activePanelId={activePanelId}
              onSwitchPanel={panelId => { onSwitchPanel(panelId); onClose(); }}
              onOpenPanel={(agentId, agentName, agentColor, initialMessage) => { onOpenAgentPanel(agentId, agentName, agentColor, initialMessage); onClose(); }}
              onClosePanel={onCloseAgentPanel}
              currentProjectId={currentProjectId}
              backendProjectId={backendProjectId}
              onInject={text => { if (onInject) { onInject(text); onClose(); } }}
              collabNodes={collabNodes}
              setCollabNodes={setCollabNodes}
              isProject={isProject}
              participatingAgentNames={participatingAgentNames}
              onUpgradeToProject={onUpgradeToProject}
              onDowngradeToTask={onDowngradeToTask}
              onRemoveAgent={onRemoveAgent}
            />
          )}

        </div>


      </div>

      <style>{`
        @keyframes tabPanelModalIn {
          from { opacity: 0; transform: scale(0.9) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ─── 优先级 Modal 弹窗 ────────────────────────────────────── */
function PriorityModal({
  priority, onSetPriority, onClose,
}: {
  priority: ProjectPriority | null;
  onSetPriority: (p: ProjectPriority) => void;
  onClose: () => void;
}) {
  return (
    /* 遮罩层 */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        overflowY: 'auto',
      }}
    >
      {/* 弹窗主体 */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
          width: 660,
          maxWidth: 'calc(100vw - 32px)',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
          animation: 'priorityModalIn 0.2s cubic-bezier(0.34,1.4,0.64,1)',
          overflow: 'hidden',
          position: 'relative',
          marginBottom: 32,
        }}
      >
        {/* ── 头部标题栏 ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '22px 28px 18px',
          borderBottom: '1px solid #f0f0f0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="19" height="19" viewBox="0 0 16 16" fill="none">
                <path d="M3 2h10l-2.5 4.5L13 11H3V2Z" fill="white" fillOpacity="0.95"/>
                <rect x="3" y="13" width="1.8" height="1.8" rx="0.5" fill="white"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a202c', lineHeight: 1.3 }}>
                设置优先级
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 3, lineHeight: 1.4 }}>
                同步至项目看板列表
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: 'none', background: '#f3f4f6', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#9ca3af', fontSize: 18, lineHeight: 1,
              transition: 'background 0.15s, color 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e5e7eb'; e.currentTarget.style.color = '#374151'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#9ca3af'; }}
          >×</button>
        </div>

        {/* ── 内容区：优先级标签与选项并排 ── */}
        <div style={{ padding: '24px 28px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* 左侧标签 */}
            <div style={{
              fontSize: 13, fontWeight: 600, color: '#374151',
              whiteSpace: 'nowrap', width: 56, flexShrink: 0,
            }}>
              优先级
            </div>
            {/* 右侧三个选项按钮并排 */}
            <div style={{ display: 'flex', gap: 10, flex: 1 }}>
              {PRIORITY_OPTIONS.map(opt => {
                const isActive = priority === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => { onSetPriority(opt.value); onClose(); }}
                    style={{
                      flex: 1, padding: '9px 0', borderRadius: 8, border: '1.5px solid',
                      borderColor: isActive ? opt.color : '#e5e7eb',
                      background: isActive ? opt.bg : '#fff',
                      color: isActive ? opt.color : '#9ca3af',
                      fontSize: 13, fontWeight: isActive ? 700 : 400,
                      cursor: 'pointer', transition: 'all 0.15s',
                      fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = opt.color;
                        e.currentTarget.style.background = opt.bg;
                        e.currentTarget.style.color = opt.color;
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.background = '#fff';
                        e.currentTarget.style.color = '#9ca3af';
                      }
                    }}
                  >
                    {isActive && (
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M1.5 5.5L4 8L9.5 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>


      </div>

      <style>{`
        @keyframes priorityModalIn {
          from { opacity: 0; transform: scale(0.9) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ─── 消息渠道配置 Modal ───────────────────────────────────── */
type ChannelType = 'feishu' | 'wecom' | 'dingtalk';

const CHANNEL_TABS: { key: ChannelType; label: string; icon: string }[] = [
  { key: 'feishu',   label: '飞书',   icon: '🪶' },
  { key: 'wecom',    label: '企业微信', icon: '💬' },
  { key: 'dingtalk', label: '钉钉',   icon: '📎' },
];

function ChannelConfigModal({ onClose, initialChannel = 'feishu' }: { onClose: () => void; initialChannel?: ChannelType }) {
  const [channel, setChannel] = useState<ChannelType>(initialChannel);
  const [botId, setBotId]     = useState('');
  const [secret, setSecret]   = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [errors, setErrors]   = useState<{ botId?: string; secret?: string }>({});
  const [saved, setSaved]     = useState(false);
  const [saving, setSaving]   = useState(false);
  // 缓存各渠道已加载的配置，避免切换时重复请求
  const [configCache, setConfigCache] = useState<Record<string, { botId: string; secret: string }>>({});

  /** 从后端加载指定渠道的已有配置 */
  async function loadChannelConfig(channelType: ChannelType) {
    // 如果缓存里已有，直接用
    if (configCache[channelType] !== undefined) {
      setBotId(configCache[channelType].botId);
      setSecret(configCache[channelType].secret);
      return;
    }
    try {
      const res = await fetch(`/api/bot-channels/${channelType}`);
      const json = await res.json();
      const data = json.data;
      const cfg = { botId: data?.botId ?? '', secret: data?.secret ?? '' };
      setConfigCache(prev => ({ ...prev, [channelType]: cfg }));
      setBotId(cfg.botId);
      setSecret(cfg.secret);
    } catch {
      setBotId(''); setSecret('');
    }
  }

  // 初始化时加载默认渠道的配置
  useEffect(() => {
    loadChannelConfig(initialChannel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validate() {
    const e: { botId?: string; secret?: string } = {};
    if (!botId.trim())   e.botId  = 'Bot ID 不能为空';
    if (!secret.trim())  e.secret = 'Secret 不能为空';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleConfirm() {
    if (!validate()) return;
    setSaving(true);
    try {
      await fetch('/api/bot-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelType: channel, botId: botId.trim(), secret: secret.trim(), enabled: true }),
      });
      // 更新缓存
      setConfigCache(prev => ({ ...prev, [channel]: { botId: botId.trim(), secret: secret.trim() } }));
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    } catch {
      setErrors({ botId: '保存失败，请稍后重试' });
    } finally {
      setSaving(false);
    }
  }

  /* 切换渠道时加载对应渠道的配置 */
  function switchChannel(c: ChannelType) {
    setChannel(c);
    setErrors({});
    loadChannelConfig(c);
  }

  const channelLabels: Record<ChannelType, string> = {
    feishu: '飞书', wecom: '企业微信', dingtalk: '钉钉',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
          width: 660,
          maxWidth: 'calc(100vw - 32px)',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
          animation: 'channelModalIn 0.2s cubic-bezier(0.34,1.4,0.64,1)',
          overflow: 'hidden',
          position: 'relative',
          marginBottom: 32,
        }}
      >
        {/* ── 头部标题栏 ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '22px 28px 18px',
          borderBottom: '1px solid #f0f0f0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* 图标 */}
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="19" height="19" viewBox="0 0 17 17" fill="none">
                <path d="M2 3.5C2 2.67 2.67 2 3.5 2H10L15 7V13.5C15 14.33 14.33 15 13.5 15H3.5C2.67 15 2 14.33 2 13.5V3.5Z"
                  fill="none" stroke="white" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M10 2V7H15" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 10H12M5 12.5H9" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </div>
            {/* 标题 + 副标题 */}
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a202c', lineHeight: 1.3 }}>
                消息渠道配置
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 3, lineHeight: 1.4 }}>
                连接后智能体可接收并回复渠道消息
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: 'none', background: '#f3f4f6', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#9ca3af', fontSize: 18, lineHeight: 1,
              transition: 'background 0.15s, color 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e5e7eb'; e.currentTarget.style.color = '#374151'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#9ca3af'; }}
          >×</button>
        </div>

        {/* ── 提示栏 ── */}
        <div style={{
          margin: '18px 28px 0',
          padding: '11px 14px',
          borderRadius: 8,
          background: '#f0f7ff',
          border: '1px solid #c8e0ff',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <svg width="15" height="15" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="6" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="1.2"/>
            <path d="M7 6V10M7 4.5V5" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 13, color: '#333', flex: 1, lineHeight: 1.5 }}>
            配置机器人 Token 后，智能体可在渠道中自动收发消息。
          </span>
          <a
            href="#"
            onClick={e => e.preventDefault()}
            style={{
              fontSize: 13, color: '#1d6ef5', fontWeight: 600,
              textDecoration: 'underline', whiteSpace: 'nowrap',
              textUnderlineOffset: 2,
            }}
          >实践教程 →</a>
        </div>

        {/* ── 渠道标签页 ── */}
        <div style={{ padding: '20px 28px 0' }}>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 10, fontWeight: 500 }}>
            选择渠道
          </div>
          <div style={{ display: 'flex', gap: 0, border: '1px solid #e5e7eb', borderRadius: 9, overflow: 'hidden' }}>
            {CHANNEL_TABS.map((tab, idx) => {
              const active = channel === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => switchChannel(tab.key)}
                  style={{
                    flex: 1,
                    height: 48,
                    padding: '0 12px',
                    borderRadius: 0,
                    border: 'none',
                    borderLeft: idx === 0 ? 'none' : '1px solid #e5e7eb',
                    background: active ? '#3b82f6' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                    transition: 'all 0.15s',
                    fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                    outline: active ? '2px solid #3b82f6' : 'none',
                    outlineOffset: -2,
                    position: 'relative',
                  }}
                  onMouseEnter={e => {
                    if (!active) { e.currentTarget.style.background = '#f0f7ff'; }
                  }}
                  onMouseLeave={e => {
                    if (!active) { e.currentTarget.style.background = '#ffffff'; }
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
                  <span style={{
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    color: active ? '#ffffff' : '#6b7280',
                  }}>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 表单区域 ── */}
        <div style={{ padding: '22px 28px 12px' }}>
          {/* 分割线 + 渠道名 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
          }}>
            <div style={{ flex: 1, height: 1, background: '#f0f0f0' }}/>
            <span style={{ fontSize: 12, color: '#aaa', whiteSpace: 'nowrap' }}>
              {channelLabels[channel]} Bot 配置
            </span>
            <div style={{ flex: 1, height: 1, background: '#f0f0f0' }}/>
          </div>

          {/* Bot ID */}
          <div style={{ marginBottom: 18 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 2,
              fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7,
            }}>
              Bot ID<span style={{ color: '#ef4444', fontSize: 13, lineHeight: 1, marginLeft: 2 }}>*</span>
            </label>
            <input
              value={botId}
              onChange={e => { setBotId(e.target.value); if (errors.botId) setErrors(v => ({ ...v, botId: undefined })); }}
              placeholder={`请输入 ${channelLabels[channel]} Bot ID`}
              style={{
                width: '100%', height: 44, padding: '0 16px',
                border: errors.botId ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb',
                borderRadius: 8, fontSize: 13, outline: 'none',
                background: '#fff', color: '#1a202c',
                fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = errors.botId ? '#ef4444' : '#3b82f6';
                e.currentTarget.style.boxShadow = errors.botId
                  ? '0 0 0 3px rgba(239,68,68,0.12)'
                  : '0 0 0 3px rgba(59,130,246,0.12)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = errors.botId ? '#ef4444' : '#e5e7eb';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <style>{`input::placeholder { color: #999 !important; }`}</style>
            {errors.botId && (
              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <circle cx="5.5" cy="5.5" r="4.5" fill="#ef4444" fillOpacity="0.15" stroke="#ef4444" strokeWidth="1"/>
                  <path d="M5.5 3.5V6M5.5 7.5V8" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                {errors.botId}
              </div>
            )}
          </div>

          {/* Secret */}
          <div style={{ marginBottom: 8 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 2,
              fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7,
            }}>
              Secret<span style={{ color: '#ef4444', fontSize: 13, lineHeight: 1, marginLeft: 2 }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showSecret ? 'text' : 'password'}
                value={secret}
                onChange={e => { setSecret(e.target.value); if (errors.secret) setErrors(v => ({ ...v, secret: undefined })); }}
                placeholder="请输入 Secret"
                style={{
                  width: '100%', height: 44, padding: '0 48px 0 16px',
                  border: errors.secret ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb',
                  borderRadius: 8, fontSize: 13, outline: 'none',
                  background: '#fff', color: '#1a202c',
                  fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = errors.secret ? '#ef4444' : '#3b82f6';
                  e.currentTarget.style.boxShadow = errors.secret
                    ? '0 0 0 3px rgba(239,68,68,0.12)'
                    : '0 0 0 3px rgba(59,130,246,0.12)';
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = errors.secret ? '#ef4444' : '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              {/* 眼睛图标：点击切换显示/隐藏，默认隐藏(password) */}
              <button
                type="button"
                onClick={() => setShowSecret(v => !v)}
                tabIndex={-1}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 4, display: 'flex', alignItems: 'center',
                  color: showSecret ? '#3b82f6' : '#9ca3af',
                  transition: 'color 0.15s', borderRadius: 4,
                }}
                onMouseEnter={e => { if (!showSecret) e.currentTarget.style.color = '#6b7280'; }}
                onMouseLeave={e => { if (!showSecret) e.currentTarget.style.color = '#9ca3af'; }}
                title={showSecret ? '点击隐藏密码' : '点击显示密码'}
              >
                {showSecret ? (
                  /* 眼睛睁开：密码可见状态，图标蓝色 */
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                ) : (
                  /* 眼睛关闭：密码隐藏状态，图标灰色 */
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                )}
              </button>
            </div>
            {errors.secret && (
              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <circle cx="5.5" cy="5.5" r="4.5" fill="#ef4444" fillOpacity="0.15" stroke="#ef4444" strokeWidth="1"/>
                  <path d="M5.5 3.5V6M5.5 7.5V8" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                {errors.secret}
              </div>
            )}
          </div>
        </div>

        {/* ── 底部按钮 ── */}
        <div style={{
          display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center',
          padding: '16px 28px 24px',
          borderTop: '1px solid #f0f0f0',
        }}>
          {/* 取消：白底灰边，hover 边框加深 */}
          <button
            onClick={onClose}
            style={{
              height: 40, padding: '0 24px', fontSize: 14, borderRadius: 8,
              border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer',
              color: '#6b7280', fontWeight: 500,
              fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
              transition: 'border-color 0.15s, color 0.15s, background 0.15s',
              display: 'inline-flex', alignItems: 'center',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#9ca3af';
              e.currentTarget.style.color = '#374151';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.color = '#6b7280';
            }}
          >取消</button>

          {/* 确定：紫色实底，hover 加深，保存后变绿 */}
          <button
            onClick={handleConfirm}
            disabled={saving}
            style={{
              height: 40, padding: '0 28px', fontSize: 14, borderRadius: 8,
              border: 'none',
              background: saved ? '#22c55e' : '#6366f1',
              cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: 600,
              fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
              opacity: saving ? 0.75 : 1,
              transition: 'background 0.15s, box-shadow 0.15s',
              boxShadow: saved ? '0 2px 8px rgba(34,197,94,0.25)' : '0 2px 8px rgba(99,102,241,0.25)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = saved ? '#16a34a' : '#4f46e5';
              e.currentTarget.style.boxShadow = saved
                ? '0 4px 12px rgba(34,197,94,0.35)'
                : '0 4px 12px rgba(79,70,229,0.35)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = saved ? '#22c55e' : '#6366f1';
              e.currentTarget.style.boxShadow = saved
                ? '0 2px 8px rgba(34,197,94,0.25)'
                : '0 2px 8px rgba(99,102,241,0.25)';
            }}
          >
            {saving ? '保存中...' : saved ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7L5.5 10L11.5 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                已保存
              </>
            ) : '确 定'}
          </button>
        </div>

        {/* 成功提示 toast */}
        {saved && (
          <div style={{
            position: 'absolute', bottom: 88, left: '50%', transform: 'translateX(-50%)',
            background: '#1a202c', color: '#fff', borderRadius: 8, padding: '8px 18px',
            fontSize: 12, whiteSpace: 'nowrap', pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            animation: 'toastIn 0.2s ease',
          }}>
            ✓ 渠道配置已保存
          </div>
        )}
      </div>

      <style>{`
        @keyframes channelModalIn {
          from { opacity: 0; transform: scale(0.9) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
export function ProjectWorkspace() {
  const location = useLocation();
  type NavState = { projectName?: string; projectId?: string; taskId?: string; agentNames?: string[] } | null;
  const navState = location.state as NavState;

  // ── 持久化项目上下文到 sessionStorage，刷新后可恢复 ──
  // 有新的 navState 时写入；刷新后 navState 为 null 时从 sessionStorage 读取
  const SESSION_KEY = 'workspace_project_ctx';
  type ProjectCtx = {
    projectName?: string;
    projectId?: string;
    taskId?: string;
    agentNames?: string[];
    /** 项目已降级为任务：true 时刷新后 isProjectMode=false */
    isDegraded?: boolean;
    /** 降级后继承的标签（刷新恢复用） */
    degradedTags?: string[];
    /** 降级后继承的优先级（刷新恢复用） */
    degradedPriority?: string | null;
    /** 降级后保留的单个智能体名称（刷新恢复用） */
    degradedAgentName?: string;
  };

  const resolvedCtx = ((): ProjectCtx => {
    if (navState?.projectName || navState?.projectId || navState?.taskId) {
      // 有新跳转数据：重置降级标志并写入 sessionStorage
      const ctx: ProjectCtx = {
        projectName: navState.projectName,
        projectId: navState.projectId,
        taskId: navState.taskId,
        agentNames: navState.agentNames,
        isDegraded: false,
      };
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(ctx)); } catch {}
      return ctx;
    }
    // 刷新后从 sessionStorage 恢复
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) return JSON.parse(saved) as ProjectCtx;
    } catch {}
    return {};
  })();

  /** 从项目协作页跳转时携带的项目名（任务/项目通用） */
  const incomingProjectName = resolvedCtx.projectName;
  /** 从项目看板卡片跳转时携带的项目 id */
  const incomingProjectId = resolvedCtx.projectId;
  /** 从任务看板卡片跳转时携带的任务 id */
  const incomingTaskId = resolvedCtx.taskId;
  /**
   * 从任务/项目看板卡片点击跳转时携带的智能体名称列表
   * 用于 AgentPanel 只展示该任务/项目关联的智能体
   * 若为空/未传入，则 AgentPanel 展示所有智能体
   */
  const incomingAgentNames = resolvedCtx.agentNames;

  /* ── Store 接入 ─────────────────────────────────────────── */
  const { currentProject, projects, fetchProjects, createProject } = useProjectStore();
  const {
    openPanels, openPanel, sendMessage, connect, closePanel, wsConnected, dismissBanner,
    sessionTabs, activeTabId, createSessionTab, switchSessionTab, closeSessionTab, bindPanelToTab,
  } = useConversationStore();
  const { agents, fetchAgents } = useAgentStore();
  const { addTaskFromChat, tasks, updateTask, addTask } = useTaskStore();
  const { projects: kanbanProjects, updateProject: updateKanbanProject, addProject: addKanbanProject } = useProjectKanbanStore();

  /* ── 新建项目/任务弹窗状态 ───────────────────────────────── */
  const [createModal, setCreateModal] = useState<{ open: boolean; type: 'project' | 'task' | null }>({ open: false, type: null });
  /* ── 本地状态 ────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [inputValue, setInputValue] = useState('');
  /** 当前激活的对话 panel id（用于智能体面板高亮显示） */
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  /** 协作流程节点（提升到顶层，防止 TabPanel 关闭时丢失） */
  const [collabNodes, setCollabNodes] = useState<FlowNode[]>(() => [makeFlowNode(0)]);
  /**
   * 当前是否为项目模式（可动态升级/降级）—— 刷新后从 sessionStorage 恢复。
   * 若 sessionStorage 里记录了 isDegraded=true，说明用户在本次会话中已将项目降级为任务，
   * 刷新后应维持任务模式，而不是根据 incomingProjectId 重新变回项目模式。
   */
  const [isProjectMode, setIsProjectMode] = useState<boolean>(() => {
    if (resolvedCtx.isDegraded) return false;
    return !!(incomingProjectId && !incomingTaskId);
  });
  /** 当前参与会话的智能体名称列表（项目模式下可增删，任务模式下只有1个） */
  const [participatingAgentNames, setParticipatingAgentNames] = useState<string[]>(() => {
    // 降级状态：恢复降级时保留的单个智能体
    if (resolvedCtx.isDegraded && resolvedCtx.degradedAgentName) {
      return [resolvedCtx.degradedAgentName];
    }
    return incomingAgentNames ?? [];
  });
  /**
   * ⚠️ 降级任务数据 —— 请勿删除此 state，否则降级后标签/优先级会全部丢失！
   *
   * 从项目降级为任务时，将原项目的 tags/priority 继承过来，
   * 存入此 state 作为任务模式的临时数据源。
   *
   * 【背景 / 根因】
   *   本页面由"项目"跳转进入时，incomingTaskId 为 null（URL 里没有 taskId），
   *   所以 matchedTask 永远为 null（见下方 matchedTask 定义）。
   *   降级后 isProjectMode=false，但 taskStore 里没有对应的 task 记录，
   *   如果 currentTags/currentPriority 只看 matchedTask，会读到空值，
   *   标签和优先级全部丢失，且 addTag/setPriority 也无处写入。
   *
   * 【解决方案】
   *   downgradeToTask() 被调用时，立即把 matchedKanbanProject.tags/priority
   *   拷贝到 degradedTaskData，后续读写均通过此 state 完成（见 currentTags、
   *   addTag、removeTag、setPriority 的实现）。
   */
  const [degradedTaskData, setDegradedTaskData] = useState<{
    tags: string[];
    priority: ProjectPriority | null;
  } | null>(() => {
    // 刷新后从 sessionStorage 恢复降级数据
    if (resolvedCtx.isDegraded) {
      return {
        tags: resolvedCtx.degradedTags ?? [],
        priority: (resolvedCtx.degradedPriority as ProjectPriority | null) ?? null,
      };
    }
    return null;
  });

  /** 顶部优先级下拉是否展开 */
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // ── 防重说明 ────────────────────────────────────────────────────────────────
  // addTaskFromChat 内部已做幂等校验：task.id = conversationId（panelId），
  // 若 taskStore 中已存在同 id 的任务则直接跳过，不重复插入。
  // 因此 ProjectWorkspace 不再需要维护任何防重集合（内存或 localStorage）。
  // ────────────────────────────────────────────────────────────────────────────

  /** 浏览器网络是否在线 */
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /** 顶部状态徽标：离线 > 忙碌 > 运行中 */
  const isAnyStreaming = openPanels.some(p => p.isStreaming);
  type AppStatus = 'running' | 'offline' | 'busy';
  const appStatus: AppStatus = !isOnline || !wsConnected ? 'offline' : isAnyStreaming ? 'busy' : 'running';
  const STATUS_CONFIG: Record<AppStatus, { label: string; bg: string; color: string; border: string; dotColor: string }> = {
    running: { label: '运行中', bg: '#e8f5e9', color: '#2e7d32', border: '#dcedc8', dotColor: '#22c55e' },
    offline: { label: '离线',   bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', dotColor: '#ef4444' },
    busy:    { label: '忙碌',   bg: '#fffbeb', color: '#b45309', border: '#fde68a', dotColor: '#f59e0b' },
  };

  /* ── openPanels 变化时自动同步 sessionTabs ─────────────────── */
  useEffect(() => {
    const store = useConversationStore.getState();
    const { sessionTabs: tabs } = store;
    openPanels.forEach((panel) => {
      // 若 panel 尚未绑定任何 Tab，自动创建一个并绑定
      const bound = tabs.find((t) => t.panelId === panel.id);
      if (!bound) {
        const tabId = `tab-${panel.id}`;
        // 检查是否已有此 tabId（避免重复）
        if (!tabs.find((t) => t.id === tabId)) {
          const newTab = {
            id: tabId,
            title: panel.agentName,
            panelId: panel.id,
            color: panel.agentColor,
            isStreaming: panel.isStreaming,
          };
          useConversationStore.setState((s) => ({
            sessionTabs: s.sessionTabs.find((t) => t.id === tabId)
              ? s.sessionTabs
              : [...s.sessionTabs, newTab],
            activeTabId: s.activeTabId ?? tabId,
          }));
        }
      } else {
        // 同步 streaming 状态
        useConversationStore.setState((s) => ({
          sessionTabs: s.sessionTabs.map((t) =>
            t.id === bound.id ? { ...t, isStreaming: panel.isStreaming, title: panel.agentName, color: panel.agentColor } : t
          ),
        }));
      }
    });
  }, [openPanels]);

  /* ── 根据当前激活 Tab 同步 activePanelId ─────────────────── */
  useEffect(() => {
    if (!activeTabId) return;
    const tab = sessionTabs.find((t) => t.id === activeTabId);
    if (tab?.panelId && tab.panelId !== activePanelId) {
      setActivePanelId(tab.panelId);
    }
  }, [activeTabId, sessionTabs]);

  /* ── 取当前工作台的会话 panel（按 activePanelId 查找，兜底取第一个） ── */
  const activePanel = (activePanelId ? openPanels.find(p => p.id === activePanelId) : null) ?? openPanels[0] ?? null;

  /* ── 动态数据：优先用跳转传入的项目名 > currentProject > 第一个项目 ── */
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const taskName = incomingProjectName ?? currentProject?.title ?? (projects[0]?.title ?? 'WorkBuddy');
  const taskProgress = 68; // 真实进度字段后端暂无，保留占位

  /* ── 找到 kanban 中对应的项目（项目模式用来读写 tags/priority）── */
  const allKanbanProjects = [...kanbanProjects.progress, ...kanbanProjects.done];
  const matchedKanbanProject =
    (incomingProjectId ? allKanbanProjects.find(p => p.id === incomingProjectId) : undefined)
    ?? (incomingProjectName && !incomingTaskId ? allKanbanProjects.find(p => p.title === incomingProjectName) : undefined)
    ?? null;

  /* ── 找到 taskStore 中对应的任务（任务模式用来读写 tags/priority）── */
  const allTasks = [...tasks.progress, ...tasks.done];
  const matchedTask = incomingTaskId ? allTasks.find(t => t.id === incomingTaskId) ?? null : null;

  /* ── 统一的 tags / priority 数据源 ──────────────────────────────────────────────
   * ⚠️ 读取优先级固定为以下顺序，请勿随意调整，否则降级场景会回归 BUG！
   *
   *   优先级（高 → 低）：
   *     1. matchedTask       —— 有 incomingTaskId 时，从 taskStore 精确匹配（任务模式正常入口）
   *     2. degradedTaskData  —— 项目降级为任务后的内存数据（无 taskId 时的唯一降级兜底）
   *     3. matchedKanbanProject —— 项目模式，从 kanbanStore 读取
   *     4. 默认空值
   *
   * 【为什么需要 degradedTaskData 这一层】
   *   从项目页跳转进入时 incomingTaskId=null → matchedTask 永远为 null；
   *   降级后 isProjectMode=false，若跳过 degradedTaskData 直接用
   *   matchedKanbanProject，写入时 addTag/setPriority 又会走项目分支，
   *   数据来源和写入目标不一致，标签/优先级展示错误。
   * ────────────────────────────────────────────────────────────────────────── */
  const currentTags: string[] = matchedTask?.tags ?? degradedTaskData?.tags ?? matchedKanbanProject?.tags ?? [];
  const currentPriority: ProjectPriority | null =
    (matchedTask?.priority as ProjectPriority | undefined)
    ?? degradedTaskData?.priority
    ?? matchedKanbanProject?.priority
    ?? null;

  /* ── 后端项目 UUID（用于属性修改同步到后端）──────────────── */
  const backendProjectId = projects.find(p => p.title === taskName)?.id ?? null;

  /**
   * ⚠️ 顶部头像区的唯一数据源 —— 请勿改回 participatingAgentNames！
   *
   * 项目协作智能体列表：直接从 collabNodes（协作弹窗里的流程节点）实时提取。
   *
   * 【为什么不用 participatingAgentNames】
   *   participatingAgentNames 只在以下三个时机写入：
   *     1. 页面初始化（从 URL / sessionStorage 读取）
   *     2. upgradeToProject 升级时
   *     3. useEffect 从后端回填时
   *   用户在协作 Tab 里实时增删节点/分配智能体，只更新 collabNodes，
   *   participatingAgentNames 不会同步 → 顶部头像展示"旧快照"，两者产生分歧。
   *
   * 【正确做法】
   *   从 collabNodes 实时 flatMap 出所有 agentId，去重后 map 成 Agent 对象。
   *   每次 collabNodes 变化，collabAgents 自动跟随更新，顶部头像实时同步。
   *
   * 注意：只在项目模式（isProjectMode=true）下使用；
   *       任务模式顶部仅显示单个当前激活智能体，不用此字段。
   */
  const collabAgents = isProjectMode
    ? [...new Set(collabNodes.flatMap(n => n.agentIds))]
        .map(id => agents.find(a => a.id === id))
        .filter((a): a is import('../types').Agent => !!a)
    : [];

  /**
   * 项目属性修改统一同步函数：
   *   1. 先更新 projectKanbanStore（会话列表 / 看板 UI 立即响应）
   *   2. 再异步调用 projectsApi.update 同步到后端（供其他端口读取）
   * 任务属性仅更新 taskStore（当前无独立后端任务 API）
   */
  function syncProjectPatch(projectId: string, patch: Partial<import('../stores/projectKanbanStore').KanbanProject>) {
    // Step 1：同步到前端 store（立即生效，UI 响应无延迟）
    updateKanbanProject(projectId, patch);
    // Step 2：同步到后端，让其他端口可以读到最新数据
    if (backendProjectId) {
      projectsApi.update(backendProjectId, patch as any).catch(() => {
        showToast('属性同步到后端失败，刷新后可能恢复旧值', 'error');
      });
    }
  }

  /**
   * ⚠️ 协作节点变化 → 同步写回 kanbanStore.agents（会话列表卡片的数据来源）
   *
   * 【问题根因】
   *   会话列表卡片（AgentKanban.tsx > ProjectCard）展示的智能体头像
   *   读取的是 kanbanStore 里 project.agents 字段，该字段在 AgentKanban
   *   的 useEffect 初始化时从后端 workflowNodes 反查写入一次，之后不再更新。
   *
   *   用户在协作弹窗里实时增删节点/分配智能体时，collabNodes（本组件 state）
   *   随之变化，但 kanbanStore.agents 没有同步，导致会话列表卡片仍显示旧数据。
   *
   * 【修复方式】
   *   监听 collabNodes 变化，从中提取最新的去重 agentId 列表，
   *   反查 agentStore 得到 { name, color }，写回 kanbanStore.agents。
   *   这样无论用户怎么修改协作配置，会话列表卡片都能实时同步。
   *
   * 【只在项目模式下执行】
   *   任务模式下没有 kanbanProject 记录，也不需要同步 agents 字段。
   */
  useEffect(() => {
    if (!isProjectMode || !matchedKanbanProject) return;
    // 从 collabNodes 提取去重 agentId，反查 agentStore 得到 { name, color }
    const agentIds = [...new Set(collabNodes.flatMap(n => n.agentIds))];
    const syncedAgents = agentIds
      .map(id => agents.find(a => a.id === id))
      .filter((a): a is import('../types').Agent => !!a)
      .map(a => ({ name: a.name, color: a.color ?? '#6366f1' }));
    if (syncedAgents.length === 0) return; // 节点全空时不覆盖（避免初始化时清空）
    // 只更新前端 store，不调后端（agents 字段无对应后端 API）
    updateKanbanProject(matchedKanbanProject.id, {
      agents: syncedAgents,
      memberCount: syncedAgents.length,
    });
  // collabNodes / isProjectMode 变化时重新同步；agents/matchedKanbanProject 变化时也要重新反查
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collabNodes, isProjectMode]);

  /* ── 标签编辑（写回 store，供标签管理面板使用）──────────── */
  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || currentTags.includes(tag)) return;
    if (matchedTask) {
      // 任务模式（有真实 task 记录）：只更新 taskStore（当前无独立后端任务 API）
      updateTask(matchedTask.id, { tags: [...currentTags, tag] });
    } else if (!isProjectMode && degradedTaskData !== null) {
      // 降级任务模式（无 task 记录，数据来自 degradedTaskData）：
      // 直接更新内存 state，UI 立即响应
      setDegradedTaskData(prev => prev && { ...prev, tags: [...prev.tags, tag] });
    } else if (matchedKanbanProject) {
      // 项目模式：先更新 store，再同步后端
      syncProjectPatch(matchedKanbanProject.id, { tags: [...currentTags, tag] });
    }
  }

  function removeTag(tag: string) {
    if (matchedTask) {
      updateTask(matchedTask.id, { tags: currentTags.filter(t => t !== tag) });
    } else if (!isProjectMode && degradedTaskData !== null) {
      // 降级任务模式：从内存 state 中移除
      setDegradedTaskData(prev => prev && { ...prev, tags: prev.tags.filter(t => t !== tag) });
    } else if (matchedKanbanProject) {
      syncProjectPatch(matchedKanbanProject.id, { tags: currentTags.filter(t => t !== tag) });
    }
  }

  /* ── 优先级读写 ──────────────────────────────────────────── */
  function setPriority(p: ProjectPriority) {
    if (matchedTask) {
      updateTask(matchedTask.id, { priority: p as 'high' | 'mid' | 'low' });
    } else if (!isProjectMode && degradedTaskData !== null) {
      // 降级任务模式：写入内存 state，UI 立即响应
      setDegradedTaskData(prev => prev && { ...prev, priority: p });
    } else if (matchedKanbanProject) {
      syncProjectPatch(matchedKanbanProject.id, { priority: p });
    }
  }

  /* ── 任务升级为项目 ─────────────────────────────────────── */
  function upgradeToProject(newAgentNames: string[]) {
    // 将新增的智能体 Panel 打开
    const allNames = [...new Set([...participatingAgentNames, ...newAgentNames])];
    setParticipatingAgentNames(allNames);
    setIsProjectMode(true);
    // 在看板 store 新建或更新项目记录
    const participantAgents = agents
      .filter(a => allNames.includes(a.name))
      .map(a => ({ name: a.name, color: a.color ?? '#6366f1' }));
    if (!matchedKanbanProject || matchedKanbanProject.agents.length < 1) {
      const dueDate30 = new Date(Date.now() + 30 * 86400000);
      const mm = String(dueDate30.getMonth() + 1).padStart(2, '0');
      const dd = String(dueDate30.getDate()).padStart(2, '0');
      addKanbanProject({
        id: matchedKanbanProject?.id ?? `proj_upgrade_${Date.now()}`,
        title: taskName,
        description: '',
        tags: currentTags,
        priority: currentPriority ?? 'low',
        agent: participantAgents[0]?.name ?? agents[0]?.name ?? '策划助手',
        agentColor: participantAgents[0]?.color ?? agents[0]?.color ?? '#6366f1',
        agents: participantAgents,
        progress: 0,
        dueDate: `${mm}/${dd}`,
        updatedAt: '刚刚',
        taskCount: collabNodes.length,
        memberCount: participantAgents.length,
      }, 'progress');
    } else {
      // 已有项目记录则只更新 agents 列表
      updateKanbanProject(matchedKanbanProject.id, { agents: participantAgents, memberCount: participantAgents.length });
    }
  }

  /* ── 修改标题 ───────────────────────────────────────────── */
  function startEditTitle() {
    setEditTitleValue(taskName);
    setEditingTitle(true);
  }

  function saveTitle() {
    const trimmed = editTitleValue.trim();
    if (!trimmed || trimmed === taskName) {
      setEditingTitle(false);
      return;
    }
    
    // 更新任务/项目标题
    if (matchedTask) {
      // 任务模式：更新 taskStore
      updateTask(matchedTask.id, { title: trimmed });
    } else if (matchedKanbanProject) {
      // 项目模式：更新 kanbanStore
      updateKanbanProject(matchedKanbanProject.id, { title: trimmed });
      // 同时更新后端项目名称
      if (backendProjectId) {
        projectsApi.update(backendProjectId, { title: trimmed }).catch(() => {
          // 后端更新失败时静默处理
        });
      }
    }
    setEditingTitle(false);
  }

  /* ── 移出协作（不降级，仅减少参与智能体）─────────────────── */
  function removeAgentFromProject(removedAgentName: string) {
    const newNames = participatingAgentNames.filter(n => n !== removedAgentName);
    setParticipatingAgentNames(newNames);
    // 同步更新看板 store
    if (matchedKanbanProject) {
      const participantAgents = agents
        .filter(a => newNames.includes(a.name))
        .map(a => ({ name: a.name, color: a.color ?? '#6366f1' }));
      updateKanbanProject(matchedKanbanProject.id, { agents: participantAgents, memberCount: participantAgents.length });
    }
  }

  /* ── 项目降级为任务 ─────────────────────────────────────── */
  function downgradeToTask(keptAgentName: string) {
    /**
     * 降级时将原项目的 tags 和 priority 继承到 degradedTaskData。
     *
     * 原因：降级后 isProjectMode=false，但 incomingTaskId 仍为 null（进入页面时
     * 是从项目跳转的），导致 matchedTask=null，currentTags/currentPriority 会丢失。
     * 通过初始化 degradedTaskData，让降级后的任务模式有数据源可读写。
     */
    const degradedTags = matchedKanbanProject?.tags ?? [];
    const degradedPriority = matchedKanbanProject?.priority ?? null;

    setDegradedTaskData({
      tags: degradedTags,
      priority: degradedPriority,
    });

    // 同步写入 sessionStorage，刷新后可恢复降级状态
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      const ctx = saved ? JSON.parse(saved) : {};
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        ...ctx,
        isDegraded: true,
        degradedTags,
        degradedPriority,
        degradedAgentName: keptAgentName,
      }));
    } catch { /* ignore */ }

    setParticipatingAgentNames([keptAgentName]);
    setIsProjectMode(false);
    // 关闭非保留智能体的所有 Panel
    openPanels.forEach(p => {
      if (p.agentName !== keptAgentName) closePanel(p.id);
    });
    setActivePanelId(prev => {
      const kept = openPanels.find(p => p.agentName === keptAgentName);
      return kept ? kept.id : prev;
    });
    // 清空协作节点，回到初始单节点
    setCollabNodes([makeFlowNode(0)]);
  }

  /* ── 点击空白处关闭优先级下拉 ──────────────────────────── */
  useEffect(() => {
    if (!showPriorityDropdown) return;
    function handleClickOutside(e: MouseEvent) {
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(e.target as Node)) {
        setShowPriorityDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPriorityDropdown]);

  /* ── 初始化：加载项目 + 智能体列表 + WS 连接 ───────────── */
  useEffect(() => {
    fetchProjects();
    fetchAgents();
    connect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 刷新后从后端回填协作节点 ──────────────────────────── */
  // 当后端项目列表加载完成后，按项目名/id找到对应项目，把 workflowNodes 回填到 collabNodes
  // 只在初次加载时回填（collabNodes 还是默认的单空节点时），避免用户手动编辑后被覆盖
  const collabNodesInitialized = useRef(false);
  useEffect(() => {
    if (collabNodesInitialized.current) return;
    if (!projects.length) return;
    if (!agents.length) return;  // 等 agents 加载完成，确保能推导名称

    // 在 effect 内部重新计算 targetTitle，避免闭包过期问题
    // 优先用 incomingProjectName（sessionStorage 恢复后依然有效）
    // 其次在 kanban store 里通过 incomingProjectId 找到项目名
    const allKanban = [
      ...kanbanProjects.progress,
      ...kanbanProjects.done,
    ];
    const kanbanMatch = incomingProjectId
      ? allKanban.find(p => p.id === incomingProjectId)
      : (incomingProjectName ? allKanban.find(p => p.title === incomingProjectName) : undefined);
    const targetTitle = kanbanMatch?.title ?? incomingProjectName;

    if (!targetTitle) return;

    const backendProject = projects.find(p => p.title === targetTitle);
    if (!backendProject) return;

    const nodes = backendProject.workflowNodes;
    if (!nodes || nodes.length === 0) return;

    // 把后端 workflowNodes 转成前端 FlowNode 格式
    const flowNodes: FlowNode[] = nodes.map(n => ({
      id: n.id,
      name: n.name,
      nodeType: n.nodeType as 'serial' | 'parallel',
      agentIds: n.agentIds,
      desc: n.taskDesc,
    }));

    setCollabNodes(flowNodes);

    // 同时从节点的 agentIds 推导出参与智能体名称列表，更新 participatingAgentNames
    // 这样协作 tab 里"参与智能体"区域只会显示节点里实际选的那些智能体
    const allAgentIds = [...new Set(flowNodes.flatMap(n => n.agentIds))];
    if (allAgentIds.length > 0 && agents.length > 0) {
      const names = allAgentIds
        .map(id => agents.find(a => a.id === id)?.name)
        .filter(Boolean) as string[];
      if (names.length > 0) {
        setParticipatingAgentNames(names);
      }
    }

    collabNodesInitialized.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, kanbanProjects, agents]);

  /* ── 消息列表滚动到底部 ─────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activePanel?.messages]);

  /* ── 发送消息 ─────────────────────────────────────────────── */
  async function handleSend() {
    const text = inputValue.trim();
    if (!text) return;

    let panelId: string | undefined;
    let agentName = '';
    let agentColor = '#9ca3af';

    if (activePanel) {
      // 已有会话 panel，直接发消息
      sendMessage(activePanel.id, text);
      panelId = activePanel.id;
      agentName = activePanel.agentName;
      agentColor = activePanel.agentColor ?? '#9ca3af';
    } else {
      // 没有 panel：用第一个可用智能体自动开启一个会话
      const defaultAgent = agents[0];
      if (defaultAgent) {
        // 取当前激活 Tab id（若有），在新建 panel 后自动绑定
        const currentTabId = useConversationStore.getState().activeTabId;
        await openPanel({
          agentId: defaultAgent.id,
          agentName: defaultAgent.name,
          agentColor: defaultAgent.color,
          projectId: currentProject?.id,
          tabId: currentTabId ?? undefined,
        });
        const freshPanel = useConversationStore.getState().openPanels[0];
        if (freshPanel) {
          sendMessage(freshPanel.id, text);
          panelId = freshPanel.id;
          setActivePanelId(freshPanel.id);
        }
        agentName = defaultAgent.name;
        agentColor = defaultAgent.color ?? '#9ca3af';
      }
    }

    // 自动为对话建任务：task.id = panelId（conversationId），addTaskFromChat 内部幂等，
    // 同一 conversationId 已存在则静默跳过，无需外部防重集合
    if (panelId) {
      // 任务标题：优先用项目名（来自跳转上下文），其次用"与 AgentName 的对话"
      const ctxTitle = resolvedCtx.projectName
        || (resolvedCtx.taskId ? (() => {
            const allTasks = [...(tasks['progress'] ?? []), ...(tasks['done'] ?? [])];
            return allTasks.find(t => t.id === resolvedCtx.taskId)?.title;
          })() : undefined);
      const taskTitle = ctxTitle || `与 ${agentName || '智能体'} 的对话`;
      addTaskFromChat({
        title: taskTitle,
        agentName: agentName || '智能体',
        agentColor,
        panelId,
      });
    }

    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); handleSend(); }
  }

  function handleTabClick(tab: string) {
    if (tab === '优先级') {
      setActiveTab(null);
      setShowPriorityModal(true);
    } else if (tab === '消息渠道') {
      setActiveTab(null);
      setShowChannelModal(true);
    } else {
      setActiveTab(activeTab === tab ? null : tab);
    }
  }

  const progressColor = getProgressColor(taskProgress);

  /* ── 渲染消息列表 ──────────────────────────────────────── */
  const messages = activePanel?.messages ?? [];

  return (
    <>
      <style>{`
        .workspace-body {
          width: 100%; height: 100%; background: #f5f7fa;
          padding: 16px; box-sizing: border-box; display: flex; flex-direction: column;
        }
        .layout-container {
          flex: 1; min-height: 0;
          display: flex; flex-direction: column;
          background: #fafbfc; border: 1px solid #e5e6eb;
          border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.05);
          font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
          overflow: hidden;
        }
        .content-header {
          display: flex; align-items: center; gap: 10px;
          padding: 16px 32px; border-bottom: 1px solid #ebedf0;
          flex-shrink: 0; background: #ffffff;
        }
        .content-header .brand-name {
          font-size: 16px; font-weight: 700; color: #1a1d23;
        }
        .status-badge {
          font-size: 12px; padding: 2px 8px; border-radius: 20px;
          white-space: nowrap; display: inline-flex; align-items: center; gap: 5px;
          font-weight: 500; transition: background 0.3s, color 0.3s;
          border: 1px solid;
        }
        .welcome-area {
          flex: 1; min-height: 0; background: #ffffff; overflow-y: auto;
        }
        /* ── 会话 Tab 栏 ── */
        .session-tab-bar {
          display: flex; align-items: center; gap: 0;
          padding: 0 16px; border-bottom: 1px solid #ebedf0;
          background: #f5f7fa; flex-shrink: 0; overflow-x: auto;
          scrollbar-width: none;
        }
        .session-tab-bar::-webkit-scrollbar { display: none; }
        .session-tab {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 14px; font-size: 12.5px; cursor: pointer;
          border: none; background: none; color: #8c8f9a;
          border-bottom: 2px solid transparent; white-space: nowrap;
          font-family: "Microsoft YaHei","Segoe UI",sans-serif;
          transition: color 0.15s, border-color 0.15s, background 0.15s;
          flex-shrink: 0; position: relative;
        }
        .session-tab:hover { color: #1890ff; background: #e6f4ff; }
        .session-tab.active {
          color: #1890ff; border-bottom-color: #1890ff;
          background: #ffffff; font-weight: 600;
        }
        .session-tab .tab-dot {
          width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
        }
        .session-tab .tab-close {
          width: 16px; height: 16px; border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          color: #c0c4ce; font-size: 11px; line-height: 1;
          cursor: pointer; transition: background 0.15s, color 0.15s;
          background: none; border: none; padding: 0; margin-left: 2px;
        }
        .session-tab .tab-close:hover { background: #fde8e8; color: #ef4444; }
        .session-tab-add {
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 6px; border: none;
          background: none; cursor: pointer; color: #8c8f9a; font-size: 18px; line-height: 1;
          transition: background 0.15s, color 0.15s; flex-shrink: 0; margin-left: 4px;
        }
        .session-tab-add:hover { background: #e6f4ff; color: #1890ff; }
        .function-tabs {
          display: flex; gap: 8px; padding: 10px 20px; flex-wrap: wrap;
          border-bottom: 1px solid #ebedf0; flex-shrink: 0; background: #fafbfc;
        }
        .function-tab {
          padding: 4px 10px; background: #ffffff; border: 1px solid #d9d9d9;
          border-radius: 4px; font-size: 12px; color: #333; cursor: pointer;
          transition: all 0.15s; user-select: none;
        }
        .function-tab:hover { border-color: #1890ff; color: #1890ff; }
        .function-tab.active { background: #e6f4ff; border-color: #1890ff; color: #1890ff; }
        .input-container {
          position: relative; padding: 16px 20px 12px; flex-shrink: 0;
          background: #fafbfc; border-top: 1px solid #ebedf0;
        }
        .main-input {
          width: 100%; padding: 10px 50px 10px 14px; border: 1px solid #d9d9d9;
          border-radius: 8px; min-height: 80px; resize: none; background: #ffffff;
          font-size: 14px; font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
          color: #1a1d23; line-height: 1.6; box-sizing: border-box; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .main-input:focus { border-color: #1890ff; box-shadow: 0 0 0 2px rgba(24,144,255,0.2); }
        .send-btn {
          position: absolute; right: 30px; bottom: 28px;
          width: 28px; height: 28px; border-radius: 50%;
          background: #8c6fff; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, transform 0.1s;
        }
        .send-btn:hover { background: #7c5ef0; transform: scale(1.08); }
        .send-btn:active { transform: scale(0.95); }
        .send-btn svg { display: block; }
        .progress-bar-area {
          flex-shrink: 0; padding: 10px 20px 14px;
          border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;
          background: #fafbfc;
        }
        .progress-bar-header {
          display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px;
        }
        .progress-bar-label { font-size: 12px; color: #8c8f9a; }
        .progress-bar-pct { font-size: 12px; font-weight: 600; }
        .progress-track {
          width: 100%; height: 5px; border-radius: 99px;
          background: #ebedf0; overflow: hidden; box-sizing: border-box;
        }
        .progress-fill { height: 100%; border-radius: 99px; transition: width 0.6s ease; }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.4); }
        }
        @media (max-width: 768px) {
          .workspace-body { padding: 8px; }
          .content-header { flex-direction: column; align-items: flex-start; gap: 6px; }
        }
      `}</style>

      <div className="workspace-body">
        <div className="layout-container">

          {/* 1. 顶部标题栏 */}
          <div className="content-header">
            {/* 模式标签：任务 / 项目 */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: 6, flexShrink: 0,
              fontSize: 11, fontWeight: 600, lineHeight: 1.6,
              background: isProjectMode ? '#ede9fe' : '#e0f2fe',
              color:      isProjectMode ? '#7c3aed'  : '#0369a1',
              border:     `1px solid ${isProjectMode ? '#c4b5fd' : '#bae6fd'}`,
              userSelect: 'none',
            }}>
              {isProjectMode ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              )}
              {isProjectMode ? '项目' : '任务'}
            </span>
            <span className="brand-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {editingTitle ? (
                <input
                  autoFocus
                  value={editTitleValue}
                  onChange={e => setEditTitleValue(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveTitle();
                    if (e.key === 'Escape') setEditingTitle(false);
                  }}
                  style={{
                    fontSize: 20, fontWeight: 700, color: '#1a202c',
                    border: '1.5px solid #3b82f6', borderRadius: 6,
                    padding: '4px 10px', outline: 'none',
                    fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                    width: Math.max(200, editTitleValue.length * 14),
                  }}
                />
              ) : (
                <>
                  <span>{taskName}</span>
                  <button
                    onClick={startEditTitle}
                    title="编辑标题"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 24, height: 24, borderRadius: 5,
                      border: '1px solid transparent',
                      background: 'transparent', cursor: 'pointer',
                      color: '#9ca3af', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#f3f4f6';
                      e.currentTarget.style.color = '#374151';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#9ca3af';
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                </>
              )}
            </span>
            <span
              className="status-badge"
              style={{
                background:   STATUS_CONFIG[appStatus].bg,
                color:        STATUS_CONFIG[appStatus].color,
                borderColor:  STATUS_CONFIG[appStatus].border,
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: STATUS_CONFIG[appStatus].dotColor,
                flexShrink: 0,
                ...(appStatus === 'busy' ? { animation: 'pulse 1.2s infinite' } : {}),
              }} />
              {STATUS_CONFIG[appStatus].label}
            </span>

            {/* 分隔线 */}
            <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 4px' }} />

            {/* 新建项目按钮 */}
            <button
              onClick={() => setCreateModal({ open: true, type: 'project' })}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 6,
                border: '1px solid #c4b5fd',
                background: '#ede9fe',
                color: '#7c3aed',
                fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
                fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#ddd6fe';
                e.currentTarget.style.borderColor = '#a78bfa';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#ede9fe';
                e.currentTarget.style.borderColor = '#c4b5fd';
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                <line x1="12" y1="12" x2="12" y2="16"/>
                <line x1="9" y1="14" x2="15" y2="14"/>
              </svg>
              新建项目
            </button>

            {/* 新建任务按钮 */}
            <button
              onClick={() => setCreateModal({ open: true, type: 'task' })}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 6,
                border: '1px solid #bae6fd',
                background: '#e0f2fe',
                color: '#0369a1',
                fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
                fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#bae6fd';
                e.currentTarget.style.borderColor = '#7dd3fc';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#e0f2fe';
                e.currentTarget.style.borderColor = '#bae6fd';
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                <line x1="12" y1="12" x2="12" y2="16"/>
                <line x1="9" y1="14" x2="15" y2="14"/>
              </svg>
              新建任务
            </button>
          </div>

          {/* 1b. 优先级标签 + 项目标签 + 参与项目的AI智能体 */}
          {/* 显示条件：项目模式用 collabAgents 判断是否有智能体；任务模式用 openPanels */}
          {(currentTags.length > 0 || currentPriority || (isProjectMode ? collabAgents.length > 0 : openPanels.length > 0)) && (
            <div style={{
              padding: '7px 24px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}>
              {/* 优先级只读标签（仅有值时展示） */}
              {currentPriority && (() => {
                const opt = PRIORITY_OPTIONS.find(o => o.value === currentPriority);
                if (!opt) return null;
                return (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '2px 9px', borderRadius: 20, flexShrink: 0,
                    fontSize: 11, fontWeight: 600, lineHeight: 1.6,
                    border: `1px solid ${opt.color}`,
                    background: opt.bg,
                    color: opt.color,
                    fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                    userSelect: 'none',
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: opt.color, flexShrink: 0, display: 'inline-block',
                    }} />
                    {opt.label}
                  </span>
                );
              })()}

              {/* 标签区 */}
              {currentTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                  {currentTags.slice(0, 4).map(tag => {
                    const c = getTagColor(tag);
                    return (
                      <span key={tag} style={{
                        fontSize: 11, padding: '2px 9px', borderRadius: 20,
                        background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                        fontWeight: 500, lineHeight: 1.6,
                        fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                        cursor: 'pointer',
                        transition: 'opacity 0.12s',
                      }}
                        title="点击管理标签"
                        onClick={() => setActiveTab('标签管理')}
                      >{tag}</span>
                    );
                  })}
                </div>
              )}

              {/* 分隔线（当左侧有内容时） */}
              {(currentPriority || currentTags.length > 0) && (isProjectMode ? collabAgents.length > 0 : openPanels.length > 0) && (
                <div style={{ width: 1, height: 18, background: '#e5e7eb', flexShrink: 0 }} />
              )}

        {/* 参与项目的AI智能体（仅展示图标，不可点击/管理） */}
        {(() => {
          if (isProjectMode) {
            /* ── 项目模式：直接读 collabNodes 里分配的智能体（协作弹窗配置的真实值）──
             *
             * 为什么不用 participatingAgentNames：
             *   participatingAgentNames 是从 URL / sessionStorage / 回填 useEffect 写入的，
             *   用户在协作 Tab 实时修改节点分配后，collabNodes 已更新，
             *   但 participatingAgentNames 不一定同步，会导致顶部头像展示滞后/错误。
             *
             * collabAgents 是在渲染函数体内从 collabNodes 实时计算的（已去重），
             * 始终与协作 Tab 里的当前配置保持一致。
             */
            const projectAgents = collabAgents.length > 0
              ? collabAgents
              : agents.filter(a => openPanels.some(p => p.agentId === a.id)); // 协作节点为空时兜底用 openPanels
            if (projectAgents.length === 0) return null;
            const visible = projectAgents.slice(0, 6);
            const overflow = projectAgents.length - 6;
            return (
              /* 智能体头像列表：gap 间距排列，不重叠 */
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {visible.map((agent) => {
                  const ac = agent.color ?? '#6366f1';
                  const isActiveAgent = openPanels.some(p => p.agentId === agent.id);
                  return (
                    <div
                      key={agent.id}
                      title={agent.name}
                      style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: ac + '22',
                        /* 激活中的智能体用彩色描边，其余用浅灰描边做视觉分隔 */
                        border: `2px solid ${isActiveAgent ? ac : '#d1d5db'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: ac, fontWeight: 700, fontSize: 10,
                        cursor: 'default',
                        flexShrink: 0,
                        userSelect: 'none',
                      }}
                    >
                      {agent.name.charAt(0)}
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: '#f3f4f6',
                    border: '2px solid #d1d5db',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#9ca3af', fontWeight: 700, fontSize: 10,
                    cursor: 'default',
                    flexShrink: 0,
                    userSelect: 'none',
                  }}>
                    +{overflow}
                  </div>
                )}
              </div>
            );
          }

          /* ── 任务模式：只显示当前会话中激活的智能体 ── */
          const curAgent = activePanel
            ? agents.find(a => a.id === activePanel.agentId) ?? null
            : openPanels.length > 0
              ? agents.find(a => a.id === openPanels[0].agentId) ?? null
              : null;
          if (!curAgent) return null;
          const ac = curAgent.color ?? '#6366f1';
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: ac + '20',
                border: `2px solid ${ac}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: ac, fontWeight: 700, fontSize: 9,
                flexShrink: 0,
                boxShadow: `0 0 0 2px ${ac}22`,
                userSelect: 'none',
              }}>
                {curAgent.name.charAt(0)}
              </div>
              <span style={{
                fontSize: 12, fontWeight: 600, color: ac,
                fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                userSelect: 'none',
              }}>
                {curAgent.name}
              </span>
            </div>
          );
        })()}
            </div>
          )}

          {/* ══════════ 会话 Tab 栏 ══════════ */}
          <div className="session-tab-bar">
            {sessionTabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <button
                  key={tab.id}
                  className={`session-tab${isActive ? ' active' : ''}`}
                  onClick={() => {
                    switchSessionTab(tab.id);
                    if (tab.panelId) setActivePanelId(tab.panelId);
                  }}
                  title={tab.title}
                >
                  {/* 颜色圆点 */}
                  {tab.color && (
                    <span
                      className="tab-dot"
                      style={{
                        background: tab.color,
                        boxShadow: tab.isStreaming ? `0 0 0 2px ${tab.color}44` : 'none',
                        animation: tab.isStreaming ? 'pulse 1.2s infinite' : 'none',
                      }}
                    />
                  )}
                  <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tab.title}
                  </span>
                  {/* 关闭按钮（只有多于 1 个 Tab 时才显示） */}
                  {sessionTabs.length > 1 && (
                    <button
                      className="tab-close"
                      title="关闭会话"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeSessionTab(tab.id);
                        if (tab.panelId) closePanel(tab.panelId);
                        // 切换 activePanelId 到下一个 tab
                        const remaining = sessionTabs.filter((t) => t.id !== tab.id);
                        const nextTab = remaining[0];
                        setActivePanelId(nextTab?.panelId ?? null);
                      }}
                    >
                      ×
                    </button>
                  )}
                </button>
              );
            })}
            {/* 新建会话按钮 */}
            <button
              className="session-tab-add"
              title="新建会话"
              onClick={() => {
                // 新建 Tab，并从 openPanels 里挑一个未绑定的 panel，或等用户发消息时自动绑定
                const tabId = createSessionTab();
                // 如果当前有 openPanels，选择第一个未绑定的 panel（新会话中无 panel，等待用户选 agent）
                setActivePanelId(null);
              }}
            >
              +
            </button>
          </div>

          {/* ══════════ 对话工作台 ══════════ */}

          {/* 协作任务启动 Banner（仅前端，可关闭，不存入对话历史） */}
          {activePanel?.systemBanner && (
            <div style={{
              margin: '10px 16px 0',
              padding: '10px 14px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              fontSize: 12,
              color: '#1e40af',
              lineHeight: 1.6,
            }}>
              <svg style={{ flexShrink: 0, marginTop: 2 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{activePanel.systemBanner}</span>
              <button
                onClick={() => dismissBanner(activePanel.id)}
                style={{
                  flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                  color: '#93c5fd', padding: 2, lineHeight: 1,
                }}
                title="关闭提示"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          )}

          {/* 2. 消息展示区 */}
          {(() => {
            const activeSessionTab = sessionTabs.find(t => t.id === activeTabId);
            const isEmptyTab = activeSessionTab && !activeSessionTab.panelId;
            return (
              <div className="welcome-area" style={{ padding: messages.length ? '16px 24px' : 0 }}>
                {isEmptyTab ? (
                  /* ── 空 Tab：引导用户开始新会话 ── */
                  <div style={{
                    height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: 12, color: '#c0c4ce',
                  }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      <line x1="12" y1="8" x2="12" y2="16" strokeWidth="1.8"/><line x1="8" y1="12" x2="16" y2="12" strokeWidth="1.8"/>
                    </svg>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#a0a3ab' }}>新会话</span>
                    <span style={{ fontSize: 12, color: '#c0c4ce', textAlign: 'center', lineHeight: 1.7 }}>
                      在下方输入消息，或在右侧选择智能体<br/>即可开始一段全新的对话
                    </span>
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{
                    height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: 8, color: '#c0c4ce',
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span style={{ fontSize: 13 }}>输入消息与智能体开始对话</span>
                  </div>
                ) : null}
                {messages.map((msg) => {
                  const msgAgent = msg.agentId
                    ? agents.find(a => a.id === msg.agentId)
                    : activePanel
                      ? agents.find(a => a.id === activePanel.agentId)
                      : undefined;
                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      agentName={msgAgent?.name ?? activePanel?.agentName}
                      agentColor={msgAgent?.color ?? activePanel?.agentColor ?? '#6366f1'}
                      outputFormat={msgAgent?.outputFormat}
                    />
                  );
                })}
            <div ref={messagesEndRef} />
          </div>
            );
          })()}

          {/* 3. 功能标签栏 */}
          <div className="function-tabs">
            {FUNCTION_TABS.map(tab => (
              <button
                key={tab}
                className={`function-tab${activeTab === tab ? ' active' : ''}`}
                onClick={() => handleTabClick(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* 4. 输入区 */}
          <div className="input-container">
            <textarea
              ref={textareaRef}
              className="main-input"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息，Enter 发送，Ctrl+Enter 换行"
            />
            <button className="send-btn" onClick={handleSend} title="发送">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 11.5V2.5M7 2.5L3 6.5M7 2.5L11 6.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* 5. 项目进度条 */}
          <div className="progress-bar-area">
            <div className="progress-bar-header">
              <span className="progress-bar-label">{taskName} · 完成进度</span>
              <span className="progress-bar-pct" style={{ color: progressColor }}>{taskProgress}%</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${taskProgress}%`,
                  background: `linear-gradient(90deg, ${progressColor}88, ${progressColor})`,
                }}
              />
            </div>
          </div>

        </div>
      </div>

      {/* 优先级弹窗 */}
      {showPriorityModal && (
        <PriorityModal
          priority={currentPriority}
          onSetPriority={setPriority}
          onClose={() => setShowPriorityModal(false)}
        />
      )}

      {/* Tab 面板弹窗（标签管理、飞书配对、快捷指令、技能、定时任务、智能体等） */}
      {activeTab && activeTab !== '优先级' && activeTab !== '消息渠道' && (
        <TabPanel
          tab={activeTab}
          onClose={() => setActiveTab(null)}
          tags={currentTags}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          agents={agents}
          tasks={[...tasks.progress, ...tasks.done]}
          taskName={taskName}
          matchedProject={matchedKanbanProject}
          incomingAgentNames={incomingAgentNames}
          onInject={text => setInputValue(text)}
          onSend={text => { setInputValue(text); setTimeout(() => handleSend(), 0); }}
          openPanels={openPanels}
          activePanelId={activePanelId ?? activePanel?.id ?? null}
          onSwitchPanel={panelId => setActivePanelId(panelId)}
          onOpenAgentPanel={async (agentId, agentName, agentColor, initialMessage) => {
            const existing = openPanels.find(p => p.agentId === agentId);
            if (existing) {
              setActivePanelId(existing.id);
              // 找到绑定此 panel 的 Tab 并激活
              const boundTab = useConversationStore.getState().sessionTabs.find(t => t.panelId === existing.id);
              if (boundTab) switchSessionTab(boundTab.id);
            } else {
              const currentTabId = useConversationStore.getState().activeTabId;
              await openPanel({ agentId, agentName, agentColor, projectId: currentProject?.id, initialMessage, tabId: currentTabId ?? undefined });
              // 新建后取最新 panel
              const fresh = useConversationStore.getState().openPanels.find(p => p.agentId === agentId);
              if (fresh) setActivePanelId(fresh.id);
            }
            // 项目模式下，将新智能体加入参与列表（去重）
            if (isProjectMode) {
              setParticipatingAgentNames(prev =>
                prev.includes(agentName) ? prev : [...prev, agentName]
              );
              // 同步更新看板 store
              if (matchedKanbanProject) {
                const allNames = [...new Set([...participatingAgentNames, agentName])];
                const participantAgents = agents
                  .filter(a => allNames.includes(a.name))
                  .map(a => ({ name: a.name, color: a.color ?? '#6366f1' }));
                updateKanbanProject(matchedKanbanProject.id, { agents: participantAgents, memberCount: participantAgents.length });
              }
            }
          }}
          onCloseAgentPanel={panelId => {
            closePanel(panelId);
            setActivePanelId(prev => prev === panelId ? (openPanels.find(p => p.id !== panelId)?.id ?? null) : prev);
          }}
          currentProjectId={matchedKanbanProject?.id}
          backendProjectId={backendProjectId ?? undefined}
          collabNodes={collabNodes}
          setCollabNodes={setCollabNodes}
          isProject={isProjectMode}
          participatingAgentNames={participatingAgentNames}
          onUpgradeToProject={upgradeToProject}
          onDowngradeToTask={downgradeToTask}
          onRemoveAgent={removeAgentFromProject}
        />
      )}

      {showChannelModal && (
        <ChannelConfigModal onClose={() => setShowChannelModal(false)} />
      )}

      {/* 新建项目/任务弹窗 */}
      <CreateItemModal
        open={createModal.open}
        type={createModal.type}
        onClose={() => setCreateModal({ open: false, type: null })}
      />
    </>
  );
}
