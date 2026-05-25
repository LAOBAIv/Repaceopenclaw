/**
 * AgentCard - 智能体卡片组件
 */
import { AlertTriangle, Settings, Pencil, Trash2 } from 'lucide-react';
import type { Agent } from '@/types';
import type { AgentRoutingInfo } from '@/api/agents';
import { isValidModelName } from '../utils';
import { VisibilityBadge } from '../VisibilityBadge';
import { AgentAvatar } from '../AgentAvatar';
import { ModelParamBar } from '../ModelParamBar';

interface Props {
  agent: Agent;
  routing?: AgentRoutingInfo;
  isAdmin: boolean;
  onCardClick: (agent: Agent) => void;
  onEditClick: (e: React.MouseEvent, agent: Agent) => void;
  onDeleteClick: (e: React.MouseEvent, agent: Agent) => void;
  onSkillClick: (agent: Agent) => void;
}

export function AgentCard({ agent, routing, isAdmin, onCardClick, onEditClick, onDeleteClick, onSkillClick }: Props) {
  return (
    <div className="am-item" onClick={() => onCardClick(agent)}>
      {/* 操作按钮（hover 显示） */}
      <div className="am-item-actions">
        <button
          className="am-action-btn am-action-btn-edit"
          title={agent.isSystem && !isAdmin ? '仅管理员可查看平台助手设置' : 'Skill 配置'}
          onClick={(e) => { e.stopPropagation(); onSkillClick(agent); }}
          disabled={!!agent.isSystem && !isAdmin}
        >
          <Settings size={12} />
        </button>
        <button
          className="am-action-btn am-action-btn-edit"
          title={agent.isSystem && !isAdmin ? '仅管理员可查看平台助手设置' : '编辑智能体'}
          onClick={(e) => onEditClick(e, agent)}
          disabled={!!agent.isSystem && !isAdmin}
        >
          <Pencil size={12} />
        </button>
        <button
          className="am-action-btn am-action-btn-del"
          title={agent.isSystem ? '平台助手不允许删除' : '删除智能体'}
          onClick={(e) => onDeleteClick(e, agent)}
          disabled={!!agent.isSystem}
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="am-item-top">
        <AgentAvatar agent={agent} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="am-name" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {agent.name}
            <VisibilityBadge visibility={agent.visibility} />
            {agent.modelName && !isValidModelName(agent.modelName, routing) && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '1px 6px', borderRadius: 10,
                background: '#fef2f2', border: '1px solid #fecaca',
                fontSize: 10, color: '#dc2626', fontWeight: 500,
              }} title={`模型 "${agent.modelName}" 无效`}>
                <AlertTriangle size={10} />
                无效模型
              </span>
            )}
          </div>
          <div className="am-style">{agent.writingStyle}</div>
        </div>
      </div>
      {(agent.description || agent.systemPrompt) && (
        <div className="am-desc">{agent.description || agent.systemPrompt}</div>
      )}
      {agent.expertise && agent.expertise.length > 0 && (
        <div className="am-tags">
          {agent.expertise.slice(0, 4).map(tag => (
            <span key={tag} className="am-tag">{tag}</span>
          ))}
        </div>
      )}

      {/* ── 模型参数行 ── */}
      <ModelParamBar agent={agent} routing={routing} />
    </div>
  );
}
