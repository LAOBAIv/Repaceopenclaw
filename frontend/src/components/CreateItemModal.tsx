import { useState } from 'react';
import { showToast } from '@/components/Toast';
import { useProjectStore } from '@/stores/projectStore';
import { useAgentStore } from '@/stores/agentStore';
import { useTaskStore } from '@/stores/taskStore';
import { useConversationStore } from '@/stores/conversationStore';
import type { ProjectPriority } from '@/stores/projectKanbanStore';

const PRIORITY_OPTIONS: { value: ProjectPriority; label: string; color: string; bg: string }[] = [
  { value: 'high', label: '高优先级', color: '#ef4444', bg: '#fef2f2' },
  { value: 'mid',  label: '中优先级', color: '#f59e0b', bg: '#fffbeb' },
  { value: 'low',  label: '低优先级', color: '#22c55e', bg: '#f0fdf4' },
];

interface CreateItemModalProps {
  open: boolean;
  type: 'project' | 'task' | null;
  onClose: () => void;
}

export function CreateItemModal({ open, type, onClose }: CreateItemModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<ProjectPriority>('mid');
  const [creating, setCreating] = useState(false);

  const { createProject } = useProjectStore();
  const { agents } = useAgentStore();
  const { addTask } = useTaskStore();
  const { openPanel, sendMessage } = useConversationStore();

  if (!open || !type) return null;

  async function handleCreateProject() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const project = await createProject({
        title: title.trim(),
        description: description.trim(),
        tags: [],
        priority,
        status: 'active',
        goal: '',
        startTime: new Date().toISOString(),
        endTime: '',
        decisionMaker: '',
        workflowNodes: [],
      });

      const defaultAgent = agents[0];
      if (defaultAgent) {
        await openPanel({
          agentId: defaultAgent.id,
          agentName: defaultAgent.name,
          agentColor: defaultAgent.color,
          projectId: project.id,
        });
        const freshPanel = useConversationStore.getState().openPanels[0];
        if (freshPanel) {
          sendMessage(freshPanel.id, `开始新项目：${title.trim()}\n\n${description.trim() || '暂无描述'}`);
        }
      }

      resetAndClose();
      showToast('项目创建成功', 'success');
    } catch {
      showToast('项目创建失败', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateTask() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const defaultAgent = agents[0];
      if (!defaultAgent) {
        showToast('请先创建智能体', 'warning');
        setCreating(false);
        return;
      }

      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');

      const newTask = {
        id: `task_${Date.now()}`,
        title: title.trim(),
        description: description.trim(),
        agent: defaultAgent.name,
        agentColor: defaultAgent.color ?? '#6366f1',
        agents: [{ name: defaultAgent.name, color: defaultAgent.color ?? '#6366f1' }],
        priority,
        tags: ['手动创建'],
        updatedAt: '刚刚',
        dueDate: `${mm}/${String(Number(dd) + 7).padStart(2, '0')}`,
        commentCount: 0,
        fileCount: 0,
        source: 'manual' as const,
      };

      addTask(newTask, 'progress');

      await openPanel({
        agentId: defaultAgent.id,
        agentName: defaultAgent.name,
        agentColor: defaultAgent.color,
      });

      const freshPanel = useConversationStore.getState().openPanels[0];
      if (freshPanel) {
        sendMessage(freshPanel.id, `开始新任务：${title.trim()}\n\n${description.trim() || '暂无描述'}`);
      }

      resetAndClose();
      showToast('任务创建成功', 'success');
    } catch {
      showToast('任务创建失败', 'error');
    } finally {
      setCreating(false);
    }
  }

  function resetAndClose() {
    setTitle('');
    setDescription('');
    setPriority('mid');
    onClose();
  }

  const isProject = type === 'project';
  const themeColor = isProject ? '#6366f1' : '#3b82f6';
  const themeGradient = isProject 
    ? 'linear-gradient(135deg,#8b5cf6,#6366f1)' 
    : 'linear-gradient(135deg,#3b82f6,#06b6d4)';

  return (
    <div
      onClick={resetAndClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
          width: 480,
          maxWidth: 'calc(100vw - 32px)',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
          animation: 'createModalIn 0.2s cubic-bezier(0.34,1.4,0.64,1)',
          overflow: 'hidden',
          position: 'relative',
          marginBottom: 32,
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '22px 28px 18px',
          borderBottom: '1px solid #f0f0f0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: themeGradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {isProject ? (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
                  <rect x="2" y="7" width="20" height="14" rx="2"/>
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                </svg>
              ) : (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
                  <path d="M9 11l3 3L22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              )}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a202c', lineHeight: 1.3 }}>
                新建{isProject ? '项目' : '任务'}
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 3, lineHeight: 1.4 }}>
                创建后自动开启会话
              </div>
            </div>
          </div>
          <button
            onClick={resetAndClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: 'none', background: '#f3f4f6', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#9ca3af', fontSize: 18, lineHeight: 1,
              transition: 'background 0.15s, color 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e5e7eb'; e.currentTarget.style.color = '#374151'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#9ca3af'; }}
          >×</button>
        </div>

        {/* Form */}
        <div style={{ padding: '24px 28px' }}>
          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 2,
              fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7,
            }}>
              标题<span style={{ color: '#ef4444', fontSize: 13, lineHeight: 1, marginLeft: 2 }}>*</span>
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={`请输入${isProject ? '项目' : '任务'}标题`}
              style={{
                width: '100%', height: 44, padding: '0 16px',
                border: '1.5px solid #e5e7eb',
                borderRadius: 8, fontSize: 13, outline: 'none',
                background: '#fff', color: '#1a202c',
                fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label style={{
              fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7,
              display: 'block',
            }}>
              描述
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={`请输入${isProject ? '项目' : '任务'}描述（可选）`}
              style={{
                width: '100%', height: 80, padding: '10px 16px',
                border: '1.5px solid #e5e7eb',
                borderRadius: 8, fontSize: 13, outline: 'none',
                background: '#fff', color: '#1a202c',
                fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                boxSizing: 'border-box',
                resize: 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Priority */}
          <div style={{ marginBottom: 8 }}>
            <label style={{
              fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7,
              display: 'block',
            }}>
              优先级
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              {PRIORITY_OPTIONS.map(opt => {
                const isActive = priority === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setPriority(opt.value)}
                    style={{
                      flex: 1, padding: '9px 0', borderRadius: 8, border: '1.5px solid',
                      borderColor: isActive ? opt.color : '#e5e7eb',
                      background: isActive ? opt.bg : '#fff',
                      color: isActive ? opt.color : '#9ca3af',
                      fontSize: 13, fontWeight: isActive ? 700 : 400,
                      cursor: 'pointer', transition: 'all 0.15s',
                      fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = opt.color;
                        e.currentTarget.style.background = opt.bg;
                        e.currentTarget.style.color = opt.color;
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.background = '#fff';
                        e.currentTarget.style.color = '#9ca3af';
                      }
                    }}
                  >
                    {isActive && (
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M1.5 5.5L4 8L9.5 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div style={{
          display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center',
          padding: '16px 28px 24px',
          borderTop: '1px solid #f0f0f0',
        }}>
          <button
            onClick={resetAndClose}
            style={{
              height: 40, padding: '0 24px', fontSize: 14, borderRadius: 8,
              border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer',
              color: '#6b7280', fontWeight: 500,
              fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
              transition: 'border-color 0.15s, color 0.15s, background 0.15s',
              display: 'inline-flex', alignItems: 'center',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#9ca3af';
              e.currentTarget.style.color = '#374151';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.color = '#6b7280';
            }}
          >取消</button>

          <button
            onClick={isProject ? handleCreateProject : handleCreateTask}
            disabled={!title.trim() || creating}
            style={{
              height: 40, padding: '0 28px', fontSize: 14, borderRadius: 8,
              border: 'none',
              background: themeColor,
              cursor: (!title.trim() || creating) ? 'not-allowed' : 'pointer',
              color: '#fff', fontWeight: 600,
              fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
              opacity: (!title.trim() || creating) ? 0.6 : 1,
              transition: 'background 0.15s, box-shadow 0.15s',
              boxShadow: `0 2px 8px ${themeColor}40`,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
            onMouseEnter={e => {
              if (title.trim() && !creating) {
                e.currentTarget.style.background = isProject ? '#4f46e5' : '#2563eb';
                e.currentTarget.style.boxShadow = `0 4px 12px ${themeColor}60`;
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = themeColor;
              e.currentTarget.style.boxShadow = `0 2px 8px ${themeColor}40`;
            }}
          >
            {creating ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" style={{ animation: 'spin 1s linear infinite' }}/>
                </svg>
                创建中...
              </>
            ) : (
              <>创建{isProject ? '项目' : '任务'}</>
            )}
          </button>
        </div>

        <style>{`
          @keyframes createModalIn {
            from { opacity: 0; transform: scale(0.9) translateY(16px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
