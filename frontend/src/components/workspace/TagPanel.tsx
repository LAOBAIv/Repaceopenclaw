import React, { useState, useRef, useEffect } from 'react';

// 标签颜色池
const TAG_COLOR_POOL: { bg: string; border: string; text: string }[] = [
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  { bg: '#fdf4ff', border: '#e9d5ff', text: '#7c3aed' },
  { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
  { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
  { bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1' },
  { bg: '#fafaf9', border: '#e7e5e4', text: '#44403c' },
];

function getTagColor(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_COLOR_POOL[h % TAG_COLOR_POOL.length];
}

// 预设标签
const PRESET_TAGS = ['优先级高', '待跟进', '已完成', '阻塞中', 'Bug', 'Feature', '文档', '重构'];

interface TagPanelProps {
  tags?: string[];
  onAddTag?: (tag: string) => void;
  onRemoveTag?: (tag: string) => void;
  taskName?: string;
}

export function TagPanel({ tags, onAddTag, onRemoveTag, taskName }: TagPanelProps) {
  const [localTags, setLocalTags] = useState<string[]>(tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    tagInputRef.current?.focus();
  }, []);

  function addTag(raw: string) {
    const t = raw.trim();
    if (!t || localTags.includes(t)) return;
    const next = [...localTags, t];
    setLocalTags(next);
    onAddTag?.(t);
  }

  function removeTag(tag: string) {
    setLocalTags(prev => prev.filter(t => t !== tag));
    onRemoveTag?.(tag);
  }

  function togglePreset(pt: string) {
    if (localTags.includes(pt)) {
      removeTag(pt);
    } else {
      addTag(pt);
    }
  }

  function commitTag() {
    addTag(tagInput);
    setTagInput('');
  }

  return (
    <div style={{ fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif' }}>
      {/* 已选标签展示区 */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 7, alignContent: 'flex-start',
        minHeight: 52, marginBottom: 16,
        padding: '10px 12px',
        background: '#fafafa',
        border: '1.5px solid #e5e7eb',
        borderRadius: 10,
      }}>
        {localTags.length === 0 ? (
          <span style={{ fontSize: 12, color: '#d1d5db', lineHeight: '24px' }}>
            点击下方标签或输入自定义标签
          </span>
        ) : localTags.map(tag => {
          const c = getTagColor(tag);
          return (
            <span key={tag} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 12, padding: '3px 8px 3px 10px', borderRadius: 20,
              background: c.bg, color: c.text, border: `1px solid ${c.border}`,
              fontWeight: 500,
            }}>
              {tag}
              <button
                onClick={e => { e.stopPropagation(); removeTag(tag); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '0 1px', color: c.text, opacity: 0.45, fontSize: 15,
                }}
              >×</button>
            </span>
          );
        })}
      </div>

      {/* 快捷预设标签 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 8 }}>
          快捷标签
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PRESET_TAGS.map(pt => {
            const selected = localTags.includes(pt);
            const c = getTagColor(pt);
            return (
              <button
                key={pt}
                onClick={() => togglePreset(pt)}
                style={{
                  padding: '4px 11px', borderRadius: 20, fontSize: 12,
                  border: `1px solid ${selected ? c.border : '#e5e7eb'}`,
                  background: selected ? c.bg : '#fff',
                  color: selected ? c.text : '#6b7280',
                  cursor: 'pointer',
                  fontWeight: selected ? 600 : 400,
                }}
              >
                {selected ? '✓' : '+'} {pt}
              </button>
            );
          })}
        </div>
      </div>

      {/* 自定义输入 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          ref={tagInputRef}
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitTag(); }}}
          placeholder="输入自定义标签，Enter 确认"
          style={{
            flex: 1, height: 38, fontSize: 13, padding: '0 14px',
            border: '1.5px solid #e5e7eb', borderRadius: 8, outline: 'none',
          }}
        />
        <button
          onClick={commitTag}
          style={{
            height: 38, padding: '0 18px', fontSize: 13, fontWeight: 600,
            border: 'none', borderRadius: 8,
            background: '#6366f1', color: '#fff', cursor: 'pointer',
          }}
        >添加</button>
      </div>
    </div>
  );
}
