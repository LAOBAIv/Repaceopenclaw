/**
 * useFileUpload
 *
 * 文件上传逻辑 hook：处理文件选择、base64 转换、上传到后端、
 * 加载已上传文件列表、上传进度/错误状态管理。
 */

import { useState, useCallback, useEffect } from 'react';
import filesApi, { type FileAsset } from '@/api/files';

export function useFileUpload(conversationId?: string) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<FileAsset[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  /* ── 加载已上传文件列表 ── */
  useEffect(() => {
    if (conversationId) {
      filesApi.list(undefined, conversationId).then(files => {
        setUploadedFiles(files);
      }).catch(err => {
        console.error('[useFileUpload:loadFiles]', err);
      });
    }
  }, [conversationId]);

  /* ── 文件上传处理 ── */
  const handleFileUpload = useCallback(async (file: File) => {
    if (!conversationId) {
      setUploadError('缺少会话 ID，无法上传');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setUploadError('文件大小超过 50MB 限制');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadProgress(`正在上传 ${file.name}...`);

    try {
      // 转换为 base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const uploaded = await filesApi.upload({
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            base64,
            conversationId,
          });
          setUploadedFiles(prev => [...prev, uploaded]);
          setUploadProgress(`${file.name} 上传成功`);
          setUploading(false);
          // 清除成功提示
          setTimeout(() => setUploadProgress(null), 3000);
        } catch (uploadErr: any) {
          console.error('[useFileUpload:upload]', uploadErr);
          setUploadError(uploadErr.message || '上传失败');
          setUploading(false);
          setUploadProgress(null);
        }
      };
      reader.onerror = () => {
        setUploadError('文件读取失败');
        setUploading(false);
        setUploadProgress(null);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('[useFileUpload:uploadOuter]', err);
      setUploadError(err.message || '上传失败');
      setUploading(false);
      setUploadProgress(null);
    }
  }, [conversationId]);

  return {
    uploading,
    uploadProgress,
    uploadedFiles,
    uploadError,
    handleFileUpload,
    setUploadedFiles,
    setUploadProgress,
    setUploadError,
  };
}
