/**
 * 项目弹窗组件
 * 用于创建和编辑项目
 */

import { useState } from 'react';
import { ProjectModalProps } from './types';

export function ProjectModal({
  initial,
  onSave,
  onClose,
}: ProjectModalProps) {
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [tags, setTags] = useState(initial?.tags?.join(', ') || '');
  const [status, setStatus] = useState<'active' | 'archived'>(initial?.status || 'active');
  const [priority, setPriority] = useState<'high' | 'mid' | 'low'>(initial?.priority || 'mid');
  const [goal, setGoal] = useState(initial?.goal || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return alert('请输入项目名称');
    setLoading(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        status,
        priority,
        goal: goal.trim(),
      });
      onClose();
    } catch (e: any) {
      alert(e?.response?.data?.error || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div style={{
        position: 'relative', width: 520, maxHeight: '85vh', overflowY: 'auto',
        background: '#fff', borderRadius: 16, padding: '28px 24px 20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
          {initial ? '编辑项目' : '创建项目'}
        </h2>

        {/* 项目名称 */}
        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>项目名称 *</span>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="输入项目名称"
            style={{
              width: '100%', marginTop: 6, padding: '8px 12px',
              border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none',
            }}
          />
        </label>

        {/* 描述 */}
        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>描述</span>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="项目描述（可选）"
            rows={3}
            style={{
              width: '100%', marginTop: 6, padding: '8px 12px',
              border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical',
            }}
          />
        </label>

        {/* 目标 */}
        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>项目目标</span>
          <textarea
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="项目要达成的目标（可选）"
            rows={2}
            style={{
              width: '100%', marginTop: 6, padding: '8px 12px',
              border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical',
            }}
          />
        </label>

        {/* 优先级 + 状态 */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
          <label style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>优先级</span>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as any)}
              style={{
                width: '100%', marginTop: 6, padding: '8px 12px',
                border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none',
              }}
            >
              <option value="high">高优先级</option>
              <option value="mid">中优先级</option>
              <option value="low">低优先级</option>
            </select>
          </label>
          <label style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>状态</span>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              style={{
                width: '100%', marginTop: 6, padding: '8px 12px',
                border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none',
              }}
            >
              <option value="active">进行中</option>
              <option value="archived">已归档</option>
            </select>
          </label>
        </div>

        {/* 标签 */}
        <label style={{ display: 'block', marginBottom: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>标签</span>
          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="用逗号分隔多个标签"
            style={{
              width: '100%', marginTop: 6, padding: '8px 12px',
              border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none',
            }}
          />
        </label>

        {/* 按钮 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: 8, border: '1px solid #d1d5db',
              background: '#fff', fontSize: 14, cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              padding: '8px 24px', borderRadius: 8, border: 'none',
              background: loading ? '#93c5fd' : '#3b82f6', color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
