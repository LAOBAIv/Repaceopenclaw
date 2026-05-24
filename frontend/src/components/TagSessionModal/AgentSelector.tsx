/**
 * AgentSelector - 智能体选择器组件
 * 用于 TagSessionModal 中的智能体多选 UI
 */

interface Agent {
  id: string;
  name: string;
  color?: string;
}

interface AgentSelectorProps {
  agents: Agent[];
  selectedAgentIds: string[];
  onToggle: (agentId: string) => void;
}

const DEFAULT_AGENT_COLOR = '#6366f1';

export function AgentSelector({ agents, selectedAgentIds, onToggle }: AgentSelectorProps) {
  const isProject = selectedAgentIds.length >= 2;

  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{
        fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7,
        display: 'block',
      }}>
        选择智能体<span style={{ color: '#ef4444' }}>*</span>
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400, marginLeft: 6 }}>
          选择2个及以上自动升级为项目协作
        </span>
      </label>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: '12px',
        background: '#f9fafb',
        borderRadius: 8,
        border: '1.5px solid #e5e7eb',
      }}>
        {agents.length === 0 ? (
          <div style={{ fontSize: 12, color: '#9ca3af', padding: '8px 0' }}>暂无可用智能体</div>
        ) : agents.map(agent => {
          const isSelected = selectedAgentIds.includes(agent.id);
          const ac = agent.color ?? DEFAULT_AGENT_COLOR;
          return (
            <button
              key={agent.id}
              onClick={() => onToggle(agent.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 20,
                border: `1.5px solid ${isSelected ? ac : '#e5e7eb'}`,
                background: isSelected ? ac + '15' : '#fff',
                color: isSelected ? ac : '#6b7280',
                fontSize: 12, fontWeight: isSelected ? 600 : 400,
                cursor: 'pointer', transition: 'all 0.15s',
                fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
              }}
              onMouseEnter={e => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = ac;
                  e.currentTarget.style.color = ac;
                }
              }}
              onMouseLeave={e => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.color = '#6b7280';
                }
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: ac, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700,
              }}>
                {agent.name.charAt(0)}
              </div>
              {agent.name}
              {isSelected && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          );
        })}
      </div>
      {selectedAgentIds.length > 0 && (
        <div style={{
          marginTop: 8,
          fontSize: 12,
          color: isProject ? '#7c3aed' : '#0369a1',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 4,
            background: isProject ? '#ede9fe' : '#e0f2fe',
          }}>
            已选择 {selectedAgentIds.length} 个智能体
            {isProject && '（项目协作模式）'}
          </span>
        </div>
      )}
    </div>
  );
}
