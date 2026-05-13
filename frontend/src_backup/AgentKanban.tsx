import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, Clock, MoreHorizontal,
  Search, X, User, Calendar, AlignLeft, Tag,
  CheckCircle2, Loader2, Layers, ListTodo,
  Users,
} from 'lucide-react';
import { useTaskStore, Task, Column } from '@/stores/taskStore';
import { useProjectKanbanStore, KanbanProject, ProjectColumn } from '@/stores/projectKanbanStore';

/* ══════════════════════════════════════════════════════════════
   通用配置
══════════════════════════════════════════════════════════════ */
const COL_CONFIG: Record<Column, { label: string; color: string; bg: string; icon: typeof Loader2 }> = {
  progress: { label: '进行中', color: '#f59e0b', bg: '#fffbeb', icon: Loader2 },
  done:     { label: '已完成', color: '#22c55e', bg: '#f0fdf4', icon: CheckCircle2 },
};

const PRIORITY_MAP = {
  high: { label: '紧急',    color: '#ef4444', bg: '#fef2f2' },
  mid:  { label: '高优先级', color: '#f59e0b', bg: '#fffbeb' },
  low:  { label: '普通',    color: '#9ca3af', bg: '#f3f4f6' },
};

/* 标签颜色池（与 ProjectWorkspace 保持一致）*/
const TAG_COLOR_POOL: { bg: string; border: string; text: string }[] = [
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  { bg: '#fdf4ff', border: '#e9d5ff', text: '#7c3aed' },
  { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
  { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
  { bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1' },
  { bg: '#fafaf9', border: '#e7e5e4', text: '#44403c' },
];
function getTagColor(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_COLOR_POOL[h % TAG_COLOR_POOL.length];
}

/* ══════════════════════════════════════════════════════════════
   任务详情面板
══════════════════════════════════════════════════════════════ */
function TaskDetailPanel({
  task, col, onClose, onMove, onTaskUpdated,
}: {
  task: Task; col: Column;
  onClose: () => void;
  onMove: (taskId: string, from: Column, to: Column) => void;
  onTaskUpdated?: (updated: Task) => void;
}) {
  const { updateTask } = useTaskStore();
  const cols: Column[] = ['progress', 'done'];
  const cfg = COL_CONFIG[col];

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle]       = useState(task.title);
  const [editDesc, setEditDesc]         = useState(task.description);
  const [editPriority, setEditPriority] = useState<Task['priority']>(task.priority);
  const [editDue, setEditDue]           = useState(task.dueDate);

  function handleSave() {
    updateTask(task.id, {
      title: editTitle.trim() || task.title,
      description: editDesc.trim(),
      priority: editPriority,
      dueDate: editDue,
    });
    onTaskUpdated?.({
      ...task,
      title: editTitle.trim() || task.title,
      description: editDesc.trim(),
      priority: editPriority,
      dueDate: editDue,
      updatedAt: '刚刚',
    });
    setEditing(false);
  }

  const p = PRIORITY_MAP[editing ? editPriority : task.priority];

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, width: 500, maxHeight: '85vh',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* 顶栏 */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            {editing ? (
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{
                fontSize: 15, fontWeight: 700, color: '#1a202c', width: '100%',
                border: '1.5px solid #3b82f6', borderRadius: 7, padding: '5px 9px',
                outline: 'none', marginBottom: 8,
                fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif', boxSizing: 'border-box',
              }} />
            ) : (
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a202c', lineHeight: 1.4, marginBottom: 8 }}>
                {task.title}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 20,
                background: cfg.bg, color: cfg.color, fontWeight: 600, border: `1px solid ${cfg.color}30`,
              }}>{cfg.label}</span>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 20,
                background: p.bg, color: p.color, fontWeight: 600,
              }}>{p.label}</span>
              {task.source === 'chat' && (
                <span style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 20,
                  background: '#ede9fe', color: '#7c3aed', fontWeight: 500,
                }}>对话生成</span>
              )}
              {task.tags.filter(t => t !== '对话生成').map(t => (
                <span key={t} style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 20,
                  background: '#f3f4f6', color: '#6b7280',
                }}>{t}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} style={{
                  padding: '5px 12px', borderRadius: 7, border: '1px solid #e5e7eb',
                  background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer',
                }}>取消</button>
                <button onClick={handleSave} style={{
                  padding: '5px 12px', borderRadius: 7, border: 'none',
                  background: '#2a3b4d', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>保存</button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} style={{
                padding: '5px 12px', borderRadius: 7, border: '1px solid #e5e7eb',
                background: '#f9fafb', color: '#374151', fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                编辑
              </button>
            )}
            <button onClick={onClose} style={{
              background: '#f3f4f6', border: 'none', borderRadius: '50%',
              width: 30, height: 30, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer',
            }}>
              <X size={14} color="#6b7280" />
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
              <AlignLeft size={13} /> 任务描述
            </div>
            {editing ? (
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4}
                placeholder="添加任务描述..."
                style={{
                  width: '100%', fontSize: 13, color: '#4b5563', lineHeight: 1.7,
                  background: '#f9fafb', borderRadius: 8, padding: '10px 12px',
                  border: '1.5px solid #3b82f6', outline: 'none', resize: 'vertical',
                  boxSizing: 'border-box', fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                }}
              />
            ) : (
              <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.7, margin: 0, background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
                {task.description || <span style={{ color: '#d1d5db' }}>暂无描述，点击编辑添加</span>}
              </p>
            )}
          </div>

          {editing && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>优先级</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['high', 'mid', 'low'] as const).map(pv => (
                  <button key={pv} onClick={() => setEditPriority(pv)} style={{
                    flex: 1, padding: '6px 0', borderRadius: 7, border: '1.5px solid',
                    borderColor: editPriority === pv ? PRIORITY_MAP[pv].color : '#e5e7eb',
                    background: editPriority === pv ? PRIORITY_MAP[pv].bg : '#fff',
                    color: editPriority === pv ? PRIORITY_MAP[pv].color : '#9ca3af',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  }}>{PRIORITY_MAP[pv].label}</button>
                ))}
              </div>
            </div>
          )}

          {editing && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>截止日期</div>
              <input type="date" value={editDue} onChange={e => setEditDue(e.target.value)}
                style={{
                  width: '100%', padding: '7px 10px', fontSize: 13,
                  border: '1.5px solid #e5e7eb', borderRadius: 7, outline: 'none',
                  boxSizing: 'border-box', color: editDue ? '#374151' : '#9ca3af',
                  fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                }}
              />
            </div>
          )}

          {!editing && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <InfoItem icon={<User size={13} />} label="负责智能体">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: task.agentColor + '22', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: task.agentColor, fontSize: 10, fontWeight: 700,
                  }}>{task.agent.charAt(0)}</div>
                  <span style={{ fontSize: 13, color: '#374151' }}>{task.agent}</span>
                </div>
              </InfoItem>
              <InfoItem icon={<Calendar size={13} />} label="截止日期">
                <span style={{ fontSize: 13, color: '#374151' }}>{task.dueDate || '未设置'}</span>
              </InfoItem>

              <InfoItem icon={<Tag size={13} />} label="标签">
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {task.tags.filter(t => t !== '对话生成').length > 0
                    ? task.tags.filter(t => t !== '对话生成').map(t => (
                        <span key={t} style={{ fontSize: 11, padding: '1px 7px', borderRadius: 20, background: '#f3f4f6', color: '#6b7280' }}>{t}</span>
                      ))
                    : <span style={{ fontSize: 13, color: '#9ca3af' }}>无</span>
                  }
                </div>
              </InfoItem>
              <InfoItem icon={<Clock size={13} />} label="最后更新">
                <span style={{ fontSize: 13, color: '#374151' }}>{task.updatedAt}</span>
              </InfoItem>
            </div>
          )}

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>移动到</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {cols.map(c => {
                const cc = COL_CONFIG[c];
                const isCurrent = c === col;
                return (
                  <button key={c} onClick={() => { if (!isCurrent) onMove(task.id, col, c); }}
                    disabled={isCurrent}
                    style={{
                      flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                      border: `1.5px solid ${isCurrent ? cc.color : '#e5e7eb'}`,
                      background: isCurrent ? cc.bg : '#fff',
                      color: isCurrent ? cc.color : '#9ca3af',
                      cursor: isCurrent ? 'default' : 'pointer', transition: 'all 0.15s',
                    }}
                  >{cc.label}</button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   项目详情面板
══════════════════════════════════════════════════════════════ */
function ProjectDetailPanel({
  project, col, onClose, onMove,
}: {
  project: KanbanProject; col: ProjectColumn;
  onClose: () => void;
  onMove: (id: string, from: ProjectColumn, to: ProjectColumn) => void;
}) {
  const { updateProject } = useProjectKanbanStore();
  const cols: ProjectColumn[] = ['progress', 'done'];
  const cfg = COL_CONFIG[col];

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle]       = useState(project.title);
  const [editDesc, setEditDesc]         = useState(project.description);
  const [editDue, setEditDue]           = useState(project.dueDate);
  const [editPriority, setEditPriority] = useState<KanbanProject['priority']>(project.priority ?? 'low');

  function handleSave() {
    updateProject(project.id, {
      title: editTitle.trim() || project.title,
      description: editDesc.trim(),
      dueDate: editDue,
      priority: editPriority,
    });
    setEditing(false);
  }

  const p = PRIORITY_MAP[editing ? editPriority : (project.priority ?? 'low')];

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, width: 500, maxHeight: '85vh',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* 顶栏 */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            {editing ? (
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{
                fontSize: 15, fontWeight: 700, color: '#1a202c', width: '100%',
                border: '1.5px solid #3b82f6', borderRadius: 7, padding: '5px 9px',
                outline: 'none', marginBottom: 8,
                fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif', boxSizing: 'border-box',
              }} />
            ) : (
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a202c', lineHeight: 1.4, marginBottom: 8 }}>
                {project.title}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 20,
                background: cfg.bg, color: cfg.color, fontWeight: 600, border: `1px solid ${cfg.color}30`,
              }}>{cfg.label}</span>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 20,
                background: p.bg, color: p.color, fontWeight: 600,
              }}>{p.label}</span>
              {project.tags.map(t => {
                const c = getTagColor(t);
                return (
                  <span key={t} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 20,
                    background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                    fontWeight: 500,
                  }}>{t}</span>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} style={{
                  padding: '5px 12px', borderRadius: 7, border: '1px solid #e5e7eb',
                  background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer',
                }}>取消</button>
                <button onClick={handleSave} style={{
                  padding: '5px 12px', borderRadius: 7, border: 'none',
                  background: '#2a3b4d', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>保存</button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} style={{
                padding: '5px 12px', borderRadius: 7, border: '1px solid #e5e7eb',
                background: '#f9fafb', color: '#374151', fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                编辑
              </button>
            )}
            <button onClick={onClose} style={{
              background: '#f3f4f6', border: 'none', borderRadius: '50%',
              width: 30, height: 30, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer',
            }}>
              <X size={14} color="#6b7280" />
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* 进度 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#374151' }}>
              <span>项目进度</span>
              <span style={{ color: project.progress === 100 ? '#22c55e' : '#f59e0b' }}>{project.progress}%</span>
            </div>
          </div>

          {/* 描述 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
              <AlignLeft size={13} /> 项目描述
            </div>
            {editing ? (
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4}
                placeholder="添加项目描述..."
                style={{
                  width: '100%', fontSize: 13, color: '#4b5563', lineHeight: 1.7,
                  background: '#f9fafb', borderRadius: 8, padding: '10px 12px',
                  border: '1.5px solid #3b82f6', outline: 'none', resize: 'vertical',
                  boxSizing: 'border-box', fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                }}
              />
            ) : (
              <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.7, margin: 0, background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
                {project.description || <span style={{ color: '#d1d5db' }}>暂无描述</span>}
              </p>
            )}
          </div>

          {editing && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>截止日期</div>
              <input type="date" value={editDue} onChange={e => setEditDue(e.target.value)}
                style={{
                  width: '100%', padding: '7px 10px', fontSize: 13,
                  border: '1.5px solid #e5e7eb', borderRadius: 7, outline: 'none',
                  boxSizing: 'border-box', color: editDue ? '#374151' : '#9ca3af',
                  fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                }}
              />
            </div>
          )}

          {editing && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>优先级</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['high', 'mid', 'low'] as const).map(pv => (
                  <button key={pv} onClick={() => setEditPriority(pv)} style={{
                    flex: 1, padding: '6px 0', borderRadius: 7, border: '1.5px solid',
                    borderColor: editPriority === pv ? PRIORITY_MAP[pv].color : '#e5e7eb',
                    background: editPriority === pv ? PRIORITY_MAP[pv].bg : '#fff',
                    color: editPriority === pv ? PRIORITY_MAP[pv].color : '#9ca3af',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  }}>{PRIORITY_MAP[pv].label}</button>
                ))}
              </div>
            </div>
          )}

          {/* 元信息 */}
          {!editing && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <InfoItem icon={<User size={13} />} label="负责智能体">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: project.agentColor + '22', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: project.agentColor, fontSize: 10, fontWeight: 700,
                  }}>{project.agent.charAt(0)}</div>
                  <span style={{ fontSize: 13, color: '#374151' }}>{project.agent}</span>
                </div>
              </InfoItem>
              <InfoItem icon={<Calendar size={13} />} label="截止日期">
                <span style={{ fontSize: 13, color: '#374151' }}>{project.dueDate || '未设置'}</span>
              </InfoItem>

              <InfoItem icon={<Users size={13} />} label="成员">
                <span style={{ fontSize: 13, color: '#374151' }}>{project.memberCount} 人</span>
              </InfoItem>
              <InfoItem icon={<Clock size={13} />} label="最后更新">
                <span style={{ fontSize: 13, color: '#374151' }}>{project.updatedAt}</span>
              </InfoItem>
            </div>
          )}

          {/* 移动到 */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>移动到</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {cols.map(c => {
                const cc = COL_CONFIG[c];
                const isCurrent = c === col;
                return (
                  <button key={c} onClick={() => { if (!isCurrent) onMove(project.id, col, c); }}
                    disabled={isCurrent}
                    style={{
                      flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                      border: `1.5px solid ${isCurrent ? cc.color : '#e5e7eb'}`,
                      background: isCurrent ? cc.bg : '#fff',
                      color: isCurrent ? cc.color : '#9ca3af',
                      cursor: isCurrent ? 'default' : 'pointer', transition: 'all 0.15s',
                    }}
                  >{cc.label}</button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   任务卡片（对齐插件/技能页面横排样式）
══════════════════════════════════════════════════════════════ */
function TaskCard({
  task, col, onEdit, onDelete,
}: {
  task: Task;
  col: Column;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const p = PRIORITY_MAP[task.priority];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
      onClick={() => navigate('/workspace', { state: { projectName: task.title } })}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '16px 20px',
        background: '#fff',
        border: `1px solid ${hovered ? '#b0b0b0' : '#e5e5e5'}`,
        borderRadius: 12,
        boxShadow: hovered ? '0 2px 10px rgba(0,0,0,0.05)' : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        cursor: 'pointer', userSelect: 'none',
      }}
    >
      {/* 图标 */}
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: task.agentColor + '22',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: task.agentColor, fontSize: 15, fontWeight: 700,
      }}>{task.agent.charAt(0)}</div>

      {/* 信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#333', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {task.title}
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: p.bg, color: p.color, fontWeight: 400 }}>{p.label}</span>
          {task.source === 'chat' && (
            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#ede9fe', color: '#7c3aed', fontWeight: 400 }}>对话生成</span>
          )}
        </div>
        <div style={{
          fontSize: 13, color: '#666', lineHeight: 1.5, marginBottom: 8,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{task.description || '暂无描述'}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#9ca3af' }}>
          <span>{task.agent}</span>
          {col === 'done' && (
            <>
              <span>·</span>
              <span style={{ fontWeight: 600, color: '#22c55e' }}>100%</span>
            </>
          )}
          {col === 'progress' && task.progress !== undefined && (
            <>
              <span>·</span>
              <span style={{ fontWeight: 600, color: task.progress >= 80 ? '#22c55e' : task.progress >= 50 ? '#3b82f6' : '#f59e0b' }}>
                {task.progress}%
              </span>
            </>
          )}
          {task.dueDate && <><span>·</span><span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={11} />{task.dueDate}</span></>}
          {task.tags.length > 0 && task.tags.map(t => (
            <span key={t} style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, background: '#f0f4f8', color: '#4a5568' }}>{t}</span>
          ))}
        </div>
      </div>

      {/* 三点菜单 */}
      <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        <button
          onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
            color: hovered ? '#9ca3af' : 'transparent', transition: 'color 0.15s',
            borderRadius: 6, display: 'flex', alignItems: 'center',
          }}
        >
          <MoreHorizontal size={16} />
        </button>
        {menuOpen && (
          <div style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 4,
            background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 96, overflow: 'hidden',
          }}>
            <button
              onClick={() => { setMenuOpen(false); onEdit(); }}
              style={{ display: 'block', width: '100%', padding: '9px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#374151' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >编辑</button>
            <button
              onClick={() => { setMenuOpen(false); onDelete(); }}
              style={{ display: 'block', width: '100%', padding: '9px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#ef4444' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >删除</button>
          </div>
        )}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   项目卡片（对齐插件/技能页面横排样式）
══════════════════════════════════════════════════════════════ */
function ProjectCard({
  project, col, onEdit, onDelete,
}: {
  project: KanbanProject;
  col: ProjectColumn;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const p = PRIORITY_MAP[project.priority ?? 'low'];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
      onClick={() => navigate('/workspace', { state: { projectName: project.title, projectId: project.id } })}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '16px 20px',
        background: '#fff',
        border: `1px solid ${hovered ? '#b0b0b0' : '#e5e5e5'}`,
        borderRadius: 12,
        boxShadow: hovered ? '0 2px 10px rgba(0,0,0,0.05)' : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        cursor: 'pointer', userSelect: 'none',
      }}
    >
      {/* 图标 */}
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: 'linear-gradient(135deg, #e8f0fe 0%, #d0e4ff 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: project.agentColor, fontSize: 15, fontWeight: 700,
      }}>{project.title.charAt(0)}</div>

      {/* 信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 标题行：项目名 + 优先级 */}
        <div style={{ fontSize: 14, fontWeight: 600, color: '#333', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {project.title}
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: p.bg, color: p.color, fontWeight: 400 }}>{p.label}</span>
        </div>

        {/* 描述 */}
        <div style={{
          fontSize: 13, color: '#666', lineHeight: 1.5, marginBottom: 8,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{project.description || '暂无描述'}</div>

        {/* 底部信息行：智能体 · 进度 · 截止日期 · 全部标签 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#9ca3af', flexWrap: 'wrap' }}>
          <span>{project.agent}</span>
          {col === 'done' && (
            <>
              <span>·</span>
              <span style={{ fontWeight: 600, color: '#22c55e' }}>100%</span>
            </>
          )}
          {col === 'progress' && (
            <>
              <span>·</span>
              <span style={{ fontWeight: 600, color: project.progress >= 80 ? '#22c55e' : project.progress >= 50 ? '#3b82f6' : '#f59e0b' }}>
                {project.progress}%
              </span>
            </>
          )}
          {project.dueDate && (
            <><span>·</span><span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={11} />{project.dueDate}</span></>
          )}
          {project.tags.length > 0 && project.tags.map(t => {
            const c = getTagColor(t);
            return (
              <span key={t} style={{
                fontSize: 11, padding: '1px 8px', borderRadius: 20,
                background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                fontWeight: 500,
              }}>{t}</span>
            );
          })}
        </div>
      </div>

      {/* 三点菜单 */}
      <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        <button
          onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
            color: hovered ? '#9ca3af' : 'transparent', transition: 'color 0.15s',
            borderRadius: 6, display: 'flex', alignItems: 'center',
          }}
        >
          <MoreHorizontal size={16} />
        </button>
        {menuOpen && (
          <div style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 4,
            background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 96, overflow: 'hidden',
          }}>
            <button
              onClick={() => { setMenuOpen(false); onEdit(); }}
              style={{ display: 'block', width: '100%', padding: '9px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#374151' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >编辑</button>
            <button
              onClick={() => { setMenuOpen(false); onDelete(); }}
              style={{ display: 'block', width: '100%', padding: '9px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#ef4444' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >删除</button>
          </div>
        )}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   通用 InfoItem
══════════════════════════════════════════════════════════════ */
function InfoItem({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>
        {icon} {label}
      </div>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   主页面
══════════════════════════════════════════════════════════════ */
export function AgentKanban() {
  const [activeTab, setActiveTab] = useState<'task' | 'project'>('task');
  const [searchText, setSearchText] = useState('');

  const { tasks } = useTaskStore();
  const { projects } = useProjectKanbanStore();
  const taskTotal = Object.values(tasks).flat().length;
  const projectTotal = Object.values(projects).flat().length;

  const tabs = [
    { key: 'task' as const,    label: '任务列表', icon: ListTodo,  count: taskTotal },
    { key: 'project' as const, label: '项目列表', icon: Layers,    count: projectTotal },
  ];

  return (
    <div style={{
      width: '100%', height: '100%', background: '#f5f7fa',
      padding: 16, boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
      fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif',
    }}>
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        background: '#fafbfc', border: '1px solid #e5e6eb',
        borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden',
      }}>

        {/* ── 顶部 header ── */}
        <div style={{
          padding: '16px 32px', borderBottom: '1px solid #e5e6eb',
          background: '#fff', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={18} color="#2a3b4d" />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#1a202c' }}>任务看板</span>
          </div>
          {/* 搜索框 */}
          <div style={{ position: 'relative' }}>
            <Search size={13} color="#9ca3af" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder={`搜索${activeTab === 'task' ? '任务' : '项目'}...`}
              style={{
                width: 200, padding: '7px 30px 7px 30px', fontSize: 13,
                border: '1px solid #e5e7eb', borderRadius: 8, outline: 'none',
                boxSizing: 'border-box', color: '#374151',
                background: searchText ? '#f0f9ff' : '#f9fafb',
                borderColor: searchText ? '#3b82f6' : '#e5e7eb',
                transition: 'border-color 0.15s, background 0.15s',
                fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
              }}
            />
            {searchText && (
              <button onClick={() => setSearchText('')} style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}><X size={12} color="#9ca3af" /></button>
            )}
          </div>
        </div>

        {/* ── Tab 切换 ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0,
          padding: '0 32px', background: '#fff',
          borderBottom: '1px solid #e5e6eb', flexShrink: 0,
        }}>
          {tabs.map(tab => {
            const active = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSearchText(''); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '12px 20px', fontSize: 13, fontWeight: active ? 700 : 500,
                  color: active ? '#2a3b4d' : '#9ca3af',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: active ? '2.5px solid #2a3b4d' : '2.5px solid transparent',
                  marginBottom: -1, transition: 'all 0.15s',
                  fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                }}
              >
                <Icon size={14} />
                {tab.label}
                <span style={{
                  fontSize: 11, padding: '1px 7px', borderRadius: 20, fontWeight: 600,
                  background: active ? '#2a3b4d' : '#f3f4f6',
                  color: active ? '#fff' : '#9ca3af',
                  transition: 'all 0.15s',
                }}>{tab.count}</span>
              </button>
            );
          })}
        </div>

        {/* ── 内容区 ── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeTab === 'task'
            ? <TaskKanbanWithSearch searchText={searchText} />
            : <ProjectKanbanWithSearch searchText={searchText} />
          }
        </div>
      </div>
    </div>
  );
}

/* 带外部搜索词注入的包装组件 */
function TaskKanbanWithSearch({ searchText }: { searchText: string }) {
  const { tasks, moveTask: storeMoveTask, removeTask } = useTaskStore();
  const cols: Column[] = ['progress', 'done'];

  function filterTask(task: Task) {
    if (searchText && !task.title.toLowerCase().includes(searchText.toLowerCase()) &&
        !task.description.toLowerCase().includes(searchText.toLowerCase()) &&
        !task.tags.some(t => t.toLowerCase().includes(searchText.toLowerCase()))) return false;
    return true;
  }
  const hasFilter = !!searchText;
  const [editTask, setEditTask] = useState<{ task: Task; col: Column } | null>(null);

  return (
    <>
      {/* 两列并排内容区 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          {cols.map(col => {
            const cfg = COL_CONFIG[col];
            const colTasks = tasks[col].filter(filterTask);
            const Icon = cfg.icon;

            return (
              <div key={col}>
                {/* 列标题 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                  <Icon size={14} color={cfg.color} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{cfg.label}</span>
                  <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 20, background: cfg.color + '20', color: cfg.color, fontWeight: 700 }}>
                    {colTasks.length}{hasFilter && colTasks.length !== tasks[col].length ? `/${tasks[col].length}` : ''}
                  </span>
                </div>

                {/* 卡片列表 */}
                {colTasks.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '28px 0', fontSize: 13, color: '#d1d5db',
                    border: '1.5px dashed #e5e7eb', borderRadius: 12,
                  }}>{hasFilter ? '无匹配任务' : '暂无任务'}</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {colTasks.map(task => (
                      <TaskCard key={task.id} task={task} col={col}
                        onEdit={() => setEditTask({ task, col })}
                        onDelete={() => removeTask(task.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 编辑弹窗 */}
      {editTask && (
        <TaskDetailPanel
          task={editTask.task}
          col={editTask.col}
          onClose={() => setEditTask(null)}
          onMove={(taskId, from, to) => { storeMoveTask(taskId, from, to); setEditTask(null); }}
          onTaskUpdated={updated => setEditTask(prev => prev ? { ...prev, task: updated } : null)}
        />
      )}
    </>
  );
}

function ProjectKanbanWithSearch({ searchText }: { searchText: string }) {
  const { projects, moveProject: storeMoveProject, removeProject } = useProjectKanbanStore();
  const cols: ProjectColumn[] = ['progress', 'done'];

  function filterProject(p: KanbanProject) {
    if (searchText && !p.title.toLowerCase().includes(searchText.toLowerCase()) &&
        !p.description.toLowerCase().includes(searchText.toLowerCase()) &&
        !p.tags.some(t => t.toLowerCase().includes(searchText.toLowerCase()))) return false;
    return true;
  }
  const hasFilter = !!searchText;
  const [editProject, setEditProject] = useState<{ project: KanbanProject; col: ProjectColumn } | null>(null);

  return (
    <>
      {/* 两列并排内容区 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          {cols.map(col => {
            const cfg = COL_CONFIG[col];
            const colProjects = projects[col].filter(filterProject);
            const Icon = cfg.icon;

            return (
              <div key={col}>
                {/* 列标题 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                  <Icon size={14} color={cfg.color} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{cfg.label}</span>
                  <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 20, background: cfg.color + '20', color: cfg.color, fontWeight: 700 }}>
                    {colProjects.length}{hasFilter && colProjects.length !== projects[col].length ? `/${projects[col].length}` : ''}
                  </span>
                </div>

                {/* 卡片列表 */}
                {colProjects.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '28px 0', fontSize: 13, color: '#d1d5db',
                    border: '1.5px dashed #e5e7eb', borderRadius: 12,
                  }}>{hasFilter ? '无匹配项目' : '暂无项目'}</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {colProjects.map(project => (
                      <ProjectCard key={project.id} project={project} col={col}
                        onEdit={() => setEditProject({ project, col })}
                        onDelete={() => removeProject(project.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 编辑弹窗 */}
      {editProject && (
        <ProjectDetailPanel
          project={editProject.project}
          col={editProject.col}
          onClose={() => setEditProject(null)}
          onMove={(id, from, to) => { storeMoveProject(id, from, to); setEditProject(null); }}
        />
      )}
    </>
  );
}


