import { useState, useRef, useEffect } from 'react';
import { Send, X } from 'lucide-react';
import type { Message, OpenPanel } from '../../types';
import { MessageBubble } from './MessageBubble';

interface ConversationPanelProps {
  panel: OpenPanel;
  messages: Message[];
  onSend: (panelId: string, content: string) => void;
  onClose: (panelId: string) => void;
  /** 将 AI 消息内容插入到文档编辑器 */
  onInsertToDoc?: (content: string) => void;
  /** 当前面板关联智能体的输出格式，用于消息特殊渲染 */
  outputFormat?: string;
}

export function ConversationPanel({
  panel,
  messages,
  onSend,
  onClose,
  onInsertToDoc,
  outputFormat,
}: ConversationPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);

  // 自动滚动到底部
  useEffect(() => {
    const msgCount = messages?.length || 0;
    // 只在新增消息时自动滚动，流式更新内容时不触发，防止页面闪烁
    if (msgCount > prevMsgCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (msgCount < prevMsgCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
    prevMsgCountRef.current = msgCount;
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(panel.id, input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* 面板头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/30">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
            style={{ backgroundColor: panel.agentColor }}
          >
            {panel.agentName.charAt(0)}
          </div>
          <span className="text-white font-medium text-sm truncate">{panel.agentName}</span>
        </div>
        <button
          onClick={() => onClose(panel.id)}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white mb-3"
              style={{ backgroundColor: panel.agentColor }}
            >
              {panel.agentName.charAt(0)}
            </div>
            <p className="text-slate-400 text-sm">开始与 {panel.agentName} 对话</p>
            <p className="text-slate-500 text-xs mt-1">发送消息获取 AI 回复</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                agentName={panel.agentName}
                agentColor={panel.agentColor}
                outputFormat={outputFormat}
                onInsertToEditor={onInsertToDoc}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 输入区域 */}
      <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
