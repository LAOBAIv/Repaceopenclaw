import { Loader2, Eye, EyeOff, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { FormState, lbl, inp } from './constants';

interface Props {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  editingProvider: string | null;
  hint: string;
  showApiKey: boolean;
  setShowApiKey: (v: boolean) => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  saving: boolean;
  saveMsg: string;
  onSave: () => void;
  onClose: () => void;
}

export function ChannelModal({ form, setForm, editingProvider, hint, showApiKey, setShowApiKey, showAdvanced, setShowAdvanced, saving, saveMsg, onSave, onClose }: Props) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '85vh', overflow: 'auto', padding: '24px 28px' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {editingProvider ? `✏️ 编辑渠道：${editingProvider}` : '添加模型渠道'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {hint && <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400e', marginBottom: 16 }}>💡 {hint}</div>}

        {/* 必填区 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          <div>
            <label style={lbl}>提供商名称 *</label>
            <input value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
              placeholder="如 doubao / deepseek"
              style={{ ...inp, ...(editingProvider ? { background: '#f3f4f6', color: '#9ca3af' } : {}) }}
              readOnly={!!editingProvider} />
          </div>
          <div>
            <label style={lbl}>API Key *</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type={showApiKey ? 'text' : 'password'} value={form.apiKey}
                onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                placeholder="粘贴 API Key" style={{ ...inp, flex: 1 }} autoComplete="off" />
              <button type="button" onClick={() => setShowApiKey(!showApiKey)} style={{ padding: '6px 10px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center' }}>
                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* 基础配置（始终显示，预设预填可编辑） */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          <div>
            <label style={lbl}>模型 ID</label>
            <input value={form.modelName} onChange={e => setForm(f => ({ ...f, modelName: e.target.value }))} placeholder="如 doubao-pro-32k / ep-xxxxxx" style={inp} />
          </div>
          <div>
            <label style={lbl}>认证类型</label>
            <select value={form.authType} onChange={e => setForm(f => ({ ...f, authType: e.target.value as 'Bearer' | 'ApiKey' | 'Basic' }))} style={inp}>
              <option value="Bearer">Bearer Token</option>
              <option value="ApiKey">ApiKey Header</option>
              <option value="Basic">Basic Auth</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Base URL</label>
            <input value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} placeholder="https://api.example.com/v1" style={inp} />
          </div>
        </div>

        {/* 高级参数 */}
        <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6b7280', marginBottom: showAdvanced ? 12 : 0, padding: 0 }}>
          {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />} 高级参数
        </button>

        {showAdvanced && (
          <div style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>优先级</label><input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))} style={inp} min={0} max={100} /><div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>越大越优先</div></div>
              <div><label style={lbl}>Temperature</label><input type="number" value={form.temperature} onChange={e => setForm(f => ({ ...f, temperature: Number(e.target.value) }))} style={inp} min={0} max={2} step={0.1} /><div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>创造性 (0-2)</div></div>
              <div><label style={lbl}>Max Tokens</label><input type="number" value={form.maxTokens} onChange={e => setForm(f => ({ ...f, maxTokens: Number(e.target.value) }))} style={inp} min={1} max={128000} /><div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>最大输出</div></div>
              <div><label style={lbl}>Top P</label><input type="number" value={form.topP} onChange={e => setForm(f => ({ ...f, topP: Number(e.target.value) }))} style={inp} min={0} max={1} step={0.01} /><div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>核采样 (0-1)</div></div>
              <div><label style={lbl}>Freq Penalty</label><input type="number" value={form.frequencyPenalty} onChange={e => setForm(f => ({ ...f, frequencyPenalty: Number(e.target.value) }))} style={inp} min={-2} max={2} step={0.1} /><div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>频率惩罚</div></div>
              <div><label style={lbl}>Pres Penalty</label><input type="number" value={form.presencePenalty} onChange={e => setForm(f => ({ ...f, presencePenalty: Number(e.target.value) }))} style={inp} min={-2} max={2} step={0.1} /><div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>存在惩罚</div></div>
            </div>
          </div>
        )}

        {saveMsg && <div style={{ marginBottom: 14, fontSize: 13, color: saveMsg.includes('✅') ? '#16a34a' : '#dc2626' }}>{saveMsg}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 size={15} /> : <Zap size={15} />}
            {saving ? '保存中...' : editingProvider ? '更新渠道' : '保存渠道'}
          </button>
          <button onClick={onClose} style={{ padding: '9px 16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#6b7280' }}>取消</button>
        </div>
      </div>
    </div>
  );
}
