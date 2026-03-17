import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Zap, Clock,
  Search, X, User, Calendar, AlignLeft, Tag,
  CheckCircle2, Loader2, Layers, ListTodo,
  Users,
} from 'lucide-react';
import { useTaskStore, Task, Column } from '@/stores/taskStore';
import { useProjectKanbanStore, KanbanProject, ProjectColumn } from '@/stores/projectKanbanStore';
import { useAgentStore } from '@/stores/agentStore';
import { projectsApi } from '@/api/projects';

/* ══════════════════════════════════════════════════════════════
   自定义确认弹窗
   替代 window.confirm —— 支持按钮居中、确认后刷新页面
══════════════════════════════════════════════════════════════ */
function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    /* 全屏半透明遮罩 */
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      {/* 弹窗主体，阻止点击冒泡到遮罩 */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: '28px 32px 24px',
          minWidth: 320,
          maxWidth: 420,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
        }}
      >
        {/* 警告图标 */}
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: '#fef2f2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>

        {/* 提示文字 */}
        <p style={{
          margin: 0, textAlign: 'center',
          fontSize: 15, color: '#374151', lineHeight: 1.6,
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
        }}>
          {message}
        </p>

        {/* 按钮组 —— 居中排列 */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 24px', borderRadius: 8,
              border: '1.5px solid #e5e7eb',
              background: '#fff', color: '#6b7280',
              fontSize: 14, fontWeight: 500,
              cursor: 'pointer',
              fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 24px', borderRadius: 8,
              border: 'none',
              background: '#ef4444', color: '#fff',
              fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ef4444'; }}
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}

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

/* 预设标签（与 ProjectWorkspace 保持一致）*/
const PRESET_TAGS = ['优先级高', '待跟进', '已完成', '阻塞中', 'Bug', 'Feature', '文档', '重构'];

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
  /* 标签编辑状态（始终可用，不依赖 editing）*/
  const [localTags, setLocalTags]       = useState<string[]>(project.tags ?? []);
  const [tagInput, setTagInput]         = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);

  function handleSave() {
    updateProject(project.id, {
      title: editTitle.trim() || project.title,
      description: editDesc.trim(),
      dueDate: editDue,
      priority: editPriority,
      tags: localTags,
    });
    setEditing(false);
  }

  /* ── 标签操作 ── */
  function addTag(raw: string) {
    const t = raw.trim();
    if (!t || localTags.includes(t)) return;
    const next = [...localTags, t];
    setLocalTags(next);
    updateProject(project.id, { tags: next });
  }
  function removeTag(tag: string) {
    const next = localTags.filter(t => t !== tag);
    setLocalTags(next);
    updateProject(project.id, { tags: next });
  }
  function togglePreset(pt: string) {
    localTags.includes(pt) ? removeTag(pt) : addTag(pt);
  }
  function commitTag() {
    addTag(tagInput);
    setTagInput('');
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

          {/* 截止日期（仅编辑态） */}
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

          {/* ── 优先级：标签与选项并排（始终显示）── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* 左侧：标签 */}
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', width: 48, flexShrink: 0 }}>
                优先级
              </div>
              {/* 右侧：三个选项按钮 */}
              <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                {(['high', 'mid', 'low'] as const).map(pv => {
                  const isActive = (editing ? editPriority : (project.priority ?? 'low')) === pv;
                  return (
                    <button
                      key={pv}
                      onClick={() => editing && setEditPriority(pv)}
                      style={{
                        flex: 1, padding: '5px 0', borderRadius: 7, border: '1.5px solid',
                        borderColor: isActive ? PRIORITY_MAP[pv].color : '#e5e7eb',
                        background: isActive ? PRIORITY_MAP[pv].bg : '#fff',
                        color: isActive ? PRIORITY_MAP[pv].color : '#9ca3af',
                        fontSize: 12, fontWeight: isActive ? 600 : 400,
                        cursor: editing ? 'pointer' : 'default',
                        transition: 'all 0.15s',
                        opacity: editing ? 1 : (isActive ? 1 : 0.5),
                      }}
                    >{PRIORITY_MAP[pv].label}</button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── 标签编辑（始终展示，实时写入 store）── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
              标签
            </div>

            {/* 已选标签展示区 */}
            <div
              style={{
                display: 'flex', flexWrap: 'wrap', gap: 7, alignContent: 'flex-start',
                minHeight: 44, marginBottom: 12,
                padding: '8px 12px',
                background: '#fafafa', border: '1.5px solid #e5e7eb', borderRadius: 10,
                cursor: 'text',
              }}
              onClick={() => tagInputRef.current?.focus()}
            >
              {localTags.length === 0 ? (
                <span style={{ fontSize: 12, color: '#d1d5db', lineHeight: '24px', userSelect: 'none' }}>
                  点击下方快捷标签或输入自定义标签
                </span>
              ) : localTags.map(tag => {
                const c = getTagColor(tag);
                return (
                  <span key={tag} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    fontSize: 12, padding: '3px 8px 3px 10px', borderRadius: 20,
                    background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                    fontWeight: 500, lineHeight: 1.5,
                  }}>
                    {tag}
                    <button
                      onClick={e => { e.stopPropagation(); removeTag(tag); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '0 1px', lineHeight: 1, color: c.text,
                        opacity: 0.45, fontSize: 15,
                        display: 'flex', alignItems: 'center',
                        transition: 'opacity 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '0.45'; }}
                      title="移除此标签"
                    >×</button>
                  </span>
                );
              })}
            </div>

            {/* 快捷预设标签 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 7 }}>
                快捷标签
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PRESET_TAGS.map(pt => {
                  const selected = localTags.includes(pt);
                  const c = getTagColor(pt);
                  return (
                    <button
                      key={pt}
                      onClick={() => togglePreset(pt)}
                      style={{
                        padding: '4px 11px', borderRadius: 20, fontSize: 12,
                        border: `1px solid ${selected ? c.border : '#e5e7eb'}`,
                        background: selected ? c.bg : '#fff',
                        color: selected ? c.text : '#6b7280',
                        cursor: 'pointer', fontWeight: selected ? 600 : 400,
                        transition: 'all 0.12s',
                        display: 'inline-flex', alignItems: 'center', gap: 4, outline: 'none',
                        fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                      }}
                      onMouseEnter={e => {
                        if (!selected) {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = c.border;
                          (e.currentTarget as HTMLButtonElement).style.background = c.bg + 'cc';
                          (e.currentTarget as HTMLButtonElement).style.color = c.text;
                        }
                      }}
                      onMouseLeave={e => {
                        if (!selected) {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb';
                          (e.currentTarget as HTMLButtonElement).style.background = '#fff';
                          (e.currentTarget as HTMLButtonElement).style.color = '#6b7280';
                        }
                      }}
                    >
                      {selected ? (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <span style={{ fontSize: 12, lineHeight: 1, opacity: 0.5 }}>+</span>
                      )}
                      {pt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 自定义输入 */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={tagInputRef}
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitTag(); } }}
                placeholder="输入自定义标签，Enter 确认"
                style={{
                  flex: 1, height: 36, fontSize: 13, padding: '0 12px',
                  border: '1.5px solid #e5e7eb', borderRadius: 8, outline: 'none',
                  fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif', color: '#374151',
                  transition: 'border-color 0.15s', boxSizing: 'border-box',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
              />
              <button
                onClick={commitTag}
                style={{
                  height: 36, padding: '0 16px', fontSize: 13, fontWeight: 600,
                  border: 'none', borderRadius: 8,
                  background: '#6366f1', color: '#fff', cursor: 'pointer',
                  fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#4f46e5'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#6366f1'; }}
              >添加</button>
            </div>
          </div>

          {/* 元信息（非编辑态） */}
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
   任务卡片
   【交互规则】
   - 点击卡片主体跳转到任务对应的工作区（/workspace）
   - 右侧始终显示「编辑」「删除」两个操作按钮（不再使用三点菜单）
   - 「编辑」打开任务详情弹窗；「删除」直接从看板中移除任务
   【智能体规则】
   - 每个任务至少包含 1 个智能体（agents.length >= 1）
   - 卡片底部展示所有参与智能体的 Avatar 列表
══════════════════════════════════════════════════════════════ */
function TaskCard({
  task, col, onEdit, onDelete, onEditNavigate,
}: {
  task: Task;
  col: Column;
  onEdit: () => void;
  onDelete: () => void;
  onEditNavigate?: (t: Task) => void;
}) {
  const navigate = useNavigate();
  const { updateTask: updateTaskStore } = useTaskStore();
  const [hovered, setHovered] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState(task.title);
  const p = PRIORITY_MAP[task.priority];

  async function saveTitle() {
    const trimmed = editingTitle.trim();
    if (!trimmed || trimmed === task.title) {
      setIsEditingTitle(false);
      setEditingTitle(task.title);
      return;
    }
    // 对于任务，直接更新前端 store（当前无后端任务 API）
    updateTaskStore(task.id, { title: trimmed });
    setIsEditingTitle(false);
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '14px 16px 14px 20px',
        background: '#fff',
        border: `1px solid ${hovered ? '#b0b0b0' : '#e5e5e5'}`,
        borderRadius: 12,
        boxShadow: hovered ? '0 2px 10px rgba(0,0,0,0.05)' : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        userSelect: 'none',
      }}
    >
      {/* 图标 —— 点击进入工作区 */}
      <div
        onClick={() => navigate('/workspace', {
          state: {
            projectName: task.title,
            taskId: task.id,
            // 将任务关联的智能体名称列表传入对话页，对话页智能体面板按此名单过滤
            agentNames: (task.agents ?? [{ name: task.agent, color: task.agentColor }]).map(a => a.name),
          },
        })}
        style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: task.agentColor + '22',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: task.agentColor, fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}
      >{task.agent.charAt(0)}</div>

      {/* 信息区 —— 点击进入工作区 */}
      <div
        onClick={() => navigate('/workspace', {
          state: {
            projectName: task.title,
            taskId: task.id,
            agentNames: (task.agents ?? [{ name: task.agent, color: task.agentColor }]).map(a => a.name),
          },
        })}
        style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
      >
        {/* 标题行（支持双击编辑） */}
        <div style={{ fontSize: 14, fontWeight: 600, color: '#333', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {isEditingTitle ? (
            <input
              autoFocus
              value={editingTitle}
              onChange={e => setEditingTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') {
                  setIsEditingTitle(false);
                  setEditingTitle(task.title);
                }
              }}
              onClick={e => e.stopPropagation()}
              style={{
                flex: 1,
                fontSize: 14,
                fontWeight: 600,
                color: '#333',
                border: '1.5px solid #3b82f6',
                borderRadius: 6,
                padding: '4px 8px',
                outline: 'none',
                fontFamily: '\"Microsoft YaHei\",\"Segoe UI\",sans-serif',
              }}
            />
          ) : (
            <span
              onDoubleClick={() => setIsEditingTitle(true)}
              style={{
                flex: 1,
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: 4,
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => {
                if (!isEditingTitle) (e.currentTarget as HTMLSpanElement).style.background = '#f0f0f0';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLSpanElement).style.background = 'transparent';
              }}
            >
              {task.title}
            </span>
          )}
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: p.bg, color: p.color, fontWeight: 400 }}>{p.label}</span>
          {task.source === 'chat' && (
            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#ede9fe', color: '#7c3aed', fontWeight: 400 }}>对话生成</span>
          )}
        </div>

        {/* 描述 */}
        <div style={{
          fontSize: 13, color: '#666', lineHeight: 1.5, marginBottom: 8,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{task.description || '暂无描述'}</div>

        {/* 底部元信息行：智能体 Avatars · 进度 · 截止日期 · 标签 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#9ca3af', flexWrap: 'wrap' }}>
          {/* 智能体 Avatar 组（展示所有参与智能体，最多显示 3 个）*/}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {(task.agents ?? [{ name: task.agent, color: task.agentColor }]).slice(0, 3).map((a, i) => (
              <div key={i} title={a.name} style={{
                width: 18, height: 18, borderRadius: '50%',
                background: a.color + '33',
                border: `1.5px solid ${a.color}66`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: a.color, fontSize: 9, fontWeight: 700,
              }}>{a.name.charAt(0)}</div>
            ))}
            {(task.agents ?? []).length > 3 && (
              <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 2 }}>+{task.agents.length - 3}</span>
            )}
          </div>
          {col === 'done' && (
            <><span>·</span><span style={{ fontWeight: 600, color: '#22c55e' }}>100%</span></>
          )}
          {col === 'progress' && task.progress !== undefined && (
            <><span>·</span>
            <span style={{ fontWeight: 600, color: task.progress >= 80 ? '#22c55e' : task.progress >= 50 ? '#3b82f6' : '#f59e0b' }}>
              {task.progress}%
            </span></>
          )}
          {task.dueDate && <><span>·</span><span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={11} />{task.dueDate}</span></>}
          {task.tags.length > 0 && task.tags.map(t => (
            <span key={t} style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, background: '#f0f4f8', color: '#4a5568' }}>{t}</span>
          ))}
        </div>
      </div>

      {/* 操作按钮区：「进入会话」「编辑」「删除」 */}
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {/* 进入会话按钮 */}
        <button
          onClick={() => navigate('/workspace', {
            state: {
              projectName: task.title,
              taskId: task.id,
              agentNames: (task.agents ?? [{ name: task.agent, color: task.agentColor }]).map(a => a.name),
            },
          })}
          title="进入会话"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 6, border: '1px solid #bfdbfe',
            background: '#eff6ff',
            color: '#2563eb', cursor: 'pointer',
            transition: 'background 0.12s, border-color 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.borderColor = '#93c5fd'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>

        {/* 编辑按钮（仅图标） */}
        <button
          onClick={() => onEditNavigate ? onEditNavigate(task) : onEdit()}
          title="编辑任务"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb',
            background: hovered ? '#f9fafb' : '#fff',
            color: '#374151', cursor: 'pointer',
            transition: 'background 0.12s, border-color 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f0f0f0'; e.currentTarget.style.borderColor = '#9ca3af'; }}
          onMouseLeave={e => { e.currentTarget.style.background = hovered ? '#f9fafb' : '#fff'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>

        {/* 删除按钮（仅图标） */}
        <button
          onClick={onDelete}
          title="删除任务"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca',
            background: '#fff5f5',
            color: '#ef4444', cursor: 'pointer',
            transition: 'background 0.12s, border-color 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#f87171'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff5f5'; e.currentTarget.style.borderColor = '#fecaca'; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   项目卡片
   【交互规则】
   - 点击卡片主体跳转到项目工作区（/workspace）
   - 右侧始终显示「编辑」「删除」两个操作按钮（不再使用三点菜单）
   【智能体规则】
   - 每个项目至少包含 2 个智能体（agents.length >= 2）
   - 卡片底部展示所有参与智能体的 Avatar 列表（最多显示 4 个，超出显示 +N）
══════════════════════════════════════════════════════════════ */
function ProjectCard({
  project, col, onEdit, onDelete, onEditNavigate,
}: {
  project: KanbanProject;
  col: ProjectColumn;
  onEdit: () => void;
  onDelete: () => void;
  onEditNavigate?: (p: KanbanProject) => void;
}) {
  const navigate = useNavigate();
  const { updateProject: updateKanbanProject } = useProjectKanbanStore();
  const [hovered, setHovered] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState(project.title);
  const p = PRIORITY_MAP[project.priority ?? 'low'];

  async function saveTitle() {
    const trimmed = editingTitle.trim();
    if (!trimmed || trimmed === project.title) {
      setIsEditingTitle(false);
      setEditingTitle(project.title);
      return;
    }
    try {
      // 调用后端 API 更新
      const { projectsApi } = await import('@/api/projects');
      await projectsApi.update(project.id, { title: trimmed });
      // 更新前端 kanban store
      updateKanbanProject(project.id, { title: trimmed });
      setIsEditingTitle(false);
    } catch (err: any) {
      if (err.response?.status === 403) {
        showToast('只有创建人可以修改项目名称', 'error');
      } else {
        showToast('修改项目名称失败', 'error');
      }
      setEditingTitle(project.title);
      setIsEditingTitle(false);
    }
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '14px 16px 14px 20px',
        background: '#fff',
        border: `1px solid ${hovered ? '#b0b0b0' : '#e5e5e5'}`,
        borderRadius: 12,
        boxShadow: hovered ? '0 2px 10px rgba(0,0,0,0.05)' : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        userSelect: 'none',
      }}
    >
      {/* 图标 —— 点击进入工作区 */}
      <div
        onClick={() => navigate('/workspace', {
          state: {
            projectName: project.title,
            projectId: project.id,
            // 将项目关联的智能体名称列表传入对话页，对话页智能体面板按此名单过滤
            agentNames: (project.agents ?? [{ name: project.agent, color: project.agentColor }]).map(a => a.name),
          },
        })}
        style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, #e8f0fe 0%, #d0e4ff 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: project.agentColor, fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}
      >{project.title.charAt(0)}</div>

      {/* 信息区 —— 点击进入工作区 */}
      <div
        onClick={() => navigate('/workspace', {
          state: {
            projectName: project.title,
            projectId: project.id,
            agentNames: (project.agents ?? [{ name: project.agent, color: project.agentColor }]).map(a => a.name),
          },
        })}
        style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
      >
        {/* 标题行：项目名 + 优先级（支持双击编辑） */}
        <div style={{ fontSize: 14, fontWeight: 600, color: '#333', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {isEditingTitle ? (
            <input
              autoFocus
              value={editingTitle}
              onChange={e => setEditingTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') {
                  setIsEditingTitle(false);
                  setEditingTitle(project.title);
                }
              }}
              onClick={e => e.stopPropagation()}
              style={{
                flex: 1,
                fontSize: 14,
                fontWeight: 600,
                color: '#333',
                border: '1.5px solid #3b82f6',
                borderRadius: 6,
                padding: '4px 8px',
                outline: 'none',
                fontFamily: '\"Microsoft YaHei\",\"Segoe UI\",sans-serif',
              }}
            />
          ) : (
            <span
              onDoubleClick={() => setIsEditingTitle(true)}
              style={{
                flex: 1,
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: 4,
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => {
                if (!isEditingTitle) (e.currentTarget as HTMLSpanElement).style.background = '#f0f0f0';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLSpanElement).style.background = 'transparent';
              }}
            >
              {project.title}
            </span>
          )}
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: p.bg, color: p.color, fontWeight: 400, flexShrink: 0 }}>{p.label}</span>
        </div>

        {/* 描述 */}
        <div style={{
          fontSize: 13, color: '#666', lineHeight: 1.5, marginBottom: 8,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{project.description || '暂无描述'}</div>

        {/* 底部元信息行：智能体 Avatars · 进度 · 截止日期 · 标签 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#9ca3af', flexWrap: 'wrap' }}>
          {/*
           * 项目智能体 Avatar 组（最多显示 4 个，超出显示 +N）
           *
           * 【数据来源说明】
           *   读取 project.agents（ProjectAgent[]），该字段在两个时机写入：
           *     1. AgentKanban useEffect 初始化：从后端 workflowNodes 反查写入
           *     2. ProjectWorkspace.tsx 的 useEffect（监听 collabNodes 变化）：
           *        用户在协作弹窗里实时增删智能体时，自动同步写回此字段
           *   两级 fallback：
           *     ① project.agents 有值 → 优先使用（多智能体）
           *     ② 降级为 project.agent + project.agentColor（单智能体旧格式，向后兼容）
           *
           * ⚠️ 请勿在此处直接用 agentStore 反查，此组件无法获取 collabNodes；
           *    跨组件同步通过 ProjectWorkspace.tsx 的 useEffect 写回 kanbanStore 实现。
           */}
          {(() => {
            const agentList = project.agents && project.agents.length > 0
              ? project.agents
              : [{ name: project.agent, color: project.agentColor }];
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {agentList.slice(0, 4).map((a, i) => (
                  <div key={i} title={a.name} style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: a.color + '33',
                    border: `1.5px solid ${a.color}88`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: a.color, fontSize: 10, fontWeight: 700,
                    flexShrink: 0,
                  }}>{a.name.charAt(0)}</div>
                ))}
                {agentList.length > 4 && (
                  <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 2 }}>+{agentList.length - 4}</span>
                )}
              </div>
            );
          })()}
          {col === 'done' && (
            <><span>·</span><span style={{ fontWeight: 600, color: '#22c55e' }}>100%</span></>
          )}
          {col === 'progress' && (
            <><span>·</span>
            <span style={{ fontWeight: 600, color: project.progress >= 80 ? '#22c55e' : project.progress >= 50 ? '#3b82f6' : '#f59e0b' }}>
              {project.progress}%
            </span></>
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

      {/* 操作按钮区：「进入会话」「编辑」「删除」，与 TaskCard 保持一致 */}
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {/* 进入会话按钮 */}
        <button
          onClick={() => navigate('/workspace', {
            state: {
              projectName: project.title,
              projectId: project.id,
              agentNames: (project.agents ?? [{ name: project.agent, color: project.agentColor }]).map(a => a.name),
            },
          })}
          title="进入会话"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 6, border: '1px solid #bfdbfe',
            background: '#eff6ff',
            color: '#2563eb', cursor: 'pointer',
            transition: 'background 0.12s, border-color 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.borderColor = '#93c5fd'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>

        {/* 编辑按钮（仅图标） */}
        <button
          onClick={() => onEditNavigate ? onEditNavigate(project) : onEdit()}
          title="编辑项目"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb',
            background: hovered ? '#f9fafb' : '#fff',
            color: '#374151', cursor: 'pointer',
            transition: 'background 0.12s, border-color 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f0f0f0'; e.currentTarget.style.borderColor = '#9ca3af'; }}
          onMouseLeave={e => { e.currentTarget.style.background = hovered ? '#f9fafb' : '#fff'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>

        {/* 删除按钮（仅图标） */}
        <button
          onClick={onDelete}
          title="删除项目"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca',
            background: '#fff5f5',
            color: '#ef4444', cursor: 'pointer',
            transition: 'background 0.12s, border-color 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#f87171'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff5f5'; e.currentTarget.style.borderColor = '#fecaca'; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
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
  const [activeTab, setActiveTab] = useState<'progress' | 'done'>('progress');
  const [searchText, setSearchText] = useState('');

  const { tasks } = useTaskStore();
  const { projects, addProject, updateProject: updateKanbanProject } = useProjectKanbanStore();
  const { agents, fetchAgents } = useAgentStore();
  const progressCount = tasks['progress'].length + projects['progress'].length;
  const doneCount = tasks['done'].length + projects['done'].length;

  /* ── 从后端同步项目到 kanban store，防止刷新后用户新建的项目消失 ── */
  useEffect(() => {
    (async () => {
      // 先等智能体加载完毕，再查项目——避免 agents store 为空时查不到名字
      await fetchAgents();
      // fetchAgents 完成后，从 store 里取最新的 agents 列表
      const freshAgents = useAgentStore.getState().agents;

      let backendProjects: import('../types').Project[];
      try {
        backendProjects = await projectsApi.list();
      } catch {
        return; // 后端不可用时静默
      }

      const allKanban = [...projects.progress, ...projects.done];

      /**
       * 将后端 updatedAt（ISO 时间字符串）转为可读的相对时间展示
       * 例如：刚刚 / 5分钟前 / 2小时前 / 3天前
       */
      function formatUpdatedAt(isoStr: string | undefined): string {
        if (!isoStr) return '刚刚';
        const diff = Date.now() - new Date(isoStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 2) return '刚刚';
        if (mins < 60) return `${mins}分钟前`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}小时前`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}天前`;
        const weeks = Math.floor(days / 7);
        return `${weeks}周前`;
      }

      backendProjects.forEach(bp => {
        // 从 workflow_nodes 里推导参与智能体列表（使用最新 freshAgents 反查）
        const agentIds = [...new Set((bp.workflowNodes ?? []).flatMap(n => n.agentIds))];
        const agentsInNodes = agentIds
          .map(id => freshAgents.find(a => a.id === id))
          .filter(Boolean)
          .map(a => ({ name: a!.name, color: a!.color ?? '#6366f1' }));
        const firstAgent = agentsInNodes[0] ?? { name: '策划助手', color: '#6366f1' };
        const dueDate = bp.endTime ? bp.endTime.slice(0, 10).replace(/-/g, '/').slice(5) : '';
        const updatedAt = formatUpdatedAt(bp.updatedAt);

        const alreadyInKanban = allKanban.find(
          kp => kp.id === bp.id || kp.title === bp.title
        );
        if (alreadyInKanban) {
          // 已有项目：同步后端最新的 title/description/tags/priority/dueDate/agents/updatedAt
          // 不覆盖 progress（进度由用户在前端手动管理）
          updateKanbanProject(alreadyInKanban.id, {
            id: bp.id,                    // 确保 ID 与后端一致（修复临时 proj_xxx 遗留问题）
            title: bp.title,
            description: bp.description ?? '',
            tags: bp.tags ?? [],
            priority: bp.priority ?? 'low',
            dueDate,
            updatedAt,
            agent: firstAgent.name,
            agentColor: firstAgent.color,
            agents: agentsInNodes.length > 0 ? agentsInNodes : [firstAgent],
            taskCount: (bp.workflowNodes ?? []).length,
            memberCount: agentsInNodes.length || 1,
          });
          return;
        }
        // 新项目：写入 kanban store（使用后端真实 id，根据 status 放入对应列）
        const targetCol = bp.status === 'archived' ? 'done' : 'progress';
        addProject({
          id: bp.id,
          title: bp.title,
          description: bp.description ?? '',
          tags: bp.tags ?? [],
          priority: bp.priority ?? 'low',
          agent: firstAgent.name,
          agentColor: firstAgent.color,
          agents: agentsInNodes.length > 0 ? agentsInNodes : [firstAgent],
          progress: 0,
          dueDate,
          updatedAt,
          taskCount: (bp.workflowNodes ?? []).length,
          memberCount: agentsInNodes.length || 1,
        }, targetCol);
      });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 接收来自「配置智能体」按钮的跳转参数
  const location = useLocation();
  useEffect(() => {
    const state = location.state as { tab?: string; projectId?: string | null; projectTitle?: string } | null;
    if (state?.tab === 'project') {
      setActiveTab('progress');
      if (state.projectTitle) {
        setSearchText(state.projectTitle);
      }
      // 清除 state 防止刷新时重复触发
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const tabs = [
    { key: 'progress' as const, label: '进行中', icon: Loader2,      count: progressCount, color: '#f59e0b' },
    { key: 'done'     as const, label: '已完成', icon: CheckCircle2,  count: doneCount,     color: '#22c55e' },
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
            <span style={{ fontWeight: 700, fontSize: 16, color: '#1a202c' }}>会话列表</span>
          </div>
          {/* 搜索框 */}
          <div style={{ position: 'relative' }}>
            <Search size={13} color="#9ca3af" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="搜索任务或项目..."
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
                  borderBottom: active ? `2.5px solid ${tab.color}` : '2.5px solid transparent',
                  marginBottom: -1, transition: 'all 0.15s',
                  fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                }}
              >
                <Icon size={14} color={active ? tab.color : '#9ca3af'} />
                {tab.label}
                <span style={{
                  fontSize: 11, padding: '1px 7px', borderRadius: 20, fontWeight: 600,
                  background: active ? tab.color + '22' : '#f3f4f6',
                  color: active ? tab.color : '#9ca3af',
                  transition: 'all 0.15s',
                }}>{tab.count}</span>
              </button>
            );
          })}
        </div>

        {/* ── 内容区 ── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <StatusKanban col={activeTab} searchText={searchText} />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   按状态展示（进行中 / 已完成），同时包含任务和项目两个区块
══════════════════════════════════════════════════════════════ */
function StatusKanban({ col, searchText }: { col: Column; searchText: string }) {
  const navigate = useNavigate();
  const { tasks, moveTask: storeMoveTask, removeTask } = useTaskStore();
  const { projects, moveProject: storeMoveProject, removeProject } = useProjectKanbanStore();

  const [editTask, setEditTask]       = useState<{ task: Task; col: Column } | null>(null);
  const [editProject, setEditProject] = useState<{ project: KanbanProject; col: ProjectColumn } | null>(null);

  const hasFilter = !!searchText;

  /**
   * 待确认的删除操作：存储弹窗提示文字和确认后的执行函数。
   * 非 null 时渲染 ConfirmDialog，用户点「确认删除」后执行 action 并刷新页面。
   */
  const [pendingDelete, setPendingDelete] = useState<{
    message: string;
    action: () => Promise<void> | void;
  } | null>(null);

  /**
   * 删除项目：
   * BUG 根因——之前只删前端 store（projectKanbanStore.removeProject），
   * 但 AgentKanban 挂载时会从后端重新同步项目（useEffect + projectsApi.list），
   * 刷新页面后被删的项目会从后端重新加回来，导致"删除没有效果"。
   *
   * 修复：先调后端 projectsApi.delete 删除服务端记录，
   * 成功后再删前端 store，确保刷新后不会复原。
   * 同时改用自定义弹窗（ConfirmDialog），确认后调用 window.location.reload() 刷新页面。
   */
  function handleDeleteProject(projectId: string, projectTitle: string) {
    setPendingDelete({
      message: `确定删除项目「${projectTitle}」？此操作不可撤销。`,
      action: async () => {
        try {
          // Step 1：删除后端记录（先删后端，防止刷新时 useEffect 重新同步回来）
          await projectsApi.delete(projectId);
        } catch {
          // 后端删除失败时，也继续删前端 store（避免 mock 数据/无后端时卡住）
        }
        // Step 2：删前端 store（projectKanbanStore + localStorage persist）
        removeProject(projectId);
      },
    });
  }

  /**
   * 删除任务：
   * 当前无独立的后端任务 API，只删前端 store（taskStore + localStorage persist）。
   * 任务数据不会从后端同步回来（AgentKanban 的 useEffect 只同步项目），
   * 所以纯前端删除对任务是有效的。
   * 同样改用自定义弹窗，确认后刷新页面。
   */
  function handleDeleteTask(taskId: string, taskTitle: string) {
    setPendingDelete({
      message: `确定删除任务「${taskTitle}」？此操作不可撤销。`,
      action: () => {
        // 只删前端 store（taskStore 无后端 API，persist 到 localStorage）
        removeTask(taskId);
      },
    });
  }

  function filterTask(task: Task) {
    if (!searchText) return true;
    return task.title.toLowerCase().includes(searchText.toLowerCase()) ||
      task.description.toLowerCase().includes(searchText.toLowerCase()) ||
      task.tags.some(t => t.toLowerCase().includes(searchText.toLowerCase()));
  }
  function filterProject(p: KanbanProject) {
    if (!searchText) return true;
    return p.title.toLowerCase().includes(searchText.toLowerCase()) ||
      p.description.toLowerCase().includes(searchText.toLowerCase()) ||
      p.tags.some(t => t.toLowerCase().includes(searchText.toLowerCase()));
  }

  const colTasks    = tasks[col].filter(filterTask);
  const colProjects = projects[col].filter(filterProject);
  const cfg = COL_CONFIG[col];

  return (
    <>
      {/* ── 删除确认弹窗 ──
          pendingDelete 非 null 时展示，按钮居中对齐。
          用户点「确认删除」后：
            1. 执行 action（调后端 API + 删前端 store）
            2. 调 window.location.reload() 刷新页面，确保列表数据与后端完全一致
          用户点「取消」或点遮罩则关闭弹窗，什么都不做。
      */}
      {pendingDelete && (
        <ConfirmDialog
          message={pendingDelete.message}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            await pendingDelete.action();
            setPendingDelete(null);
            // 刷新页面，确保列表展示与 store/后端数据完全同步
            window.location.reload();
          }}
        />
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

          {/* ── 项目区块 ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Layers size={15} color="#6366f1" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>项目</span>
              <span style={{
                fontSize: 11, padding: '1px 8px', borderRadius: 20, fontWeight: 700,
                background: '#ede9fe', color: '#7c3aed',
              }}>
                {colProjects.length}{hasFilter && colProjects.length !== projects[col].length ? `/${projects[col].length}` : ''}
              </span>
            </div>
            {colProjects.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '24px 0', fontSize: 13, color: '#d1d5db',
                border: '1.5px dashed #e5e7eb', borderRadius: 12,
              }}>{hasFilter ? '无匹配项目' : `暂无${cfg.label}项目`}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {colProjects.map(project => (
                  <ProjectCard key={project.id} project={project} col={col}
                    onEdit={() => {/* navigate handled inside ProjectCard */}}
                    onDelete={() => handleDeleteProject(project.id, project.title)}
                    onEditNavigate={(p) => navigate('/console', { state: { editProject: p } })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── 任务区块 ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <ListTodo size={15} color="#3b82f6" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>任务</span>
              <span style={{
                fontSize: 11, padding: '1px 8px', borderRadius: 20, fontWeight: 700,
                background: '#eff6ff', color: '#3b82f6',
              }}>
                {colTasks.length}{hasFilter && colTasks.length !== tasks[col].length ? `/${tasks[col].length}` : ''}
              </span>
            </div>
            {colTasks.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '24px 0', fontSize: 13, color: '#d1d5db',
                border: '1.5px dashed #e5e7eb', borderRadius: 12,
              }}>{hasFilter ? '无匹配任务' : `暂无${cfg.label}任务`}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {colTasks.map(task => (
                  <TaskCard key={task.id} task={task} col={col}
                    onEdit={() => setEditTask({ task, col })}
                    onDelete={() => handleDeleteTask(task.id, task.title)}
                    onEditNavigate={(t) => navigate('/console', { state: { editTask: t } })}
                  />
                ))}
              </div>
            )}
          </div>

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
      {editProject && (
        <ProjectDetailPanel
          project={editProject.project}
          col={editProject.col}
          onClose={() => setEditProject(null)}
          onMove={async (id, from, to) => {
            // Step 1：更新前端 store（立即生效）
            storeMoveProject(id, from, to);
            // Step 2：同步 status 到后端（active = 进行中, archived = 已完成）
            const newStatus = to === 'done' ? 'archived' : 'active';
            try {
              await projectsApi.update(id, { status: newStatus } as any);
            } catch {
              // 后端不可用时静默，前端状态已更新不回滚
            }
            setEditProject(null);
          }}
        />
      )}
    </>
  );
}


