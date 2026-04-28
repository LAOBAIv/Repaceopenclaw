import { useState } from 'react';
import { ShieldCheck, Cpu, Users, FileText, Route } from 'lucide-react';
import { ModelChannels } from './ModelChannels';
import { AgentChannelOverview } from '../components/AgentChannelOverview';
import { UserManagement } from './UserManagement';
import { AuditLogs } from './AuditLogs';
import { useAuthStore } from '../stores/authStore';
import { Navigate } from 'react-router-dom';

type AdminTab = 'model-channels' | 'agent-routing' | 'users' | 'audit-logs';

const TABS = [
  { id: 'model-channels' as AdminTab, label: '模型渠道', icon: Cpu },
  { id: 'agent-routing' as AdminTab, label: '智能体通道', icon: Route },
  { id: 'users' as AdminTab,          label: '用户管理', icon: Users },
  { id: 'audit-logs' as AdminTab,     label: '审计日志', icon: FileText },
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
        {activeTab === 'agent-routing' && <AgentChannelOverview />}
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'audit-logs' && <AuditLogs />}
      </div>
    </div>
  );
}
