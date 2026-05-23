/**
 * ChatInput — 底部输入框组件
 *
 * 职责：渲染消息输入框、粘贴图片预览区、发送按钮、拖拽调整高度。
 * 支持 Enter 发送、Ctrl+Enter 换行、图片粘贴上传。
 */
import React from 'react';

/**
 * ChatInput — 消息输入区
 *
 * @param inputValue 输入框内容
 * @param onInputChange 输入变化回调
 * @param onKeyDown 键盘事件回调
 * @param onPaste 粘贴事件回调
 * @param onSend 发送回调
 * @param textareaRef textarea ref（用于高度调整和聚焦）
 * @param pastedImages 已粘贴的图片列表
 * @param onRemoveImage 移除图片回调
 */
export function ChatInput({
  inputValue,
  onInputChange,
  onKeyDown,
  onPaste,
  onSend,
  textareaRef,
  pastedImages,
  onRemoveImage,
}: {
  inputValue: string;
  onInputChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  pastedImages: { file: File; preview: string; uploading: boolean; url?: string }[];
  onRemoveImage: (idx: number) => void;
}) {
  return (
    <div className="input-container">
      {/* 拖拽调整高度条 */}
      <div
        className="resize-bar"
        onMouseDown={e => {
          e.preventDefault();
          const startY = e.clientY;
          const ta = textareaRef.current;
          if (!ta) return;
          const startH = ta.offsetHeight;
          const onMove = (ev: MouseEvent) => {
            const delta = startY - ev.clientY;
            // 最小高度 96px，最大 300px
            const newH = Math.min(300, Math.max(96, startH + delta));
            ta.style.height = newH + 'px';
          };
          const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        }}
      />
      {/* 粘贴图片预览区 */}
      {pastedImages.length > 0 && (
        <div style={{ display: 'flex', gap: 6, padding: '6px 8px', flexWrap: 'wrap' }}>
          {pastedImages.map((img, idx) => (
            <div key={idx} style={{ position: 'relative', width: 56, height: 56 }}>
              <img src={img.preview} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb' }} />
              {img.uploading && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10 }}>
                  上传中
                </div>
              )}
              <button
                onClick={() => onRemoveImage(idx)}
                style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none', fontSize: 10, cursor: 'pointer', lineHeight: '16px', padding: 0 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {/* 输入框 */}
      <textarea
        ref={textareaRef}
        className="main-input"
        value={inputValue}
        onChange={e => onInputChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        placeholder="输入消息，Enter 发送，Ctrl+Enter 换行，可粘贴图片"
      />
      {/* 发送按钮 */}
      <button className="send-btn" onClick={onSend} title="发送">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 11.5V2.5M7 2.5L3 6.5M7 2.5L11 6.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}
