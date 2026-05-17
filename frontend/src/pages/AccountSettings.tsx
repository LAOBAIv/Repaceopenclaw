// [2026-05-17] 用户账号信息页面 — 查看账号信息、修改昵称、修改密码
import { useState, useEffect } from 'react';
import { User, Lock, Save, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../api/auth';

interface UserInfo {
  id: string;
  user_code?: string;
  username: string;
  nickname?: string;
  email: string;
  role: string;
  status: string;
  avatar: string;
  created_at: string;
  primary_department_name?: string | null;
}

export default function AccountSettings() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // 密码修改
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { loadUser(); }, []);

  async function loadUser() {
    try {
      const data = await authApi.me();
      setUser(data);
      setNickname(data.nickname || '');
    } catch (e) {
      console.error('加载用户信息失败', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveNickname() {
    if (!nickname.trim()) { setMsg('昵称不能为空'); return; }
    setSaving(true); setMsg('');
    try {
      const updated = await authApi.updateMe({ nickname: nickname.trim() });
      setUser(updated);
      setMsg('昵称保存成功');
    } catch (e: any) {
      setMsg(e?.response?.data?.error || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    setPwdMsg('');
    if (!oldPwd) { setPwdMsg('请输入原密码'); return; }
    if (!newPwd || newPwd.length < 6) { setPwdMsg('新密码不能少于6位'); return; }
    if (newPwd !== confirmPwd) { setPwdMsg('两次密码输入不一致'); return; }
    try {
      await authApi.changePassword(oldPwd, newPwd);
      setPwdMsg('密码修改成功');
      setOldPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (e: any) {
      setPwdMsg(e?.response?.data?.error || '修改失败');
    }
  }

  const roleMap: Record<string, string> = { super_admin: '超级管理员', admin: '管理员', user: '普通用户' };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>加载中...</div>;
  if (!user) return <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>无法加载用户信息</div>;

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 };
  const labelStyle = { display: 'block' as const, fontSize: 12, color: '#6b7280', marginBottom: 4 };

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1a202c', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <User size={20} color="#d97706" /> 账号信息
      </h2>

      {/* 基本信息卡片 */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 20 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>基本信息</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
          <div><span style={{ color: '#6b7280' }}>用户名：</span>{user.username}</div>
          <div><span style={{ color: '#6b7280' }}>邮箱：</span>{user.email}</div>
          <div><span style={{ color: '#6b7280' }}>角色：</span>{roleMap[user.role] || user.role}</div>
          <div><span style={{ color: '#6b7280' }}>用户编码：</span>{user.user_code || '-'}</div>
          <div><span style={{ color: '#6b7280' }}>所属组织：</span>{user.primary_department_name || '未分配'}</div>
          <div><span style={{ color: '#6b7280' }}>注册时间：</span>{user.created_at?.slice(0, 10) || '-'}</div>
        </div>
      </div>

      {/* 昵称修改 */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 20 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>账号昵称</h4>
        <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>昵称用于展示，不可与其他用户重复</p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder="设置你的昵称"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={handleSaveNickname}
            disabled={saving}
            style={{ padding: '8px 16px', borderRadius: 8, background: '#d97706', color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
          >
            <Save size={14} /> {saving ? '保存中...' : '保存'}
          </button>
        </div>
        {msg && <p style={{ fontSize: 12, marginTop: 8, color: msg.includes('成功') ? '#059669' : '#dc2626' }}>{msg}</p>}
      </div>

      {/* 修改密码 */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Lock size={14} /> 修改密码
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>原密码</label>
            <div style={{ position: 'relative' }}>
              <input type={showOld ? 'text' : 'password'} value={oldPwd} onChange={e => setOldPwd(e.target.value)} style={inputStyle} placeholder="输入当前密码" />
              <button onClick={() => setShowOld(!showOld)} style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>{showOld ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>新密码（至少6位）</label>
            <div style={{ position: 'relative' }}>
              <input type={showNew ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)} style={inputStyle} placeholder="输入新密码" />
              <button onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>{showNew ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>确认新密码</label>
            <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} style={inputStyle} placeholder="再次输入新密码" />
          </div>
          <button
            onClick={handleChangePassword}
            style={{ padding: '10px 20px', borderRadius: 8, background: '#1a202c', color: '#fff', border: 'none', fontSize: 14, cursor: 'pointer', fontWeight: 500, alignSelf: 'flex-start' }}
          >
            确认修改
          </button>
          {pwdMsg && <p style={{ fontSize: 12, color: pwdMsg.includes('成功') ? '#059669' : '#dc2626' }}>{pwdMsg}</p>}
        </div>
      </div>
    </div>
  );
}
