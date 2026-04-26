import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Bot, Layers,
  ChevronLeft, ChevronRight, Settings, Network, Sparkles, PlusCircle, Wrench, Puzzle, ShieldCheck, Library, LogOut,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const NAV_ITEMS = [
  { to: '/workspace',      icon: Sparkles,   label: 'RepaceClaw',  exact: false },
  { to: '/agent-library',  icon: Library,    label: 'Agent 模板库', exact: false },
  { to: '/agent-create',   icon: PlusCircle, label: '智能体创建',   exact: false },
  { to: '/agents',         icon: Bot,        label: '智能体管理',   exact: false },
  { to: '/console',        icon: Network,    label: '项目协作',     exact: false },
  { to: '/skill-settings', icon: Wrench,     label: '技能设置',     exact: false },
  { to: '/plugin-settings',icon: Puzzle,     label: '插件设置',     exact: false },
  { to: '/kanban',         icon: Layers,     label: '会话列表',     exact: false },
];

/* ─── 当前项目信息（可替换为真实数据源） ──────────────────────── */
const CURRENT_PROJECT = {
  name: 'RepaceClaw智能体平台',
  phase: '开发阶段',
};

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--body-bg)', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: collapsed ? 60 : 208,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'transparent',
        transition: 'width 0.25s ease',
        overflow: 'hidden',
      }}>

        {/* ── Logo / 当前项目 ── */}
        <div
          onClick={() => navigate('/')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '20px 0' : '16px 14px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          {/* 项目名 + 阶段 */}
          {!collapsed && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontWeight: 700, fontSize: 13, color: 'var(--text-primary)',
                lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {CURRENT_PROJECT.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {CURRENT_PROJECT.phase}
              </div>
            </div>
          )}
        </div>

        {/* ── Nav ── */}
        <nav style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
          {NAV_ITEMS.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              title={collapsed ? label : undefined}
              style={{ textDecoration: 'none' }}
            >
              {({ isActive }) => (
                <div style={{
                  display: 'flex', alignItems: 'center',
                  gap: collapsed ? 0 : 10,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: isActive ? 'var(--accent-light)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  letterSpacing: 0.1,
                }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <Icon size={17} style={{ flexShrink: 0, color: isActive ? 'var(--accent)' : 'var(--text-muted)' }} />
                  {!collapsed && label}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* ── Bottom ── */}
        <div style={{ padding: '4px 8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 管理后台入口（仅 admin/super_admin 可见） */}
          {isAdmin && (
            <NavLink to="/admin" style={{ textDecoration: 'none' }}>
              {({ isActive }) => (
                <div style={{
                  display: 'flex', alignItems: 'center',
                  gap: collapsed ? 0 : 10,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  padding: '9px 10px', borderRadius: 8,
                  background: isActive ? '#fef3c7' : 'transparent',
                  color: isActive ? '#d97706' : '#d97706',
                  fontSize: 13, cursor: 'pointer', fontWeight: 500,
                }}
                  title={collapsed ? '管理后台' : undefined}
                >
                  <ShieldCheck size={16} style={{ flexShrink: 0 }} />
                  {!collapsed && '管理后台'}
                </div>
              )}
            </NavLink>
          )}
          <NavLink to="/plugin-settings" style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <div style={{
                display: 'flex', alignItems: 'center',
                gap: collapsed ? 0 : 10,
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: '9px 10px', borderRadius: 8,
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 13, cursor: 'pointer',
              }}>
                <Settings size={16} style={{ flexShrink: 0 }} />
                {!collapsed && '设置'}
              </div>
            )}
          </NavLink>

          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : 10,
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: '9px 10px', borderRadius: 8,
              background: 'transparent', border: 'none',
              color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
              width: '100%',
            }}
          >
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>收起</span></>}
          </button>

          {/* 退出登录 */}
          <button
            onClick={() => {
              if (confirm('确定要退出登录吗？')) {
                useAuthStore.getState().logout();
                navigate('/login');
              }
            }}
            style={{
              display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : 10,
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: '9px 10px', borderRadius: 8,
              background: 'transparent', border: 'none',
              color: '#ef4444', fontSize: 13, cursor: 'pointer',
              width: '100%',
              marginTop: 2,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <LogOut size={16} style={{ flexShrink: 0 }} />
            {!collapsed && '退出登录'}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>
    </div>
  );
}
