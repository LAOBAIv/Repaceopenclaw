/**
 * PageLayout — 统一页面布局组件
 * [2026-05-20] 所有管理页面使用此组件包裹，确保样式一致
 */
import React from 'react';
import { RefreshCw } from 'lucide-react';

interface PageLayoutProps {
  title: string;
  icon?: React.ReactNode;
  onRefresh?: () => void;
  actions?: React.ReactNode;
  maxWidth?: number;
  children: React.ReactNode;
}

export default function PageLayout({ title, icon, onRefresh, actions, maxWidth, children }: PageLayoutProps) {
  return (
    <div style={{ padding: 24, background: 'var(--body-bg, #f5f5f5)', minHeight: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1a202c', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          {icon}
          {title}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {actions}
          {onRefresh && (
            <button
              onClick={onRefresh}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: 13 }}
            >
              <RefreshCw size={14} /> 刷新
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: maxWidth || undefined }}>
        {children}
      </div>
    </div>
  );
}
