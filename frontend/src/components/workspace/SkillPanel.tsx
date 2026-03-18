import React from 'react';

interface SkillPanelProps {
  taskName?: string;
  onInject?: (text: string) => void;
}

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

export function SkillPanel({ onInject }: SkillPanelProps) {
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
