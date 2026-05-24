/**
 * CodeBlock 代码块组件
 *
 * 带复制按钮 + 自动换行，用于 Markdown 中的代码块渲染。
 */
import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  codeText: string;
  language: string;
  isUser: boolean;
  props: Record<string, unknown>;
}

export function CodeBlock({ codeText, language, isUser, props }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  return (
    <div style={{ margin: '8px 0', borderRadius: '8px', overflow: 'hidden', border: isUser ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 12px', background: isUser ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)',
        fontSize: 11, color: isUser ? '#b0b3bf' : '#888',
      }}>
        <span>{language}</span>
        <button
          onClick={handleCopy}
          style={{
            background: copied ? '#22c55e' : 'rgba(255,255,255,0.1)',
            border: 'none', borderRadius: 4, padding: '3px 10px',
            color: copied ? '#fff' : '#b0b3bf', fontSize: 11, cursor: 'pointer',
          }}
        >
          {copied ? '✓ 已复制' : '复制'}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0, borderRadius: 0, fontSize: 12,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          overflowWrap: 'break-word',
        }}
        wrapLongLines={true}
        {...props}
      >
        {codeText}
      </SyntaxHighlighter>
    </div>
  );
}
