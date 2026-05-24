/**
 * @file UserDetailModal.tsx
 * @description 用户详情弹窗组件（查看权限 / 编辑用户 / 重置密码）
 */

import { Shield } from 'lucide-react';
import { OrganizationUser, DepartmentNode } from '../../api/adminOrganizations';
import { authApi } from '../../api/auth';
import { ROLE_MAP, STATUS_MAP } from './constants';

interface UserDetailModalProps {
  user: OrganizationUser;
  onClose: () => void;
}

/** 用户权限详情弹窗 */
export function UserDetailModal({ user, onClose }: UserDetailModalProps) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        width: '80%',
        maxWidth: 800,
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <div style={{ padding: 24, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1a202c' }}>用户权限详情</h3>
            <button
              onClick={onClose}
              style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              {user.avatar ? (
                <img src={user.avatar} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 20, color: '#6b7280', fontWeight: 600 }}>
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1a202c' }}>{user.username}</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>{user.email}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>角色</div>
                <div style={{ fontSize: 14, color: '#1a202c' }}>
                  {ROLE_MAP[user.role]?.label || user.role}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>状态</div>
                <div style={{ fontSize: 14, color: '#1a202c' }}>
                  {STATUS_MAP[user.status]?.label || user.status}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>所属组织</div>
                <div style={{ fontSize: 14, color: '#1a202c' }}>
                  {user.primaryDepartmentName || '-'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: '#1a202c', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={16} /> 权限范围
          </h4>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
            <p>权限详情功能正在开发中，将在后续版本中完善。</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface EditUserModalProps {
  user: OrganizationUser;
  departments: DepartmentNode[];
  editDepartmentId: string | null;
  onDepartmentChange: (deptId: string | null) => void;
  onRoleChange: (role: OrganizationUser['role']) => void;
  onStatusChange: (status: OrganizationUser['status']) => void;
  onSave: () => void;
  onCancel: () => void;
}

/** 展平部门树（用于下拉选择） */
function flattenDepts(nodes: DepartmentNode[], level = 0): Array<DepartmentNode & { level: number }> {
  const result: Array<DepartmentNode & { level: number }> = [];
  for (const n of nodes) {
    result.push({ ...n, level });
    if (n.children?.length) result.push(...flattenDepts(n.children, level + 1));
  }
  return result;
}

/** 编辑用户弹窗（含重置密码） */
export function EditUserModal({
  user,
  departments,
  editDepartmentId,
  onDepartmentChange,
  onRoleChange,
  onStatusChange,
  onSave,
  onCancel,
}: EditUserModalProps) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        width: '500px',
        maxWidth: '90%'
      }}>
        <div style={{ padding: 24, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1a202c' }}>编辑用户</h3>
            <button
              onClick={onCancel}
              style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            {user.avatar ? (
              <img src={user.avatar} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 20, color: '#6b7280', fontWeight: 600 }}>
                  {user.username.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1a202c' }}>{user.username}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{user.email}</div>
            </div>
          </div>

          {/* 完整账户信息 */}
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 12, color: '#6b7280' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><span style={{ color: '#9ca3af' }}>ID：</span>{user.id.slice(0, 8)}...</div>
              <div><span style={{ color: '#9ca3af' }}>用户编码：</span>{user.userCode || '-'}</div>
              <div><span style={{ color: '#9ca3af' }}>注册时间：</span>{user.createdAt?.slice(0, 10) || '-'}</div>
              <div><span style={{ color: '#9ca3af' }}>最后登录：</span>{user.lastLoginAt?.slice(0, 10) || '-'}</div>
              <div><span style={{ color: '#9ca3af' }}>微信绑定：</span>{user.wechatBound ? '✅ 已绑定' : '❌ 未绑定'}</div>
              <div><span style={{ color: '#9ca3af' }}>所属组织：</span>{user.primaryDepartmentName || '未分配'}</div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>角色</label>
            <select
              value={user.role}
              onChange={(e) => onRoleChange(e.target.value as OrganizationUser['role'])}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }}
            >
              <option value="super_admin">超级管理员</option>
              <option value="admin">管理员</option>
              <option value="user">普通用户</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>状态</label>
            <select
              value={user.status}
              onChange={(e) => onStatusChange(e.target.value as OrganizationUser['status'])}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }}
            >
              <option value="active">活跃</option>
              <option value="disabled">禁用</option>
            </select>
          </div>

          {/* 组织架构归属选择 */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>所属组织</label>
            <select
              value={editDepartmentId || ''}
              onChange={(e) => onDepartmentChange(e.target.value || null)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }}
            >
              <option value="">未分配</option>
              {flattenDepts(departments).map(dept => (
                <option key={dept.id} value={dept.id}>{'\u00A0\u00A0'.repeat(dept.level)}{dept.level > 0 ? '└ ' : ''}{dept.name}</option>
              ))}
            </select>
          </div>

          {/* 重置密码 */}
          <div style={{ marginBottom: 20, padding: 12, background: '#fefce8', borderRadius: 8, border: '1px solid #fde68a' }}>
            <label style={{ display: 'block', fontSize: 12, color: '#92400e', marginBottom: 6, fontWeight: 500 }}>重置密码</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                id="reset-pwd-input"
                placeholder="输入新密码（至少6位）"
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
              />
              <button
                onClick={async () => {
                  const input = document.getElementById('reset-pwd-input') as HTMLInputElement;
                  const pwd = input?.value;
                  if (!pwd || pwd.length < 6) { alert('密码不能少于6位'); return; }
                  try {
                    await authApi.resetPassword(user.id, pwd);
                    alert('密码重置成功');
                    input.value = '';
                  } catch (e: any) {
                    alert(`重置失败: ${e?.response?.data?.error || e.message}`);
                  }
                }}
                style={{ padding: '8px 14px', borderRadius: 8, background: '#a16207', color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                重置
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              onClick={onCancel}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer' }}
            >
              取消
            </button>
            <button
              onClick={onSave}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#d97706', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 500 }}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
