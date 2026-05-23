/**
 * MobileLeftDrawer — 移动端左侧抽屉（导航菜单）
 *
 * 对应PC端侧边栏，包含导航菜单项和登出按钮。
 */

import { X, LogOut } from 'lucide-react';
import { COLORS, NAV_ITEMS } from './constants';

interface MobileLeftDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavClick: (item: typeof NAV_ITEMS[number]) => void;
  onLogout: () => void;
}

export function MobileLeftDrawer({
  isOpen,
  onClose,
  onNavClick,
  onLogout,
}: MobileLeftDrawerProps) {
  return (
    <>
      {/* Mask */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.5)',
          }}
        />
      )}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: '60vw', maxWidth: 240, zIndex: 101,
        background: 'linear-gradient(180deg, #1f1f23 0%, #0f0f13 100%)',
        borderRight: 'none',
        boxShadow: '4px 0 20px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column',
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* 左抽屉 Header */}
        <div style={{
          height: 52, flexShrink: 0,
          display: 'flex', alignItems: 'center',
          padding: '0 16px', gap: 12,
          background: COLORS.bgSecondary,
          borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: COLORS.bgTertiary, border: 'none', cursor: 'pointer',
              color: COLORS.textSecondary, borderRadius: 10,
            }}
          >
            <X size={18} />
          </button>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: COLORS.textPrimary }}>
            导航
          </div>
        </div>

        {/* 左抽屉 Body — 导航菜单 */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '8px 0' }}>
            {NAV_ITEMS.map(({ action, to, icon: Icon, label }) => {
              const handleClick = () => {
                onNavClick({ action, to, icon: Icon, label });
              };
              return (
                <button
                  key={to || action}
                  onClick={handleClick}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    width: '100%', padding: '14px 16px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: COLORS.textPrimary,
                  }}
                >
                  <Icon size={18} color={COLORS.textSecondary} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
                </button>
              );
            })}
            {/* 登出按钮 */}
            <button
              onClick={onLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                width: '100%', padding: '14px 16px', marginTop: 8,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: COLORS.danger,
              }}
            >
              <LogOut size={18} />
              <span style={{ fontSize: 14, fontWeight: 500 }}>退出登录</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
