/**
 * ChannelConfigModal — 消息渠道配置弹窗组件
 *
 * 职责：提供飞书、企业微信、钉钉等消息渠道的 Bot 配置界面，
 * 支持表单验证和配置保存。样式常量已提取到 channelStyles.ts。
 *
 * [2026-05-23] 重构：从 pages/ProjectWorkspace/ 迁移至 components/workspace/，
 * 消除跨目录引用，保持 @/components/workspace barrel export 兼容。
 */
import React, { useState } from 'react';
// 同目录引用（搬迁后自包含）
import { type ChannelType, CHANNEL_TABS } from './constants';
import {
  overlayStyle, modalContainerStyle, headerStyle, headerIconStyle,
  tipBarStyle, channelTabsContainerStyle, channelTabButtonStyle,
  sectionDividerStyle, inputStyle, inputErrorStyle,
  secretInputWrapperStyle, secretToggleStyle,
  footerStyle, cancelButtonStyle, confirmButtonStyle, toastStyle,
} from './channelStyles';

/* ─── SVG 图标组件 ─────────────────────────────────────────── */
const FolderIcon = () => (
  <svg width="19" height="19" viewBox="0 0 17 17" fill="none">
    <path d="M2 3.5C2 2.67 2.67 2 3.5 2H10L15 7V13.5C15 14.33 14.33 15 13.5 15H3.5C2.67 15 2 14.33 2 13.5V3.5Z" fill="none" stroke="white" strokeWidth="1.4" strokeLinejoin="round"/>
    <path d="M10 2V7H15" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 10H12M5 12.5H9" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const InfoIcon = () => (
  <svg width="15" height="15" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="7" cy="7" r="6" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="1.2"/>
    <path d="M7 6V10M7 4.5V5" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const ErrorIcon = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
    <circle cx="5.5" cy="5.5" r="4.5" fill="#ef4444" fillOpacity="0.15" stroke="#ef4444" strokeWidth="1"/>
    <path d="M5.5 3.5V6M5.5 7.5V8" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const EyeOpenIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeClosedIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
// [2026-05-23] 迁移补充：CheckIcon 子组件（原 pages/ProjectWorkspace/ChannelConfigModal.tsx 中）
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2.5 7L5.5 10L11.5 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// [2026-05-23] 迁移补充：ChannelConfigModal 主组件（原 pages/ProjectWorkspace/ChannelConfigModal.tsx 中）
export function ChannelConfigModal({ onClose }: { onClose: () => void }) {
  const [channel, setChannel] = useState<ChannelType>('feishu');
  const [botId, setBotId] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [errors, setErrors] = useState<{ botId?: string; secret?: string }>({});
  const [saved, setSaved] = useState(false);

  const channelLabels: Record<ChannelType, string> = { feishu: '飞书', wecom: '企业微信', dingtalk: '钉钉' };

  const validate = () => {
    const e: { botId?: string; secret?: string } = {};
    if (!botId.trim()) e.botId = 'Bot ID 不能为空';
    if (!secret.trim()) e.secret = 'Secret 不能为空';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleConfirm = () => { if (!validate()) return; setSaved(true); setTimeout(() => { setSaved(false); onClose(); }, 1200); };
  const switchChannel = (c: ChannelType) => { setChannel(c); setBotId(''); setSecret(''); setErrors({}); };

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={modalContainerStyle}>
        {/* 头部 */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={headerIconStyle}><FolderIcon /></div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a202c', lineHeight: 1.3 }}>消息渠道配置</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 3, lineHeight: 1.4 }}>连接后智能体可接收并回复渠道消息</div>
            </div>
          </div>
          <CloseButton onClose={onClose} />
        </div>

        {/* 提示栏 */}
        <div style={tipBarStyle}>
          <InfoIcon />
          <span style={{ fontSize: 13, color: '#333', flex: 1, lineHeight: 1.5 }}>配置机器人 Token 后，智能体可在渠道中自动收发消息。</span>
          <a href="#" onClick={e => e.preventDefault()} style={{ fontSize: 13, color: '#1d6ef5', fontWeight: 600, textDecoration: 'underline', whiteSpace: 'nowrap', textUnderlineOffset: 2 }}>实践教程 →</a>
        </div>

        {/* 渠道标签页 */}
        <div style={{ padding: '20px 28px 0' }}>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 10, fontWeight: 500 }}>选择渠道</div>
          <div style={channelTabsContainerStyle}>
            {CHANNEL_TABS.map((tab, idx) => (
              <button key={tab.key} onClick={() => switchChannel(tab.key)} style={channelTabButtonStyle(channel === tab.key, idx === 0)}
                onMouseEnter={e => { if (channel !== tab.key) e.currentTarget.style.background = '#f0f7ff'; }}
                onMouseLeave={e => { if (channel !== tab.key) e.currentTarget.style.background = '#ffffff'; }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
                <span style={{ fontSize: 13, fontWeight: channel === tab.key ? 600 : 400, color: channel === tab.key ? '#fff' : '#6b7280' }}>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 表单 */}
        <div style={{ padding: '22px 28px 12px' }}>
          <div style={sectionDividerStyle}>{channelLabels[channel]} Bot 配置</div>
          <FormField label="Bot ID" value={botId} error={errors.botId}
            placeholder={`请输入 ${channelLabels[channel]} Bot ID`}
            onChange={v => { setBotId(v); if (errors.botId) setErrors(x => ({ ...x, botId: undefined })); }} />
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7 }}>
              Secret<span style={{ color: '#ef4444', fontSize: 13, lineHeight: 1, marginLeft: 2 }}>*</span>
            </label>
            <div style={secretInputWrapperStyle}>
              <input type={showSecret ? 'text' : 'password'} value={secret}
                onChange={e => { setSecret(e.target.value); if (errors.secret) setErrors(x => ({ ...x, secret: undefined })); }}
                placeholder="请输入 Secret" style={inputStyle(errors.secret, true)}
                onFocus={e => { e.currentTarget.style.borderColor = errors.secret ? '#ef4444' : '#3b82f6'; e.currentTarget.style.boxShadow = errors.secret ? '0 0 0 3px rgba(239,68,68,0.12)' : '0 0 0 3px rgba(59,130,246,0.12)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = errors.secret ? '#ef4444' : '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }} />
              <button type="button" onClick={() => setShowSecret(v => !v)} tabIndex={-1} style={secretToggleStyle(showSecret)}
                onMouseEnter={e => { if (!showSecret) e.currentTarget.style.color = '#6b7280'; }}
                onMouseLeave={e => { if (!showSecret) e.currentTarget.style.color = '#9ca3af'; }}
                title={showSecret ? '点击隐藏密码' : '点击显示密码'}
              >{showSecret ? <EyeOpenIcon /> : <EyeClosedIcon />}</button>
            </div>
            {errors.secret && <div style={inputErrorStyle}><ErrorIcon />{errors.secret}</div>}
          </div>
        </div>

        {/* 底部按钮 */}
        <div style={footerStyle}>
          <button onClick={onClose} style={cancelButtonStyle}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#9ca3af'; e.currentTarget.style.color = '#374151'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280'; }}>取消</button>
          <button onClick={handleConfirm} style={confirmButtonStyle(saved)}
            onMouseEnter={e => { e.currentTarget.style.background = saved ? '#16a34a' : '#4f46e5'; e.currentTarget.style.boxShadow = saved ? '0 4px 12px rgba(34,197,94,0.35)' : '0 4px 12px rgba(79,70,229,0.35)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = saved ? '#22c55e' : '#6366f1'; e.currentTarget.style.boxShadow = saved ? '0 2px 8px rgba(34,197,94,0.25)' : '0 2px 8px rgba(99,102,241,0.25)'; }}
          >{saved ? <><CheckIcon />已保存</> : '确 定'}</button>
        </div>

        {saved && <div style={toastStyle}>✓ 渠道配置已保存</div>}
      </div>
      <style>{`@keyframes channelModalIn{from{opacity:0;transform:scale(0.9) translateY(16px)}to{opacity:1;transform:scale(1) translateY(0)}}@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
    </div>
  );
}

/* ─── 子组件 ─────────────────────────────────────────────── */
// [2026-05-23] 迁移补充：CloseButton / FormField 子组件（原 pages/ProjectWorkspace/ChannelConfigModal.tsx 中）

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#f3f4f6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 18, lineHeight: 1, transition: 'background 0.15s, color 0.15s', flexShrink: 0 }}
      onMouseEnter={e => { e.currentTarget.style.background = '#e5e7eb'; e.currentTarget.style.color = '#374151'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#9ca3af'; }}>×</button>
  );
}

function FormField({ label, value, error, placeholder, onChange }: {
  label: string; value: string; error?: string; placeholder: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7 }}>
        {label}<span style={{ color: '#ef4444', fontSize: 13, lineHeight: 1, marginLeft: 2 }}>*</span>
      </label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle(error)}
        onFocus={e => { e.currentTarget.style.borderColor = error ? '#ef4444' : '#3b82f6'; e.currentTarget.style.boxShadow = error ? '0 0 0 3px rgba(239,68,68,0.12)' : '0 0 0 3px rgba(59,130,246,0.12)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = error ? '#ef4444' : '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }} />
      <style>{`input::placeholder{color:#999 !important}`}</style>
      {error && <div style={inputErrorStyle}><ErrorIcon />{error}</div>}
    </div>
  );
}
