/**
 * MobileModelSelector — 模型选择器 Sheet
 *
 * 底部弹出面板，展示可用模型列表供用户切换当前智能体的模型。
 */

import { X, Check } from 'lucide-react';
import { COLORS, AVAILABLE_MODELS } from './constants';

interface MobileModelSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  currentModelName?: string;
  onSelectModel: (modelId: string) => void;
}

export function MobileModelSelector({
  isOpen,
  onClose,
  currentModelName,
  onSelectModel,
}: MobileModelSelectorProps) {
  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.6)',
          }}
        />
      )}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201,
        background: COLORS.bgSecondary,
        borderRadius: '20px 20px 0 0',
        maxHeight: '50vh',
        display: 'flex', flexDirection: 'column',
        transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* Header */}
        <div style={{
          height: 52, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.textPrimary }}>切换模型</div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: COLORS.bgTertiary, border: 'none', cursor: 'pointer', borderRadius: 10,
              color: COLORS.textSecondary,
            }}
          >
            <X size={16} />
          </button>
        </div>
        {/* 当前模型 */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 12, color: COLORS.textMuted }}>当前模型</div>
          <div style={{ fontSize: 13, color: COLORS.textPrimary, marginTop: 4 }}>{currentModelName || '未设置'}</div>
        </div>
        {/* Model 列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {AVAILABLE_MODELS.map(model => {
            const isSelected = currentModelName === model.id;
            return (
              <button
                key={model.id}
                onClick={() => onSelectModel(model.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: 12,
                  background: isSelected ? COLORS.accentLight : COLORS.bgTertiary,
                  border: isSelected ? `1.5px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`, cursor: 'pointer',
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 14, color: isSelected ? COLORS.accent : COLORS.textPrimary }}>{model.label}</span>
                {isSelected && <Check size={16} color={COLORS.accent} />}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
