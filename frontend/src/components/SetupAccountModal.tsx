/**
 * SetupAccountModal.tsx
 * [2026-05-19] 微信扫码登录用户首次进入时强制设置账号信息
 */
import { useState } from 'react';
import apiClient from '../api/client';

interface Props {
  visible: boolean;
  onComplete: () => void;
}

export function SetupAccountModal({ visible, onComplete }: Props) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!visible) return null;

  async function handleSubmit() {
    setError('');
    if (!username.trim()) return setError('请输入账号');
    if (!email.trim()) return setError('请输入邮箱');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('邮箱格式不正确');
    if (password.length < 6) return setError('密码至少6位');
    if (password !== confirmPwd) return setError('两次密码不一致');

    setLoading(true);
    try {
      await apiClient.post('/auth/complete-setup', {
        username: username.trim(),
        email: email.trim(),
        password,
      });
      onComplete();
    } catch (e: any) {
      setError(e?.response?.data?.error || '设置失败');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb',
    borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 400, padding: '32px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 20, color: '#1f2937' }}>设置账号信息</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>首次登录需要设置账号、邮箱和密码才能正常使用</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, color: '#374151', fontWeight: 500, marginBottom: 4, display: 'block' }}>账号</label>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="设置登录账号" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 13, color: '#374151', fontWeight: 500, marginBottom: 4, display: 'block' }}>邮箱</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="用于找回密码" type="email" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 13, color: '#374151', fontWeight: 500, marginBottom: 4, display: 'block' }}>密码</label>
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="至少6位" type="password" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 13, color: '#374151', fontWeight: 500, marginBottom: 4, display: 'block' }}>确认密码</label>
            <input value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="再次输入密码" type="password" style={inputStyle} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>
        </div>

        {error && <div style={{ marginTop: 12, fontSize: 13, color: '#ef4444' }}>{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{ marginTop: 20, width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 15, fontWeight: 600, cursor: loading ? 'wait' : 'pointer' }}
        >
          {loading ? '提交中...' : '完成设置'}
        </button>
      </div>
    </div>
  );
}

export default SetupAccountModal;
