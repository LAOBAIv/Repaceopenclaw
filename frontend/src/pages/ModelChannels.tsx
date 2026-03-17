import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Plus, Trash2, TestTube2, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, Zap, Pencil } from 'lucide-react';

interface Channel {
  id: string;
  provider: string;
  modelName: string;
  baseUrl: string;
  apiKey: string;
  authType: 'Bearer' | 'ApiKey' | 'Basic';
  enabled: boolean;
  priority: number;
}

interface TestResult {
  connected: boolean;
  statusCode: number;
  latencyMs: number | null;
  note: string;
}

// 常用大模型预设
const PRESETS = [
  {
    label: '🫘 豆包 (火山方舟)',
    provider: 'doubao',
    modelName: 'doubao-pro-32k',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    authType: 'Bearer' as const,
    hint: '模型 ID 填写方舟控制台的 Endpoint ID（ep-xxxxxx）或模型名称',
  },
  {
    label: '🔮 DeepSeek',
    provider: 'deepseek',
    modelName: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com/v1',
    authType: 'Bearer' as const,
    hint: '',
  },
  {
    label: '🌟 通义千问',
    provider: 'qwen',
    modelName: 'qwen-max',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    authType: 'Bearer' as const,
    hint: '',
  },
  {
    label: '🤖 OpenAI',
    provider: 'openai',
    modelName: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    authType: 'Bearer' as const,
    hint: '',
  },
  {
    label: '🌀 Anthropic（Claude）',
    provider: 'anthropic',
    modelName: 'claude-3-5-sonnet-20241022',
    baseUrl: 'https://api.anthropic.com/v1',
    authType: 'ApiKey' as const,
    hint: 'API Key 填写 Anthropic 控制台的 sk-ant- 开头的 Key；认证方式选 ApiKey Header',
  },
  {
    label: '⚡ 自定义',
    provider: '',
    modelName: '',
    baseUrl: '',
    authType: 'Bearer' as const,
    hint: '兼容 OpenAI Chat Completions 格式的任意服务',
  },
];

const emptyForm = {
  provider: '',
  modelName: '',
  baseUrl: '',
  apiKey: '',
  authType: 'Bearer' as const,
  enabled: true,
  priority: 0,
};

export function ModelChannels() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult & { loading?: boolean }>>({});
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [showPresets, setShowPresets] = useState(true);
  const [hint, setHint] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  // 编辑模式：记录当前正在编辑的渠道 provider（null = 新增模式）
  const [editingProvider, setEditingProvider] = useState<string | null>(null);

  const fetchChannels = async () => {
    try {
      const res = await apiClient.get('/token-channels');
      setChannels(res.data.data || []);
    } catch {
      setChannels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchChannels(); }, []);

  const applyPreset = (idx: number) => {
    const p = PRESETS[idx];
    setSelectedPreset(idx);
    setForm(f => ({ ...f, provider: p.provider, modelName: p.modelName, baseUrl: p.baseUrl, authType: p.authType }));
    setHint(p.hint);
    setShowForm(true);
    setShowPresets(false);
  };

  /** 点击「编辑」：将渠道数据填入表单，进入编辑模式 */
  const handleEdit = (ch: Channel) => {
    setEditingProvider(ch.provider);
    setSelectedPreset(null);
    setHint('');
    setForm({
      provider: ch.provider,
      modelName: ch.modelName,
      baseUrl: ch.baseUrl,
      apiKey: ch.apiKey,
      authType: ch.authType,
      enabled: ch.enabled,
      priority: ch.priority,
    });
    setShowForm(true);
    setShowPresets(false);
    setSaveMsg('');
  };

  /** 统一的关闭/取消表单逻辑 */
  const cancelForm = () => {
    setShowForm(false);
    setShowPresets(true);
    setSelectedPreset(null);
    setHint('');
    setEditingProvider(null);
    setForm({ ...emptyForm });
    setSaveMsg('');
  };

  const handleSave = async () => {
    if (!form.provider || !form.apiKey) {
      setSaveMsg('❌ 提供商和 API Key 不能为空');
      return;
    }
    setSaving(true);
    setSaveMsg('');
    try {
      await apiClient.post('/token-channels', form);
      await fetchChannels();
      // 先设置成功消息，再关闭表单（cancelForm 内部会清空 saveMsg，故改为手动重置表单）
      setShowForm(false);
      setShowPresets(true);
      setSelectedPreset(null);
      setHint('');
      setEditingProvider(null);
      setForm({ ...emptyForm });
      setSaveMsg('✅ 保存成功');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e: any) {
      setSaveMsg(`❌ 保存失败：${e.response?.data?.error || e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (provider: string) => {
    if (!confirm(`确定删除渠道 "${provider}" 吗？`)) return;
    await apiClient.delete(`/token-channels/${provider}`);
    await fetchChannels();
  };

  const handleTest = async (channel: Channel) => {
    setTestResults(r => ({ ...r, [channel.id]: { loading: true, connected: false, statusCode: 0, latencyMs: null, note: '测试中...' } }));
    try {
      const res = await apiClient.post(`/token-channels/${channel.id}/test`);
      setTestResults(r => ({ ...r, [channel.id]: res.data.data }));
    } catch (e: any) {
      setTestResults(r => ({ ...r, [channel.id]: { connected: false, statusCode: 0, latencyMs: null, note: e.message } }));
    }
  };

  const toggleEnabled = async (ch: Channel) => {
    await apiClient.post('/token-channels', { ...ch, enabled: !ch.enabled });
    await fetchChannels();
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '28px 32px', background: 'var(--body-bg)' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>模型渠道</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, margin: '6px 0 0' }}>
          配置大模型 API 接入渠道，支持豆包、DeepSeek、通义千问等 OpenAI 兼容格式
        </p>
      </div>

      {/* 已有渠道列表 */}
      {!loading && channels.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            已配置渠道 ({channels.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {channels.map(ch => {
              const tr = testResults[ch.id];
              return (
                <div key={ch.id} style={{
                  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
                  padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  {/* 状态点 */}
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: ch.enabled ? '#22c55e' : '#d1d5db',
                  }} />

                  {/* 信息 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{ch.provider}</span>
                      {ch.modelName && (
                        <span style={{ fontSize: 12, background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: 20 }}>
                          {ch.modelName}
                        </span>
                      )}
                      <span style={{ fontSize: 12, background: ch.enabled ? '#dcfce7' : '#f3f4f6', color: ch.enabled ? '#16a34a' : '#9ca3af', padding: '2px 8px', borderRadius: 20 }}>
                        {ch.enabled ? '启用' : '禁用'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                      {ch.baseUrl || 'OpenAI 默认'}
                      {ch.apiKey && <span style={{ marginLeft: 8 }}>Key: {ch.apiKey.slice(0, 8)}...</span>}
                    </div>
                    {/* 测试结果 */}
                    {tr && (
                      <div style={{
                        marginTop: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
                        color: tr.loading ? '#6b7280' : tr.connected ? '#16a34a' : '#dc2626',
                      }}>
                        {tr.loading
                          ? <><Loader2 size={12} className="animate-spin" /> 连接测试中...</>
                          : tr.connected
                          ? <><CheckCircle2 size={12} /> {tr.note}{tr.latencyMs != null ? ` · ${tr.latencyMs}ms` : ''}</>
                          : <><XCircle size={12} /> {tr.note}</>
                        }
                      </div>
                    )}
                  </div>

                  {/* 操作 */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => handleTest(ch)} title="连通性测试" style={btnStyle('#f0fdf4', '#16a34a')}>
                      {tr?.loading ? <Loader2 size={14} /> : <TestTube2 size={14} />}
                      <span>测试</span>
                    </button>
                    <button onClick={() => handleEdit(ch)} title="编辑渠道" style={btnStyle('#f5f3ff', '#7c3aed')}>
                      <Pencil size={14} />
                      <span>编辑</span>
                    </button>
                    <button onClick={() => toggleEnabled(ch)} style={btnStyle('#eff6ff', '#2563eb')}>
                      {ch.enabled ? '禁用' : '启用'}
                    </button>
                    <button onClick={() => handleDelete(ch.provider)} title="删除" style={btnStyle('#fef2f2', '#dc2626')}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 预设选择 */}
      {!showForm && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <button
            onClick={() => setShowPresets(p => !p)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={16} color="var(--accent)" />
              添加模型渠道
            </div>
            {showPresets ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showPresets && (
            <div style={{ padding: '0 18px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {PRESETS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => applyPreset(i)}
                  style={{
                    padding: '12px 14px', background: selectedPreset === i ? '#eff6ff' : '#f9fafb',
                    border: `1.5px solid ${selectedPreset === i ? '#2563eb' : '#e5e7eb'}`,
                    borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                    transition: 'all 0.15s',
                  }}
                >
                  {p.label}
                  {p.modelName && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{p.modelName}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div style={{ background: '#fff', border: '1.5px solid #2563eb', borderRadius: 12, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {editingProvider
                ? `✏️ 编辑渠道：${editingProvider}`
                : selectedPreset !== null ? PRESETS[selectedPreset].label : '自定义渠道'}
            </div>
            <button onClick={cancelForm}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20, lineHeight: 1 }}>×</button>
          </div>

          {hint && (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400e', marginBottom: 16 }}>
              💡 {hint}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* 编辑模式下 provider 只读，避免更改 upsert 主键导致产生新记录 */}
            {editingProvider ? (
              <div>
                <label style={labelStyle}>提供商名称</label>
                <input value={form.provider} readOnly
                  style={{ ...inputStyle, background: '#f3f4f6', color: '#9ca3af', cursor: 'not-allowed' }} />
              </div>
            ) : (
              <FormField label="提供商名称 *" value={form.provider}
                onChange={v => setForm(f => ({ ...f, provider: v }))}
                placeholder="如 doubao / deepseek" />
            )}
            <FormField label="模型 ID" value={form.modelName}
              onChange={v => setForm(f => ({ ...f, modelName: v }))}
              placeholder="如 doubao-pro-32k 或 ep-xxxxxx" />
            <FormField label="Base URL" value={form.baseUrl}
              onChange={v => setForm(f => ({ ...f, baseUrl: v }))}
              placeholder="https://ark.cn-beijing.volces.com/api/v3"
              colSpan />
            <FormField label="API Key *" value={form.apiKey}
              onChange={v => setForm(f => ({ ...f, apiKey: v }))}
              placeholder="粘贴你的 API Key" type="password"
              colSpan />

            <div>
              <label style={labelStyle}>认证类型</label>
              <select value={form.authType} onChange={e => setForm(f => ({ ...f, authType: e.target.value as any }))}
                style={inputStyle}>
                <option value="Bearer">Bearer Token</option>
                <option value="ApiKey">ApiKey Header</option>
                <option value="Basic">Basic Auth</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>优先级</label>
              <input type="number" value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
                style={inputStyle} min={0} max={100} />
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>数字越大优先调用</div>
            </div>
          </div>

          {saveMsg && (
            <div style={{ marginTop: 14, fontSize: 13, color: saveMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>
              {saveMsg}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={handleSave} disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 20px', background: '#2563eb', color: '#fff',
                border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1,
              }}>
              {saving ? <Loader2 size={15} /> : <Zap size={15} />}
              {saving ? '保存中...' : editingProvider ? '更新渠道' : '保存渠道'}
            </button>
            <button onClick={cancelForm}
              style={{ padding: '9px 16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#6b7280' }}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* 全局保存结果提示（放在表单外，关闭表单后仍可见） */}
      {saveMsg && !showForm && (
        <div style={{
          marginTop: 14, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: saveMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
          color: saveMsg.startsWith('✅') ? '#16a34a' : '#dc2626',
          border: `1px solid ${saveMsg.startsWith('✅') ? '#bbf7d0' : '#fecaca'}`,
        }}>
          {saveMsg}
        </div>
      )}

      {/* 空状态 */}
      {!loading && channels.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          还没有配置任何渠道，从上方预设中选择一个开始吧
        </div>
      )}
    </div>
  );
}

// ── 小组件 ────────────────────────────────────────────────────────────
function FormField({ label, value, onChange, placeholder, type = 'text', colSpan = false }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; colSpan?: boolean;
}) {
  return (
    <div style={colSpan ? { gridColumn: '1 / -1' } : {}}>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} style={inputStyle} autoComplete="off" />
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500,
  color: '#6b7280', marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', fontSize: 13,
  border: '1px solid #e5e7eb', borderRadius: 8,
  outline: 'none', boxSizing: 'border-box',
  color: 'var(--text-primary)', background: '#fafafa',
};

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '6px 12px', background: bg, color,
    border: `1px solid ${color}22`, borderRadius: 7,
    cursor: 'pointer', fontSize: 12, fontWeight: 500,
  };
}
