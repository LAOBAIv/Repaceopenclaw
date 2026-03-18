import React from 'react';

interface SchedulePanelProps {
  onFillInput?: (text: string) => void;
  onSend?: (text: string) => void;
}

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

export function SchedulePanel({ onFillInput, onSend }: SchedulePanelProps) {
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
