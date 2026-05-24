/**
 * GroupChat 群聊主页面
 * 包含聊天消息区域、输入区域和成员侧栏
 */

import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Bot, User, UserPlus, X } from 'lucide-react';
import type { Message, Agent } from './types';
import { MessageBubble } from './MessageBubble';
import { AddMemberModal } from './AddMemberModal';
import { DEFAULT_PROJECT_TITLE, AI_REPLY_DELAY_MS } from './constants';

export default function GroupChat() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [projectTitle, setProjectTitle] = useState(DEFAULT_PROJECT_TITLE);
  const [showAddMember, setShowAddMember] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 获取 token
  const getToken = () => {
    try {
      const raw = sessionStorage.getItem('repaceclaw-auth');
      return raw ? JSON.parse(raw).state.token : '';
    } catch { return ''; }
  };

  // 加载项目信息
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    })
      .then(r => r.json())
      .then(res => {
        if (res.data) setProjectTitle(res.data.title || DEFAULT_PROJECT_TITLE);
      })
      .catch(() => {});
  }, [projectId]);

  // 加载所有 Agent
  useEffect(() => {
    fetch('/api/agents', {
      headers: { Authorization: `Bearer ${getToken()}` }
    })
      .then(r => r.json())
      .then(res => {
        if (res.data) {
          const agents = res.data.map((a: { id: string; name?: string; title?: string }) => ({ // [2026-05-24] 类型安全
            id: a.id,
            name: a.name || a.title || 'Agent',
            avatar: '🤖',
          }));
          setAllAgents(agents);
        }
      })
      .catch(() => {});
  }, []);

  // 加载项目关联的 Agent（TODO: 接入后端 API 获取项目成员）
  useEffect(() => {
    // 暂时默认无成员，后续接入后端后从项目数据中读取
    setMemberIds([]);
  }, [projectId]);

  // 加载历史消息（TODO: 接入后端 API）
  useEffect(() => {
    setMessages([
      {
        id: 'demo-1',
        senderType: 'agent',
        senderId: 'agent_1',
        senderName: '系统助手',
        content: `欢迎加入「${projectTitle}」群聊！\n\n目前群聊功能还在开发中，暂时支持界面预览。\n\n你可以在右侧成员栏添加或删除 AI 成员。`,
        createdAt: new Date().toISOString(),
      },
    ]);
  }, [projectTitle]);

  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 添加成员
  const handleAddMember = (agentId: string) => {
    setMemberIds(prev => prev.includes(agentId) ? prev : [...prev, agentId]);
    // 如果所有成员都已加入，关闭弹窗
    const remaining = allAgents.filter(a => !memberIds.includes(a.id) && a.id !== agentId);
    if (remaining.length === 0) setShowAddMember(false);
  };

  // 删除成员
  const handleRemoveMember = (agentId: string) => {
    if (!confirm('确定要移除该成员吗？')) return;
    setMemberIds(prev => prev.filter(id => id !== agentId));
  };

  // 发送消息（TODO: 接入 WebSocket）
  const sendMessage = () => {
    if (!input.trim()) return;
    const msg: Message = {
      id: `msg-${Date.now()}`,
      senderType: 'human',
      senderId: 'user',
      senderName: '我',
      content: input.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, msg]);
    setInput('');

    // 模拟 AI 回复
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}-reply`,
        senderType: 'agent',
        senderId: 'agent_1',
        senderName: '系统助手',
        content: '群聊功能开发中，暂时无法处理消息。',
        createdAt: new Date().toISOString(),
      }]);
    }, AI_REPLY_DELAY_MS);
  };

  // 当前群内成员列表
  const members = memberIds.map(id => allAgents.find(a => a.id === id)).filter(Boolean) as Agent[];

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f9fafb' }}>
      {/* ── 左侧：聊天区域 ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* 顶部栏 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', background: '#fff', borderBottom: '1px solid #e5e7eb',
          flexShrink: 0,
        }}>
          <button
            onClick={() => navigate('/Projects')}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 10px', borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer', color: '#6b7280',
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>{projectTitle}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              {members.length + 1} 个成员
            </div>
          </div>
        </div>

        {/* 消息区域 */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px 20px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div style={{
          padding: '12px 16px', background: '#fff', borderTop: '1px solid #e5e7eb',
          display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0,
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="输入消息..."
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 10,
              border: '1px solid #d1d5db', fontSize: 14, outline: 'none',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40, borderRadius: 10, border: 'none',
              background: input.trim() ? '#3b82f6' : '#d1d5db',
              color: '#fff', cursor: input.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* ── 右侧：成员列表（固定侧栏） ── */}
      <div style={{
        width: 240, flexShrink: 0, background: '#fff', borderLeft: '1px solid #e5e7eb',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* 成员栏头部 */}
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#374151' }}>
            群成员 ({members.length + 1})
          </span>
          <button
            onClick={() => setShowAddMember(true)}
            title="添加成员"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db',
              background: '#fff', cursor: 'pointer', fontSize: 12, color: '#3b82f6',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
          >
            <UserPlus size={14} />
            添加
          </button>
        </div>

        {/* 成员列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {/* 用户（固定，不可删除） */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 8, marginBottom: 2,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', flexShrink: 0,
            }}>
              <User size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>你</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>管理员</div>
            </div>
          </div>

          {/* Agent 成员 */}
          {members.map(agent => (
            <div
              key={agent.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8, marginBottom: 2,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: '#f3f4f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}>
                🤖
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 500, color: '#374151',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {agent.name}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>AI 智能体</div>
              </div>
              <button
                onClick={() => handleRemoveMember(agent.id)}
                title="移除成员"
                style={{
                  padding: 4, borderRadius: 6, border: 'none',
                  background: 'transparent', cursor: 'pointer', color: '#d1d5db',
                  flexShrink: 0, transition: 'color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#d1d5db'; }}
              >
                <X size={14} />
              </button>
            </div>
          ))}

          {members.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '32px 12px', color: '#9ca3af', fontSize: 13,
            }}>
              <Bot size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
              <div>暂无 AI 成员</div>
              <button
                onClick={() => setShowAddMember(true)}
                style={{
                  marginTop: 8, padding: '6px 16px', borderRadius: 6,
                  border: '1px solid #d1d5db', background: '#fff',
                  fontSize: 12, color: '#3b82f6', cursor: 'pointer',
                }}
              >
                添加智能体
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 添加成员弹窗 */}
      {showAddMember && (
        <AddMemberModal
          allAgents={allAgents}
          memberIds={memberIds}
          onAdd={handleAddMember}
          onClose={() => setShowAddMember(false)}
        />
      )}
    </div>
  );
}
