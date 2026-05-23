/**
 * ModelSection - 模型配置区组件
 *
 * 职责：渲染 CODE 渠道选择触发器
 * - 显示当前选中的渠道和模型信息
 * - 点击打开 CODE 渠道 & 模型选择弹窗
 */
import { Code2, ChevronDown } from 'lucide-react';
import type { CodeChannel, CodeModel } from './types';

interface ModelSectionProps {
  selectedChannel: CodeChannel;
  selectedModel: CodeModel | null;
  onOpenModal: () => void;
  // 样式
  labelStyle: React.CSSProperties;
  fieldStyle: React.CSSProperties;
}

export function ModelSection({
  selectedChannel, selectedModel, onOpenModal,
  labelStyle, fieldStyle,
}: ModelSectionProps) {
  return (
    <div style={{ ...fieldStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <label style={labelStyle}>CODE 渠道</label>
        <div className="ac-model-trigger" onClick={onOpenModal}>
          <span className="ac-model-trigger-icon"><Code2 size={16} /></span>
          <div className="ac-model-trigger-info">
            <div className="ac-model-trigger-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {selectedChannel.name}
              {selectedChannel.isPreset && <span style={{ fontSize: 13 }}>⭐</span>}
              <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, background: '#f3f4f6', color: '#6b7280' }}>
                {selectedChannel.provider}
              </span>
            </div>
            <div className="ac-model-trigger-sub">
              {selectedModel ? `${selectedModel.name} · ${selectedModel.maxTokens}tok` : '请选择模型'}
            </div>
          </div>
          <span style={{ marginLeft: 'auto', color: '#9ca3af', flexShrink: 0 }}><ChevronDown size={15} /></span>
        </div>
      </div>
    </div>
  );
}
