import { Bot, User } from 'lucide-react';
import type { Message } from '../../types';
import { InsertContentButton } from '../document/InsertContentButton';

interface MessageBubbleProps {
  message: Message;
  agentName?: string;
  agentColor?: string;
  showAvatar?: boolean;
  /** 如果提供，AI 消息将显示"插入到文档"按钮 */
  onInsertToEditor?: (text: string) => void;
}

export function MessageBubble({
  message,
  agentName,
  agentColor = '#6366f1',
  showAvatar = true,
  onInsertToEditor,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.streaming;

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''} mb-4`}>
      {/* 头像 */}
      {showAvatar && (
        <div
          className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-medium mt-0.5`}
          style={!isUser ? { backgroundColor: agentColor } : { backgroundColor: '#475569' }}
        >
          {isUser ? (
            <User size={14} />
          ) : (
            <Bot size={14} />
          )}
        </div>
      )}

      {/* 内容区 */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[78%]`}>
        {/* 发送者名 */}
        {!isUser && agentName && (
          <span className="text-xs text-slate-500 mb-1 px-1">{agentName}</span>
        )}

        {/* 气泡 */}
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed relative ${
            isUser
              ? 'bg-indigo-500 text-white rounded-br-sm'
              : 'bg-slate-700/60 text-slate-200 rounded-bl-sm border border-slate-600/30'
          }`}
        >
          <span className="whitespace-pre-wrap break-words">{message.content}</span>

          {/* Streaming indicator */}
          {isStreaming && (
            <span className="inline-flex items-center gap-0.5 ml-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-xs text-slate-600 mt-1 px-1">
          {new Date(message.createdAt).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>

        {/* Insert to editor button — only for completed agent messages */}
        {!isUser && !isStreaming && onInsertToEditor && message.content.trim().length > 0 && (
          <div className="px-1 w-full">
            <InsertContentButton
              content={message.content}
              agentName={agentName ?? 'AI'}
              agentColor={agentColor}
              onInsert={onInsertToEditor}
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
}
