/**
 * SkillSection - 技能配置区组件
 *
 * 职责：渲染技能选择触发器
 * - 显示已选技能标签（chip）
 * - 点击打开技能选择弹窗
 * - 支持单个技能移除
 */
import { ChevronDown, X } from 'lucide-react';

interface SkillSectionProps {
  skills: string[];
  onOpenModal: () => void;
  onRemoveSkill: (id: string) => void;
  skillDisplayName: (id: string) => string;
}

export function SkillSection({
  skills, onOpenModal, onRemoveSkill, skillDisplayName,
}: SkillSectionProps) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
        核心技能
      </label>
      <div className="ac-skill-trigger" onClick={onOpenModal}>
        {skills.length === 0
          ? <span className="ac-skill-placeholder">点击选择技能...</span>
          : skills.map(s => (
              <span key={s} className="ac-skill-chip">
                {skillDisplayName(s)}
                <button type="button" className="ac-skill-chip-del"
                  onClick={e => { e.stopPropagation(); onRemoveSkill(s); }}>
                  <X size={11} />
                </button>
              </span>
            ))
        }
        <span className="ac-skill-arrow"><ChevronDown size={15} /></span>
      </div>
    </div>
  );
}
