import React, { useState, useRef, useEffect } from 'react';
import { showToast } from '@/components/Toast';
import filesApi, { type FileAsset } from '@/api/files';
import { FileHistoryModal } from '@/components/workspace/FileHistoryModal';
import { SkillPanel } from './SkillPanel';
import { SchedulePanel } from './SchedulePanel';
import { ShortcutPanel } from './ShortcutPanel';
import { TaskTagPanel } from './TaskTagPanel';
import { AgentPanel, type FlowNode } from './AgentPanel';
import { TAB_META, CHANNEL_LIST } from './constants';
import type { Agent, ConversationPanel } from '@/types';
import type { Task } from '@/stores/taskStore';
import type { KanbanProject } from '@/stores/projectKanbanStore';

export function TabPanel({
  tab, onClose,
  agents, tasks, taskName,
  onInject, onSend,
  matchedProject,
  incomingAgentNames,
  openPanels,
  activePanelId,
  onSwitchPanel,
  onOpenAgentPanel,
  onSwitchAgentInSession,
  onCloseAgentPanel,
  currentProjectId,
  collabNodes,
  setCollabNodes,
  isProject,
  participatingAgentNames,
  onUpgradeToProject,
  onDowngradeToTask,
}: {
  tab: string;
  onClose: () => void;
  agents?: Agent[];
  tasks?: Task[];
  taskName?: string;
  onInject?: (text: string) => void;
  onSend?: (text: string) => void;
  matchedProject?: KanbanProject | null;
  /** 来自看板跳转的智能体名称列表，透传给 AgentPanel 使用 */
  incomingAgentNames?: string[];
  openPanels: ConversationPanel[];
  activePanelId: string | null;
  onSwitchPanel: (panelId: string) => void;
  onOpenAgentPanel: (agentId: string, agentName: string, agentColor: string, initialMessage?: string) => void;
  onSwitchAgentInSession: (agentId: string, agentName: string, agentColor: string) => void;
  onCloseAgentPanel: (panelId: string) => void;
  currentProjectId?: string;
  /** 协作流程节点（持久化，由外层维护） */
  collabNodes: FlowNode[];
  setCollabNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  /** 当前是项目（true）还是任务（false），控制协作 Tab 的显示 */
  isProject: boolean;
  /** 当前参与会话的智能体名称列表 */
  participatingAgentNames?: string[];
  /** 任务升级为项目回调 */
  onUpgradeToProject?: (newAgentNames: string[]) => void;
  /** 项目降级为任务回调 */
  onDowngradeToTask?: (keptAgentName: string) => void;
}) {
  /* 根据activePanelId推导当前激活的panel */
  const activePanel = (activePanelId ? openPanels.find(p => p.id === activePanelId) : null) ?? openPanels[0] ?? null;

  /* 文件快传状态（项目级关联） */
  const [uploadedFiles, setUploadedFiles] = useState<FileAsset[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showFileHistory, setShowFileHistory] = useState(false);

  async function loadProjectFiles() {
    try {
      const rows = await filesApi.list(currentProjectId || '', activePanel?.conversationId || '');
      setUploadedFiles(rows);
    } catch (e) {
      console.error('[loadProjectFiles]', e);
    }
  }

  async function uploadRealFile(file: File) {
    setUploading(true);
    try {
      const conversationId = activePanel?.conversationId || '';
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      await filesApi.upload({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64,
        projectId: currentProjectId || '',
        conversationId,
      });
      await loadProjectFiles();
      showToast('文件上传成功，正在触发智能体初步分析', 'success');

      if (conversationId && onSend) {
        try {
          const prompt = await filesApi.getAutoAnalysisPrompt(conversationId);
          if (prompt.trim()) {
            onSend(prompt);
          }
        } catch (analysisError) {
          console.error('[uploadRealFile:autoAnalysis]', analysisError);
        }
      }
    } catch (e: any) {
      console.error('[uploadRealFile]', e);
      showToast(e?.response?.data?.error?.message || '文件上传失败', 'error');
    } finally {
      setUploading(false);
    }
  }

  /* 智能体状态映射 */
  const agentStatusMap: Record<string, { label: string; color: string }> = {
    active: { label: '在线', color: '#22c55e' },
    idle:   { label: '空闲', color: '#3b82f6' },
    busy:   { label: '忙碌', color: '#f59e0b' },
  };

  useEffect(() => {
    void loadProjectFiles();
  }, [currentProjectId, activePanel?.conversationId]);

  const meta = TAB_META[tab] ?? {
    gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    subtitle: '',
    icon: <svg width="19" height="19" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="white" strokeWidth="1.4"/></svg>,
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 12px', borderRadius: 8, background: '#f9fafb',
    marginBottom: 7, fontSize: 13, color: '#374151',
    border: '1px solid #f0f0f0',
  };

  function formatFileSize(sizeBytes: number) {
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return '0 B';
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
    return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
  }
  const badgeStyle = (color: string): React.CSSProperties => ({
    fontSize: 11, padding: '2px 8px', borderRadius: 4,
    background: color + '18', color,
  });

  return (
    /* 遮罩层 */
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
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
      {/* 弹窗主体 */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
          width: 660,
          maxWidth: 'calc(100vw - 32px)',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
          animation: 'tabPanelModalIn 0.2s cubic-bezier(0.34,1.4,0.64,1)',
          overflow: 'clip',
          marginBottom: 32,
        }}
      >
        {/* ── 头部 ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '22px 28px 18px',
          borderBottom: '1px solid #f0f0f0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: meta.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {meta.icon}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a202c', lineHeight: 1.3 }}>
                {tab}
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 3, lineHeight: 1.4 }}>
                {meta.subtitle}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
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

        {/* ── 内容区 ── */}
        <div style={{ padding: '20px 28px', maxHeight: '70vh', overflowY: 'auto' }}>

          {tab === '消息渠道' && (
            <div>
              {CHANNEL_LIST.map(ch => (
                <div key={ch.name} style={itemStyle}>
                  <span style={{ fontWeight: 500 }}>{ch.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={badgeStyle(ch.color)}>{ch.status}</span>
                    <button style={{
                      fontSize: 12, padding: '4px 14px', borderRadius: 6,
                      border: '1.5px solid #e5e7eb', background: '#fff',
                      cursor: 'pointer', color: '#374151',
                      fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                    }}>连接</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === '快捷指令' && (
            <ShortcutPanel
              taskName={taskName}
              onInject={text => { if (onInject) { onInject(text); onClose(); } }}
            />
          )}

          {tab === '文件快传' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,.docx,.md,.txt,.json,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await uploadRealFile(file);
                  e.currentTarget.value = '';
                }}
              />
              <div
                style={{
                  border: `2px dashed ${dragOver ? '#3b82f6' : '#d1d5db'}`,
                  borderRadius: 10, padding: '28px 20px',
                  textAlign: 'center', cursor: uploading ? 'wait' : 'pointer',
                  background: dragOver ? '#f0f7ff' : 'transparent',
                  transition: 'border-color 0.15s, background 0.15s',
                  opacity: uploading ? 0.75 : 1,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#3b82f6'; (e.currentTarget as HTMLDivElement).style.background = '#f0f7ff'; }}
                onMouseLeave={e => { if (!dragOver) { (e.currentTarget as HTMLDivElement).style.borderColor = '#d1d5db'; (e.currentTarget as HTMLDivElement).style.background = 'transparent'; } }}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={async e => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) await uploadRealFile(file);
                }}
                onClick={() => !uploading && fileInputRef.current?.click()}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" style={{ margin: '0 auto 8px', display: 'block', opacity: 0.6 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{uploading ? '上传中...' : '点击或拖拽文件到此处'}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>支持图片、Excel、CSV、PDF、Word、TXT、Markdown、JSON，最大 50MB</div>
              </div>
              {uploadedFiles.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 8 }}>
                    已上传文件（{uploadedFiles.length}）
                  </div>
                  {uploadedFiles.map((f) => (
                    <div key={f.id} style={{ ...itemStyle, marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 6, flexShrink: 0,
                          background: 'linear-gradient(135deg,#3b82f6,#06b6d4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, color: '#fff', fontWeight: 700,
                        }}>{(f.extension || '').replace('.', '').toUpperCase() || 'FILE'}</div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{f.originalName}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{formatFileSize(f.sizeBytes)}</div>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await filesApi.remove(f.id);
                            await loadProjectFiles();
                          } catch (e) {
                            console.error('[removeProjectFile]', e);
                            showToast('删除文件失败', 'error');
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#9ca3af',
                          fontSize: 12,
                          lineHeight: 1,
                          padding: '4px 6px',
                          fontWeight: 500,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; }}
                      >删除</button>
                    </div>
                  ))}
                </div>
              )}
              {uploadedFiles.length === 0 && (
                <div style={{ textAlign: 'center', fontSize: 12, color: '#d1d5db', marginTop: 12 }}>
                  暂无上传文件，项目可后续再关联
                </div>
              )}
              {/* [2026-05-19] 从历史文件添加 */}
              <div
                onClick={() => setShowFileHistory(true)}
                style={{ marginTop: 14, padding: '10px 0', textAlign: 'center', cursor: 'pointer', borderTop: '1px dashed #e5e7eb', fontSize: 13, color: '#3b82f6', fontWeight: 500 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f0f7ff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                📂 从历史文件添加
              </div>
              <FileHistoryModal
                visible={showFileHistory}
                onClose={() => setShowFileHistory(false)}
                excludeIds={uploadedFiles.map(f => f.id)}
                onConfirm={async (fileIds) => {
                  const convId = activePanel?.conversationId || '';
                  if (!convId) return;
                  for (const fid of fileIds) {
                    await filesApi.associate(fid, convId).catch(() => {});
                  }
                  await loadProjectFiles();
                  showToast(`已添加 ${fileIds.length} 个文件到当前会话`, 'success');
                }}
              />
            </div>
          )}

          {tab === '技能应用' && (
            <SkillPanel
              taskName={taskName}
              onInject={text => { if (onInject) { onInject(text); onClose(); } }}
            />
          )}

          {tab === '定时任务' && (
            <SchedulePanel
              onFillInput={text => { if (onInject) { onInject(text); onClose(); } }}
              onSend={text => { if (onSend) { onSend(text); onClose(); } }}
            />
          )}

          {tab === '多智能体' && (
            <AgentPanel
              agents={agents}
              agentStatusMap={agentStatusMap}
              taskName={taskName}
              matchedProject={matchedProject}
              incomingAgentNames={incomingAgentNames}
              openPanels={openPanels}
              activePanelId={activePanelId}
              onSwitchPanel={panelId => { onSwitchPanel(panelId); onClose(); }}
              onOpenPanel={(agentId, agentName, agentColor, initialMessage) => { onOpenAgentPanel(agentId, agentName, agentColor, initialMessage); onClose(); }}
              onSwitchAgent={(agentId, agentName, agentColor) => { onSwitchAgentInSession(agentId, agentName, agentColor); onClose(); }}
              onClosePanel={onCloseAgentPanel}
              currentProjectId={currentProjectId}
              onInject={text => { if (onInject) { onInject(text); onClose(); } }}
              collabNodes={collabNodes}
              setCollabNodes={setCollabNodes}
              isProject={isProject}
              participatingAgentNames={participatingAgentNames}
              onUpgradeToProject={onUpgradeToProject}
              onDowngradeToTask={onDowngradeToTask}
            />
          )}

          {tab === '任务标签' && <TaskTagPanel conversationId={activePanel?.conversationId} taskName={taskName} />}

        </div>


      </div>

      <style>{`
        @keyframes tabPanelModalIn {
          from { opacity: 0; transform: scale(0.9) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
