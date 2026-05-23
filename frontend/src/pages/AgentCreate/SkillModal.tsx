/**
 * SkillModal - 技能选择弹窗组件
 *
 * 职责：
 * - 展示后端技能列表供用户勾选
 * - 支持多选、确认、取消
 * - 显示加载状态和空状态
 */
import { X, Check } from 'lucide-react';
import type { BackendSkill } from './types';

interface SkillModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  skills: BackendSkill[];
  loading: boolean;
  tempSkills: string[];
  onToggleSkill: (id: string) => void;
}

export function SkillModal({
  open, onClose, onConfirm, skills, loading, tempSkills, onToggleSkill,
}: SkillModalProps) {
  if (!open) return null;

  return (
    <div className="ac-modal-mask" onClick={onClose}>
      <div className="ac-modal" onClick={e => e.stopPropagation()}>
        <div className="ac-modal-head">
          <span className="ac-modal-title">选择核心技能</span>
          <button className="ac-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="ac-modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 13 }}>
              加载技能列表中…
            </div>
          ) : skills.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 13 }}>
              暂无可用技能，请先在「技能设置」页面创建技能
            </div>
          ) : skills.map(skill => {
            const sel = tempSkills.includes(skill.id);
            return (
              <div
                key={skill.id}
                className={`ac-modal-item${sel ? ' selected' : ''}`}
                onClick={() => onToggleSkill(skill.id)}
              >
                <div className="ac-modal-check">
                  {sel && <Check size={13} color="#fff" strokeWidth={3} />}
                </div>
                <div className="ac-modal-item-info">
                  <div className="ac-modal-item-name">
                    {skill.name}
                    <span className="ac-modal-item-cat">{skill.category}</span>
                  </div>
                  <div className="ac-modal-item-desc">{skill.description}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="ac-modal-foot">
          <span className="ac-modal-selected-tip">已选 {tempSkills.length} 个技能</span>
          <div className="ac-modal-foot-btns">
            <button className="ac-modal-btn-cancel" onClick={onClose}>取消</button>
            <button className="ac-modal-btn-confirm" onClick={onConfirm}>确认</button>
          </div>
        </div>
      </div>
    </div>
  );
}
