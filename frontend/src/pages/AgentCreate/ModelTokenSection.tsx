/**
 * ModelTokenSection - 模型配置 + Token 接入区组件
 *
 * 职责：渲染 CODE 渠道选择触发器 + Token 接入触发器（同行两列布局）
 * - 左列：CODE 渠道 & 模型选择
 * - 右列：Token 接入配置 + 复制按钮
 */
import { Code2, KeyRound, ChevronDown, Copy, CheckCheck } from 'lucide-react';
import type { CodeChannel, CodeModel } from './types';

interface ModelTokenSectionProps {
  selectedChannel: CodeChannel;
  selectedModel: CodeModel | null;
  tokenValue: string;
  hasBackendKey: boolean;
  copied: boolean;
  onOpenCodeModal: () => void;
  onOpenTokenModal: () => void;
  onCopyToken: () => void;
  // 样式
  labelStyle: React.CSSProperties;
  fieldStyle: React.CSSProperties;
}

export function ModelTokenSection({
  selectedChannel, selectedModel, tokenValue, hasBackendKey, copied,
  onOpenCodeModal, onOpenTokenModal, onCopyToken,
  labelStyle, fieldStyle,
}: ModelTokenSectionProps) {
  return (
    <div style={{ ...fieldStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {/* CODE 渠道 */}
      <div>
        <label style={labelStyle}>CODE 渠道</label>
        <div className="ac-model-trigger" onClick={onOpenCodeModal}>
          <span className="ac-model-trigger-icon"><Code2 size={16} /></span>
          <div className="ac-model-trigger-info">
            <div className="ac-model-trigger-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {selectedChannel.name}
              {selectedChannel.isPreset && <span style={{ fontSize: 13 }}>⭐</span>}
              <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, background: '#f3f4f6', color: '#6b7280' }}>
                {selectedChannel.provider}
              </span>
            </div>
            <div className="ac-model-trigger-sub">
              {selectedModel ? `${selectedModel.name} · ${selectedModel.maxTokens}tok` : '请选择模型'}
            </div>
          </div>
          <span style={{ marginLeft: 'auto', color: '#9ca3af', flexShrink: 0 }}><ChevronDown size={15} /></span>
        </div>
      </div>

      {/* Token 接入 */}
      <div>
        <label style={labelStyle}>Token 接入</label>
        <div className="ac-token-trigger" onClick={onOpenTokenModal}>
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
