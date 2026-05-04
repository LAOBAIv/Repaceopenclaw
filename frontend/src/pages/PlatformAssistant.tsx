/**
 * 平台助手页面 — 独立会话界面
 * 不走工作台的标签会话系统，每个用户有专属的平台助手会话
 * 通过 WebSocket 发送消息（和普通智能体同链路，避免 Gateway HTTP 超时）
 *
 * 关键排障结论：这里曾经自建一条页面级 WS，并在 effect cleanup 中直接 close。
 * 当用户切路由 / 页面重渲染 / 连接抖动时，这条 WS 会先断开；而 Gateway 回复通常 10~15s 才回来，
 * 结果就是“回复已生成并入库，但旧 WS 已死，前端看起来像没有回复”。
 * 此外，旧代码 onclose 里的‘重连逻辑’是空实现，实际并不会恢复连接。
 * 因此平台助手必须复用全局 conversationStore 的单例 WS，并在重连后回补 DB 消息，
 * 不能再维护一套页面私有 WS 生命周期。
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, Loader2, Wifi, WifiOff } from 'lucide-react';
import apiClient from '@/api/client';
import { sendConversationMessageOverWs, subscribeConversationWs, useConversationStore } from '@/stores/conversationStore';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string;
  agentIds: string[];
  messages: Message[];
}

export function PlatformAssistant() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wsConnected = useConversationStore((s) => s.wsConnected);
  const connect = useConversationStore((s) => s.connect);

  // 加载或创建平台助手会话
  useEffect(() => {
    let cancelled = false;
    apiClient.get('/conversations/platform-assistant')
      .then(res => {
        if (!cancelled && res.data.data) {
          const conv = res.data.data;
          setConversation(conv);
          setMessages(conv.messages || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // 平台助手复用全局单例 WS。
  // 根因说明：不能在页面级 useEffect 里 new/close WebSocket，
  // 否则路由切换或组件重建会把正在等待 Gateway 回复的连接提前关闭。
  useEffect(() => {
    connect();
  }, [connect]);

  // 发送后/重连后都从 DB 同步该固定会话消息。
  // 这样即便 Gateway 回复落在断连窗口，也能在重连后恢复显示，不再出现“后台有回复，页面没回复”。
  const reloadConversationMessages = useCallback(async () => {
    if (!conversation?.id) return;
    try {
      const res = await apiClient.get(`/conversations/${conversation.id}`);
      const conv = res.data?.data;
      if (conv) {
        setConversation(conv);
        setMessages(conv.messages || []);
      }
    } catch {}
  }, [conversation?.id]);

  useEffect(() => {
    if (!wsConnected || !conversation?.id) return;
    reloadConversationMessages();
  }, [wsConnected, conversation?.id, reloadConversationMessages]);

  useEffect(() => {
    if (!conversation?.id) return;
    return subscribeConversationWs(conversation.id, (data) => {
      if (data.type === 'user_message' && data.message) {
        const msg = data.message;
        setMessages(prev => {
          const filtered = prev.filter(m => !m.id.startsWith('optimistic-') && m.id !== msg.id);
          return [...filtered, msg];
        });
      }

      if (data.type === 'agent_start' && data.messageId) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.messageId)) return prev;
          return [...prev, {
            id: data.messageId,
            role: 'agent',
            content: '',
            createdAt: new Date().toISOString(),
          }];
        });
      }

      if (data.type === 'agent_chunk' && data.messageId && data.chunk) {
        setMessages(prev => prev.map(m =>
          m.id === data.messageId
            ? { ...m, content: m.content + data.chunk }
            : m
        ));
      }

      if (data.type === 'agent_done' && data.messageId && data.message) {
        setMessages(prev => prev.map(m =>
          m.id === data.messageId
            ? { ...data.message, streaming: false }
            : m
        ));
        setSending(false);
      }

      if (data.type === 'error') {
        setMessages(prev => prev.filter(m => !m.id.startsWith('optimistic-')));
        setSending(false);
      }
    });
  }, [conversation?.id]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 自动聚焦输入框
  useEffect(() => {
    inputRef.current?.focus();
  }, [conversation]);

  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if (!content || !conversation || sending) return;

    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setInput('');
    setSending(true);

    try {
      await sendConversationMessageOverWs({
        conversationId: conversation.id,
        agentId: conversation.agentIds?.[0] || '',
        agentIds: conversation.agentIds || [],
        content,
      });
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setSending(false);
    }
  }, [input, conversation, sending]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#f9fafb',
      }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <div style={{ color: '#6b7280', fontSize: 13 }}>正在加载平台助手...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#1f2937' }}>RepaceClaw 平台助手</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>平台功能答疑、使用引导、操作建议</div>
          </div>
        </div>
        {/* 连接状态 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 12,
          background: wsConnected ? '#f0fdf4' : '#fef2f2',
          fontSize: 12,
          color: wsConnected ? '#16a34a' : '#dc2626',
        }}>
          {wsConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {wsConnected ? '已连接' : '未连接'}
        </div>
      </div>

      {/* Messages — 底部加 padding 防止与输入框重叠 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 100px' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div style={{ fontWeight: 600, fontSize: 16, color: '#1f2937', marginBottom: 8 }}>
              你好，我是 RepaceClaw 平台助手
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', maxWidth: 400, margin: '0 auto' }}>
              我可以帮助你了解平台功能、解答使用问题、引导你选择正确的功能入口。
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 16,
              }}
            >
              <div style={{
                display: 'flex',
                gap: 10,
                maxWidth: '70%',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: msg.role === 'user' ? '#3b82f6' : 'linear-gradient(135deg, #3b82f6, #6366f1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {msg.role === 'user'
                    ? <User className="w-4 h-4 text-white" />
                    : <Bot className="w-4 h-4 text-white" />
                  }
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* 智能体名字和时间 */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: msg.role === 'user' ? '#3b82f6' : '#6b7280',
                    }}>
                      {msg.role === 'user' ? '我' : '平台助手'}
                    </span>
                    <span style={{
                      fontSize: 11,
                      color: '#9ca3af',
                    }}>
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  {/* 消息内容 */}
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: msg.role === 'user' ? '#3b82f6' : '#fff',
                    color: msg.role === 'user' ? '#fff' : '#1f2937',
                    fontSize: 13.5,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    border: msg.role === 'agent' ? '1px solid #e5e7eb' : 'none',
                  }}>
                    {msg.content || <Loader2 className="w-4 h-4 animate-spin" />}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} style={{ height: 20 }} />
      </div>

      {/* Input */}
      <div style={{
        padding: '16px 24px',
        background: '#fff',
        borderTop: '1px solid #e5e7eb',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: '8px 12px',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题..."
            rows={1}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 13.5,
              resize: 'none',
              fontFamily: 'inherit',
              color: '#1f2937',
              lineHeight: 1.5,
              maxHeight: 120,
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending || !wsConnected}
            style={{
              width: 34, height: 34, borderRadius: 10,
              border: 'none',
              background: input.trim() && !sending && wsConnected ? '#3b82f6' : '#e5e7eb',
              color: input.trim() && !sending && wsConnected ? '#fff' : '#9ca3af',
              cursor: input.trim() && !sending && wsConnected ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
          平台助手基于 OpenClaw 内核 · 仅用于平台功能答疑
        </div>
      </div>
    </div>
  );
}
