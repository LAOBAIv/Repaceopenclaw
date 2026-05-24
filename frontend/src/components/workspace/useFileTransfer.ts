/**
 * useFileTransfer — 文件快传逻辑 Hook
 *
 * 封装项目文件列表加载、文件上传、文件删除等操作。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import filesApi, { type FileAsset } from '@/api/files';
import { showToast } from '@/components/Toast';

export function useFileTransfer(projectId?: string, conversationId?: string, onSend?: (text: string) => void) {
  const [uploadedFiles, setUploadedFiles] = useState<FileAsset[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadProjectFiles = useCallback(async () => {
    try {
      const rows = await filesApi.list(projectId || '', conversationId || '');
      setUploadedFiles(rows);
    } catch (e) { console.error('[loadProjectFiles]', e); }
  }, [projectId, conversationId]);

  const uploadRealFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      await filesApi.upload({
        fileName: file.name, mimeType: file.type || 'application/octet-stream',
        base64, projectId: projectId || '', conversationId: conversationId || '',
      });
      await loadProjectFiles();
      showToast('文件上传成功，正在触发智能体初步分析', 'success');
      if (conversationId && onSend) {
        try {
          const prompt = await filesApi.getAutoAnalysisPrompt(conversationId);
          if (prompt.trim()) onSend(prompt);
        } catch (analysisError) { console.error('[uploadRealFile:autoAnalysis]', analysisError); }
      }
    } catch (e: unknown) { // [2026-05-24] 类型安全
      console.error('[uploadRealFile]', e);
      showToast((e as any)?.response?.data?.error?.message || '文件上传失败', 'error');
    } finally { setUploading(false); }
  }, [projectId, conversationId, onSend, loadProjectFiles]);

  const removeFile = useCallback(async (fileId: string) => {
    try {
      await filesApi.remove(fileId);
      await loadProjectFiles();
    } catch (e) { console.error('[removeProjectFile]', e); showToast('删除文件失败', 'error'); }
  }, [loadProjectFiles]);

  useEffect(() => { void loadProjectFiles(); }, [loadProjectFiles]);

  return { uploadedFiles, dragOver, setDragOver, uploading, fileInputRef, uploadRealFile, removeFile };
}
