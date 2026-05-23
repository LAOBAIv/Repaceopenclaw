/**
 * AgentPanel/AddFlowNodeMenu — 添加流程节点弹出菜单
 *
 * 职责：在"添加流程节点"按钮下方弹出选择菜单，
 * 提供"下行节点（串行）"和"并行节点"两种选项。
 * 使用 Portal 挂载到 document.body，点击外部自动关闭。
 */
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { FlowNodeType } from '../types';

export function AddFlowNodeMenu({
  anchorRef,
  onAdd,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onAdd: (t: FlowNodeType) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  // 计算弹出菜单位置：对齐到锚点按钮中心
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ left: r.left + r.width / 2, top: r.top });
    }
    // 点击菜单外部时自动关闭
    function handler(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [anchorRef, onClose]);

  if (!pos) return null;
  const MENU_W = 260;

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: Math.max(8, pos.left - MENU_W / 2),
        top: pos.top - 10,
        transform: 'translateY(-100%)',
        zIndex: 99999,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        boxShadow: '0 6px 24px rgba(0,0,0,0.13)',
        padding: 8,
        display: 'flex',
        gap: 8,
        width: MENU_W,
      }}
    >
      {/* 小三角（朝下） */}
      <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 10, height: 6, overflow: 'hidden' }}>
        <div style={{ width: 10, height: 10, background: '#fff', border: '1px solid #e5e7eb', transform: 'rotate(45deg) translate(-3px,-3px)' }} />
      </div>

      {/* 串行节点按钮 */}
      <button
        onClick={() => { onAdd('serial'); onClose(); }}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
          padding: '10px 0', borderRadius: 8, border: '1.5px solid #e5e7eb',
          background: '#fff', cursor: 'pointer',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#374151'; e.currentTarget.style.background = '#f5f7fa'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff'; }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
        </svg>
        <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>下行节点</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>串行向下执行</span>
      </button>

      {/* 并行节点按钮 */}
      <button
        onClick={() => { onAdd('parallel'); onClose(); }}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
          padding: '10px 0', borderRadius: 8, border: '1.5px solid #e5e7eb',
          background: '#fff', cursor: 'pointer',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = '#f5f3ff'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff'; }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
        </svg>
        <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>并行节点</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>与上节点并行</span>
      </button>
    </div>,
    document.body
  );
}
