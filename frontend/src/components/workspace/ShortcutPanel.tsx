import React from 'react';

interface ShortcutPanelProps {
  onInject?: (text: string) => void;
}

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

export function ShortcutPanel({ onInject }: ShortcutPanelProps) {
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
