/**
 * MobileAgentSelector — 智能体选择器 Sheet
 *
 * 底部弹出面板，展示可用智能体列表供用户选择创建新会话。
 * 过滤系统助手，用户不可选。
 */

import { X } from 'lucide-react';
import { COLORS } from './constants';
import type { Agent } from '../../types';

interface MobileAgentSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  agents: Agent[];
  agentsLoading: boolean;
  onSelectAgent: (agentId: string, agentName: string, agentColor: string) => void;
}

export function MobileAgentSelector({
  isOpen,
  onClose,
  agents,
  agentsLoading,
  onSelectAgent,
}: MobileAgentSelectorProps) {
  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.6)',
          }}
        />
      )}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201,
        background: COLORS.bgSecondary,
        borderRadius: '20px 20px 0 0',
        maxHeight: '70vh',
        display: 'flex', flexDirection: 'column',
        transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* Header */}
        <div style={{
          height: 52, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.textPrimary }}>选择智能体</div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: COLORS.bgTertiary, border: 'none', cursor: 'pointer', borderRadius: 10,
              color: COLORS.textSecondary,
            }}
          >
            <X size={16} />
          </button>
        </div>
        {/* Agent 列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {agentsLoading ? (
            <div style={{ textAlign: 'center', color: COLORS.textMuted, padding: 24 }}>加载中...</div>
          ) : agents.length === 0 ? (
            <div style={{ textAlign: 'center', color: COLORS.textMuted, padding: 24 }}>暂无智能体</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* [2026-05-21] 过滤系统助手，用户不可选 */}
              {agents.filter((a) => !a.isSystem).map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => onSelectAgent(agent.id, agent.name, agent.color || COLORS.accent)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', borderRadius: 12,
                    background: COLORS.bgTertiary, border: `1px solid ${COLORS.border}`, cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: agent.color || COLORS.accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 14, fontWeight: 600,
                  }}>
                    {(agent.name || 'A').charAt(0)}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: COLORS.textPrimary }}>{agent.name}</div>
                    {agent.modelName && (
                      <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{agent.modelName}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
