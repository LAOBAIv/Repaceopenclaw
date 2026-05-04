import { useState, useEffect } from 'react';
import { Cpu, Trash2, RefreshCw, Search, Users } from 'lucide-react';
import { adminUserAgentsApi, UserAgent } from '../api/adminUserAgents';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: '活跃', color: '#059669', bg: '#ecfdf5' },
  idle:   { label: '空闲', color: '#d97706', bg: '#fef3c7' },
  busy:   { label: '忙碌', color: '#dc2626', bg: '#fef2f2' },
};

const VISIBILITY_MAP: Record<string, string> = {
  private:  '私有',
  public:   '公开',
  template: '模板',
};

export function UserAgentsAdmin() {
  const [agents, setAgents] = useState<UserAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterUserId, setFilterUserId] = useState<string>('');

  useEffect(() => { loadAgents(); }, []);

  async function loadAgents() {
    setLoading(true);
    try {
      const data = await adminUserAgentsApi.list();
      setAgents(data);
    } catch (e) { console.error('加载智能体列表失败:', e); }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除此智能体？此操作不可恢复。')) return;
    try {
      await adminUserAgentsApi.delete(id);
      loadAgents();
    } catch (e: any) { alert(`删除失败: ${e.message}`); }
  }

  async function handleStatusChange(id: string, status: 'active' | 'idle' | 'busy') {
    try {
      await adminUserAgentsApi.updateStatus(id, status);
      loadAgents();
    } catch (e: any) { alert(`更新失败: ${e.message}`); }
  }

  // 提取所有用户 ID 用于筛选
  const userIds = [...new Set(agents.map(a => a.userId).filter(Boolean))];

  // 筛选
  const filtered = agents.filter(a => {
    const matchSearch = !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.user?.username || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.user?.email || '').toLowerCase().includes(search.toLowerCase());
    const matchUser = !filterUserId || a.userId === filterUserId;
    return matchSearch && matchUser;
  });

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>加载智能体列表...</div>;

  return (
    <div style={{ padding: 24, background: 'var(--body-bg)', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1a202c', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Cpu size={20} color="#d97706" /> 用户智能体管理
        </h2>
        <button
          onClick={loadAgents}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: 13 }}
        >
          <RefreshCw size={14} /> 刷新
        </button>
      </div>

      {/* 统计 + 筛选 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <Users size={14} color="#6b7280" />
          <span style={{ fontSize: 13, color: '#374151' }}>共 <b>{agents.length}</b> 个智能体，<b>{userIds.length}</b> 个用户</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <Search size={14} color="#9ca3af" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索智能体 / 用户名 / 邮箱"
            style={{ border: 'none', outline: 'none', fontSize: 13, width: 220, background: 'transparent' }}
          />
        </div>
        <select
          value={filterUserId}
          onChange={e => setFilterUserId(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, background: '#fff', color: '#374151' }}
        >
          <option value="">全部用户</option>
          {userIds.map(uid => {
            const agent = agents.find(a => a.userId === uid);
            return (
              <option key={uid} value={uid}>
                {agent?.user?.username || uid.slice(0, 8)} ({uid.slice(0, 8)}...)
              </option>
            );
          })}
        </select>
      </div>

      {/* 表格 */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>名称</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>所属用户</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>模型</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>状态</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>可见性</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Token</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>创建时间</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => {
              const statusInfo = STATUS_MAP[a.status] || STATUS_MAP.idle;
              return (
                <tr key={a.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: a.color || '#3b82f6' }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#1a202c' }}>{a.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {a.user ? (
                      <div>
                        <div style={{ fontSize: 13, color: '#374151' }}>{a.user.username || '-'}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{a.user.email || ''}</div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>未关联</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{a.modelName || '-'}</span>
                    {a.modelProvider && (
                      <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>({a.modelProvider})</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <select
                      value={a.status}
                      onChange={e => handleStatusChange(a.id, e.target.value as any)}
                      style={{
                        fontSize: 12, padding: '2px 8px', borderRadius: 4, border: 'none',
                        background: statusInfo.bg, color: statusInfo.color, fontWeight: 500, cursor: 'pointer',
                      }}
                    >
                      <option value="active">活跃</option>
                      <option value="idle">空闲</option>
                      <option value="busy">忙碌</option>
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{VISIBILITY_MAP[a.visibility] || a.visibility}</span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
                    {a.tokenUsed.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 11, color: '#9ca3af' }}>
                    {new Date(a.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDelete(a.id)}
                      style={{ padding: '4px 8px', borderRadius: 6, background: '#fef2f2', color: '#dc2626', border: 'none', cursor: 'pointer', fontSize: 12 }}
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
            {agents.length === 0 ? '暂无智能体' : '没有匹配的搜索结果'}
          </div>
        )}
      </div>
    </div>
  );
}
