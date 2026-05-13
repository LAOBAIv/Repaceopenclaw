import { useState } from 'react';
import { Wrench, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface Skill {
  id: number;
  name: string;
  desc: string;
  category: string;
  enabled: boolean;
}

const INIT_SKILLS: Skill[] = [
  { id: 1, name: '代码生成', desc: '自动生成多语言代码片段，支持 React、Python、SQL 等主流语言。', category: '开发工具', enabled: true },
  { id: 2, name: '数据分析', desc: '对结构化数据进行统计分析，自动生成图表与报告。', category: '数据处理', enabled: true },
  { id: 3, name: '文本创作', desc: '生成营销文案、产品描述、社交媒体内容，支持多种风格调节。', category: '内容生产', enabled: false },
  { id: 4, name: '智能问答', desc: '基于知识库进行意图识别与 FAQ 自动匹配，快速响应用户咨询。', category: '交互能力', enabled: true },
  { id: 5, name: '工具调用', desc: '通过 Function Calling 调用外部 API 与系统工具，完成自动化任务。', category: '集成能力', enabled: true },
  { id: 6, name: '多模态处理', desc: '支持图片识别、语音输入等多模态输入，提升交互丰富度。', category: '感知能力', enabled: false },
];

const CATEGORIES = ['全部', '开发工具', '数据处理', '内容生产', '交互能力', '集成能力', '感知能力'];

export function SkillSettings() {
  const [skills, setSkills] = useState<Skill[]>(INIT_SKILLS);
  const [activeCategory, setActiveCategory] = useState('全部');

  function toggleEnabled(id: number) {
    setSkills(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  }

  function deleteSkill(id: number) {
    setSkills(prev => prev.filter(s => s.id !== id));
  }

  const filtered = activeCategory === '全部' ? skills : skills.filter(s => s.category === activeCategory);
  const enabledCount = skills.filter(s => s.enabled).length;

  return (
    <>
      <style>{`
        .ss-wrap {
          width: 100%;
          flex: 1; min-height: 0;
          display: flex; flex-direction: column;
          font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
          background: #f5f7fa;
          padding: 16px; box-sizing: border-box;
          overflow: hidden;
        }
        .ss-shell {
          flex: 1; min-height: 0; display: flex; flex-direction: column;
          background: #fafbfc; border: 1px solid #e5e6eb;
          border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.05);
          overflow: hidden;
        }
        /* 顶部 header */
        .ss-header {
          padding: 16px 32px;
          border-bottom: 1px solid #e5e6eb;
          background: #ffffff;
          display: flex; align-items: center; justify-content: space-between;
          flex-shrink: 0;
        }
        .ss-header-left { display: flex; align-items: center; gap: 10px; }
        .ss-add-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 8px; border: none;
          background: #2a3b4d; color: #fff;
          font-weight: 600; font-size: 13px; cursor: pointer;
          font-family: inherit; transition: background 0.15s;
        }
        .ss-add-btn:hover { background: #1e2d3d; }
        /* 分类筛选栏 */
        .ss-filter {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 32px;
          border-bottom: 1px solid #f0f0f0;
          background: #fff;
          flex-shrink: 0; flex-wrap: wrap;
        }
        .ss-cat-tag {
          padding: 5px 14px; border-radius: 20px;
          font-size: 13px; cursor: pointer;
          border: 1px solid #e5e7eb;
          background: #fff; color: #4a5568;
          transition: all 0.15s; user-select: none;
        }
        .ss-cat-tag.active {
          background: #2a3b4d; border-color: #2a3b4d; color: #fff;
        }
        .ss-cat-tag:hover:not(.active) { border-color: #2a3b4d; color: #2a3b4d; }
        /* 列表区 */
        .ss-scroll { flex: 1; overflow-y: auto; padding: 20px 32px; }
        .ss-list {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        @media (max-width: 640px) {
          .ss-list { grid-template-columns: 1fr; }
        }
        /* 技能卡片 */
        .ss-item {
          display: flex; align-items: center; gap: 16px;
          padding: 16px 20px;
          background: #ffffff;
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .ss-item:hover {
          border-color: #b0b0b0;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        .ss-item-info { flex: 1; min-width: 0; }
        .ss-item-name {
          font-size: 14px; font-weight: 600; color: #333333;
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 4px;
        }
        .ss-item-cat {
          font-size: 11px; padding: 2px 8px; border-radius: 4px;
          background: #f0f4f8; color: #4a5568; font-weight: 400;
        }
        .ss-item-desc {
          font-size: 13px; color: #666666; line-height: 1.5;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ss-item-actions { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
        .ss-toggle { cursor: pointer; display: flex; align-items: center; }
        .ss-delete {
          cursor: pointer; color: #ccc;
          transition: color 0.15s;
          display: flex; align-items: center;
          background: none; border: none; padding: 0;
        }
        .ss-delete:hover { color: #e53e3e; }
        @media (max-width: 768px) {
          .ss-scroll { padding: 16px; }
          .ss-header { padding: 14px 16px; }
          .ss-filter { padding: 10px 16px; }
        }
      `}</style>

      <div className="ss-wrap">
        <div className="ss-shell">

          {/* 顶部 header */}
          <div className="ss-header">
            <div className="ss-header-left">
              <Wrench size={18} color="#2a3b4d" />
              <div>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#1a202c' }}>技能设置</span>
                <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 10 }}>
                  共 {skills.length} 个技能 · 已启用 {enabledCount} 个
                </span>
              </div>
            </div>
            <button className="ss-add-btn">
              <Plus size={14} /> 添加技能
            </button>
          </div>

          {/* 分类筛选 */}
          <div className="ss-filter">
            {CATEGORIES.map(cat => (
              <span
                key={cat}
                className={`ss-cat-tag${activeCategory === cat ? ' active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >{cat}</span>
            ))}
          </div>

          {/* 技能列表 */}
          <div className="ss-scroll">
            <div className="ss-list">
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#aaa', padding: '40px 0', fontSize: 14 }}>
                  暂无技能
                </div>
              ) : filtered.map(skill => (
                <div key={skill.id} className="ss-item">
                  <div className="ss-item-info">
                    <div className="ss-item-name">
                      {skill.name}
                      <span className="ss-item-cat">{skill.category}</span>
                    </div>
                    <div className="ss-item-desc">{skill.desc}</div>
                  </div>
                  <div className="ss-item-actions">
                    <span
                      className="ss-toggle"
                      onClick={() => toggleEnabled(skill.id)}
                      title={skill.enabled ? '点击禁用' : '点击启用'}
                    >
                      {skill.enabled
                        ? <ToggleRight size={26} color="#4299e1" />
                        : <ToggleLeft size={26} color="#cbd5e0" />
                      }
                    </span>
                    <button
                      className="ss-delete"
                      onClick={() => deleteSkill(skill.id)}
                      title="删除技能"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
