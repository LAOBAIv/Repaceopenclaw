import { useState, useEffect } from 'react';
import { Pencil, Trash2, Plus, X, Save, LayoutTemplate } from 'lucide-react';
import { adminTemplatesApi } from '../api/adminTemplates';
import { AgentTemplate } from '../types';
import { CATEGORY_LABELS } from '../constants/templateConstants';

// 所有分类 ID 列表（从 CATEGORY_LABELS 中提取，不含 'all'）
const CATEGORIES = Object.keys(CATEGORY_LABELS).filter(k => k !== 'all');

export function TemplatesAdmin() {
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AgentTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<AgentTemplate>>({});

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const data = await adminTemplatesApi.list();
      setTemplates(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: '', category: 'general', emoji: '🤖', color: '#3b82f6', vibe: '专业', description: '', systemPrompt: '', writingStyle: '专业', expertise: [], outputFormat: 'markdown' });
    setShowForm(true);
  }

  function openEdit(t: AgentTemplate) {
    setEditing(t);
    setForm(t);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name) return;
    setSaving(true);
    try {
      if (editing) {
        await adminTemplatesApi.update(editing.id, form);
      } else {
        await adminTemplatesApi.create(form);
      }
      setShowForm(false);
      loadTemplates();
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除此模板？')) return;
    try {
      await adminTemplatesApi.delete(id);
      loadTemplates();
    } catch (e) { console.error(e); }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>加载模板...</div>;

  return (
    <div style={{ padding: 24, background: 'var(--body-bg)', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1a202c', display: 'flex', alignItems: 'center', gap: 8 }}>
          <LayoutTemplate size={20} /> 模板管理
        </h2>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13 }}>
          <Plus size={16} /> 新建模板
        </button>
      </div>

      {/* Templates Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>图标</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>名称</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>分类</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>简介</th>
              <th style={{ padding: 12, textAlign: 'right', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {templates.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: 12, fontSize: 20 }}>{t.emoji}</td>
                <td style={{ padding: 12, fontSize: 13, color: '#1a202c', fontWeight: 500 }}>{t.name}</td>
                <td style={{ padding: 12, fontSize: 12, color: '#6b7280' }}>{CATEGORY_LABELS[t.category] || t.category}</td>
                <td style={{ padding: 12, fontSize: 12, color: '#6b7280', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.vibe}</td>
                <td style={{ padding: 12, textAlign: 'right' }}>
                  <button onClick={() => openEdit(t)} style={{ padding: '4px 8px', borderRadius: 6, background: '#eff6ff', color: '#2563eb', border: 'none', cursor: 'pointer', marginRight: 8, fontSize: 12 }}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(t.id)} style={{ padding: '4px 8px', borderRadius: 6, background: '#fef2f2', color: '#dc2626', border: 'none', cursor: 'pointer', fontSize: 12 }}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {templates.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>暂无模板</div>}
      </div>

      {/* Edit Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 560, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>{editing ? '编辑模板' : '新建模板'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {/* Basic Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>名称 *</label>
                  <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>分类</label>
                  <select value={form.category || 'general'} onChange={e => setForm({ ...form, category: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13 }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>图标</label>
                  <input value={form.emoji || ''} onChange={e => setForm({ ...form, emoji: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>颜色</label>
                  <input value={form.color || ''} onChange={e => setForm({ ...form, color: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13 }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>简介</label>
                <input value={form.vibe || ''} onChange={e => setForm({ ...form, vibe: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13 }} />
              </div>

              <div>
                <label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>描述</label>
                <textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, resize: 'vertical' }} />
              </div>

              <div>
                <label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>角色设定（systemPrompt）</label>
                <textarea value={form.systemPrompt || ''} onChange={e => setForm({ ...form, systemPrompt: e.target.value })} rows={4} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, resize: 'vertical' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>写作风格</label>
                  <input value={form.writingStyle || ''} onChange={e => setForm({ ...form, writingStyle: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>输出格式</label>
                  <input value={form.outputFormat || ''} onChange={e => setForm({ ...form, outputFormat: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13 }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>专长领域（逗号分隔）</label>
                <input value={(form.expertise || []).join(', ')} onChange={e => setForm({ ...form, expertise: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13 }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: 8, background: '#f3f4f6', color: '#6b7280', border: 'none', cursor: 'pointer', fontSize: 13 }}>取消</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Save size={16} /> {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}