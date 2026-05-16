/**
 * WechatBindingBar — 微信用户绑定状态栏
 * [2026-05-16] 新增：展示在微信助手面板顶部，显示绑定状态，提供绑定/解绑操作
 */
import React, { useState, useEffect, useCallback } from 'react';

interface BindingData {
  bound: boolean;
  id?: string;
  botId?: string;
  wechatOpenid?: string;
  boundAt?: string;
}

const API_BASE = '/api/wechat';

export default function WechatBindingBar() {
  const [binding, setBinding] = useState<BindingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUnbindConfirm, setShowUnbindConfirm] = useState(false);

  const fetchBinding = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/user-binding`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setBinding(json.data);
      }
    } catch (err) {
      console.error('[WechatBindingBar] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBinding(); }, [fetchBinding]);

  const handleUnbind = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/user-binding`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setBinding({ bound: false });
        setShowUnbindConfirm(false);
      }
    } catch (err) {
      console.error('[WechatBindingBar] unbind error:', err);
    }
  };

  if (loading) return null;

  // [2026-05-16] 绑定状态栏样式：紧凑横条，不占太多空间
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 16px',
      background: binding?.bound ? '#f0fdf4' : '#fef3c7',
      borderBottom: `1px solid ${binding?.bound ? '#bbf7d0' : '#fde68a'}`,
      fontSize: 13, color: '#374151',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{binding?.bound ? '🔗' : '⚠️'}</span>
        {binding?.bound ? (
          <span>
            已绑定微信：<strong style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {binding.wechatOpenid ? `${binding.wechatOpenid.substring(0, 12)}...` : '-'}
            </strong>
            <span style={{ color: '#6b7280', marginLeft: 8 }}>
              {binding.boundAt ? `${new Date(binding.boundAt).toLocaleDateString()}` : ''}
            </span>
          </span>
        ) : (
          <span style={{ color: '#92400e' }}>未绑定微信账号，消息将无法正确归属</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {binding?.bound ? (
          <>
            {showUnbindConfirm ? (
              <>
                <span style={{ fontSize: 12, color: '#dc2626' }}>确认解绑？</span>
                <button
                  onClick={handleUnbind}
                  style={{
                    padding: '4px 10px', fontSize: 12, borderRadius: 4,
                    background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca',
                    cursor: 'pointer',
                  }}
                >确认</button>
                <button
                  onClick={() => setShowUnbindConfirm(false)}
                  style={{
                    padding: '4px 10px', fontSize: 12, borderRadius: 4,
                    background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb',
                    cursor: 'pointer',
                  }}
                >取消</button>
              </>
            ) : (
              <button
                onClick={() => setShowUnbindConfirm(true)}
                style={{
                  padding: '4px 12px', fontSize: 12, borderRadius: 4,
                  background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.color = '#dc2626'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280'; }}
              >解绑</button>
            )}
          </>
        ) : (
          <span style={{ fontSize: 12, color: '#6b7280' }}>请通过微信扫码绑定</span>
        )}
      </div>
    </div>
  );
}
