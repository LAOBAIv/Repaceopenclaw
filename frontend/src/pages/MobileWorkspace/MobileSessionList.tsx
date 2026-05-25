/**
 * MobileSessionList — 会话列表内容（可复用）
 *
 * 渲染会话 tab 列表，支持重命名、关闭、切换等操作。
 * 被 MobileRightDrawer 和 sessions 视图复用。
 * 重命名状态由父组件（useMobileChat）统一管理。
 */

import { MessageSquare, Pencil, X } from 'lucide-react';
import { COLORS } from './constants';
import type { SessionTab } from '../../stores/conversation';

interface MobileSessionListProps {
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
  onSelectTab?: () => void;
}

export function MobileSessionList({
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
  onSelectTab,
}: MobileSessionListProps) {
  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {tabs.length === 0 ? (
          <div style={{
            padding: '24px 16px', textAlign: 'center',
            color: COLORS.textMuted, fontSize: 13,
          }}>
            <MessageSquare size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
            <div>暂无会话</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>点击右上角新建会话</div>
          </div>
        ) : (
          tabs.map((tab) => (
            <div
              key={tab.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '12px 16px',
                background: tab.id === activeTabId ? COLORS.accentLight : 'transparent',
                borderLeft: tab.id === activeTabId ? `3px solid ${COLORS.accent}` : '3px solid transparent',
              }}
            >
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: tab.color || COLORS.accent,
              }} />
              {renamingTabId === tab.id ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={e => onRenameValueChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') onFinishRename();
                    if (e.key === 'Escape') onCancelRename();
                  }}
                  onBlur={onFinishRename}
                  autoFocus
                  style={{
                    flex: 1, background: COLORS.bgTertiary, border: `1px solid ${COLORS.accent}`,
                    borderRadius: 6, padding: '6px 8px', fontSize: 13,
                    color: COLORS.textPrimary, outline: 'none',
                  }}
                />
              ) : (
                <button
                  onClick={() => {
                    onSwitchTab(tab.id);
                    onSelectTab?.();
                  }}
                  style={{
                    flex: 1, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer',
                  }}
                >
                  <div style={{
                    fontSize: 13, fontWeight: tab.id === activeTabId ? 600 : 400,
                    color: COLORS.textPrimary,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {tab.title}
                  </div>
                  {tab.agentName && (
                    <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                      {tab.agentName}
                    </div>
                  )}
                </button>
              )}
              {renamingTabId !== tab.id && tab.type !== 'wechat' && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => onStartRename(tab.id, tab.title)}
                    style={{
                      width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: COLORS.bgTertiary, border: 'none', cursor: 'pointer', borderRadius: 6,
                      color: COLORS.textSecondary,
                    }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => onCloseTab(tab.id)}
                    style={{
                      width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: COLORS.bgTertiary, border: 'none', cursor: 'pointer', borderRadius: 6,
                      color: COLORS.textMuted,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = COLORS.danger; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = COLORS.textMuted; e.currentTarget.style.background = COLORS.bgTertiary; }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              {tab.isStreaming && renamingTabId !== tab.id && (
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#10b981', flexShrink: 0,
                }} />
              )}
            </div>
          ))
        )}
      </div>

      <div style={{
        flexShrink: 0, padding: '12px 16px',
        borderTop: `1px solid ${COLORS.border}`,
        textAlign: 'center', fontSize: 11, color: COLORS.textMuted,
      }}>
        {tabs.length > 0 ? `${tabs.length} 个会话` : '无会话'} · {wsConnected ? '已连接' : '离线'}
      </div>
    </>
  );
}
