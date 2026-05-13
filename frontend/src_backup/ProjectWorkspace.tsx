import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useLocation } from 'react-router-dom';

import { useProjectStore } from '@/stores/projectStore';
import { useConversationStore } from '@/stores/conversationStore';
import { useAgentStore } from '@/stores/agentStore';
import { useTaskStore } from '@/stores/taskStore';
import { useProjectKanbanStore, type ProjectPriority } from '@/stores/projectKanbanStore';
import { useDocumentStore } from '@/stores/documentStore';
import { DocumentTree } from '@/components/document/DocumentTree';
import { DocumentEditor, type DocumentEditorHandle } from '@/components/document/DocumentEditor';
import type { DocumentNode } from '@/types';

/* ─── 功能标签列表 ─────────────────────────────────────────── */
const FUNCTION_TABS = ['消息渠道', '飞书配对', '快捷指令', '技能', '定时任务', '智能体', '文件快传', '标签管理', '优先级'];

/* ─── 主视图切换 ──────────────────────────────────────────── */
const MAIN_VIEW_TABS = [
  { key: 'chat',     label: '对话工作台' },
  { key: 'document', label: '文档协作' },
] as const;
type MainViewTab = typeof MAIN_VIEW_TABS[number]['key'];






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
function SkillPanel({ taskName, onInject }: { taskName?: string; onInject?: (text: string) => void }) {
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);
  // 用户勾选的技能集合（多选，点击切换）
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [hoveredSend, setHoveredSend] = useState(false);

  const SKILLS: { key: string; label: string; cmd: string; hint: string }[] = [
    {
      key: '联网搜索',
      label: '联网搜索',
      cmd: '/skill search',
      hint: '实时搜索互联网，获取最新新闻、数据与资料。',
    },
    {
      key: '代码执行',
      label: '代码执行',
      cmd: '/skill code',
      hint: '在沙箱中运行 Python / JavaScript 代码并返回结果。',
    },
    {
      key: '图片识别',
      label: '图片识别',
      cmd: '/skill vision',
      hint: '上传图片后自动识别内容、提取文字或描述画面。',
    },
    {
      key: '文件解析',
      label: '文件解析',
      cmd: '/skill file',
      hint: '解析 PDF、Word、Excel 等文件，提取其中的文字与数据。',
    },
    {
      key: '数据分析',
      label: '数据分析',
      cmd: '/skill analyze',
      hint: '对表格或数据集进行统计、趋势分析与洞察总结。',
    },
    {
      key: '图表生成',
      label: '图表生成',
      cmd: '/skill chart',
      hint: '根据数据自动生成折线图、柱状图、饼图等可视化图表。',
    },
    {
      key: '邮件发送',
      label: '邮件发送',
      cmd: '/skill email',
      hint: '通过绑定邮箱自动撰写并发送邮件，支持附件。',
    },
    {
      key: '日历同步',
      label: '日历同步',
      cmd: '/skill calendar',
      hint: '读取或写入日历事件，自动安排日程与提醒。',
    },
    {
      key: '知识库检索',
      label: '知识库检索',
      cmd: '/skill kb',
      hint: '从项目知识库中检索相关文档，增强回答准确性。',
    },
  ];

  // 点击技能：切换选中状态
  function toggleSelect(key: string) {
    setSelectedSkills(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  // 发送：把所有选中技能的指令拼接后注入输入框，然后关闭弹窗
  function handleSend() {
    if (selectedSkills.size === 0 || !onInject) return;
    const cmds = SKILLS
      .filter(s => selectedSkills.has(s.key))
      .map(s => s.cmd)
      .join(' ');
    onInject(cmds);
  }

  const selectedCount = selectedSkills.size;

  return (
    <div style={{ fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif' }}>

      {/* ① 技能网格按钮区 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
        marginBottom: 14,
      }}>
        {SKILLS.map(s => {
          const selected = selectedSkills.has(s.key);
          const hovered = hoveredSkill === s.key;
          return (
            <div
              key={s.key}
              style={{ position: 'relative' }}
              onMouseEnter={() => setHoveredSkill(s.key)}
              onMouseLeave={() => setHoveredSkill(null)}
            >
              <button
                onClick={() => toggleSelect(s.key)}
                style={{
                  width: '100%',
                  padding: '9px 8px',
                  borderRadius: 8,
                  border: `1px solid ${selected ? '#c7d2fe' : hovered ? '#e0e0e0' : 'transparent'}`,
                  background: selected
                    ? (hovered ? '#e0e7ff' : '#eef2ff')
                    : (hovered ? '#ebebeb' : '#f3f4f6'),
                  cursor: 'pointer',
                  fontSize: 12,
                  color: selected ? '#4f46e5' : '#374151',
                  fontWeight: selected ? 600 : 500,
                  fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  transition: 'background 0.12s, border-color 0.12s, color 0.12s',
                  outline: 'none',
                  lineHeight: 1.4,
                  position: 'relative',
                }}
              >
                {/* 右上角勾选标记 */}
                {selected && (
                  <span style={{
                    position: 'absolute',
                    top: 4, right: 5,
                    width: 13, height: 13,
                    borderRadius: '50%',
                    background: '#6366f1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4L3.2 5.8L6.5 2.5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                )}
                <span style={{ whiteSpace: 'nowrap' }}>{s.label}</span>
              </button>

              {/* hover 气泡注释 */}
              {hovered && (
                <div style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 9px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(26,32,44,0.92)',
                  color: '#fff',
                  fontSize: 11,
                  lineHeight: 1.65,
                  padding: '7px 11px',
                  borderRadius: 7,
                  boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
                  zIndex: 1100,
                  pointerEvents: 'none',
                  width: 186,
                  textAlign: 'center',
                  backdropFilter: 'blur(2px)',
                  whiteSpace: 'normal',
                }}>
                  {/* 指令标签 */}
                  <span style={{
                    display: 'inline-block',
                    marginBottom: 4,
                    padding: '1px 6px',
                    background: 'rgba(255,255,255,0.15)',
                    borderRadius: 4,
                    fontSize: 10,
                    letterSpacing: '0.03em',
                    fontFamily: 'monospace',
                    color: '#e2e8f0',
                  }}>{s.cmd}</span>
                  <br/>
                  {s.hint}
                  {/* 向下三角 */}
                  <div style={{
                    position: 'absolute',
                    top: '100%', left: '50%',
                    transform: 'translateX(-50%)',
                    width: 0, height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: '6px solid rgba(26,32,44,0.92)',
                  }}/>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ② 灯泡提示栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '8px 12px',
        marginBottom: 12,
        background: '#fafafa',
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        fontSize: 12,
        color: '#9ca3af',
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b"
          strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 4.9 11.9c-.6.6-1.4 1.6-1.9 3.1H9c-.5-1.5-1.3-2.5-1.9-3.1A7 7 0 0 1 12 2z"/>
        </svg>
        <span>悬停查看说明，可勾选多个技能后一起发送。</span>
        {selectedCount > 0 && (
          <span style={{
            marginLeft: 'auto', flexShrink: 0,
            padding: '1px 8px', borderRadius: 10,
            background: '#eef2ff', fontSize: 11,
            color: '#6366f1', fontWeight: 600,
          }}>
            已选 {selectedCount} 个
          </span>
        )}
      </div>

      {/* ③ 发送按钮（全宽，有选中才高亮可用） */}
      <button
        onClick={handleSend}
        disabled={selectedCount === 0}
        onMouseEnter={() => setHoveredSend(true)}
        onMouseLeave={() => setHoveredSend(false)}
        style={{
          width: '100%',
          height: 40,
          fontSize: 13,
          fontWeight: 600,
          border: 'none',
          borderRadius: 8,
          cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          transition: 'background 0.15s, box-shadow 0.15s, opacity 0.15s',
          background: selectedCount === 0
            ? '#f3f4f6'
            : (hoveredSend ? '#4f46e5' : '#6366f1'),
          color: selectedCount === 0 ? '#9ca3af' : '#fff',
          boxShadow: selectedCount > 0 && hoveredSend
            ? '0 4px 12px rgba(99,102,241,0.35)'
            : selectedCount > 0 ? '0 2px 8px rgba(99,102,241,0.2)' : 'none',
          marginBottom: taskName ? 10 : 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
        {selectedCount === 0 ? '请先选择技能' : `发送 ${selectedCount} 个技能指令`}
      </button>

      {/* ④ 项目信息栏 */}
      {taskName && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '8px 12px',
          background: '#f3f4f6',
          borderRadius: 8,
          fontSize: 12,
          color: '#6b7280',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>当前项目：<b style={{ color: '#374151' }}>{taskName}</b></span>
        </div>
      )}
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
function ShortcutPanel({ taskName, onInject }: { taskName?: string; onInject?: (text: string) => void }) {
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  // label: 按钮显示文字
  // cmd: 点击后注入输入框的实际指令
  // hint: 鼠标悬停气泡注释，说明该指令的用途
  // hasArrow: 是否显示向下小箭头
  const SHORTCUTS: { label: string; cmd: string; hint: string; hasArrow?: boolean }[] = [
    {
      label: '新对话',
      cmd: '/new',
      hint: '清空当前对话，开启一段全新的会话。',
    },
    {
      label: '系统状态',
      cmd: '/status',
      hint: '查看当前系统运行状态，包括模型、工具、连接情况。',
    },
    {
      label: '查看上下文',
      cmd: '/context',
      hint: '展示当前对话已记住的上下文内容与 Token 用量。',
    },
    {
      label: '清空上下文',
      cmd: '/clear',
      hint: '清除本次对话的历史上下文，释放记忆空间。',
    },
    {
      label: '总结对话',
      cmd: '/summary',
      hint: '对当前对话内容生成简洁的摘要与关键结论。',
    },
    {
      label: '查看计划',
      cmd: '/plan',
      hint: '查看智能体当前正在执行或待执行的任务计划。',
    },
    {
      label: '工具列表',
      cmd: '/tools',
      hint: '查看当前可调用的工具，例如浏览器、文件、代码执行等。',
      hasArrow: true,
    },
  ];

  function handleClick(cmd: string) {
    if (onInject) onInject(cmd);
  }

  return (
    <div style={{ fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif' }}>

      {/* ① 按钮区 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
        marginBottom: 14,
      }}>
        {SHORTCUTS.map(s => (
          <div
            key={s.label}
            style={{ position: 'relative' }}
            onMouseEnter={() => setHoveredBtn(s.label)}
            onMouseLeave={() => setHoveredBtn(null)}
          >
            {/* 按钮 */}
            <button
              onClick={() => handleClick(s.cmd)}
              style={{
                width: '100%',
                padding: '9px 8px',
                borderRadius: 8,
                border: '1px solid transparent',
                background: hoveredBtn === s.label ? '#ebebeb' : '#f3f4f6',
                borderColor: hoveredBtn === s.label ? '#e0e0e0' : 'transparent',
                cursor: 'pointer',
                fontSize: 12,
                color: '#374151',
                fontWeight: 500,
                fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                transition: 'background 0.12s, border-color 0.12s',
                outline: 'none',
                lineHeight: 1.4,
              }}
            >
              <span style={{ whiteSpace: 'nowrap' }}>{s.label}</span>
              {s.hasArrow && (
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>

            {/* hover 气泡注释 — 每个按钮都有 */}
            {hoveredBtn === s.label && (
              <div style={{
                position: 'absolute',
                bottom: 'calc(100% + 9px)',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(26,32,44,0.92)',
                color: '#fff',
                fontSize: 11,
                lineHeight: 1.65,
                padding: '7px 11px',
                borderRadius: 7,
                boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
                zIndex: 1100,
                pointerEvents: 'none',
                width: 186,
                textAlign: 'center',
                backdropFilter: 'blur(2px)',
                whiteSpace: 'normal',
              }}>
                {/* 指令标签 */}
                <span style={{
                  display: 'inline-block',
                  marginBottom: 4,
                  padding: '1px 6px',
                  background: 'rgba(255,255,255,0.15)',
                  borderRadius: 4,
                  fontSize: 10,
                  letterSpacing: '0.03em',
                  fontFamily: 'monospace',
                  color: '#e2e8f0',
                }}>{s.cmd}</span>
                <br/>
                {s.hint}
                {/* 向下三角 */}
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 0, height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: '6px solid rgba(26,32,44,0.92)',
                }}/>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ② 灯泡提示栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '8px 12px',
        marginBottom: taskName ? 10 : 0,
        background: '#fafafa',
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        fontSize: 12,
        color: '#9ca3af',
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b"
          strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 4.9 11.9c-.6.6-1.4 1.6-1.9 3.1H9c-.5-1.5-1.3-2.5-1.9-3.1A7 7 0 0 1 12 2z"/>
        </svg>
        <span>悬停查看注释，点击后把指令带入输入框。</span>
      </div>

      {/* ③ 项目信息栏 */}
      {taskName && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '8px 12px',
          background: '#f3f4f6',
          borderRadius: 8,
          fontSize: 12,
          color: '#6b7280',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>当前项目：<b style={{ color: '#374151' }}>{taskName}</b></span>
        </div>
      )}
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

/* ─── 智能体卡片（每张独立持有 ref，供气泡精准定位） ─────── */
function AgentCard({
  agent,
  statusInfo,
  recommendedModel,
  expertiseTags,
  onInject,
}: {
  agent: import('../types').Agent;
  statusInfo: { label: string; color: string };
  recommendedModel: string;
  expertiseTags: string[];
  onInject?: (text: string) => void;
}) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = React.useState(false);
  const accentColor = agent.color ?? '#6366f1';

  // 描述兜底：优先用 description，为空则显示通用占位文案
  const displayDesc = (agent.description && agent.description.trim())
    ? agent.description.trim()
    : '通用智能体';



  return (
    <div
      ref={cardRef}
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 卡片按钮：默认白底灰边，hover 轻微加深，无任何主题色高亮 */}
      <button
        onClick={() => onInject?.(`@${agent.name} `)}
        style={{
          width: '100%',
          minWidth: 0,
          padding: '12px 14px',
          borderRadius: 10,
          border: '1px solid #e5e7eb',
          background: hovered ? '#f9fafb' : '#ffffff',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          overflow: 'hidden',
          transition: 'background 0.12s',
          outline: 'none',
          position: 'relative',
          textAlign: 'left',
          boxSizing: 'border-box',
        }}
      >
        {/* 状态小圆点（右上角） */}
        <span style={{
          position: 'absolute',
          top: 8, right: 8,
          width: 7, height: 7,
          borderRadius: '50%',
          background: statusInfo.color,
          boxShadow: '0 0 0 2px #fff',
          flexShrink: 0,
        }} />

        {/* 图标（颜色固定由 accentColor 决定，与 hover 无关） */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `linear-gradient(135deg,${accentColor}99,${accentColor})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
            <rect x="3" y="5" width="11" height="8" rx="2.5" stroke="white" strokeWidth="1.4"/>
            <circle cx="6" cy="9" r="1" fill="white"/>
            <circle cx="11" cy="9" r="1" fill="white"/>
            <path d="M6 3.5V5M11 3.5V5" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </div>

        {/* 文字区（两行：名称 + 描述，超长截断） */}
        <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{
            fontSize: 13, fontWeight: 500, color: '#374151',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            display: 'block', lineHeight: 1.3,
            fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
          }}>
            {agent.name}
          </span>
          <span style={{
            fontSize: 11, color: '#9ca3af',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            display: 'block', lineHeight: 1.4,
            fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
          }}>
            {displayDesc}
          </span>
        </div>
      </button>

      {/* hover 气泡（portal 到 body，fixed 定位，永不被 overflow:clip 裁切） */}
      {hovered && (
        <AgentTooltip
          anchorRef={cardRef}
          statusInfo={statusInfo}
          description={displayDesc}
          expertiseTags={expertiseTags}
          recommendedModel={recommendedModel}
        />
      )}
    </div>
  );
}

/* ─── 智能体气泡（fixed 定位，永不被 overflow:clip 裁切） ──── */
function AgentTooltip({
  anchorRef,
  statusInfo,
  description,
  expertiseTags,
  recommendedModel,
}: {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  statusInfo: { label: string; color: string };
  description?: string;
  expertiseTags: string[];
  recommendedModel: string;
}) {
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  React.useLayoutEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      top: rect.top - 10,           // 气泡底部贴近卡片顶部，留 10px 间距
      left: rect.left + rect.width / 2,
    });
  }, [anchorRef]);

  if (!pos) return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: 'auto',
        top: pos.top,
        left: pos.left,
        transform: 'translate(-50%, -100%)',
        background: 'rgba(26,32,44,0.95)',
        color: '#fff',
        fontSize: 11,
        lineHeight: 1.65,
        padding: '10px 14px',
        borderRadius: 8,
        boxShadow: '0 6px 24px rgba(0,0,0,0.28)',
        zIndex: 99999,
        pointerEvents: 'none',
        width: 230,
        textAlign: 'left',
        backdropFilter: 'blur(4px)',
        whiteSpace: 'normal',
        fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
      }}
    >
      {/* 状态标签 */}
      <div style={{ marginBottom: 6 }}>
        <span style={{
          display: 'inline-block',
          padding: '1px 7px',
          background: statusInfo.color + '33',
          borderRadius: 4,
          fontSize: 10,
          color: statusInfo.color,
          fontWeight: 600,
        }}>{statusInfo.label}</span>
      </div>

      {/* 描述（最多3行） */}
      <span style={{
        color: '#e2e8f0',
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        wordBreak: 'break-all',
        fontSize: 11,
        lineHeight: 1.6,
      }}>
        {description || '通用智能体'}
      </span>

      {/* 专业领域 */}
      {expertiseTags.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {expertiseTags.map(tag => (
            <span key={tag} style={{
              padding: '1px 6px', borderRadius: 3,
              background: 'rgba(255,255,255,0.14)',
              fontSize: 10, color: '#cbd5e0',
            }}>{tag}</span>
          ))}
        </div>
      )}

      {/* 推荐模型 */}
      <div style={{ marginTop: 6, fontSize: 10, color: '#a0aec0' }}>
        推荐：<span style={{ color: '#90cdf4', fontFamily: 'monospace' }}>{recommendedModel}</span>
      </div>

      {/* 向下三角箭头 */}
      <div style={{
        position: 'absolute',
        top: '100%', left: '50%',
        transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: '6px solid rgba(26,32,44,0.95)',
      }}/>
    </div>,
    document.body,
  );
}

/* ─── 智能体面板 ──────────────────────────────────────────── */
function AgentPanel({
  agents,
  agentStatusMap,
  taskName,
  onInject,
}: {
  agents?: import('../types').Agent[];
  agentStatusMap: Record<string, { label: string; color: string }>;
  taskName?: string;
  onInject?: (text: string) => void;
}) {
  const modelMap: Record<string, string> = {
    structured: 'GPT-4 Turbo',
    technical:  'GPT-4o',
    analytical: 'Claude 3.5 Sonnet',
    creative:   'Claude 3 Haiku',
    academic:   'Claude 3 Opus',
  };

  const agentList = agents ?? [];

  return (
    <div style={{ fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif' }}>

      {/* ① 网格按钮区 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 10,
        marginBottom: 14,
      }}>
        {agentList.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1',
            textAlign: 'center', padding: '24px 0',
            fontSize: 13, color: '#d1d5db',
          }}>
            暂无智能体，点击下方按钮添加
          </div>
        ) : agentList.map(agent => {
          const statusInfo = agentStatusMap[agent.status ?? 'idle'] ?? { label: '离线', color: '#9ca3af' };
          const recommendedModel = modelMap[agent.writingStyle] ?? 'GPT-4o';
          const expertiseTags = (agent.expertise ?? []).slice(0, 3);

          return (
            <AgentCard
              key={agent.id}
              agent={agent}
              statusInfo={statusInfo}
              recommendedModel={recommendedModel}
              expertiseTags={expertiseTags}
              onInject={onInject}
            />
          );
        })}
      </div>

      {/* ② 灯泡提示栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '8px 12px',
        marginBottom: taskName ? 10 : 0,
        background: '#fafafa',
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        fontSize: 12,
        color: '#9ca3af',
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b"
          strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 4.9 11.9c-.6.6-1.4 1.6-1.9 3.1H9c-.5-1.5-1.3-2.5-1.9-3.1A7 7 0 0 1 12 2z"/>
        </svg>
        <span>悬停查看详情，点击将智能体@指令带入输入框。</span>
      </div>

      {/* ③ 添加智能体按钮 */}
      <button
        style={{
          marginTop: 10,
          width: '100%', height: 40, fontSize: 13,
          border: '1.5px dashed #d1d5db', borderRadius: 8, background: 'none',
          cursor: 'pointer', color: '#6b7280',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'border-color 0.12s, color 0.12s',
          outline: 'none',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#6366f1'; (e.currentTarget as HTMLButtonElement).style.color = '#6366f1'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#d1d5db'; (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>添加智能体
      </button>

      {/* ④ 项目信息栏 */}
      {taskName && (
        <div style={{
          marginTop: 10, display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 12px', background: '#f3f4f6', borderRadius: 8,
          fontSize: 12, color: '#6b7280',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>在对话框中 <b style={{ color: '#374151', fontFamily: 'monospace' }}>@名字</b> 可直接唤醒对应智能体</span>
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
}) {
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
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
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
                    <button style={{
                      fontSize: 12, padding: '4px 14px', borderRadius: 6,
                      border: '1.5px solid #e5e7eb', background: '#fff',
                      cursor: 'pointer', color: '#374151',
                      fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                    }}>连接</button>
                  </div>
                </div>
              ))}
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
              onInject={text => { if (onInject) { onInject(text); onClose(); } }}
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
  const activePriorityOpt = PRIORITY_OPTIONS.find(o => o.value === priority) ?? null;

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
      }}
    >
      {/* 弹窗主体 */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
          width: 460,
          maxWidth: 'calc(100vw - 32px)',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
          animation: 'priorityModalIn 0.2s cubic-bezier(0.34,1.4,0.64,1)',
          overflow: 'hidden',
          position: 'relative',
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
              background: activePriorityOpt
                ? `linear-gradient(135deg,${activePriorityOpt.color},${activePriorityOpt.color}bb)`
                : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.2s',
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

        {/* ── 内容区 ── */}
        <div style={{ padding: '24px 28px 32px' }}>
          {/* 当前状态提示条 */}
          {activePriorityOpt ? (
            <div style={{
              marginBottom: 16,
              padding: '9px 14px',
              borderRadius: 8,
              background: activePriorityOpt.bg,
              border: `1px solid ${activePriorityOpt.color}35`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: activePriorityOpt.color, flexShrink: 0,
              }}/>
              <span style={{ fontSize: 13, color: activePriorityOpt.color, fontWeight: 600 }}>
                当前：{activePriorityOpt.label}
              </span>
            </div>
          ) : (
            <div style={{
              marginBottom: 16, padding: '9px 14px', borderRadius: 8,
              background: '#f9fafb', border: '1px solid #f0f0f0',
              fontSize: 13, color: '#9ca3af',
            }}>
              当前未设置优先级
            </div>
          )}

          {/* 三个选项卡片 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PRIORITY_OPTIONS.map(opt => {
              const isActive = priority === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => { onSetPriority(opt.value); onClose(); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '16px 20px', borderRadius: 10, cursor: 'pointer',
                    border: isActive ? `2px solid ${opt.color}` : '2px solid #f0f0f0',
                    background: isActive ? opt.bg : '#fafafa',
                    transition: 'all 0.15s', textAlign: 'left',
                    fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                    width: '100%',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = opt.color;
                    e.currentTarget.style.background = opt.bg;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = `0 4px 12px ${opt.color}25`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = isActive ? opt.color : '#f0f0f0';
                    e.currentTarget.style.background = isActive ? opt.bg : '#fafafa';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <span style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: opt.color, flexShrink: 0,
                    boxShadow: isActive ? `0 0 0 4px ${opt.color}30` : 'none',
                    transition: 'box-shadow 0.15s',
                  }}/>
                  <span style={{
                    flex: 1, fontSize: 13, color: '#374151',
                    fontWeight: isActive ? 700 : 400,
                  }}>
                    {opt.label}
                  </span>
                  {isActive && (
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: opt.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M2 5.5L4.5 8L9 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
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

function ChannelConfigModal({ onClose }: { onClose: () => void }) {
  const [channel, setChannel] = useState<ChannelType>('feishu');
  const [botId, setBotId]     = useState('');
  const [secret, setSecret]   = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [errors, setErrors]   = useState<{ botId?: string; secret?: string }>({});
  const [saved, setSaved]     = useState(false);

  function validate() {
    const e: { botId?: string; secret?: string } = {};
    if (!botId.trim())   e.botId  = 'Bot ID 不能为空';
    if (!secret.trim())  e.secret = 'Secret 不能为空';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleConfirm() {
    if (!validate()) return;
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  }

  /* 切换渠道时清空表单 */
  function switchChannel(c: ChannelType) {
    setChannel(c);
    setBotId(''); setSecret('');
    setErrors({});
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
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
          width: 600,
          maxWidth: 'calc(100vw - 32px)',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
          animation: 'channelModalIn 0.2s cubic-bezier(0.34,1.4,0.64,1)',
          overflow: 'hidden',
          position: 'relative',
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
            style={{
              height: 40, padding: '0 28px', fontSize: 14, borderRadius: 8,
              border: 'none',
              background: saved ? '#22c55e' : '#6366f1',
              cursor: 'pointer', color: '#fff', fontWeight: 600,
              fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
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
            {saved ? (
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
  /** 从项目协作页跳转时携带的项目名 */
  const incomingProjectName = (location.state as { projectName?: string; projectId?: string } | null)?.projectName;
  /** 从项目协作页跳转时携带的项目 id（优先于标题匹配） */
  const incomingProjectId = (location.state as { projectName?: string; projectId?: string } | null)?.projectId;

  /* ── Store 接入 ─────────────────────────────────────────── */
  const { currentProject, projects, fetchProjects } = useProjectStore();
  const { openPanels, openPanel, sendMessage, connect } = useConversationStore();
  const { agents, fetchAgents } = useAgentStore();
  const { addTaskFromChat, tasks } = useTaskStore();
  const { projects: kanbanProjects, updateProject: updateKanbanProject } = useProjectKanbanStore();
  const {
    currentDocument,
    setCurrentDocument,
    loadContent,
    setContent: setDocContent,
  } = useDocumentStore();

  /* ── 本地状态 ────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [inputValue, setInputValue] = useState('');
  /** 主视图：对话工作台 / 文档协作 */
  const [mainView, setMainView] = useState<MainViewTab>('chat');
  /** 文档树（本地维护，用于演示，可接入后端 API） */
  const [docTree, setDocTree] = useState<DocumentNode[]>([
    {
      id: 'doc_root',
      title: '项目文档',
      content: '',
      children: [
        { id: 'doc_intro', title: '项目简介', content: '', children: [] },
        { id: 'doc_plan',  title: '执行计划', content: '', children: [] },
      ],
    },
  ]);
  /** 文档加载状态 */
  const [docLoading, setDocLoading] = useState(false);
  /** DocumentEditor ref，用于 AI 消息插入 */
  const documentEditorRef = useRef<DocumentEditorHandle>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** 已自动建任务的 panelId 集合，避免同一会话重复创建 */
  const createdTaskPanels = useRef<Set<string>>(new Set());

  /* ── 取当前工作台的会话 panel（用第一个活跃 panel） ──────── */
  const activePanel = openPanels[0] ?? null;

  /* ── 动态数据：优先用跳转传入的项目名 > currentProject > 第一个项目 ── */
  const taskName = incomingProjectName ?? currentProject?.title ?? (projects[0]?.title ?? 'WorkBuddy');
  const taskProgress = 68; // 真实进度字段后端暂无，保留占位

  /* ── 找到 kanban 中对应的项目（用来读写 tags）─────────────── */
  const allKanbanProjects = [...kanbanProjects.progress, ...kanbanProjects.done];
  // 优先按 id 精准匹配 > 按标题匹配 > 兜底第一个项目
  const matchedKanbanProject =
    (incomingProjectId ? allKanbanProjects.find(p => p.id === incomingProjectId) : undefined)
    ?? allKanbanProjects.find(p => p.title === taskName)
    ?? allKanbanProjects[0]
    ?? null;
  const currentTags: string[] = matchedKanbanProject?.tags ?? [];

  /* ── 标签编辑（写回 store，供标签管理面板使用）──────────── */
  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || currentTags.includes(tag) || !matchedKanbanProject) return;
    updateKanbanProject(matchedKanbanProject.id, { tags: [...currentTags, tag] });
  }

  function removeTag(tag: string) {
    if (!matchedKanbanProject) return;
    updateKanbanProject(matchedKanbanProject.id, { tags: currentTags.filter(t => t !== tag) });
  }

  /* ── 优先级读写 ──────────────────────────────────────────── */
  const currentPriority: ProjectPriority | null = matchedKanbanProject?.priority ?? null;

  function setPriority(p: ProjectPriority) {
    if (!matchedKanbanProject) return;
    updateKanbanProject(matchedKanbanProject.id, { priority: p });
  }

  /* ── 文档树：递归查找 ─────────────────────────────────── */
  function findDocNode(nodes: DocumentNode[], id: string): DocumentNode | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) {
        const found = findDocNode(n.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  /** 选择文档节点：更新 store 并加载内容 */
  async function handleSelectDoc(doc: DocumentNode) {
    setDocLoading(true);
    setCurrentDocument(doc);
    try {
      await loadContent(doc.id);
    } catch {
      // 后端不可用时用节点自带 content
      setDocContent(doc.content ?? '');
    } finally {
      setDocLoading(false);
    }
  }

  /** 添加章节（parentId=null 表示顶层） */
  function handleAddDoc(parentId: string | null) {
    const newNode: DocumentNode = {
      id: `doc_${Date.now()}`,
      title: '新章节',
      content: '',
      children: [],
    };
    if (parentId === null) {
      setDocTree(prev => [...prev, newNode]);
    } else {
      function insertChild(nodes: DocumentNode[]): DocumentNode[] {
        return nodes.map(n => {
          if (n.id === parentId) {
            return { ...n, children: [...(n.children ?? []), newNode] };
          }
          return { ...n, children: insertChild(n.children ?? []) };
        });
      }
      setDocTree(prev => insertChild(prev));
    }
    // 自动选中新节点
    setCurrentDocument(newNode);
    setDocContent('');
  }

  /** 重命名章节 */
  function handleEditDoc(doc: DocumentNode) {
    const title = window.prompt('请输入新标题', doc.title);
    if (!title || title.trim() === doc.title) return;
    function rename(nodes: DocumentNode[]): DocumentNode[] {
      return nodes.map(n => {
        if (n.id === doc.id) return { ...n, title: title.trim() };
        return { ...n, children: rename(n.children ?? []) };
      });
    }
    setDocTree(prev => rename(prev));
    if (currentDocument?.id === doc.id) {
      setCurrentDocument({ ...doc, title: title.trim() });
    }
  }

  /** 删除章节 */
  function handleDeleteDoc(id: string) {
    function remove(nodes: DocumentNode[]): DocumentNode[] {
      return nodes
        .filter(n => n.id !== id)
        .map(n => ({ ...n, children: remove(n.children ?? []) }));
    }
    setDocTree(prev => remove(prev));
    if (currentDocument?.id === id) setCurrentDocument(null);
  }

  /* ── 初始化：加载项目 + 智能体列表 + WS 连接 ───────────── */
  useEffect(() => {
    fetchProjects();
    fetchAgents();
    connect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 消息列表滚动到底部 ─────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activePanel?.messages]);

  /**
   * ── 文档协作模式：AI 流式完成后自动将最新 assistant 消息插入编辑器 ──
   * 只有在 mainView === 'document' 且 AI 消息 streaming 结束（content 非空且不再变化）时触发。
   */
  const lastInsertedMsgId = useRef<string | null>(null);
  useEffect(() => {
    if (mainView !== 'document') return;
    const msgs = activePanel?.messages ?? [];
    // 找最后一条 assistant 消息
    const last = [...msgs].reverse().find(m => m.role === 'assistant');
    if (!last || !last.content) return;
    // 如果是正在 streaming（内容末尾有光标占位），跳过
    if (last.content === '●●●') return;
    // 避免重复插入同一条消息
    if (last.id === lastInsertedMsgId.current) return;
    lastInsertedMsgId.current = last.id;
    documentEditorRef.current?.insertContent('\n' + last.content);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel?.messages, mainView]);

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
        await openPanel({
          agentId: defaultAgent.id,
          agentName: defaultAgent.name,
          agentColor: defaultAgent.color,
          projectId: currentProject?.id,
        });
        const freshPanel = useConversationStore.getState().openPanels[0];
        if (freshPanel) {
          sendMessage(freshPanel.id, text);
          panelId = freshPanel.id;
        }
        agentName = defaultAgent.name;
        agentColor = defaultAgent.color ?? '#9ca3af';
      }
    }

    // 每个会话只自动建一次任务（第一条消息触发）
    if (panelId && !createdTaskPanels.current.has(panelId)) {
      createdTaskPanels.current.add(panelId);
      addTaskFromChat({
        title: text,
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
          font-size: 12px; padding: 1px 5px; border-radius: 4px;
          background: #e8f5e9; color: #2e7d32; border: 1px solid #dcedc8;
          white-space: nowrap;
        }
        .welcome-area {
          flex: 1; min-height: 0; background: #ffffff; overflow-y: auto;
        }
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
        @media (max-width: 768px) {
          .workspace-body { padding: 8px; }
          .content-header { flex-direction: column; align-items: flex-start; gap: 6px; }
        }
      `}</style>

      <div className="workspace-body">
        <div className="layout-container">

          {/* 1. 顶部标题栏 */}
          <div className="content-header">
            <span className="brand-name">{taskName}</span>
            <span className="status-badge">运行中</span>

            {/* 主视图切换 Tab */}
            <div style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: '#f3f4f6',
              borderRadius: 8,
              padding: '3px',
            }}>
              {MAIN_VIEW_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setMainView(tab.key)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: mainView === tab.key ? 600 : 400,
                    fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                    background: mainView === tab.key ? '#ffffff' : 'transparent',
                    color: mainView === tab.key ? '#1a1d23' : '#6b7280',
                    boxShadow: mainView === tab.key ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 1b. 项目标签展示（有标签时展示，点击可跳到标签管理） */}
          {currentTags.length > 0 && mainView === 'chat' && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
              padding: '8px 20px 6px',
              borderBottom: '1px solid #f0f0f0',
            }}>
              <span style={{ fontSize: 11, color: '#9ca3af', marginRight: 2, flexShrink: 0 }}>标签：</span>
              {currentTags.map(tag => {
                const c = getTagColor(tag);
                return (
                  <span key={tag} style={{
                    fontSize: 11, padding: '2px 9px', borderRadius: 20,
                    background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                    fontWeight: 500, lineHeight: 1.6, cursor: 'pointer',
                    fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                    transition: 'opacity 0.12s',
                  }}
                    title="点击管理标签"
                    onClick={() => setActiveTab('标签管理')}
                  >{tag}</span>
                );
              })}
              <button
                onClick={() => setActiveTab('标签管理')}
                style={{
                  fontSize: 11, color: '#9ca3af', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '2px 6px', borderRadius: 20,
                  transition: 'color 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#6366f1'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; }}
                title="管理标签"
              >+ 编辑</button>
            </div>
          )}

          {/* ══════════ 主视图：对话工作台 ══════════ */}
          {mainView === 'chat' && (<>

          {/* 2. 消息展示区 */}
          <div className="welcome-area" style={{ padding: messages.length ? '16px 24px' : 0 }}>
            {messages.length === 0 && (
              <div style={{
                height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 8, color: '#c0c4ce',
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span style={{ fontSize: 13 }}>输入消息与智能体开始对话</span>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 10,
              }}>
                <div style={{
                  maxWidth: '72%', padding: '8px 14px',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: msg.role === 'user' ? '#2a3b4d' : '#f3f4f6',
                  color: msg.role === 'user' ? '#fff' : '#1a202c',
                  fontSize: 13, lineHeight: 1.6,
                }}>
                  {msg.content || <span style={{ opacity: 0.4 }}>●●●</span>}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

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

          </>)}

          {/* ══════════ 主视图：文档协作 ══════════ */}
          {mainView === 'document' && (
            <div style={{
              flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden',
              background: '#1e2330',
            }}>
              {/* 左侧文档树 */}
              <div style={{
                width: 220, flexShrink: 0,
                padding: '12px 8px',
                borderRight: '1px solid rgba(255,255,255,0.06)',
                overflow: 'auto',
              }}>
                <DocumentTree
                  documents={docTree}
                  selectedId={currentDocument?.id}
                  onSelect={handleSelectDoc}
                  onAdd={handleAddDoc}
                  onEdit={handleEditDoc}
                  onDelete={handleDeleteDoc}
                />
              </div>

              {/* 右侧编辑器 */}
              <div style={{ flex: 1, minWidth: 0, padding: '12px', overflow: 'auto' }}>
                <DocumentEditor ref={documentEditorRef} loading={docLoading} />
              </div>
            </div>
          )}

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
          onInject={text => setInputValue(text)}
          onSend={text => { setInputValue(text); setTimeout(() => handleSend(), 0); }}
        />
      )}

      {showChannelModal && (
        <ChannelConfigModal onClose={() => setShowChannelModal(false)} />
      )}
    </>
  );
}
