import { useState } from 'react';
import apiClient from '../api/client';

/**
 * 多智能体会话 Agent 栏组件
 * 显示当前会话的所有参与智能体，支持移除
 * 注意：添加智能体请使用页面内置的智能体选择弹窗
 */
export function SessionAgentBar({
  conversationId,
  participants,
  onParticipantsChange,
}: {
  conversationId: string;
  participants: { id: string; name: string; color: string }[];
  onParticipantsChange?: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleRemoveAgent(agentId: string) {
    if (participants.length <= 1) return; // 至少保留一个
    setLoading(agentId);
    try {
      await apiClient.delete(`/conversations/${conversationId}/agents/${agentId}`);
      onParticipantsChange?.();
    } catch (err) {
      console.error('移除智能体失败:', err);
      alert('移除智能体失败');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 16px', background: '#f8f9fb',
      borderBottom: '1px solid #e5e7eb', minHeight: 48, flexWrap: 'wrap',
    }}>
      {/* 标签 */}
      <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, marginRight: 4 }}>
        参与智能体:
      </span>

      {/* 已参与智能体 Chips */}
      {participants.map(agent => (
        <div key={agent.id} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 6px 4px 4px', borderRadius: 20,
          background: agent.color + '18', border: `1.5px solid ${agent.color}44`,
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: agent.color + '33',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: agent.color, fontWeight: 700, fontSize: 11,
          }}>
            {agent.name.charAt(0)}
          </div>
          <span style={{
            fontSize: 12, fontWeight: 500, color: '#374151',
            maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {agent.name}
          </span>
          {participants.length > 1 && (
            <button
              onClick={() => handleRemoveAgent(agent.id)}
              disabled={loading === agent.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 18, height: 18, borderRadius: '50%', border: 'none',
                background: 'transparent', cursor: loading === agent.id ? 'not-allowed' : 'pointer',
                color: '#9ca3af', fontSize: 14, lineHeight: 1,
                transition: 'all 0.15s', opacity: loading === agent.id ? 0.5 : 1,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
              title="移除此智能体"
            >
              {loading === agent.id ? '…' : '×'}
            </button>
          )}
        </div>
      ))}

      {/* 多智能体标识 */}
      {participants.length > 1 && (
        <span style={{
          marginLeft: 'auto', fontSize: 11, padding: '2px 8px', borderRadius: 10,
          background: '#dbeafe', color: '#2563eb', fontWeight: 500,
        }}>
          多智能体协作 ({participants.length})
        </span>
      )}
    </div>
  );
}
