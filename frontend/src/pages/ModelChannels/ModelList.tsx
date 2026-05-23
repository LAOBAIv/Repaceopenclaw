import { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { actBtn } from './constants';
import { Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface Model {
  id: string;
  name: string;
  displayName: string;
  providerId: string;
  providerName?: string;
  contextWindow: number;
  maxTokens: number;
  capabilities: string[];
  enabled: boolean;
}

interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
}

export function ModelList() {
  const [models, setModels] = useState<Model[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [mRes, pRes] = await Promise.all([
        apiClient.get('/models'),
        apiClient.get('/model-providers'),
      ]);
      const provs: Provider[] = pRes.data.data || [];
      const mods: Model[] = (mRes.data.data || []).map((m: any) => ({
        ...m,
        providerName: provs.find(p => p.id === m.providerId)?.name || m.providerId,
      }));
      setProviders(provs);
      setModels(mods);
    } catch { setModels([]); setProviders([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleModel = async (model: Model) => {
    try {
      await apiClient.put(`/models/${model.id}`, { enabled: !model.enabled });
      fetchData();
    } catch (e) { console.warn("[ModelChannels]", e); }
  };

  const deleteModel = async (model: Model) => {
    if (!confirm(`确定删除模型 "${model.displayName || model.name}" 吗？`)) return;
    try { await apiClient.delete(`/models/${model.id}`); fetchData(); } catch (e) { console.warn("[ModelChannels]", e); }
  };

  if (loading) return null;
  if (!models.length) return <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>暂无已配置模型</div>;

  // 按 provider 分组
  const grouped = providers.filter(p => p.enabled).map(p => ({
    provider: p,
    models: models.filter(m => m.providerId === p.id),
  })).filter(g => g.models.length > 0);

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        已配置模型 ({models.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {grouped.map(({ provider, models: pModels }) => (
          <div key={provider.id}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} />
              {provider.name}
              <span style={{ fontWeight: 400, color: '#9ca3af' }}>({pModels.length})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
              {pModels.map(m => (
                <div key={m.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.enabled ? '#22c55e' : '#d1d5db', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.displayName || m.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{m.name}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => toggleModel(m)} style={{ ...actBtn(m.enabled ? '#dcfce7' : '#f3f4f6', m.enabled ? '#16a34a' : '#9ca3af'), padding: '4px 8px' }}>
                      {m.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    </button>
                    <button onClick={() => deleteModel(m)} style={{ ...actBtn('#fef2f2', '#dc2626'), padding: '4px 8px' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
