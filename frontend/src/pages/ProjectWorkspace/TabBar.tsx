/**
 * TabBar — 浏览器风格多标签栏组件
 *
 * 职责：渲染浏览器风格的多标签页，支持点击切换、双击重命名、关闭、新增标签页。
 * 微信助手 Tab 有特殊处理逻辑。模型切换下拉通过 Portal 渲染。
 */
import React from 'react';
import { createPortal } from 'react-dom';

// [2026-05-24] 类型安全
interface TabItem {
  id: string;
  type: string;
  title: string;
  panelId: string | null;
  color?: string;
  agentId?: string;
}

/**
 * TabBar — 浏览器风格多标签栏
 *
 * @param allTabs 所有标签页列表
 * @param storeActiveId 当前激活的 Tab ID
 * @param editingTabId 正在编辑的 Tab ID
 * @param editingTabTitle 编辑中的标题（由父组件管理）
 * @param onEditingTitleChange 编辑标题变化回调
 * @param showModelDropdown 是否显示模型下拉
 * @param modelDropdownTabId 模型下拉对应的 Tab ID
 * @param modelDropdownRef 模型下拉 ref
 * @param availableModels 可用模型列表
 * @param agents 智能体列表
 * @param onTabClick Tab 点击回调
 * @param onTabClose Tab 关闭回调
 * @param onRenameStart 开始重命名回调 (tabId, title)
 * @param onRenameConfirm 重命名确认回调 (tabId, newTitle)
 * @param onRenameCancel 重命名取消回调
 * @param onAddTab 新增 Tab 回调
 * @param onModelDropdownClose 关闭模型下拉回调
 * @param onSwitchModel 切换模型回调 (tabId, modelId)
 * @param onWechatTabClick 微信助手 Tab 点击回调
 */
export function TabBar({
  allTabs,
  storeActiveId,
  editingTabId,
  editingTabTitle,
  onEditingTitleChange,
  showModelDropdown,
  modelDropdownTabId,
  modelDropdownRef,
  availableModels,
  agents,
  onTabClick,
  onTabClose,
  onRenameStart,
  onRenameConfirm,
  onRenameCancel,
  onAddTab,
  onModelDropdownClose,
  onSwitchModel,
  onWechatTabClick,
}: {
  allTabs: TabItem[]; // [2026-05-24] 类型安全
  storeActiveId: string | null;
  editingTabId: string | null;
  editingTabTitle: string;
  onEditingTitleChange: (v: string) => void;
  showModelDropdown: boolean;
  modelDropdownTabId: string | null;
  modelDropdownRef: React.RefObject<HTMLDivElement | null>;
  availableModels: { id: string; label: string; provider: string }[];
  agents: { id: string; modelName?: string; name?: string; color?: string }[]; // [2026-05-24] 类型安全
  onTabClick: (tab: TabItem) => void; // [2026-05-24] 类型安全
  onTabClose: (tabId: string) => void;
  onRenameStart: (tabId: string, title: string) => void;
  onRenameConfirm: (tabId: string, newTitle: string) => void;
  onRenameCancel: () => void;
  onAddTab: () => void;
  onModelDropdownClose: () => void;
  onSwitchModel: (tabId: string, modelId: string) => void;
  onWechatTabClick: () => void;
}) {
  return (
    <>
      <div className="workspace-tabbar" style={{ display: 'flex', alignItems: 'flex-end', minHeight: 46, padding: '0', flexShrink: 0, overflowX: 'auto', gap: 4, background: '#fafbfc', boxSizing: 'border-box' }}>
        {allTabs.map((tab) => {
          const isActive = tab.id === storeActiveId;
          const hasSession = tab.type === 'session' && !!tab.panelId;
          const hasPanel = !!tab.panelId;
          const isEditing = editingTabId === tab.id;

          return (
            <div
              key={tab.id}
              className="workspace-tab"
              onClick={() => {
                if (tab.id === 'wechat') {
                  onWechatTabClick();
                  return;
                }
                onTabClick(tab);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: isActive ? '14px 20px 10px' : '12px 18px 10px',
                background: isActive ? '#fff' : 'transparent',
                borderRadius: '8px 8px 0 0',
                border: isActive ? '1px solid #e5e7eb' : '1px solid transparent',
                borderBottom: 'none',
                cursor: 'pointer', minWidth: 120, flexShrink: 0,
                color: isActive ? '#1f2937' : '#6b7280',
                fontSize: 14, fontWeight: isActive ? 600 : 500,
                transition: 'all 0.2s ease',
                boxShadow: isActive ? '0 -2px 8px rgba(0,0,0,0.06)' : 'none',
                position: 'relative',
                marginBottom: isActive ? -3 : -1,
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = '#f3f4f6';
                  e.currentTarget.style.color = '#374151';
                  e.currentTarget.style.boxShadow = '0 -2px 8px rgba(0,0,0,0.06)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              {/* 会话状态指示器 */}
              {(hasSession || hasPanel) ? (
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: tab.color || '#6366f1',
                  boxShadow: `0 0 6px ${tab.color || '#6366f1'}66`,
                }} />
              ) : (
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: '#d1d5db',
                }} />
              )}

              {isEditing && tab.type !== 'wechat' ? (
                <input
                  type="text"
                  value={editingTabTitle}
                  onChange={(e) => onEditingTitleChange(e.target.value)}
                  onBlur={() => {
                    if (editingTabTitle.trim()) onRenameConfirm(tab.id, editingTabTitle.trim());
                    else onRenameCancel();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editingTabTitle.trim()) {
                      onRenameConfirm(tab.id, editingTabTitle.trim());
                    }
                    if (e.key === 'Escape') onRenameCancel();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  style={{
                    border: 'none', outline: 'none', background: 'transparent',
                    fontSize: 14, fontWeight: 'inherit', color: 'inherit',
                    width: 120, padding: 0, fontFamily: 'inherit',
                  }}
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    // 微信助手标题不允许修改
                    if (tab.type === 'wechat') return;
                    e.stopPropagation();
                    onRenameStart(tab.id, tab.title);
                  }}
                  className="workspace-tab-title"
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}
                  title={tab.type === 'wechat' ? '' : '双击重命名'}
                >{tab.title}</span>
              )}
              {tab.type !== 'home' && tab.id !== 'wechat' && (
                <span
                  className="workspace-tab-close"
                  onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 6, opacity: 0.4, cursor: 'pointer', transition: 'all 0.15s', marginLeft: 4 }}
                  onMouseEnter={(e) => { e.stopPropagation(); e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.4'; e.currentTarget.style.color = 'inherit'; }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                </span>
              )}
            </div>
          );
        })}
        <button
          className="workspace-tab-add"
          onClick={onAddTab}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'transparent', border: '1px dashed #d1d5db', borderRadius: 8, cursor: 'pointer', color: '#9ca3af', flexShrink: 0, transition: 'all 0.2s', marginBottom: 4 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; e.currentTarget.style.color = '#6b7280'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#9ca3af'; }}
          title="新增标签页"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
      </div>

      {/* 模型切换下拉选择（Portal 渲染到 body） */}
      {showModelDropdown && modelDropdownTabId && (() => {
        const targetTab = allTabs.find(t => t.id === modelDropdownTabId);
        const targetAgent = targetTab?.agentId ? agents.find(a => a.id === targetTab.agentId) : null;
        if (!targetAgent) return null;
        return createPortal(
          <div
            ref={modelDropdownRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
              background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              padding: 12, minWidth: 200, zIndex: 1000, fontFamily: 'inherit',
            }}
          >
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, fontWeight: 500 }}>
              切换智能体模型
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>
              当前: {targetAgent.modelName || '未设置'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {availableModels.map(model => {
                const isSelected = targetAgent.modelName === model.id;
                return (
                  <button
                    key={model.id}
                    onClick={() => onSwitchModel(modelDropdownTabId, model.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', borderRadius: 8,
                      border: isSelected ? '1.5px solid #2563eb' : '1px solid #e5e7eb',
                      background: isSelected ? '#f0f5ff' : '#fff',
                      cursor: 'pointer', transition: 'all 0.15s',
                      fontSize: 13, color: isSelected ? '#2563eb' : '#374151',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = '#f3f4f6';
                        e.currentTarget.style.borderColor = '#d1d5db';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = '#fff';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }
                    }}
                  >
                    <span>{model.label}</span>
                    {isSelected && <span style={{ fontSize: 11 }}>✓</span>}
                  </button>
                );
              })}
            </div>
            <button
              onClick={onModelDropdownClose}
              style={{
                marginTop: 12, padding: '6px 12px', borderRadius: 8,
                border: '1px solid #e5e7eb', background: '#fff',
                fontSize: 12, color: '#6b7280', cursor: 'pointer',
                width: '100%', textAlign: 'center',
              }}
            >
              取消
            </button>
          </div>,
          document.body
        );
      })()}
    </>
  );
}
