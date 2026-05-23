/**
 * TokenSection - Token 接入配置区组件
 *
 * 职责：渲染 Token 接入触发器
 * - 显示当前渠道的 Token 配置状态
 * - 点击打开 Token 接入配置弹窗
 * - 支持复制 Token 功能
 */
import { KeyRound, ChevronDown, Copy, CheckCheck } from 'lucide-react';
import type { CodeChannel } from './types';

interface TokenSectionProps {
  selectedChannel: CodeChannel;
  tokenValue: string;
  hasBackendKey: boolean;
  copied: boolean;
  onOpenModal: () => void;
  onCopyToken: () => void;
  // 样式
  labelStyle: React.CSSProperties;
  fieldStyle: React.CSSProperties;
}

export function TokenSection({
  selectedChannel, tokenValue, hasBackendKey, copied,
  onOpenModal, onCopyToken,
  labelStyle, fieldStyle,
}: TokenSectionProps) {
  return (
    <div style={{ ...fieldStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div /> {/* 占位，与 CODE 渠道同行 */}
      <div>
        <label style={labelStyle}>Token 接入</label>
        <div className="ac-token-trigger" onClick={onOpenModal}>
          <span className="ac-token-trigger-icon"><KeyRound size={16} /></span>
          <div className="ac-token-trigger-info">
            <div className="ac-token-trigger-name">
              {selectedChannel.name}
              {selectedChannel.isPreset && <span style={{ fontSize: 13 }}>⭐</span>}
              {tokenValue && <span className="ac-token-dot" />}
            </div>
            <div className="ac-token-trigger-sub">
              {hasBackendKey
                ? '管理员已配置，无需填写'
                : tokenValue
                  ? `${tokenValue.slice(0, 6)}${'•'.repeat(Math.max(0, Math.min(10, tokenValue.length - 6)))} 已配置`
                  : '未填写 Token'}
            </div>
          </div>
          <span style={{ marginLeft: 'auto', color: '#9ca3af', flexShrink: 0 }}><ChevronDown size={15} /></span>
        </div>
        {tokenValue && (
          <button
            type="button"
            onClick={onCopyToken}
            style={{
              marginTop: 4, display: 'flex', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, color: copied ? '#15803d' : '#9ca3af', padding: 0,
              transition: 'color 0.15s',
            }}
          >
            {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
            {copied ? 'Token 已复制' : '复制 Token'}
          </button>
        )}
      </div>
    </div>
  );
}
