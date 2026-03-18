import { useState } from 'react';
import { showToast } from '@/components/Toast';
import { useAgentStore } from '@/stores/agentStore';
import { useTaskStore } from '@/stores/taskStore';
import { useConversationStore } from '@/stores/conversationStore';
import type { ProjectPriority } from '@/stores/projectKanbanStore';

const PRIORITY_OPTIONS: { value: ProjectPriority; label: string; color: string; bg: string }[] = [
  { value: 'high', label: '高优先级', color: '#ef4444', bg: '#fef2f2' },
  { value: 'mid',  label: '中优先级', color: '#f59e0b', bg: '#fffbeb' },
  { value: 'low',  label: '低优先级', color: '#22c55e', bg: '#f0fdf4' },
];

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateTaskModal({ open, onClose }: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<ProjectPriority>('mid');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const { agents } = useAgentStore();
  const { addTask } = useTaskStore();
  const { openPanel, sendMessage } = useConversationStore();

  if (!open) return null;

  const isProject = selectedAgentIds.length >= 2;

  function toggleAgent(agentId: string) {
    setSelectedAgentIds(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  }

  async function handleCreate() {
    if (!title.trim()) {
      showToast('请输入任务标题', 'warning');
      return;
    }
    if (selectedAgentIds.length === 0) {
      showToast('请选择至少一个智能体', 'warning');
      return;
    }

    setCreating(true);
    try {
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');

      const selectedAgents = agents.filter(a => selectedAgentIds.includes(a.id));
      const mainAgent = selectedAgents[0];
      
      // 创建任务/项目
      const taskId = isProject ? `proj_${Date.now()}` : `task_${Date.now()}`;
      const newTask = {
        id: taskId,
        title: title.trim(),
        description: description.trim(),
        agent: mainAgent.name,
        agentColor: mainAgent.color ?? '#6366f1',
        agents: selectedAgents.map(a => ({ name: a.name, color: a.color ?? '#6366f1' })),
        priority,
        tags: isProject ? ['项目', '协作'] : ['任务'],
        updatedAt: '刚刚',
        dueDate: `${mm}/${String(Number(dd) + 7).padStart(2, '0')}`,
        commentCount: 0,
        fileCount: 0,
        source: 'manual' as const,
        isProject, // 标记是否为项目
        participantCount: selectedAgentIds.length,
      };
      
      addTask(newTask, 'progress');
      
      // 为每个选中的智能体创建会话
      for (const agent of selectedAgents) {
        await openPanel({
          agentId: agent.id,
          agentName: agent.name,
          agentColor: agent.color,
          projectId: isProject ? taskId : undefined,
        });
      }
      
      // 发送初始消息到第一个智能体
      const firstPanel = useConversationStore.getState().openPanels[0];
      if (firstPanel) {
        const typeLabel = isProject ? '项目' : '任务';
        const participantInfo = isProject 
          ? `\n参与智能体：${selectedAgents.map(a => a.name).join('、')}` 
          : '';
        sendMessage(
          firstPanel.id, 
          `开始新${typeLabel}：${title.trim()}${participantInfo}\n\n${description.trim() || '暂无描述'}`
        );
      }
      
      resetAndClose();
      const typeLabel = isProject ? '项目' : '任务';
      showToast(`${typeLabel}创建成功`, 'success');
    } catch {
      showToast('创建失败', 'error');
    } finally {
      setCreating(false);
    }
  }

  function resetAndClose() {
    setTitle('');
    setDescription('');
    setPriority('mid');
    setSelectedAgentIds([]);
    onClose();
  }

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
          width: 520,
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
              background: isProject 
                ? 'linear-gradient(135deg,#8b5cf6,#6366f1)' 
                : 'linear-gradient(135deg,#3b82f6,#06b6d4)',
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
                {isProject 
                  ? `协作项目 · ${selectedAgentIds.length}个智能体参与` 
                  : '单个任务 · 选择一个智能体'}
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
              placeholder="请输入任务标题"
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
              placeholder="请输入任务描述（可选）"
              style={{
                width: '100%', height: 60, padding: '10px 16px',
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
          <div style={{ marginBottom: 16 }}>
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

          {/* Agent Selection */}
          <div style={{ marginBottom: 8 }}>
            <label style={{
              fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7,
              display: 'block',
            }}>
              选择智能体<span style={{ color: '#ef4444' }}>*</span>
              <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400, marginLeft: 6 }}>
                选择2个及以上自动升级为项目
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
              {agents.map(agent => {
                const isSelected = selectedAgentIds.includes(agent.id);
                const ac = agent.color ?? '#6366f1';
                return (
                  <button
                    key={agent.id}
                    onClick={() => toggleAgent(agent.id)}
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
                  {isProject && '（已升级为项目）'}
                </span>
              </div>
            )}
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
            onClick={handleCreate}
            disabled={!title.trim() || selectedAgentIds.length === 0 || creating}
            style={{
              height: 40, padding: '0 28px', fontSize: 14, borderRadius: 8,
              border: 'none',
              background: isProject ? '#6366f1' : '#3b82f6',
              cursor: (!title.trim() || selectedAgentIds.length === 0 || creating) ? 'not-allowed' : 'pointer',
              color: '#fff', fontWeight: 600,
              fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
              opacity: (!title.trim() || selectedAgentIds.length === 0 || creating) ? 0.6 : 1,
              transition: 'background 0.15s, box-shadow 0.15s',
              boxShadow: isProject 
                ? '0 2px 8px rgba(99,102,241,0.25)' 
                : '0 2px 8px rgba(59,130,246,0.25)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
            onMouseEnter={e => {
              if (title.trim() && selectedAgentIds.length > 0 && !creating) {
                e.currentTarget.style.background = isProject ? '#4f46e5' : '#2563eb';
                e.currentTarget.style.boxShadow = isProject
                  ? '0 4px 12px rgba(79,70,229,0.35)'
                  : '0 4px 12px rgba(37,99,235,0.35)';
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = isProject ? '#6366f1' : '#3b82f6';
              e.currentTarget.style.boxShadow = isProject
                ? '0 2px 8px rgba(99,102,241,0.25)'
                : '0 2px 8px rgba(59,130,246,0.25)';
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
