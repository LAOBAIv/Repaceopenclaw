// [2026-05-18] 从 ProjectWorkspace.tsx 拆分
import React, { useState } from 'react';
import { type ChannelType, CHANNEL_TABS } from '@/components/workspace';

export function ChannelConfigModal({ onClose }: { onClose: () => void }) {
  const [channel, setChannel] = useState<ChannelType>('feishu');
  const [botId, setBotId]     = useState('');
  const [secret, setSecret]   = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [errors, setErrors]   = useState<{ botId?: string; secret?: string }>({});
  const [saved, setSaved]     = useState(false);

  function validate() {
    const e: { botId?: string; secret?: string } = {};
    if (!botId.trim())   e.botId  = 'Bot ID 不能为空';
    if (!secret.trim())  e.secret = 'Secret 不能为空';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleConfirm() {
    if (!validate()) return;
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  }

  /* 切换渠道时清空表单 */
  function switchChannel(c: ChannelType) {
    setChannel(c);
    setBotId(''); setSecret('');
    setErrors({});
  }

  const channelLabels: Record<ChannelType, string> = {
    feishu: '飞书', wecom: '企业微信', dingtalk: '钉钉',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
          width: 660,
          maxWidth: 'calc(100vw - 32px)',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
          animation: 'channelModalIn 0.2s cubic-bezier(0.34,1.4,0.64,1)',
          overflow: 'hidden',
          position: 'relative',
          marginBottom: 32,
        }}
      >
        {/* ── 头部标题栏 ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '22px 28px 18px',
          borderBottom: '1px solid #f0f0f0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* 图标 */}
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="19" height="19" viewBox="0 0 17 17" fill="none">
                <path d="M2 3.5C2 2.67 2.67 2 3.5 2H10L15 7V13.5C15 14.33 14.33 15 13.5 15H3.5C2.67 15 2 14.33 2 13.5V3.5Z"
                  fill="none" stroke="white" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M10 2V7H15" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 10H12M5 12.5H9" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </div>
            {/* 标题 + 副标题 */}
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a202c', lineHeight: 1.3 }}>
                消息渠道配置
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 3, lineHeight: 1.4 }}>
                连接后智能体可接收并回复渠道消息
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: 'none', background: '#f3f4f6', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#9ca3af', fontSize: 18, lineHeight: 1,
              transition: 'background 0.15s, color 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e5e7eb'; e.currentTarget.style.color = '#374151'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#9ca3af'; }}
          >×</button>
        </div>

        {/* ── 提示栏 ── */}
        <div style={{
          margin: '18px 28px 0',
          padding: '11px 14px',
          borderRadius: 8,
          background: '#f0f7ff',
          border: '1px solid #c8e0ff',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <svg width="15" height="15" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="6" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="1.2"/>
            <path d="M7 6V10M7 4.5V5" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 13, color: '#333', flex: 1, lineHeight: 1.5 }}>
            配置机器人 Token 后，智能体可在渠道中自动收发消息。
          </span>
          <a
            href="#"
            onClick={e => e.preventDefault()}
            style={{
              fontSize: 13, color: '#1d6ef5', fontWeight: 600,
              textDecoration: 'underline', whiteSpace: 'nowrap',
              textUnderlineOffset: 2,
            }}
          >实践教程 →</a>
        </div>

        {/* ── 渠道标签页 ── */}
        <div style={{ padding: '20px 28px 0' }}>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 10, fontWeight: 500 }}>
            选择渠道
          </div>
          <div style={{ display: 'flex', gap: 0, border: '1px solid #e5e7eb', borderRadius: 9, overflow: 'hidden' }}>
            {CHANNEL_TABS.map((tab, idx) => {
              const active = channel === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => switchChannel(tab.key)}
                  style={{
                    flex: 1,
                    height: 48,
                    padding: '0 12px',
                    borderRadius: 0,
                    border: 'none',
                    borderLeft: idx === 0 ? 'none' : '1px solid #e5e7eb',
                    background: active ? '#3b82f6' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                    transition: 'all 0.15s',
                    fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                    outline: active ? '2px solid #3b82f6' : 'none',
                    outlineOffset: -2,
                    position: 'relative',
                  }}
                  onMouseEnter={e => {
                    if (!active) { e.currentTarget.style.background = '#f0f7ff'; }
                  }}
                  onMouseLeave={e => {
                    if (!active) { e.currentTarget.style.background = '#ffffff'; }
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
                  <span style={{
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    color: active ? '#ffffff' : '#6b7280',
                  }}>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 表单区域 ── */}
        <div style={{ padding: '22px 28px 12px' }}>
          {/* 分割线 + 渠道名 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
          }}>
            <div style={{ flex: 1, height: 1, background: '#f0f0f0' }}/>
            <span style={{ fontSize: 12, color: '#aaa', whiteSpace: 'nowrap' }}>
              {channelLabels[channel]} Bot 配置
            </span>
            <div style={{ flex: 1, height: 1, background: '#f0f0f0' }}/>
          </div>

          {/* Bot ID */}
          <div style={{ marginBottom: 18 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 2,
              fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7,
            }}>
              Bot ID<span style={{ color: '#ef4444', fontSize: 13, lineHeight: 1, marginLeft: 2 }}>*</span>
            </label>
            <input
              value={botId}
              onChange={e => { setBotId(e.target.value); if (errors.botId) setErrors(v => ({ ...v, botId: undefined })); }}
              placeholder={`请输入 ${channelLabels[channel]} Bot ID`}
              style={{
                width: '100%', height: 44, padding: '0 16px',
                border: errors.botId ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb',
                borderRadius: 8, fontSize: 13, outline: 'none',
                background: '#fff', color: '#1a202c',
                fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = errors.botId ? '#ef4444' : '#3b82f6';
                e.currentTarget.style.boxShadow = errors.botId
                  ? '0 0 0 3px rgba(239,68,68,0.12)'
                  : '0 0 0 3px rgba(59,130,246,0.12)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = errors.botId ? '#ef4444' : '#e5e7eb';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <style>{`input::placeholder { color: #999 !important; }`}</style>
            {errors.botId && (
              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <circle cx="5.5" cy="5.5" r="4.5" fill="#ef4444" fillOpacity="0.15" stroke="#ef4444" strokeWidth="1"/>
                  <path d="M5.5 3.5V6M5.5 7.5V8" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                {errors.botId}
              </div>
            )}
          </div>

          {/* Secret */}
          <div style={{ marginBottom: 8 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 2,
              fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7,
            }}>
              Secret<span style={{ color: '#ef4444', fontSize: 13, lineHeight: 1, marginLeft: 2 }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showSecret ? 'text' : 'password'}
                value={secret}
                onChange={e => { setSecret(e.target.value); if (errors.secret) setErrors(v => ({ ...v, secret: undefined })); }}
                placeholder="请输入 Secret"
                style={{
                  width: '100%', height: 44, padding: '0 48px 0 16px',
                  border: errors.secret ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb',
                  borderRadius: 8, fontSize: 13, outline: 'none',
                  background: '#fff', color: '#1a202c',
                  fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = errors.secret ? '#ef4444' : '#3b82f6';
                  e.currentTarget.style.boxShadow = errors.secret
                    ? '0 0 0 3px rgba(239,68,68,0.12)'
                    : '0 0 0 3px rgba(59,130,246,0.12)';
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = errors.secret ? '#ef4444' : '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              {/* 眼睛图标：点击切换显示/隐藏，默认隐藏(password) */}
              <button
                type="button"
                onClick={() => setShowSecret(v => !v)}
                tabIndex={-1}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 4, display: 'flex', alignItems: 'center',
                  color: showSecret ? '#3b82f6' : '#9ca3af',
                  transition: 'color 0.15s', borderRadius: 4,
                }}
                onMouseEnter={e => { if (!showSecret) e.currentTarget.style.color = '#6b7280'; }}
                onMouseLeave={e => { if (!showSecret) e.currentTarget.style.color = '#9ca3af'; }}
                title={showSecret ? '点击隐藏密码' : '点击显示密码'}
              >
                {showSecret ? (
                  /* 眼睛睁开：密码可见状态，图标蓝色 */
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                ) : (
                  /* 眼睛关闭：密码隐藏状态，图标灰色 */
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                )}
              </button>
            </div>
            {errors.secret && (
              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <circle cx="5.5" cy="5.5" r="4.5" fill="#ef4444" fillOpacity="0.15" stroke="#ef4444" strokeWidth="1"/>
                  <path d="M5.5 3.5V6M5.5 7.5V8" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                {errors.secret}
              </div>
            )}
          </div>
        </div>

        {/* ── 底部按钮 ── */}
        <div style={{
          display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center',
          padding: '16px 28px 24px',
          borderTop: '1px solid #f0f0f0',
        }}>
          {/* 取消：白底灰边，hover 边框加深 */}
          <button
            onClick={onClose}
            style={{
              height: 40, padding: '0 24px', fontSize: 14, borderRadius: 8,
              border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer',
              color: '#6b7280', fontWeight: 500,
              fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
              transition: 'border-color 0.15s, color 0.15s, background 0.15s',
              display: 'inline-flex', alignItems: 'center',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#9ca3af';
              e.currentTarget.style.color = '#374151';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.color = '#6b7280';
            }}
          >取消</button>

          {/* 确定：紫色实底，hover 加深，保存后变绿 */}
          <button
            onClick={handleConfirm}
            style={{
              height: 40, padding: '0 28px', fontSize: 14, borderRadius: 8,
              border: 'none',
              background: saved ? '#22c55e' : '#6366f1',
              cursor: 'pointer', color: '#fff', fontWeight: 600,
              fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
              transition: 'background 0.15s, box-shadow 0.15s',
              boxShadow: saved ? '0 2px 8px rgba(34,197,94,0.25)' : '0 2px 8px rgba(99,102,241,0.25)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = saved ? '#16a34a' : '#4f46e5';
              e.currentTarget.style.boxShadow = saved
                ? '0 4px 12px rgba(34,197,94,0.35)'
                : '0 4px 12px rgba(79,70,229,0.35)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = saved ? '#22c55e' : '#6366f1';
              e.currentTarget.style.boxShadow = saved
                ? '0 2px 8px rgba(34,197,94,0.25)'
                : '0 2px 8px rgba(99,102,241,0.25)';
            }}
          >
            {saved ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7L5.5 10L11.5 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                已保存
              </>
            ) : '确 定'}
          </button>
        </div>

        {/* 成功提示 toast */}
        {saved && (
          <div style={{
            position: 'absolute', bottom: 88, left: '50%', transform: 'translateX(-50%)',
            background: '#1a202c', color: '#fff', borderRadius: 8, padding: '8px 18px',
            fontSize: 12, whiteSpace: 'nowrap', pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            animation: 'toastIn 0.2s ease',
          }}>
            ✓ 渠道配置已保存
          </div>
        )}
      </div>

      <style>{`
        @keyframes channelModalIn {
          from { opacity: 0; transform: scale(0.9) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
