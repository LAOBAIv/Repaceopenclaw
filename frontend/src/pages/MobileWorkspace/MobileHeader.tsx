/**
 * MobileHeader — 移动端顶部导航栏
 *
 * 三列布局：左菜单按钮 | 标题+智能体信息 | 右设置按钮
 * 标题区两行结构，避免和左右图标互相挤压。
 */

import { Menu, Settings, ChevronDown } from 'lucide-react';
import { COLORS } from './constants';

interface MobileHeaderProps {
  activeTabTitle?: string;
  activeAgentName: string;
  activeAgentModelName?: string;
  wsConnected: boolean;
  onLeftClick: () => void;
  onRightClick: () => void;
  onModelClick: () => void;
}

export function MobileHeader({
  activeTabTitle,
  activeAgentName,
  activeAgentModelName,
  wsConnected,
  onLeftClick,
  onRightClick,
  onModelClick,
}: MobileHeaderProps) {
  return (
    <header style={{
      minHeight: 56,
      flexShrink: 0,
      display: 'grid',
      gridTemplateColumns: '40px minmax(0, 1fr) 40px',
      alignItems: 'center',
      columnGap: 8,
      padding: '6px 12px',
      background: COLORS.bgSecondary,
      borderBottom: `1px solid ${COLORS.border}`,
    }}>
      {/* 左按钮：打开左抽屉 */}
      <button
        onClick={onLeftClick}
        style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 8,
          color: COLORS.textPrimary,
          flexShrink: 0,
          justifySelf: 'start',
        }}
      >
        <Menu size={20} />
      </button>

      {/* 标题区：中间列独立占位，两行结构 */}
      <div style={{
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}>
        <div style={{
          width: '100%',
          fontSize: 15,
          fontWeight: 600,
          color: COLORS.textPrimary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.2,
          textAlign: 'center',
        }}>
          {activeTabTitle || 'RepaceClaw'}
        </div>
        {activeAgentName && (
          <div style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            minWidth: 0,
          }}>
            <div style={{
              maxWidth: '100%',
              fontSize: 10,
              color: COLORS.textMuted,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              minWidth: 0,
              lineHeight: 1.2,
              overflow: 'hidden',
            }}>
              <span style={{
                minWidth: 0,
                flex: '0 1 auto',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {activeAgentName}
              </span>
              {activeAgentModelName && (
                <button
                  onClick={onModelClick}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 2,
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: COLORS.textMuted, fontSize: 10, padding: 0,
                    flexShrink: 0,
                  }}
                >
                  <span style={{ opacity: 0.7, whiteSpace: 'nowrap' }}>{activeAgentModelName}</span>
                  <ChevronDown size={10} />
                </button>
              )}
              {!wsConnected && <span style={{ flexShrink: 0 }}>· 离线</span>}
            </div>
          </div>
        )}
      </div>

      {/* 右按钮：打开右抽屉 */}
      <button
        onClick={onRightClick}
        style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 8,
          color: COLORS.textPrimary,
          flexShrink: 0,
          justifySelf: 'end',
        }}
      >
        <Settings size={20} />
      </button>
    </header>
  );
}
