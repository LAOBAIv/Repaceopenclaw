/**
 * MessageBubble 消息气泡组件
 * 根据发送者类型（人类/智能体）渲染不同样式的消息气泡
 */

import React from 'react';
import type { Message } from './types';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isHuman = message.senderType === 'human';

  return (
    <div style={{
      display: 'flex', gap: 10, padding: '10px 14px',
      borderRadius: 12, maxWidth: '85%',
      background: isHuman ? '#3b82f6' : '#f3f4f6',
      color: isHuman ? '#fff' : '#374151',
      alignSelf: isHuman ? 'flex-end' : 'flex-start',
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>
        {isHuman ? '😎' : '🤖'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{message.senderName}</span>
          <span style={{ fontSize: 11, opacity: 0.6 }}>
            {new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p style={{ fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
          {message.content}
        </p>
      </div>
    </div>
  );
}
