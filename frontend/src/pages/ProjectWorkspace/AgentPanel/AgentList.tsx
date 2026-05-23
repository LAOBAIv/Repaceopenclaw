/**
 * AgentPanel/AgentList — 智能体列表展示组件
 *
 * 职责：在"切换"Tab 下以 2 列网格展示所有可用智能体，
 * 显示头像、状态点、名称、描述，高亮当前会话正在使用的智能体。
 * 点击可切换到对应智能体。
 */
import React from 'react';
import type { Agent, ConversationPanel } from '@/types';

export function AgentList({
  agentList,
  agentStatusMap,
  openPanels,
  activePanelId,
  onSwitchAgent,
}: {
  agentList: Agent[];
  agentStatusMap: Record<string, { label: string; color: string }>;
  openPanels: ConversationPanel[];
  activePanelId: string | null;
  onSwitchAgent: (agentId: string, agentName: string, agentColor: string) => void;
}) {
  if (agentList.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: '#d1d5db' }}>
        暂无可用智能体
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 8,
    }}>
      {agentList.map(agent => {
        const statusInfo = agentStatusMap[agent.status ?? 'idle'] ?? { label: '离线', color: '#9ca3af' };
        // 判断是否为当前会话正在使用的智能体
        const currentSessionPanel = openPanels.find(p => p.id === activePanelId) ?? openPanels[0] ?? null;
        const isCurrentAgent = currentSessionPanel?.agentId === agent.id;
        const accentColor = agent.color ?? '#6366f1';
        return (
          <button
            key={agent.id}
            onClick={() => { onSwitchAgent(agent.id, agent.name, agent.color); }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
              padding: '10px 11px', borderRadius: 9, border: '1.5px solid',
              borderColor: isCurrentAgent ? accentColor : '#e5e7eb',
              background: isCurrentAgent ? accentColor + '0d' : '#fafafa',
              cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
              fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
              width: '100%', boxSizing: 'border-box',
              position: 'relative',
            }}
            onMouseEnter={e => {
              if (!isCurrentAgent) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = accentColor + '88';
                (e.currentTarget as HTMLButtonElement).style.background = accentColor + '08';
              }
            }}
            onMouseLeave={e => {
              if (!isCurrentAgent) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb';
                (e.currentTarget as HTMLButtonElement).style.background = '#fafafa';
              }
            }}
          >
            {/* 右上角"当前"标注：仅标识当前会话正在使用的 agent */}
            {isCurrentAgent && (
              <span style={{
                position: 'absolute', top: 7, right: 8,
                fontSize: 10, padding: '1px 6px', borderRadius: 20, flexShrink: 0,
                background: accentColor + '18',
                color: accentColor,
                fontWeight: 600,
              }}>
                当前
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
              color: isCurrentAgent ? accentColor : '#1a202c',
              width: '100%', paddingRight: 36,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{agent.name}</div>

            {/* 描述（最多2行截断） */}
            {agent.description && (
              <div style={{
                fontSize: 11, color: '#9ca3af', lineHeight: 1.4,
                width: '100%',
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>{agent.description}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
