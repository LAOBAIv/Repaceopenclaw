/**
 * @file DepartmentTree.tsx
 * @description 部门管理面板组件（新建 / 编辑 / 删除 / 列表展示）
 */

import { Plus, Edit3, Trash2 } from 'lucide-react';
import { DepartmentNode, OrganizationUser } from '../../api/adminOrganizations';

interface DepartmentTreeProps {
  departments: DepartmentNode[];
  users: OrganizationUser[];
  newDeptName: string;
  newDeptCode: string;
  newDeptParentId: string | null;
  editingDept: DepartmentNode | null;
  editDeptName: string;
  editDeptCode: string;
  onNewDeptNameChange: (v: string) => void;
  onNewDeptCodeChange: (v: string) => void;
  onNewDeptParentIdChange: (v: string | null) => void;
  onCreateDept: () => void;
  onUpdateDept: () => void;
  onDeleteDept: (id: string, name: string) => void;
  onEditDept: (dept: DepartmentNode) => void;
  onEditDeptNameChange: (v: string) => void;
  onEditDeptCodeChange: (v: string) => void;
  onCancelEditDept: () => void;
}

/** 展平部门树（用于下拉选择和列表展示） */
function flattenDepts(nodes: DepartmentNode[], level = 0): Array<DepartmentNode & { level: number }> {
  const result: Array<DepartmentNode & { level: number }> = [];
  for (const n of nodes) {
    result.push({ ...n, level });
    if (n.children?.length) result.push(...flattenDepts(n.children, level + 1));
  }
  return result;
}

/** 部门管理面板 */
export function DepartmentTree({
  departments,
  users,
  newDeptName,
  newDeptCode,
  newDeptParentId,
  editingDept,
  editDeptName,
  editDeptCode,
  onNewDeptNameChange,
  onNewDeptCodeChange,
  onNewDeptParentIdChange,
  onCreateDept,
  onUpdateDept,
  onDeleteDept,
  onEditDept,
  onEditDeptNameChange,
  onEditDeptCodeChange,
  onCancelEditDept,
}: DepartmentTreeProps) {
  const flatDepts = flattenDepts(departments);

  return (
    <div>
      {/* 新建部门 */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 20 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: '#1a202c', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> 新建部门
        </h4>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>部门名称 *</label>
            <input value={newDeptName} onChange={e => onNewDeptNameChange(e.target.value)} placeholder="如：技术部" style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, width: 160 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>部门编码</label>
            <input value={newDeptCode} onChange={e => onNewDeptCodeChange(e.target.value)} placeholder="如：TECH" style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, width: 120 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>上级部门</label>
            <select value={newDeptParentId || ''} onChange={e => onNewDeptParentIdChange(e.target.value || null)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, width: 160 }}>
              <option value="">无（顶级部门）</option>
              {flatDepts.map(d => (
                <option key={d.id} value={d.id}>{'\u00A0'.repeat(d.level * 2)}{d.name}</option>
              ))}
            </select>
          </div>
          <button onClick={onCreateDept} style={{ padding: '6px 16px', borderRadius: 6, background: '#d97706', color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>创建</button>
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
            {flatDepts.map(dept => (
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
                    <button onClick={() => onEditDept(dept)} style={{ padding: '4px 8px', borderRadius: 6, background: '#eff6ff', color: '#2563eb', border: 'none', cursor: 'pointer', fontSize: 12 }} title="编辑"><Edit3 size={14} /></button>
                    <button onClick={() => onDeleteDept(dept.id, dept.name)} style={{ padding: '4px 8px', borderRadius: 6, background: '#fef2f2', color: '#dc2626', border: 'none', cursor: 'pointer', fontSize: 12 }} title="删除"><Trash2 size={14} /></button>
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
              <input value={editDeptName} onChange={e => onEditDeptNameChange(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>部门编码</label>
              <input value={editDeptCode} onChange={e => onEditDeptCodeChange(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }} />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={onCancelEditDept} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer' }}>取消</button>
              <button onClick={onUpdateDept} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#d97706', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 500 }}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
