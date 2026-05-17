import { useState, useEffect } from 'react';
import { Users, Shield, Building, RefreshCw, Search, Edit3, Trash2, Eye, MessageCircle, Plus, FolderTree, Lock } from 'lucide-react';
import { adminOrganizationsApi, OrganizationUser, DepartmentNode } from '../api/adminOrganizations';
import { authApi } from '../api/auth';
import { useAuthStore } from '../stores/authStore';

const ROLE_MAP: Record<string, { label: string; color: string; bg: string }> = {
  super_admin: { label: '超级管理员', color: '#d97706', bg: '#fef3c7' },
  admin: { label: '管理员', color: '#2563eb', bg: '#eff6ff' },
  user: { label: '普通用户', color: '#6b7280', bg: '#f3f4f6' },
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: '活跃', color: '#059669', bg: '#ecfdf5' },
  disabled: { label: '禁用', color: '#dc2626', bg: '#fef2f2' },
};

export function UserManagement() {
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [departments, setDepartments] = useState<DepartmentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<OrganizationUser | null>(null);
  const [editingUser, setEditingUser] = useState<OrganizationUser | null>(null);
  const [editDepartmentId, setEditDepartmentId] = useState<string | null>(null);
  const [showUserDetail, setShowUserDetail] = useState(false);
  // [2026-05-17] Tab 切换 + 组织管理状态
  const [activeTab, setActiveTab] = useState<'users' | 'org'>('users');
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newDeptParentId, setNewDeptParentId] = useState<string | null>(null);
  const [editingDept, setEditingDept] = useState<DepartmentNode | null>(null);
  const [editDeptName, setEditDeptName] = useState('');
  const [editDeptCode, setEditDeptCode] = useState('');

  useEffect(() => {
    loadUsers();
    loadDepartments();
  }, []);

  async function loadDepartments() {
    try {
      const data = await adminOrganizationsApi.departments();
      setDepartments(data);
    } catch (e) {
      console.error('加载组织列表失败:', e);
    }
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await adminOrganizationsApi.users();
      setUsers(data);
    } catch (e) {
      console.error('加载用户列表失败:', e);
    }
    setLoading(false);
  }

  async function handleEdit(user: OrganizationUser) {
    setEditingUser(user);
    setEditDepartmentId(user.primaryDepartmentId || null);
  }

  async function handleSaveEdit() {
    if (!editingUser) return;
    
    try {
      // 更新用户角色/状态
      await adminOrganizationsApi.updateUser(editingUser.id, {
        role: editingUser.role,
        status: editingUser.status,
        avatar: editingUser.avatar
      });
      
      // [2026-05-17] 更新组织架构归属
      if (editDepartmentId !== editingUser.primaryDepartmentId) {
        await adminOrganizationsApi.assignUserDepartment(editingUser.id, editDepartmentId);
      }
      
      // 刷新列表
      loadUsers();
      setEditingUser(null);
    } catch (e: any) {
      alert(`更新失败: ${e.message}`);
    }
  }

  // [2026-05-17] 实现删除用户功能
  async function handleDelete(id: string) {
    const user = users.find(u => u.id === id);
    if (!user) return;
    if (user.role === 'super_admin') {
      alert('不能删除超级管理员');
      return;
    }
    if (!confirm(`确定删除用户「${user.username}」？\n此操作将删除该用户的所有数据（会话、智能体、微信绑定等），不可恢复。`)) return;
    try {
      await adminOrganizationsApi.deleteUser(id);
      loadUsers();
    } catch (e: any) {
      alert(`删除失败: ${e.message || '未知错误'}`);
    }
  }

  async function handleViewPermissions(userId: string) {
    try {
      const permissions = await adminOrganizationsApi.userPermissions(userId);
      setSelectedUser(users.find(u => u.id === userId) || null);
      setShowUserDetail(true);
    } catch (e: any) {
      alert(`获取权限信息失败: ${e.message}`);
    }
  }

  // [2026-05-17] 组织架构管理方法
  async function handleCreateDept() {
    if (!newDeptName.trim()) { alert('请输入部门名称'); return; }
    try {
      await adminOrganizationsApi.createDepartment({
        name: newDeptName.trim(),
        departmentCode: newDeptCode.trim() || undefined,
        parentId: newDeptParentId || undefined,
      });
      setNewDeptName('');
      setNewDeptCode('');
      setNewDeptParentId(null);
      loadDepartments();
    } catch (e: any) {
      alert(`创建失败: ${e.message}`);
    }
  }

  async function handleUpdateDept() {
    if (!editingDept) return;
    try {
      await adminOrganizationsApi.updateDepartment(editingDept.id, {
        name: editDeptName.trim() || undefined,
        departmentCode: editDeptCode.trim() || undefined,
      });
      setEditingDept(null);
      loadDepartments();
    } catch (e: any) {
      alert(`更新失败: ${e.message}`);
    }
  }

  async function handleDeleteDept(id: string, name: string) {
    if (!confirm(`确定删除部门「${name}」？`)) return;
    try {
      await adminOrganizationsApi.deleteDepartment(id);
      loadDepartments();
    } catch (e: any) {
      alert(`删除失败: ${e.message}`);
    }
  }

  // [2026-05-17] 管理员重置用户密码
  async function handleResetPassword(userId: string, username: string) {
    const newPwd = prompt(`重置用户「${username}」的密码\n请输入新密码（至少6位）:`);
    if (!newPwd) return;
    if (newPwd.length < 6) { alert('密码不能少于6位'); return; }
    try {
      await authApi.resetPassword(userId, newPwd);
      alert(`用户「${username}」密码已重置`);
    } catch (e: any) {
      alert(`重置失败: ${e?.response?.data?.error || e.message}`);
    }
  }

  // 展平部门树（用于显示）
  function flattenDepts(nodes: DepartmentNode[], level = 0): Array<DepartmentNode & { level: number }> {
    const result: Array<DepartmentNode & { level: number }> = [];
    for (const n of nodes) {
      result.push({ ...n, level });
      if (n.children?.length) result.push(...flattenDepts(n.children, level + 1));
    }
    return result;
  }

  // 筛选用户
  const filteredUsers = users.filter(user => {
    const matchSearch = !search ||
      user.username.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      (user.primaryDepartmentName || '').toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', background: 'var(--body-bg)', minHeight: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <Users size={32} color="#6b7280" />
          <span style={{ fontSize: 16, color: '#6b7280' }}>加载用户列表...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: 'var(--body-bg)', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1a202c', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={20} color="#d97706" /> 用户与组织管理
        </h2>
        <button
          onClick={() => { loadUsers(); loadDepartments(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: 13 }}
        >
          <RefreshCw size={14} /> 刷新
        </button>
      </div>

      {/* [2026-05-17] Tab 切换 */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #e5e7eb' }}>
        <button
          onClick={() => setActiveTab('users')}
          style={{ padding: '10px 20px', fontSize: 14, fontWeight: activeTab === 'users' ? 600 : 400, color: activeTab === 'users' ? '#d97706' : '#6b7280', background: 'none', border: 'none', borderBottom: activeTab === 'users' ? '2px solid #d97706' : '2px solid transparent', marginBottom: -2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Users size={15} /> 用户管理
        </button>
        <button
          onClick={() => setActiveTab('org')}
          style={{ padding: '10px 20px', fontSize: 14, fontWeight: activeTab === 'org' ? 600 : 400, color: activeTab === 'org' ? '#d97706' : '#6b7280', background: 'none', border: 'none', borderBottom: activeTab === 'org' ? '2px solid #d97706' : '2px solid transparent', marginBottom: -2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <FolderTree size={15} /> 组织架构
        </button>
      </div>

      {activeTab === 'users' && (<>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <Users size={14} color="#6b7280" />
          <span style={{ fontSize: 13, color: '#374151' }}>共 <b>{users.length}</b> 个用户</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <Search size={14} color="#9ca3af" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索用户名 / 邮箱 / 组织"
            style={{ border: 'none', outline: 'none', fontSize: 13, width: 220, background: 'transparent' }}
          />
        </div>
      </div>

      {/* 用户表格 */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>用户名</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>邮箱</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>角色</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>状态</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>所属组织</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>微信绑定</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>最后登录</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => {
              const roleInfo = ROLE_MAP[user.role] || ROLE_MAP.user;
              const statusInfo = STATUS_MAP[user.status] || STATUS_MAP.active;
              return (
                <tr key={user.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {user.avatar ? (
                        <img src={user.avatar} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
                            {user.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#1a202c' }}>{user.username}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b7280' }}>{user.email}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: roleInfo.bg, color: roleInfo.color, fontWeight: 500 }}>
                      {roleInfo.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: statusInfo.bg, color: statusInfo.color, fontWeight: 500 }}>
                      {statusInfo.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b7280' }}>
                    {user.primaryDepartmentName || '-'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {user.wechatBound ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#ecfdf5', color: '#059669', fontWeight: 500 }}>
                        <MessageCircle size={12} /> 已绑定
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#f3f4f6', color: '#9ca3af' }}>未绑定</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 11, color: '#9ca3af' }}>
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('zh-CN') : '-'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        onClick={() => handleViewPermissions(user.id)}
                        style={{ padding: '4px 8px', borderRadius: 6, background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer', fontSize: 12 }}
                        title="查看权限"
                      >
                        <Eye size={14} />
                      </button>
                      {currentUser?.role === 'super_admin' && (
                        <>
                          <button
                            onClick={() => handleEdit(user)}
                            style={{ padding: '4px 8px', borderRadius: 6, background: '#eff6ff', color: '#2563eb', border: 'none', cursor: 'pointer', fontSize: 12 }}
                            title="编辑"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            style={{ padding: '4px 8px', borderRadius: 6, background: '#fef2f2', color: '#dc2626', border: 'none', cursor: 'pointer', fontSize: 12 }}
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredUsers.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
            {users.length === 0 ? '暂无用户' : '没有匹配的搜索结果'}
          </div>
        )}
      </div>

      {/* 用户详情模态框 */}
      {showUserDetail && selectedUser && (
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
                  onClick={() => setShowUserDetail(false)}
                  style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>
              
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  {selectedUser.avatar ? (
                    <img src={selectedUser.avatar} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 20, color: '#6b7280', fontWeight: 600 }}>
                        {selectedUser.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#1a202c' }}>{selectedUser.username}</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{selectedUser.email}</div>
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>角色</div>
                    <div style={{ fontSize: 14, color: '#1a202c' }}>
                      {ROLE_MAP[selectedUser.role]?.label || selectedUser.role}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>状态</div>
                    <div style={{ fontSize: 14, color: '#1a202c' }}>
                      {STATUS_MAP[selectedUser.status]?.label || selectedUser.status}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>所属组织</div>
                    <div style={{ fontSize: 14, color: '#1a202c' }}>
                      {selectedUser.primaryDepartmentName || '-'}
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
      )}

      {/* 编辑用户模态框 */}
      {editingUser && (
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
                  onClick={() => setEditingUser(null)}
                  style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                {editingUser.avatar ? (
                  <img src={editingUser.avatar} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 20, color: '#6b7280', fontWeight: 600 }}>
                      {editingUser.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#1a202c' }}>{editingUser.username}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{editingUser.email}</div>
                </div>
              </div>

              {/* [2026-05-17] 完整账户信息 */}
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 12, color: '#6b7280' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div><span style={{ color: '#9ca3af' }}>ID：</span>{editingUser.id.slice(0, 8)}...</div>
                  <div><span style={{ color: '#9ca3af' }}>用户编码：</span>{editingUser.userCode || '-'}</div>
                  <div><span style={{ color: '#9ca3af' }}>注册时间：</span>{editingUser.createdAt?.slice(0, 10) || '-'}</div>
                  <div><span style={{ color: '#9ca3af' }}>最后登录：</span>{editingUser.lastLoginAt?.slice(0, 10) || '-'}</div>
                  <div><span style={{ color: '#9ca3af' }}>微信绑定：</span>{editingUser.wechatBound ? '✅ 已绑定' : '❌ 未绑定'}</div>
                  <div><span style={{ color: '#9ca3af' }}>所属组织：</span>{editingUser.primaryDepartmentName || '未分配'}</div>
                </div>
              </div>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>角色</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({...editingUser, role: e.target.value as any})}
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
                  value={editingUser.status}
                  onChange={(e) => setEditingUser({...editingUser, status: e.target.value})}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }}
                >
                  <option value="active">活跃</option>
                  <option value="disabled">禁用</option>
                </select>
              </div>
              
              {/* [2026-05-17] 组织架构归属选择 */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>所属组织</label>
                <select
                  value={editDepartmentId || ''}
                  onChange={(e) => setEditDepartmentId(e.target.value || null)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }}
                >
                  <option value="">未分配</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              {/* [2026-05-17] 重置密码 */}
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
                        await authApi.resetPassword(editingUser.id, pwd);
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
                  onClick={() => setEditingUser(null)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer' }}
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEdit}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#d97706', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 500 }}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </>)}

      {/* [2026-05-17] 组织架构 Tab */}
      {activeTab === 'org' && (
        <div>
          {/* 新建部门 */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: '#1a202c', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> 新建部门
            </h4>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>部门名称 *</label>
                <input value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="如：技术部" style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, width: 160 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>部门编码</label>
                <input value={newDeptCode} onChange={e => setNewDeptCode(e.target.value)} placeholder="如：TECH" style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, width: 120 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>上级部门</label>
                <select value={newDeptParentId || ''} onChange={e => setNewDeptParentId(e.target.value || null)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, width: 160 }}>
                  <option value="">无（顶级部门）</option>
                  {flattenDepts(departments).map(d => (
                    <option key={d.id} value={d.id}>{'\u00A0'.repeat(d.level * 2)}{d.name}</option>
                  ))}
                </select>
              </div>
              <button onClick={handleCreateDept} style={{ padding: '6px 16px', borderRadius: 6, background: '#d97706', color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>创建</button>
            </div>
          </div>

          {/* 部门列表 */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>部门名称</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>编码</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>成员数</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {flattenDepts(departments).map(dept => (
                  <tr key={dept.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      <span style={{ marginLeft: dept.level * 20 }}>{dept.level > 0 ? '└ ' : ''}{dept.name}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b7280' }}>{dept.departmentCode || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b7280' }}>
                      {users.filter(u => u.primaryDepartmentId === dept.id).length} 人
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setEditingDept(dept); setEditDeptName(dept.name); setEditDeptCode(dept.departmentCode || ''); }} style={{ padding: '4px 8px', borderRadius: 6, background: '#eff6ff', color: '#2563eb', border: 'none', cursor: 'pointer', fontSize: 12 }} title="编辑"><Edit3 size={14} /></button>
                        <button onClick={() => handleDeleteDept(dept.id, dept.name)} style={{ padding: '4px 8px', borderRadius: 6, background: '#fef2f2', color: '#dc2626', border: 'none', cursor: 'pointer', fontSize: 12 }} title="删除"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {departments.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>暂无部门，请在上方创建</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 编辑部门模态框 */}
          {editingDept && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#fff', borderRadius: 12, width: 400, maxWidth: '90%', padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>编辑部门</h3>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>部门名称</label>
                  <input value={editDeptName} onChange={e => setEditDeptName(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>部门编码</label>
                  <input value={editDeptCode} onChange={e => setEditDeptCode(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }} />
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditingDept(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer' }}>取消</button>
                  <button onClick={handleUpdateDept} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#d97706', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 500 }}>保存</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}