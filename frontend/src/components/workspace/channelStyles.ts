/**
 * channelStyles — ChannelConfigModal 样式常量
 *
 * 提取渠道配置弹窗的内联样式为可复用常量，减少组件文件行数。
 */
import type { CSSProperties } from 'react';

/* ── 布局 ── */
export const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', overflowY: 'auto',
};

export const modalContainerStyle: CSSProperties = {
  background: '#fff', borderRadius: 12,
  boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
  width: 660, maxWidth: 'calc(100vw - 32px)',
  fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
  animation: 'channelModalIn 0.2s cubic-bezier(0.34,1.4,0.64,1)',
  overflow: 'hidden', position: 'relative', marginBottom: 32,
};

export const headerStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '22px 28px 18px', borderBottom: '1px solid #f0f0f0',
};

export const headerIconStyle: CSSProperties = {
  width: 38, height: 38, borderRadius: 10,
  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};

export const tipBarStyle: CSSProperties = {
  margin: '18px 28px 0', padding: '11px 14px', borderRadius: 8,
  background: '#f0f7ff', border: '1px solid #c8e0ff',
  display: 'flex', alignItems: 'center', gap: 10,
};

export const channelTabsContainerStyle: CSSProperties = {
  display: 'flex', gap: 0, border: '1px solid #e5e7eb', borderRadius: 9, overflow: 'hidden',
};

export const sectionDividerStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
};

export const footerStyle: CSSProperties = {
  display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center',
  padding: '16px 28px 24px', borderTop: '1px solid #f0f0f0',
};

export const toastStyle: CSSProperties = {
  position: 'absolute', bottom: 88, left: '50%', transform: 'translateX(-50%)',
  background: '#1a202c', color: '#fff', borderRadius: 8, padding: '8px 18px',
  fontSize: 12, whiteSpace: 'nowrap', pointerEvents: 'none',
  boxShadow: '0 4px 16px rgba(0,0,0,0.2)', animation: 'toastIn 0.2s ease',
};

/* ── 渠道 Tab 按钮 ── */
export function channelTabButtonStyle(active: boolean, isFirst: boolean): CSSProperties {
  return {
    flex: 1, height: 48, padding: '0 12px', borderRadius: 0, border: 'none',
    borderLeft: isFirst ? 'none' : '1px solid #e5e7eb',
    background: active ? '#3b82f6' : '#ffffff', cursor: 'pointer',
    display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    transition: 'all 0.15s', fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
    outline: active ? '2px solid #3b82f6' : 'none', outlineOffset: -2, position: 'relative',
  };
}

/* ── 输入框 ── */
export function inputStyle(hasError?: string, hasToggle?: boolean): CSSProperties {
  return {
    width: '100%', height: 44, padding: hasToggle ? '0 48px 0 16px' : '0 16px',
    border: hasError ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb',
    borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#1a202c',
    fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif', boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };
}

export const inputErrorStyle: CSSProperties = {
  fontSize: 12, color: '#ef4444', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4,
};

/* ── Secret 输入框包装 ── */
export const secretInputWrapperStyle: CSSProperties = { position: 'relative' };

export function secretToggleStyle(showSecret: boolean): CSSProperties {
  return {
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
    display: 'flex', alignItems: 'center', color: showSecret ? '#3b82f6' : '#9ca3af',
    transition: 'color 0.15s', borderRadius: 4,
  };
}

/* ── 按钮 ── */
export const cancelButtonStyle: CSSProperties = {
  height: 40, padding: '0 24px', fontSize: 14, borderRadius: 8,
  border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer',
  color: '#6b7280', fontWeight: 500, fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
  transition: 'border-color 0.15s, color 0.15s, background 0.15s',
  display: 'inline-flex', alignItems: 'center',
};

export function confirmButtonStyle(saved: boolean): CSSProperties {
  return {
    height: 40, padding: '0 28px', fontSize: 14, borderRadius: 8, border: 'none',
    background: saved ? '#22c55e' : '#6366f1', cursor: 'pointer', color: '#fff', fontWeight: 600,
    fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
    transition: 'background 0.15s, box-shadow 0.15s',
    boxShadow: saved ? '0 2px 8px rgba(34,197,94,0.25)' : '0 2px 8px rgba(99,102,241,0.25)',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  };
}
