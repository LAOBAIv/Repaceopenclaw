/**
 * 新建标签 → 创建新会话弹窗
 * 收集任务名 + 选择智能体 → 创建项目/会话 → AI生成概述
 */
import { useState } from 'react';
import { showToast } from '@/components/Toast';
import { useAgentStore } from '@/stores/agentStore';
import { useConversationStore } from '@/stores/conversationStore';
import { useProjectKanbanStore } from '@/stores/projectKanbanStore';
import { conversationsApi } from '@/api/conversations';
import { sessionTabsApi } from '@/api/sessionTabs';

interface TagSessionModalProps {
  open: boolean;
  tag: string;
  onClose: () => void;
  onCreated: (convId: string) => void;
}

export function TagSessionModal({ open, tag, onClose, onCreated }: TagSessionModalProps) {
  const [taskName, setTaskName] = useState(tag || '');
  const [description, setDescription] = useState('');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const { agents } = useAgentStore();
  const { addProject: addKanbanProject } = useProjectKanbanStore();
  const conversationStore = useConversationStore();

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
    if (!taskName.trim()) {
      showToast('请输入任务名称', 'warning');
      return;
    }
    if (selectedAgentIds.length === 0) {
      showToast('请至少选择一个智能体', 'warning');
      return;
    }

    setCreating(true);
    try {
      const selectedAgents = agents.filter(a => selectedAgentIds.includes(a.id));
      const mainAgent = selectedAgents[0];

      // 1. 通过后端新建会话 + AI 生成概述
      const result = await conversationsApi.createWithOverview({
        title: taskName.trim(),
        agentIds: selectedAgentIds,
        description: description.trim() || undefined,
      });

      const convId = result.id;

      // 2. 在看板 store 创建项目记录
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const projectId = `proj_${Date.now()}`;

      const participantAgents = selectedAgents.map(a => ({
        name: a.name,
        color: a.color ?? '#6366f1',
      }));

      addKanbanProject({
        id: projectId,
        title: taskName.trim(),
        description: description.trim(),
        tags: [tag, isProject ? '项目' : '任务', `tid_${Date.now()}`],
        priority: 'low',
        agent: mainAgent.name,
        agentColor: mainAgent.color ?? '#6366f1',
        agents: participantAgents,
        progress: 0,
        dueDate: `${mm}/${dd}`,
        updatedAt: '刚刚',
        taskCount: 1,
        memberCount: selectedAgentIds.length,
      }, 'progress');

      // 3. 创建前端 Panel（直接 setState，绕过 openPanel 复用逻辑）
      const panel = {
        id: convId,
        conversationId: convId,
        sessionCode: result.sessionCode,
        agentId: result.currentAgentId || mainAgent.id,
        currentAgentCode: result.currentAgentCode,
        agentIds: result.agentIds?.length ? result.agentIds : selectedAgentIds,
        agentName: mainAgent.name,
        agentColor: mainAgent.color ?? '#6366f1',
        messages: result.messages || [],
        isStreaming: false,
      };
      const current = useConversationStore.getState();
      useConversationStore.setState({
        openPanels: [...current.openPanels, panel],
      });

      // 4. 新建 BrowserTab 并切换
      const tabKey = convId;
      const newTab = {
        key: tabKey,
        title: taskName.trim(),
        conversationId: convId,
        agentId: mainAgent.id,
        agentName: mainAgent.name,
        color: mainAgent.color ?? '#6366f1',
      };

      // 通过回调通知外层更新 browserTabs + activeBrowserTabKey + activePanelId
      onCreated(convId);

      // 5. 同步到后端 sessionTabs 绑定
      sessionTabsApi.upsert({
        browser_tab_key: tabKey,
        title: taskName.trim(),
        conversation_id: convId,
        agent_id: mainAgent.id,
        agent_name: mainAgent.name,
        color: mainAgent.color ?? '#6366f1',
      }).catch(() => {});

      showToast(`${isProject ? '项目' : '任务'}创建成功，AI 概述已生成`, 'success');
      onClose();
    } catch (err: any) {
      console.error('[TagSessionModal] 创建失败:', err);
      showToast('创建失败：' + (err?.response?.data?.error || err?.message || '未知错误'), 'error');
    } finally {
      setCreating(false);
    }
  }

  function resetAndClose() {
    setTaskName(tag || '');
    setDescription('');
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
        zIndex: 1100,
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
          width: 540,
          maxWidth: 'calc(100vw - 32px)',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
          animation: 'tagSessionModalIn 0.2s cubic-bezier(0.34,1.4,0.64,1)',
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
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a202c', lineHeight: 1.3 }}>
                新建{isProject ? '项目' : '任务'}会话
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 3, lineHeight: 1.4 }}>
                标签：<span style={{
                  display: 'inline-block', padding: '1px 8px', borderRadius: 10,
                  background: '#ede9fe', color: '#6d28d9', fontSize: 11, fontWeight: 600,
                }}>{tag}</span>
                {isProject ? ` · ${selectedAgentIds.length}个智能体协作` : ''}
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
        <div style={{ padding: '24px 28px', maxHeight: '60vh', overflowY: 'auto' }}>
          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 2,
              fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7,
            }}>
              任务名称<span style={{ color: '#ef4444', fontSize: 13, lineHeight: 1, marginLeft: 2 }}>*</span>
            </label>
            <input
              value={taskName}
              onChange={e => setTaskName(e.target.value)}
              placeholder="请输入任务名称"
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
              任务描述
              <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400, marginLeft: 4 }}>（可选，将用于生成 AI 概述）</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="简要描述任务目标（可选）"
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

          {/* Agent Selection */}
          <div style={{ marginBottom: 8 }}>
            <label style={{
              fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7,
              display: 'block',
            }}>
              选择智能体<span style={{ color: '#ef4444' }}>*</span>
              <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400, marginLeft: 6 }}>
                选择2个及以上自动升级为项目协作
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
              {agents.length === 0 ? (
                <div style={{ fontSize: 12, color: '#9ca3af', padding: '8px 0' }}>暂无可用智能体</div>
              ) : agents.map(agent => {
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
                  {isProject && '（项目协作模式）'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
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
            disabled={!taskName.trim() || selectedAgentIds.length === 0 || creating}
            style={{
              height: 40, padding: '0 28px', fontSize: 14, borderRadius: 8,
              border: 'none',
              background: isProject ? '#6366f1' : '#3b82f6',
              cursor: (!taskName.trim() || selectedAgentIds.length === 0 || creating) ? 'not-allowed' : 'pointer',
              color: '#fff', fontWeight: 600,
              fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
              opacity: (!taskName.trim() || selectedAgentIds.length === 0 || creating) ? 0.6 : 1,
              transition: 'background 0.15s, box-shadow 0.15s',
              boxShadow: isProject
                ? '0 2px 8px rgba(99,102,241,0.25)'
                : '0 2px 8px rgba(59,130,246,0.25)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
            onMouseEnter={e => {
              if (taskName.trim() && selectedAgentIds.length > 0 && !creating) {
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
              <>创建并生成概述</>
            )}
          </button>
        </div>

        <style>{`
          @keyframes tagSessionModalIn {
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
