/**
 * 移动端底部输入区组件 - 样式常量
 *
 * 提取所有内联样式为常量对象，便于维护和复用。
 */

import type React from 'react';

/** 组件内联样式定义 */
export const styles: Record<string, React.CSSProperties> = {
  /* 底部容器 */
  bottomContainer: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    background: '#1a1a1a',
    borderTop: '1px solid #3a3a40',
    boxShadow: '0 -2px 12px rgba(0,0,0,0.15)',
  },

  /* 横向 tabs */
  tabsRow: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    padding: '8px 10px 6px',
    background: 'linear-gradient(180deg, #222228 0%, #1a1a1a 100%)',
    borderBottom: '1px solid #3a3a40',
    whiteSpace: 'nowrap',
  },

  /* 单个 tab 按钮 */
  tabBtn: {
    display: 'inline-flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    flexShrink: 0,
    minWidth: 'max-content',
    padding: '7px 12px',
    border: '1px solid #4a4a50',
    background: 'linear-gradient(135deg,#2a2a30 0%,#222228 100%)',
    cursor: 'pointer',
    borderRadius: 14,
    transition: 'all 0.18s',
    boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
  },

  tabIcon: {
    fontSize: 14,
    lineHeight: 1,
    flexShrink: 0,
  },

  tabLabel: {
    fontSize: 12,
    color: '#e5e5e5',
    whiteSpace: 'nowrap',
    fontWeight: 500,
  },

  /* 输入栏 */
  inputBar: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    padding: '10px 12px 12px',
    background: '#1a1a1a',
  },

  /* 输入框 */
  textarea: {
    flex: 1,
    minHeight: 52,
    maxHeight: 160,
    padding: '12px 14px',
    border: '1.2px solid #3a3a40',
    borderRadius: 16,
    fontSize: 15,
    fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif',
    color: '#f5f5f5',
    lineHeight: 1.5,
    resize: 'none',
    outline: 'none',
    boxSizing: 'border-box',
    background: 'linear-gradient(180deg,#1f1f23,#262630)',
    transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.12)',
  },

  /* 发送按钮 */
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(135deg,#666,#888)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'opacity 0.15s, transform 0.1s',
    boxShadow: '0 6px 16px rgba(102,102,102,0.2)',
  },

  /* 安全区 */
  safeArea: {
    height: 'env(safe-area-inset-bottom, 0px)',
    background: '#1a1a1a',
  },

  /* Sheet 遮罩 */
  sheetOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    animation: 'sheetFadeIn 0.2s ease',
  },

  /* Sheet 内容 */
  sheetContent: {
    width: '100%',
    maxWidth: '100%',
    maxHeight: '75vh',
    background: '#1a1a1a',
    borderRadius: '16px 16px 0 0',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    animation: 'sheetSlideUp 0.25s cubic-bezier(0.34,1.4,0.64,1)',
  },

  /* Sheet 头部 */
  sheetHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px 12px',
    borderBottom: '1px solid #3a3a40',
    flexShrink: 0,
  },

  sheetTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
  },

  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: 'none',
    background: '#262626',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#a3a3a3',
    transition: 'background 0.15s, color 0.15s',
  },

  /* Sheet 内容区 */
  sheetBody: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    padding: '16px',
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
    background: '#1a1a1a',
  },

  /* 文件上传区 */
  uploadArea: {
    border: '2px dashed #4a4a50',
    borderRadius: 12,
    padding: '24px 16px',
    textAlign: 'center',
    cursor: 'pointer',
    background: '#262626',
    transition: 'border-color 0.15s, background 0.15s',
  },

  /* 占位内容 */
  placeholderContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 16px',
    textAlign: 'center',
    background: '#1a1a1a',
  },

  placeholderBtn: {
    marginTop: 12,
    padding: '8px 20px',
    borderRadius: 8,
    border: '1.5px solid #6366f1',
    background: '#262626',
    color: '#6366f1',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif',
  },
};
