import { useState } from 'react';
import { Bot, User, ChevronDown, ChevronUp, Eye, Code2, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../../types';

interface MessageBubbleProps {
  message: Message;
  agentName?: string;
  agentColor?: string;
  showAvatar?: boolean;
  /** 如果提供，AI 消息将显示"插入到文档"按钮 */
  onInsertToEditor?: (text: string) => void;
  /** 智能体的输出格式，用于特殊渲染 */
  outputFormat?: string;
}

/** 解析"预览+完整代码"格式的消息内容 */
function parsePreviewCode(content: string): { preview: string; code: string; rest: string } | null {
  const previewMatch = content.match(/<!--\s*PREVIEW_START\s*-->([\s\S]*?)<!--\s*PREVIEW_END\s*-->/i);
  const codeMatch = content.match(/<!--\s*CODE_START\s*-->([\s\S]*?)<!--\s*CODE_END\s*-->/i);
  if (!previewMatch && !codeMatch) return null;

  const preview = previewMatch ? previewMatch[1].trim() : '';
  const code = codeMatch ? codeMatch[1].trim() : '';

  // 去掉这两个区块后的剩余内容（前言/结语等）
  let rest = content
    .replace(/<!--\s*PREVIEW_START\s*-->[\s\S]*?<!--\s*PREVIEW_END\s*-->/gi, '')
    .replace(/<!--\s*CODE_START\s*-->[\s\S]*?<!--\s*CODE_END\s*-->/gi, '')
    .trim();

  return { preview, code, rest };
}

const MARKDOWN_CLS = `prose prose-sm prose-invert max-w-none break-words
  prose-p:my-1 prose-p:leading-relaxed
  prose-headings:text-slate-100 prose-headings:font-semibold prose-headings:my-2
  prose-h1:text-base prose-h2:text-sm prose-h3:text-sm
  prose-strong:text-white prose-strong:font-semibold
  prose-em:text-slate-300
  prose-code:text-emerald-300 prose-code:bg-slate-900/60 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
  prose-pre:bg-slate-900/80 prose-pre:border prose-pre:border-slate-600/40 prose-pre:rounded-lg prose-pre:p-3 prose-pre:my-2 prose-pre:overflow-x-auto
  prose-ul:my-1 prose-ul:pl-4 prose-li:my-0.5
  prose-ol:my-1 prose-ol:pl-4
  prose-blockquote:border-l-2 prose-blockquote:border-slate-500 prose-blockquote:pl-3 prose-blockquote:text-slate-400 prose-blockquote:my-1
  prose-hr:border-slate-600 prose-hr:my-2
  prose-a:text-indigo-400 prose-a:underline
  prose-table:text-xs prose-th:text-slate-300 prose-td:text-slate-300`;

/** 预览+完整代码 双区渲染组件 */
function PreviewCodeView({
  content,
  isStreaming,
  agentColor,
}: {
  content: string;
  isStreaming?: boolean;
  agentColor: string;
}) {
  const [codeExpanded, setCodeExpanded] = useState(false);
  const parsed = parsePreviewCode(content);

  // 如果还在流式输出中且尚未完成解析标记，或解析失败，退化为普通 Markdown
  if (!parsed || isStreaming) {
    return (
      <div className={MARKDOWN_CLS}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  const { preview, code, rest } = parsed;

  return (
    <div className="space-y-2">
      {/* 前言（如有） */}
      {rest && (
        <div className={MARKDOWN_CLS}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {rest}
          </ReactMarkdown>
        </div>
      )}

      {/* 预览区 */}
      {preview && (
        <div className="rounded-lg border border-slate-600/50 overflow-hidden">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
            style={{ backgroundColor: `${agentColor}20`, color: agentColor }}
          >
            <Eye size={12} />
            <span>预览效果</span>
          </div>
          <div className="px-3 py-2 bg-slate-800/60">
            <div className={MARKDOWN_CLS}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {preview}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* 完整代码区（折叠/展开） */}
      {code && (
        <div className="rounded-lg border border-slate-600/50 overflow-hidden">
          <button
            onClick={() => setCodeExpanded((v) => !v)}
            className="w-full flex items-center justify-between gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900/60 hover:bg-slate-900/80 transition-colors text-emerald-400"
          >
            <div className="flex items-center gap-1.5">
              <Code2 size={12} />
              <span>完整代码</span>
            </div>
            {codeExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {codeExpanded && (
            <div className="bg-slate-900/80 border-t border-slate-600/40">
              <div className={MARKDOWN_CLS}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {code}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MessageBubble({
  message,
  agentName,
  agentColor = '#6366f1',
  showAvatar = true,
  onInsertToEditor,
  outputFormat,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.streaming;
  const isPreviewCodeMode = !isUser && outputFormat === '预览+完整代码';

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
          <div className="flex items-center gap-1.5 mb-1 px-1">
            <span className="text-xs text-slate-500">{agentName}</span>
            {isPreviewCodeMode && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-700/40">
                预览+代码
              </span>
            )}
          </div>
        )}

        {/* 气泡 */}
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed relative ${
            isUser
              ? 'bg-indigo-500 text-white rounded-br-sm'
              : 'bg-slate-700/60 text-slate-200 rounded-bl-sm border border-slate-600/30'
          }`}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap break-words">{message.content}</span>
          ) : isPreviewCodeMode ? (
            <PreviewCodeView
              content={message.content}
              isStreaming={isStreaming}
              agentColor={agentColor}
            />
          ) : (
            <div className={MARKDOWN_CLS}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Streaming indicator */}
          {isStreaming && (
            <span className="inline-flex items-center gap-0.5 ml-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 h-1 bg-current rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </span>
          )}
        </div>

        {/* 操作按钮（仅 AI 消息） */}
        {!isUser && onInsertToEditor && (
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={() => onInsertToEditor(message.content)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-400 transition-colors px-2 py-1 rounded hover:bg-slate-700/50"
            >
              <Copy size={12} />
              <span>插入到文档</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
