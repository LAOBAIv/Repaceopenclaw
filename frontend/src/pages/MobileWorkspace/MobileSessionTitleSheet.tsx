/**
 * MobileSessionTitleSheet — 输入会话标题 Sheet
 *
 * 底部弹出面板，用户输入新会话标题后确认创建。
 * 显示已选智能体信息。
 */

import { X } from 'lucide-react';
import { COLORS } from './constants';

interface MobileSessionTitleSheetProps {
  selectedAgent: { id: string; name: string; color: string } | null;
  sessionTitle: string;
  onTitleChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function MobileSessionTitleSheet({
  selectedAgent,
  sessionTitle,
  onTitleChange,
  onClose,
  onConfirm,
}: MobileSessionTitleSheetProps) {
  return (
    <>
      {selectedAgent && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.6)',
          }}
        />
      )}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 301,
        background: COLORS.bgSecondary,
        borderRadius: '20px 20px 0 0',
        display: 'flex', flexDirection: 'column',
        transform: selectedAgent ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: selectedAgent ? 'auto' : 'none',
      }}>
        <div style={{
          height: 52, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.textPrimary }}>新建会话</div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: COLORS.bgTertiary, border: 'none', cursor: 'pointer', borderRadius: 10,
              color: COLORS.textSecondary,
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 已选智能体 */}
          {selectedAgent && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 12,
              background: COLORS.bgTertiary,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: selectedAgent.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 13, fontWeight: 600,
              }}>
                {selectedAgent.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.textPrimary }}>{selectedAgent.name}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>已选智能体</div>
              </div>
            </div>
          )}
          {/* 标题输入 */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 6, display: 'block' }}>
              会话标题
            </label>
            <input
              value={sessionTitle}
              onChange={e => onTitleChange(e.target.value)}
              placeholder={selectedAgent?.name || '请输入标题'}
              autoFocus
              style={{
                width: '100%', height: 44, padding: '0 14px',
                border: `1.5px solid ${COLORS.border}`,
                borderRadius: 10, fontSize: 14, outline: 'none',
                background: COLORS.bgTertiary, color: COLORS.textPrimary,
                boxSizing: 'border-box',
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') onConfirm();
              }}
            />
          </div>
          {/* 创建按钮 */}
          <button
            onClick={onConfirm}
            style={{
              height: 44, borderRadius: 12, border: 'none',
              background: COLORS.accent, color: '#fff',
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            创建会话
          </button>
        </div>
      </div>
    </>
  );
}
