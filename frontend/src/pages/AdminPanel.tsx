import { useState } from 'react';
import { ShieldCheck, Cpu, Users } from 'lucide-react';
import { ModelChannels } from './ModelChannels';
import { useAuthStore } from '../stores/authStore';
import { Navigate } from 'react-router-dom';

type AdminTab = 'model-channels' | 'users';

const TABS = [
  { id: 'model-channels' as AdminTab, label: '模型渠道', icon: Cpu },
  { id: 'users' as AdminTab,          label: '用户管理', icon: Users },
];

export function AdminPanel() {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<AdminTab>('model-channels');

  // 非管理员重定向
  if (!user || (user.role !== 'super_admin' && user.role !== 'admin')) {
    return <Navigate to="/workspace" replace />;
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--body-bg)' }}>

      {/* 左侧 Tab 导航 */}
      <div style={{
        width: 180, flexShrink: 0, borderRight: '1px solid #e5e7eb',
        background: '#fff', display: 'flex', flexDirection: 'column', padding: '20px 10px',
      }}>
        {/* 标题 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 16px', borderBottom: '1px solid #f0f0f0', marginBottom: 12 }}>
          <ShieldCheck size={16} color="#d97706" />
          <span style={{ fontWeight: 700, fontSize: 14, color: '#1a202c' }}>管理后台</span>
        </div>

        {/* 角色标识 */}
        <div style={{ padding: '0 8px 12px', marginBottom: 4 }}>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 4,
            background: user.role === 'super_admin' ? '#fef3c7' : '#eff6ff',
            color: user.role === 'super_admin' ? '#d97706' : '#2563eb',
            fontWeight: 500,
          }}>
            {user.role === 'super_admin' ? '超级管理员' : '管理员'}
          </span>
        </div>

        {/* Tab 列表 */}
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '9px 12px', borderRadius: 8, border: 'none',
              background: activeTab === id ? '#fef3c7' : 'transparent',
              color: activeTab === id ? '#d97706' : '#6b7280',
              fontWeight: activeTab === id ? 600 : 400,
              fontSize: 13, cursor: 'pointer', width: '100%', textAlign: 'left',
              transition: 'all 0.15s',
            }}
          >
            <Icon size={15} style={{ flexShrink: 0 }} />
            {label}
          </button>
        ))}
      </div>

      {/* 右侧内容区 */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {activeTab === 'model-channels' && <ModelChannels />}
        {activeTab === 'users' && <UserManagement />}
      </div>
    </div>
  );
}

/* ─── 用户管理（简版，后续可扩展） ────────────────────────────── */
function UserManagement() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>用户管理</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>管理平台注册用户、角色与状态。</p>
      <div style={{ marginTop: 32, padding: 24, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, color: '#9ca3af', fontSize: 13 }}>
        用户管理功能开发中...
      </div>
    </div>
  );
}
