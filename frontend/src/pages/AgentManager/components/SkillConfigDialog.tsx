/**
 * SkillConfigDialog - Skill 配置弹窗组件
 */
import { SKILL_ITEMS } from '../constants';
import type { Agent } from '@/types';

interface Props {
  agent: Agent;
  tempSkills: Record<string, boolean>;
  savingSkills: boolean;
  updatingVisibility: string | null;
  onSkillsChange: (skills: Record<string, boolean>) => void;
  onVisibilityChange: (agent: Agent, visibility: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function SkillConfigDialog({
  agent,
  tempSkills,
  savingSkills,
  updatingVisibility,
  onSkillsChange,
  onVisibilityChange,
  onSave,
  onClose,
}: Props) {
  return (
    <div className="am-skill-mask" onClick={onClose}>
      <div className="am-skill-dialog" onClick={e => e.stopPropagation()}>
        <div className="am-skill-title">Skill 安全配置</div>
        <div className="am-skill-subtitle">管理「{agent.name}」的技能权限 · 🔴高危 🟡中危 🟢低危</div>

        {/* 可见性选择 */}
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>可见性</div>
        <div className="am-vis-selector">
          {(['private', 'public', 'template'] as const).map(v => {
            const labels = { private: '🔒 私有', public: '🌐 公开', template: '📋 模板' };
            return (
              <button
                key={v}
                className={`am-vis-btn ${(agent.visibility || 'private') === v ? 'active' : ''}`}
                disabled={updatingVisibility === agent.id}
                onClick={async () => {
                  await onVisibilityChange(agent, v);
                }}
              >
                {updatingVisibility === agent.id ? '更新中...' : labels[v]}
              </button>
            );
          })}
        </div>

        {/* Skill 开关 */}
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>技能开关</div>
        <div className="am-skill-grid">
          {SKILL_ITEMS.map(({ key, label, risk }) => {
            const active = tempSkills[key] ?? false;
            const dotColor = risk === 'high' ? '#dc2626' : risk === 'medium' ? '#f59e0b' : '#16a34a';
            return (
              <div
                key={key}
                className={`am-skill-item${active ? ' active' : ''}`}
                onClick={() => onSkillsChange({ ...tempSkills, [key]: !tempSkills[key] })}
              >
                <div className="am-skill-dot" style={{ background: dotColor }} />
                <span className="am-skill-item-label">{label}</span>
                <span className="am-skill-item-status">{active ? 'ON' : 'OFF'}</span>
              </div>
            );
          })}
        </div>

        <div className="am-skill-btns">
          <button className="am-del-btn-cancel" onClick={onClose} disabled={savingSkills}>取消</button>
          <button className="am-del-btn-confirm" onClick={onSave} disabled={savingSkills} style={{ background: '#2a3b4d' }}>
            {savingSkills ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
