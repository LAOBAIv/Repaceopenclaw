/**
 * AddMemberModal 添加成员弹窗组件
 * 提供搜索和选择智能体加入群聊的功能
 */

import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import type { Agent } from './types';

interface AddMemberModalProps {
  allAgents: Agent[];
  memberIds: string[];
  onAdd: (agentId: string) => void;
  onClose: () => void;
}

export function AddMemberModal({
  allAgents,
  memberIds,
  onAdd,
  onClose,
}: AddMemberModalProps) {
  const [search, setSearch] = useState('');

  // 过滤掉已加入的成员
  const available = allAgents.filter(a => !memberIds.includes(a.id));
  const filtered = search
    ? available.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
    : available;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div style={{
        position: 'relative', width: 380, maxHeight: '70vh',
        background: '#fff', borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* 头部 */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>添加成员</span>
          <button
            onClick={onClose}
            style={{
              padding: 4, borderRadius: 6, border: 'none',
              background: 'transparent', cursor: 'pointer', color: '#9ca3af',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 搜索 */}
        <div style={{ padding: '12px 20px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索智能体..."
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              border: '1px solid #d1d5db', fontSize: 14, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* 列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 13 }}>
              {available.length === 0 ? '所有智能体已加入' : '没有匹配的智能体'}
            </div>
          ) : (
            filtered.map(agent => (
              <div
                key={agent.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: 8, marginBottom: 4,
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                onClick={() => { onAdd(agent.id); }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: '#f3f4f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                  }}>
                    🤖
                  </div>
                  <span style={{ fontSize: 14, color: '#374151' }}>{agent.name}</span>
                </div>
                <Check size={16} color="#3b82f6" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
