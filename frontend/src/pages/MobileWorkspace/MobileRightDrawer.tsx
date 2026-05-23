/**
 * MobileRightDrawer — 移动端右侧抽屉（会话 Tab 列表）
 *
 * 对应PC端会话界面顶部tab，包含会话列表和新建会话按钮。
 */

import { X, Plus } from 'lucide-react';
import { COLORS } from './constants';
import { MobileSessionList } from './MobileSessionList';
import type { SessionTab } from '../../stores/conversationStore';

interface MobileRightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNewSession: () => void;
  tabs: SessionTab[];
  activeTabId: string | null;
  wsConnected: boolean;
  renamingTabId: string | null;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onStartRename: (tabId: string, currentTitle: string) => void;
  onFinishRename: () => void;
  onCancelRename: () => void;
  onRenameValueChange: (v: string) => void;
}

export function MobileRightDrawer({
  isOpen,
  onClose,
  onNewSession,
  tabs,
  activeTabId,
  wsConnected,
  renamingTabId,
  renameValue,
  renameInputRef,
  onSwitchTab,
  onCloseTab,
  onStartRename,
  onFinishRename,
  onCancelRename,
  onRenameValueChange,
}: MobileRightDrawerProps) {
  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.5)',
          }}
        />
      )}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '75vw', maxWidth: 280, zIndex: 101,
        background: 'linear-gradient(180deg, #1f1f23 0%, #0f0f13 100%)',
        borderLeft: 'none',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* 右抽屉 Header */}
        <div style={{
          height: 52, flexShrink: 0,
          display: 'flex', alignItems: 'center',
          padding: '0 16px', gap: 12,
          background: COLORS.bgSecondary,
          borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: COLORS.bgTertiary, border: 'none', cursor: 'pointer',
              color: COLORS.textSecondary, borderRadius: 10,
            }}
          >
            <X size={18} />
          </button>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: COLORS.textPrimary }}>
            会话
          </div>
          {/* 新建会话按钮 */}
          <button
            onClick={onNewSession}
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: COLORS.accentLight, border: 'none', cursor: 'pointer',
              color: COLORS.accent, borderRadius: 10,
            }}
          >
            <Plus size={16} />
          </button>
        </div>

        {/* 右抽屉 Body — 会话 Tab 列表 */}
        <MobileSessionList
          tabs={tabs}
          activeTabId={activeTabId}
          wsConnected={wsConnected}
          renamingTabId={renamingTabId}
          renameValue={renameValue}
          renameInputRef={renameInputRef}
          onSwitchTab={onSwitchTab}
          onCloseTab={onCloseTab}
          onStartRename={onStartRename}
          onFinishRename={onFinishRename}
          onCancelRename={onCancelRename}
          onRenameValueChange={onRenameValueChange}
          onSelectTab={onClose}
        />
      </div>
    </>
  );
}
