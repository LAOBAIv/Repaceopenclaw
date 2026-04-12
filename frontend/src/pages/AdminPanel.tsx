import { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, Users, FileText } from 'lucide-react';
import { ModelChannels } from './ModelChannels';
import { useAuthStore } from '../stores/authStore';
import { Navigate } from 'react-router-dom';
import apiClient from '../api/client';

type AdminTab = 'model-channels' | 'users' | 'audit-logs';

const TABS = [
  { id: 'model-channels' as AdminTab, label: '模型渠道', icon: Cpu },
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
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'audit-logs' && <AuditLogs />}
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

/* ─── 审计日志 ────────────────────────────── */
interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource: string;
  resource_id: string | null;
  detail: string;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  created_at: string;
}

function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/audit-logs?limit=100')
      .then(res => setLogs(res.data.data || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const actionLabel: Record<string, string> = {
    register: '注册',
    login: '登录',
    create: '创建',
    update: '更新',
    delete: '删除',
  };

  const resourceLabel: Record<string, string> = {
    user: '用户',
    agent: '智能体',
    conversation: '会话',
    project: '项目',
    task: '任务',
    'token-channel': '模型渠道',
  };

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>审计日志</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>记录用户登录、资源操作等关键行为。</p>

      <div style={{ marginTop: 24, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>加载中...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>暂无审计日志</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  {['时间', '用户', '操作', '资源', 'IP', 'Request ID'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 16px', whiteSpace: 'nowrap', color: '#6b7280' }}>
                      {new Date(log.created_at).toLocaleString('zh-CN')}
                    </td>
                    <td style={{ padding: '8px 16px', fontFamily: 'monospace', fontSize: 11 }}>{log.user_id.slice(0, 8)}</td>
                    <td style={{ padding: '8px 16px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                        background: log.action === 'login' ? '#dcfce7' : log.action === 'register' ? '#dbeafe' : '#f3f4f6',
                        color: log.action === 'login' ? '#16a34a' : log.action === 'register' ? '#2563eb' : '#6b7280',
                      }}>
                        {actionLabel[log.action] || log.action}
                      </span>
                    </td>
                    <td style={{ padding: '8px 16px' }}>{resourceLabel[log.resource] || log.resource}</td>
                    <td style={{ padding: '8px 16px', fontSize: 11, color: '#9ca3af' }}>{log.ip_address || '-'}</td>
                    <td style={{ padding: '8px 16px', fontFamily: 'monospace', fontSize: 10, color: '#9ca3af' }}>
                      {log.request_id?.slice(0, 8) || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
