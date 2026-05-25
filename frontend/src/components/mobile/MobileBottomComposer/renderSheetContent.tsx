/**
 * 移动端底部输入区组件 - Sheet 内容渲染
 *
 * 根据当前选中的功能 tab，渲染对应的面板内容（快捷指令、技能应用、定时任务、
 * 多智能体、文件快传、任务标签等）。
 */

import React from 'react';
import {
  ShortcutPanel,
  SkillPanel,
  SchedulePanel,
  TaskTagPanel,
} from '@/components/workspace';
import { MobileMultiAgentPanel } from './MobileMultiAgentPanel';
import type { FileAsset } from '@/api/files';
import { styles } from './styles';

/**
 * 根据 tab 名称渲染对应的 Sheet 面板内容
 */
export function renderSheetContent(
  tab: string | null,
  onInject: (text: string) => void,
  onSend: (text: string) => void,
  conversationId?: string,
  taskName?: string,
  fileInputRef?: React.RefObject<HTMLInputElement>,
  onFileUpload?: (file: File) => void,
  uploading?: boolean,
  uploadProgress?: string | null,
  uploadError?: string | null,
  uploadedFiles?: FileAsset[],
  agents?: Array<{ id: string; name: string; color?: string }>, // [2026-05-24] 类型安全
  currentAgentId?: string,
  currentAgentIds?: string[],
  collabNodesInternal?: Array<{ id: string; name: string; nodeType: 'serial' | 'parallel'; agentIds: string[]; desc?: string }>, // [2026-05-24] 类型安全
  setCollabNodesInternal?: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string; nodeType: 'serial' | 'parallel'; agentIds: string[]; desc?: string }>>>, // [2026-05-24] 类型安全
  isProject?: boolean,
  onSwitchAgent?: (agentId: string, agentName: string, agentColor: string) => void,
) {
  switch (tab) {
    case '快捷指令':
      return <ShortcutPanel taskName={taskName} onInject={onInject} />;

    case '技能应用':
      return <SkillPanel taskName={taskName} onInject={onInject} />;

    case '定时任务':
      return (
        <SchedulePanel
          onFillInput={onInject}
          onSend={(text) => {
            onInject(text);
            setTimeout(() => onSend(text), 50);
          }}
        />
      );

    case '多智能体':
      return (
        <MobileMultiAgentPanel
          agents={agents || []}
          currentAgentId={currentAgentId}
          currentAgentIds={currentAgentIds}
          collabNodes={collabNodesInternal}
          setCollabNodes={setCollabNodesInternal}
          isProject={isProject}
          onInject={onInject}
          onSwitchAgent={onSwitchAgent}
        />
      );

    case '文件快传':
      return (
        <div style={{ padding: '4px 0' }}>
          {/* 上传入口 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.pdf,.docx,.md,.txt,.json,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && onFileUpload) {
                onFileUpload(file);
              }
              e.target.value = '';
            }}
          />
          {/* 上传状态提示 */}
          {uploadProgress && (
            <div style={{
              padding: '12px 16px', marginBottom: 12,
              background: '#262626', borderRadius: 8,
              fontSize: 13, color: '#6366f1', textAlign: 'center',
            }}>
              {uploadProgress}
            </div>
          )}
          {uploadError && (
            <div style={{
              padding: '12px 16px', marginBottom: 12,
              background: 'rgba(239,68,68,0.1)', borderRadius: 8,
              fontSize: 13, color: '#ef4444', textAlign: 'center',
            }}>
              {uploadError}
            </div>
          )}
          {/* 上传按钮 */}
          <div
            style={styles.uploadArea}
            onClick={() => !uploading && fileInputRef?.current?.click()}
          >
            {uploading ? (
              <div style={{ textAlign: 'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" style={{ marginBottom: 8, animation: 'spin 1s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                <div style={{ fontSize: 13, color: '#a3a3a3', fontWeight: 500 }}>上传中...</div>
              </div>
            ) : (
              <>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" style={{ marginBottom: 8 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div style={{ fontSize: 13, color: '#a3a3a3', fontWeight: 500 }}>点击选择文件</div>
                <div style={{ fontSize: 12, color: '#737373', marginTop: 4 }}>支持图片、Excel、PDF、Word、TXT、JSON，最大 50MB</div>
              </>
            )}
          </div>
          {/* 已上传文件列表 */}
          {uploadedFiles && uploadedFiles.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: '#737373', marginBottom: 8 }}>已上传文件</div>
              {uploadedFiles.map(f => (
                <div key={f.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', marginBottom: 6,
                  background: '#262626', borderRadius: 8,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <div style={{ flex: 1, fontSize: 13, color: '#f5f5f5' }}>{f.originalName}</div>
                  <div style={{ fontSize: 11, color: '#737373' }}>{Math.round(f.sizeBytes / 1024)} KB</div>
                </div>
              ))}
            </div>
          )}
          {/* [2026-05-19] 从历史文件添加入口 */}
          <div
            onClick={() => {
              const win = window as typeof window & { __showFileHistory?: () => void };
              if (win.__showFileHistory) {
                win.__showFileHistory();
              }
            }}
            style={{ marginTop: 14, padding: '10px 0', textAlign: 'center', cursor: 'pointer', borderTop: '1px dashed #404040', fontSize: 13, color: '#6366f1', fontWeight: 500 }}
          >
            📂 从历史文件添加
          </div>
        </div>
      );

    case '任务标签':
      return (
        <TaskTagPanel
          conversationId={conversationId}
          taskName={taskName}
        />
      );

    default:
      return (
        <div style={styles.placeholderContent}>
          <p style={{ fontSize: 13, color: '#737373' }}>功能开发中...</p>
        </div>
      );
  }
}
