import { useState, useEffect } from 'react';
import { conversationsApi } from '../api/conversations';

const TAG_COLOR_POOL = [
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  { bg: '#fdf4ff', border: '#e9d5ff', text: '#7c3aed' },
  { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
];

function getTagColor(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_COLOR_POOL[h % TAG_COLOR_POOL.length];
}

function getStorageKey(conversationId: string): string {
  return `repaceclaw-session-tags-${conversationId}`;
}

function loadSessionTags(conversationId: string): string[] {
  try {
    const saved = localStorage.getItem(getStorageKey(conversationId));
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

/**
 * 多智能体会话 Agent 栏组件
 * 显示当前会话的所有参与智能体和该会话的任务标签
 * ⚡ 标签按 conversationId 隔离
 */
export function SessionAgentBar({
  conversationId,
  participants,
  onParticipantsChange,
}: {
  conversationId: string;
  participants: { id: string; name: string; color: string }[];
  onParticipantsChange?: (conversation?: { id: string; agentIds: string[]; currentAgentId: string; agentId: string }) => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [taskTags, setTaskTags] = useState<string[]>([]);

  // 按 conversationId 读取标签
  useEffect(() => {
    if (!conversationId) return;
    const loadTags = () => setTaskTags(loadSessionTags(conversationId));
    loadTags();
    const interval = setInterval(loadTags, 500);
    return () => clearInterval(interval);
  }, [conversationId]);

  async function handleRemoveAgent(agentId: string) {
    if (participants.length <= 1) return;
    setLoading(agentId);
    try {
      const updated = await conversationsApi.removeAgent(conversationId, agentId);
      onParticipantsChange?.(updated ? {
        id: updated.id,
        agentIds: updated.agentIds || [],
        currentAgentId: updated.currentAgentId,
        agentId: updated.agentId,
      } : undefined);
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
      {/* 参与智能体标签 */}
      <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, marginRight: 4 }}>
        智能体:
      </span>

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

      {/* 当前会话的任务标签 */}
      {taskTags.length > 0 && (
        <>
          <span style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 4px' }} />
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, marginRight: 4 }}>
            标签:
          </span>
          {taskTags.map(tag => {
            const c = getTagColor(tag);
            return (
              <span key={tag} style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 11, padding: '2px 8px', borderRadius: 20,
                background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                fontWeight: 500, lineHeight: 1.5,
              }}>
                {tag}
              </span>
            );
          })}
        </>
      )}

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
