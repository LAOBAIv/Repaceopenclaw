/**
 * CodeModal - CODE 渠道 & 模型选择弹窗组件
 *
 * 职责：
 * - 三列布局：渠道列表 | 模型列表 | 参数调节
 * - 支持动态渠道 + 自定义渠道
 * - 自定义渠道：显示 Base URL、模型 ID、API Key 输入框
 * - 预设渠道：显示模型列表卡片
 * - 参数调节：Max Tokens、Temperature、Top P、Frequency/Presence Penalty
 */
import { X, Check, Code2, Eye, EyeOff } from 'lucide-react';
import type { CodeChannel, CodeModel } from './types';
import { BADGE_COLOR } from './constants';

interface CodeModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  dynamicChannels: CodeChannel[];
  // 弹窗内临时状态
  tempChannel: CodeChannel;
  tempModel: CodeModel | null;
  tempCustomUrl: string;
  tempTokenValue: string;
  customMaxTokens: string;
  customTemp: string;
  customTopP: string;
  customFreqPenalty: string;
  customPresPenalty: string;
  // 操作函数
  onSelectChannel: (ch: CodeChannel) => void;
  onSelectModel: (m: CodeModel) => void;
  onTempCustomUrlChange: (v: string) => void;
  onTempTokenValueChange: (v: string) => void;
  onCustomMaxTokensChange: (v: string) => void;
  onCustomTempChange: (v: string) => void;
  onCustomTopPChange: (v: string) => void;
  onCustomFreqPenaltyChange: (v: string) => void;
  onCustomPresPenaltyChange: (v: string) => void;
  onShowTokenToggle: () => void;
  showToken: boolean;
  // 样式
  numInputStyle: React.CSSProperties;
  focusStyle: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  blurStyle: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
}

export function CodeModal({
  open, onClose, onConfirm,
  dynamicChannels,
  tempChannel, tempModel, tempCustomUrl, tempTokenValue,
  customMaxTokens, customTemp, customTopP, customFreqPenalty, customPresPenalty,
  onSelectChannel, onSelectModel,
  onTempCustomUrlChange, onTempTokenValueChange,
  onCustomMaxTokensChange, onCustomTempChange, onCustomTopPChange,
  onCustomFreqPenaltyChange, onCustomPresPenaltyChange,
  onShowTokenToggle, showToken,
  numInputStyle, focusStyle, blurStyle,
}: CodeModalProps) {
  if (!open) return null;

  return (
    <div className="ac-modal-mask" onClick={onClose}>
      <div className="ac-modal cm-modal" onClick={e => e.stopPropagation()}>

        <div className="ac-modal-head">
          <span className="ac-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Code2 size={16} color="#2a3b4d" />
            选择 CODE 渠道 &amp; 模型
          </span>
          <button className="ac-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="ac-modal-body cm-body">
          <div className="cm-two-cols" style={{ display: 'flex', gap: 0, height: '100%' }}>

            {/* ── 第一列：渠道列表 ── */}
            <div style={{ width: 160, borderRight: '1px solid #f0f0f0', overflowY: 'auto', flexShrink: 0 }}>
              <div className="cm-section-title">接入渠道</div>
              {dynamicChannels.map(ch => {
                const sel = tempChannel.id === ch.id;
                const bc = ch.badge ? BADGE_COLOR[ch.badge] : null;
                return (
                  <div
                    key={ch.id}
                    onClick={() => onSelectChannel(ch)}
                    style={{
                      padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      background: sel ? '#f0f4ff' : 'transparent',
                      borderLeft: sel ? '3px solid #2a3b4d' : '3px solid transparent',
                      transition: 'all 0.1s',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: sel ? 600 : 400, color: sel ? '#1e293b' : '#374151' }}>{ch.name}</span>
                        {ch.badge && bc && (
                          <span style={{ fontSize: 10, padding: '0 5px', borderRadius: 3, background: bc.bg, color: bc.color, fontWeight: 500 }}>{ch.badge}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{ch.provider}</div>
                    </div>
                  </div>
                );
              })}
              {/* ── 自定义渠道选项 ── */}
              <div
                onClick={() => {
                  const customChannel: CodeChannel = {
                    id: 'custom',
                    name: '自定义',
                    provider: 'custom',
                    badge: '自定义',
                    desc: '使用自定义 API 配置',
                    baseUrl: '',
                    authType: 'Bearer',
                    models: [{ id: 'custom-model', name: '自定义模型', contextWindow: '-', maxTokens: 4096, temperature: 0.7, topP: 0.95, frequencyPenalty: 0, presencePenalty: 0, desc: '请在右侧填写模型名称' }],
                  };
                  onSelectChannel(customChannel);
                  onTempCustomUrlChange('');
                }}
                style={{
                  padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  background: tempChannel.id === 'custom' ? '#f0f4ff' : 'transparent',
                  borderLeft: tempChannel.id === 'custom' ? '3px solid #2a3b4d' : '3px solid transparent',
                  transition: 'all 0.1s',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: tempChannel.id === 'custom' ? 600 : 400, color: tempChannel.id === 'custom' ? '#1e293b' : '#374151' }}>➕ 自定义</span>
                    <span style={{ fontSize: 10, padding: '0 5px', borderRadius: 3, background: '#fef3c7', color: '#d97706', fontWeight: 500 }}>自定义</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>自定义 API 配置</div>
                </div>
              </div>
            </div>

            {/* ── 第二列：模型列表 ── */}
            <div className="cm-col-models" style={{ flex: '0 0 220px', borderRight: '1px solid #f0f0f0' }}>
              <div className="cm-section-title">{tempChannel.id === 'custom' ? '自定义配置' : tempChannel.name + ' 模型'}</div>
              <div className="cm-preset-list">
                {tempChannel.id === 'custom' ? (
                  <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Base URL */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 500, color: '#374151', marginBottom: 4, display: 'block' }}>API Base URL</label>
                      <input
                        type="text"
                        placeholder="https://api.example.com/v1"
                        value={tempCustomUrl}
                        onChange={e => onTempCustomUrlChange(e.target.value)}
                        style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none' }}
                        onFocus={focusStyle} onBlur={blurStyle}
                      />
                      <span style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>OpenAI 兼容格式的 API 地址</span>
                    </div>
                    {/* 模型名称 */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 500, color: '#374151', marginBottom: 4, display: 'block' }}>模型 ID</label>
                      <input
                        type="text"
                        placeholder="gpt-4o, claude-3-opus 等"
                        value={tempModel?.id || ''}
                        onChange={e => {
                          const newModel: CodeModel = {
                            id: e.target.value,
                            name: e.target.value || '自定义模型',
                            contextWindow: '-',
                            maxTokens: Number(customMaxTokens) || 4096,
                            temperature: Number(customTemp) || 0.7,
                            topP: Number(customTopP) || 0.95,
                            frequencyPenalty: Number(customFreqPenalty) || 0,
                            presencePenalty: Number(customPresPenalty) || 0,
                            desc: '自定义模型',
                          };
                          onSelectModel(newModel);
                        }}
                        style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none' }}
                        onFocus={focusStyle} onBlur={blurStyle}
                      />
                      <span style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>实际调用的模型名称</span>
                    </div>
                    {/* API Key */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 500, color: '#374151', marginBottom: 4, display: 'block' }}>API Key</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type={showToken ? 'text' : 'password'}
                          placeholder="sk-..."
                          value={tempTokenValue}
                          onChange={e => onTempTokenValueChange(e.target.value)}
                          style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none' }}
                          onFocus={focusStyle} onBlur={blurStyle}
                        />
                        <button
                          onClick={onShowTokenToggle}
                          style={{ padding: '4px 8px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                        >
                          {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <span style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>您的 API 密钥</span>
                    </div>
                  </div>
                ) : (
                  tempChannel.models.map(m => {
                    const sel = tempModel?.id === m.id;
                    const bc = m.badge ? BADGE_COLOR[m.badge] : null;
                    return (
                      <div
                        key={m.id}
                        className={`cm-preset-item${sel ? ' selected' : ''}`}
                        onClick={() => onSelectModel(m)}
                      >
                        <div className="ac-modal-check" style={{ marginTop: 2 }}>
                          {sel && <Check size={13} color="#fff" strokeWidth={3} />}
                        </div>
                        <div className="cm-preset-info">
                          <div className="cm-preset-name-row">
                            <span className="cm-preset-name">{m.name}</span>
                            {m.badge && bc && (
                              <span className="cm-preset-badge" style={{ background: bc.bg, color: bc.color }}>{m.badge}</span>
                            )}
                          </div>
                          <div className="cm-preset-ctx">上下文：{m.contextWindow}</div>
                          {m.desc && <div className="cm-preset-desc">{m.desc}</div>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── 第三列：参数调节 ── */}
            <div className="cm-col-params">
              <div className="cm-section-title">参数调节</div>
              {tempModel ? (
                <div className="cm-params-grid">
                  <div className="cm-param-item">
                    <label className="cm-param-label">Max Tokens</label>
                    <input type="number" min={256} max={32768} step={256} style={numInputStyle} value={customMaxTokens} onChange={e => onCustomMaxTokensChange(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} placeholder={String(tempModel.maxTokens)} />
                    <span className="cm-param-sub">最大输出 token 数</span>
                  </div>
                  <div className="cm-param-item">
                    <label className="cm-param-label">Temperature</label>
                    <input type="number" min={0} max={2} step={0.05} style={numInputStyle} value={customTemp} onChange={e => onCustomTempChange(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} placeholder={String(tempModel.temperature)} />
                    <span className="cm-param-sub">0 = 精准，2 = 发散</span>
                  </div>
                  <div className="cm-param-item">
                    <label className="cm-param-label">Top P</label>
                    <input type="number" min={0} max={1} step={0.05} style={numInputStyle} value={customTopP} onChange={e => onCustomTopPChange(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} placeholder={String(tempModel.topP)} />
                    <span className="cm-param-sub">核采样概率阈值</span>
                  </div>
                  <div className="cm-param-item">
                    <label className="cm-param-label">Frequency Penalty</label>
                    <input type="number" min={-2} max={2} step={0.1} style={numInputStyle} value={customFreqPenalty} onChange={e => onCustomFreqPenaltyChange(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} placeholder={String(tempModel.frequencyPenalty)} />
                    <span className="cm-param-sub">降低重复词语频率</span>
                  </div>
                  <div className="cm-param-item">
                    <label className="cm-param-label">Presence Penalty</label>
                    <input type="number" min={-2} max={2} step={0.1} style={numInputStyle} value={customPresPenalty} onChange={e => onCustomPresPenaltyChange(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} placeholder={String(tempModel.presencePenalty)} />
                    <span className="cm-param-sub">鼓励引入新话题</span>
                  </div>
                </div>
              ) : (
                <div className="cm-params-empty"><span>← 请先选择一个模型</span></div>
              )}
            </div>

          </div>
        </div>

        <div className="ac-modal-foot">
          <span className="ac-modal-selected-tip">
            {tempModel ? `${tempChannel.name} · ${tempModel.name}` : '请选择渠道和模型'}
          </span>
          <div className="ac-modal-foot-btns">
            <button className="ac-modal-btn-cancel" onClick={onClose}>取消</button>
            <button className="ac-modal-btn-confirm" disabled={!tempModel} onClick={onConfirm}>确认</button>
          </div>
        </div>

      </div>
    </div>
  );
}
