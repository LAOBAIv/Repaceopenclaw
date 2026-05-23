/**
 * FileTransferPanel — 文件快传面板组件
 *
 * 职责：提供文件拖拽/点击上传、文件列表展示、文件删除等功能。
 * 使用 useFileTransfer hook 管理文件状态。
 */
import React from 'react';
import type { FileAsset } from '@/api/files';
// [2026-05-23] 从 pages/ProjectWorkspace/ 搬迁至 components/workspace/，消除跨目录引用
import { useFileTransfer } from './useFileTransfer';

const itemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 12px', borderRadius: 8, background: '#f9fafb',
  marginBottom: 7, fontSize: 13, color: '#374151', border: '1px solid #f0f0f0',
};

function formatFileSize(sizeBytes: number) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return '0 B';
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FileTransferPanel({ projectId, conversationId, onSend }: {
  projectId?: string; conversationId?: string; onSend?: (text: string) => void;
}) {
  const { uploadedFiles, dragOver, setDragOver, uploading, fileInputRef, uploadRealFile, removeFile } =
    useFileTransfer(projectId, conversationId, onSend);

  const dropZoneStyle: React.CSSProperties = {
    border: `2px dashed ${dragOver ? '#3b82f6' : '#d1d5db'}`, borderRadius: 10,
    padding: '28px 20px', textAlign: 'center', cursor: uploading ? 'wait' : 'pointer',
    background: dragOver ? '#f0f7ff' : 'transparent', transition: 'border-color 0.15s, background 0.15s',
    opacity: uploading ? 0.75 : 1,
  };

  return (
    <div>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.pdf,.docx,.md,.txt,.json"
        style={{ display: 'none' }}
        onChange={async (e) => { const file = e.target.files?.[0]; if (file) await uploadRealFile(file); e.currentTarget.value = ''; }} />
      <div style={dropZoneStyle}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#3b82f6'; (e.currentTarget as HTMLDivElement).style.background = '#f0f7ff'; }}
        onMouseLeave={e => { if (!dragOver) { (e.currentTarget as HTMLDivElement).style.borderColor = '#d1d5db'; (e.currentTarget as HTMLDivElement).style.background = 'transparent'; } }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={async e => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files?.[0]; if (file) await uploadRealFile(file); }}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" style={{ margin: '0 auto 8px', display: 'block', opacity: 0.6 }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{uploading ? '上传中...' : '点击或拖拽文件到此处'}</div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>支持 Excel、CSV、PDF、Word、TXT、Markdown、JSON，最大 50MB；项目可为空，后续再关联</div>
      </div>

      {uploadedFiles.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 8 }}>已上传文件（{uploadedFiles.length}）</div>
          {uploadedFiles.map((f) => (
            <FileItem key={f.id} file={f} onRemove={() => removeFile(f.id)} />
          ))}
        </div>
      )}
      {uploadedFiles.length === 0 && (
        <div style={{ textAlign: 'center', fontSize: 12, color: '#d1d5db', marginTop: 12 }}>暂无上传文件，项目可后续再关联</div>
      )}
    </div>
  );
}

function FileItem({ file, onRemove }: { file: FileAsset; onRemove: () => void }) {
  const ext = (file.extension || '').replace('.', '').toUpperCase() || 'FILE';
  return (
    <div style={{ ...itemStyle, marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 30, height: 30, borderRadius: 6, flexShrink: 0, background: 'linear-gradient(135deg,#3b82f6,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700 }}>{ext}</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{file.originalName}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{formatFileSize(file.sizeBytes)}</div>
        </div>
      </div>
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 12, lineHeight: 1, padding: '4px 6px', fontWeight: 500 }}
        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; }}>删除</button>
    </div>
  );
}
