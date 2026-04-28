import { useEffect, useState } from 'react';
import { Bot, Plus, Trash2, AlertTriangle, Pencil, Cpu, Eye, EyeOff, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAgentStore } from '@/stores/agentStore';
import { DEFAULT_AGENTS } from '@/data/defaultAgents';
import { Agent } from '@/types';
import apiClient from '@/api/client';
import { agentsApi, type AgentRoutingInfo } from '@/api/agents';

/** 可见性标签 */
function VisibilityBadge({ visibility }: { visibility?: string }) {
  const v = visibility || 'private';
  const config: Record<string, { icon: any; label: string; bg: string; color: string }> = {
    private: { icon: EyeOff, label: '私有', bg: '#f3f4f6', color: '#6b7280' },
    public:  { icon: Eye,    label: '公开', bg: '#dcfce7', color: '#16a34a' },
    template:{ icon: Eye,    label: '模板', bg: '#dbeafe', color: '#2563eb' },
  };
  const { icon: Icon, label, bg, color } = config[v] || config.private;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 6px', borderRadius: 10,
      background: bg, fontSize: 10, color, fontWeight: 500,
    }} title={`可见性: ${label}`}>
      <Icon size={9} />
      {label}
    </span>
  );
}
export const VALID_MODELS = [
  'claude-opus-4-6',
  'glm-5',
  'qwen3-max-2026-01-23',
  'kimi-k2.5',
  'MiniMax-M2.5',
  'qwen3.6-plus',
];

/** Skill 配置项 */
const SKILL_ITEMS: { key: string; label: string; risk: 'high' | 'medium' | 'low' }[] = [
  { key: 'exec', label: '代码执行', risk: 'high' },
  { key: 'shell', label: 'Shell 命令', risk: 'high' },
  { key: 'file_write', label: '文件写入', risk: 'high' },
  { key: 'browser', label: '浏览器控制', risk: 'high' },
  { key: 'image_generation', label: '图片生成', risk: 'medium' },
  { key: 'web_search', label: '网络搜索', risk: 'low' },
  { key: 'file_read', label: '文件读取', risk: 'low' },
];

/** 模型参数展示栏：显示实际 LLM 路由 + 渠道 + 模型名 */
function ModelParamBar({ agent, routing }: { agent: Agent; routing?: AgentRoutingInfo }) {
  const channel = agent.tokenProvider;
  const model   = agent.modelName;
  const isValidModel = !model || VALID_MODELS.includes(model);

  // 路由来源标识
  const sourceLabel = routing ? {
    private: '🔑 私有',
    global:  '🌐 全局',
    gateway: '🔄 GW',
    none:    '⚠️ 无',
  }[routing.source] : '';
  const sourceColor = routing ? {
    private: '#15803d',
    global:  '#1d4ed8',
    gateway: '#7c3aed',
    none:    '#b91c1c',
  }[routing.source] : '#94a3b8';

  if (!channel && !model && !routing) {
    return (
      <div className="am-model-bar" style={{ justifyContent: 'center', opacity: 0.55 }}>
        <Cpu size={11} />
        <span style={{ fontSize: 11, color: '#9ca3af' }}>未配置模型</span>
      </div>
    );
  }

  return (
    <div className="am-model-bar" style={{ justifyContent: isValidModel ? 'flex-start' : 'space-between' }}>
      {/* 路由来源标识 */}
      {sourceLabel && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 600,
          background: sourceColor + '15', color: sourceColor,
          border: `1px solid ${sourceColor}30`, flexShrink: 0,
        }} title={`LLM 路由：${routing?.effectiveChannel} / ${routing?.effectiveModel}`}>
          {sourceLabel}
        </span>
      )}

      <Cpu size={11} color={isValidModel ? '#6b7280' : '#ef4444'} style={{ flexShrink: 0 }} />

      {/* 渠道名 */}
      {channel && (
        <span className="am-model-channel" title={channel}>{channel}</span>
      )}

      {/* 分隔符 */}
      {channel && model && <div className="am-model-sep" />}

      {/* 模型名 */}
      {model && (
        <span className="am-model-name" title={model} style={{ color: isValidModel ? undefined : '#ef4444' }}>{model}</span>
      )}

      {/* 无效模型警告标识 */}
      {model && !isValidModel && (
        <span title={`模型 "${model}" 无效，请在智能体管理中更新`}>
          <AlertTriangle size={13} color="#ef4444" style={{ flexShrink: 0, marginLeft: 4 }} />
        </span>
      )}
    </div>
  );
}
function AgentAvatar({ agent }: { agent: Agent }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
      background: agent.color + '22',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: agent.color, fontWeight: 700, fontSize: 15,
      border: `2px solid ${agent.color}44`,
    }}>
      {agent.name.charAt(0)}
    </div>
  );
}

export function AgentManager() {
  const { agents, fetchAgents, deleteAgent } = useAgentStore();
  const navigate = useNavigate();
  const [routings, setRoutings] = useState<AgentRoutingInfo[]>([]);

  useEffect(() => {
    fetchAgents();
    agentsApi.routingOverview().then(setRoutings).catch(() => {});
  }, [fetchAgents]);

  // 路由查找辅助函数
  function getRouting(agentId: string): AgentRoutingInfo | undefined {
    return routings.find(r => r.id === agentId);
  }

  // 优先用后端真实数据，接口失败或为空时 fallback 到默认
  const agentList: Agent[] = agents.length > 0 ? agents : DEFAULT_AGENTS;

  /* ── 删除确认弹窗 ─────────────────────────── */
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ── Skill 配置弹窗 ───────────────────────── */
  const [skillAgent, setSkillAgent] = useState<Agent | null>(null);
  const [tempSkills, setTempSkills] = useState<Record<string, boolean>>({});
  const [savingSkills, setSavingSkills] = useState(false);

  /* ── 可见性切换 ───────────────────────────── */
  const [updatingVisibility, setUpdatingVisibility] = useState<string | null>(null);

  async function handleVisibilityChange(agent: Agent, visibility: string) {
    setUpdatingVisibility(agent.id);
    try {
      await apiClient.put(`/agents/${agent.id}`, { visibility });
      await fetchAgents();
      agentsApi.routingOverview().then(setRoutings).catch(() => {});
    } catch {
      alert('更新可见性失败');
    } finally {
      setUpdatingVisibility(null);
    }
  }

  function openSkillModal(agent: Agent) {
    setSkillAgent(agent);
    setTempSkills(agent.skillsConfig || {
      exec: false, shell: false, file_write: false, browser: false,
      image_generation: false, web_search: true, file_read: true,
    });
  }

  function closeSkillModal() {
    setSkillAgent(null);
  }

  async function saveSkillConfig() {
    if (!skillAgent) return;
    setSavingSkills(true);
    try {
      await apiClient.put(`/agents/${skillAgent.id}`, { skillsConfig: tempSkills });
      await fetchAgents();
      agentsApi.routingOverview().then(setRoutings).catch(() => {});
      setSkillAgent(null);
    } catch {
      alert('保存 Skill 配置失败');
    } finally {
      setSavingSkills(false);
    }
  }

  function handleDeleteClick(e: React.MouseEvent, agent: Agent) {
    e.stopPropagation();
    setDeleteTarget(agent);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAgent(deleteTarget.id);
    } catch {
      // 接口失败时静默处理，store 已有 fallback
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function handleDeleteCancel() {
    setDeleteTarget(null);
  }

  function handleEditClick(e: React.MouseEvent, agent: Agent) {
    e.stopPropagation();
    navigate(`/agent-create?id=${agent.id}`);
  }

  function handleCardClick(agent: Agent) {
    navigate(`/agent-create?id=${agent.id}`);
  }

  return (
    <>
      <style>{`
        .am-wrap {
          width: 100%;
          flex: 1; min-height: 0;
          display: flex; flex-direction: column;
          font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
          background: #f5f7fa;
          padding: 16px; box-sizing: border-box;
          overflow: hidden;
        }
        .am-shell {
          flex: 1; min-height: 0; display: flex; flex-direction: column;
          background: #fafbfc; border: 1px solid #e5e6eb;
          border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.05);
          overflow: hidden;
        }
        .am-header {
          padding: 16px 32px;
          border-bottom: 1px solid #e5e6eb;
          background: #fff;
          display: flex; align-items: center; justify-content: space-between;
          flex-shrink: 0;
        }
        .am-header-left { display: flex; align-items: center; gap: 10px; }
        .am-header-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 8px; border: none;
          background: #2a3b4d; color: #fff;
          font-weight: 600; font-size: 13px; cursor: pointer;
          font-family: inherit; transition: background 0.15s;
        }
        .am-header-btn:hover { background: #1e2d3d; }
        .am-scroll { flex: 1; overflow-y: auto; padding: 24px; }
        .am-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }
        .am-item {
          padding: 18px 20px;
          background: #ffffff;
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s;
          display: flex; flex-direction: column; gap: 10px;
        }
        .am-item:hover {
          border-color: #b0b0b0;
          box-shadow: 0 2px 10px rgba(0,0,0,0.06);
        }
        .am-item-top { display: flex; align-items: center; gap: 10px; }
        .am-item-new {
          padding: 20px;
          background: #ffffff;
          border: 1px dashed #c8c8c8;
          border-radius: 12px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: border-color 0.15s, box-shadow 0.15s;
          color: #999999; font-size: 14px;
          min-height: 96px;
        }
        .am-item-new:hover {
          border-color: #2a3b4d;
          color: #2a3b4d;
          box-shadow: 0 2px 10px rgba(0,0,0,0.06);
        }
        .am-name {
          font-size: 14px; font-weight: 600;
          color: #333333;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .am-style {
          font-size: 11px; color: #9ca3af; margin-top: 1px;
        }
        .am-desc {
          font-size: 13px; color: #666666;
          line-height: 1.6;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .am-tags { display: flex; flex-wrap: wrap; gap: 5px; }
        .am-tag {
          padding: 2px 8px; border-radius: 20px; font-size: 11px;
          background: #f3f4f6; color: #6b7280; border: 1px solid #e5e7eb;
        }
        /* ── 卡片操作区 ── */
        .am-item { position: relative; }
        .am-item-actions {
          position: absolute; top: 10px; right: 10px;
          display: flex; gap: 4px;
          opacity: 0; transition: opacity 0.15s;
        }
        .am-item:hover .am-item-actions { opacity: 1; }
        .am-action-btn {
          width: 28px; height: 28px; border-radius: 7px;
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s;
        }
        .am-action-btn-del {
          background: #fff0f0; color: #d1453b;
        }
        .am-action-btn-del:hover { background: #ffd9d9; color: #b91c1c; }
        .am-action-btn-edit {
          background: #f0f5ff; color: #2a6be8;
        }
        .am-action-btn-edit:hover { background: #dce8ff; color: #1a4fc4; }

        /* ── 删除确认弹窗 ── */
        .am-del-mask {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,0.35);
          display: flex; align-items: center; justify-content: center;
        }
        .am-del-dialog {
          background: #fff; border-radius: 14px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.18);
          width: 360px; padding: 28px 28px 24px;
          display: flex; flex-direction: column; gap: 0;
          font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
        }
        .am-del-icon-wrap {
          width: 48px; height: 48px; border-radius: 50%;
          background: #fff3f3; display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px;
        }
        .am-del-title {
          font-size: 16px; font-weight: 700; color: #1a202c; margin-bottom: 8px;
        }
        .am-del-desc {
          font-size: 13px; color: #6b7280; line-height: 1.6; margin-bottom: 24px;
        }
        .am-del-desc strong { color: #1a202c; }
        .am-del-btns { display: flex; justify-content: flex-end; gap: 10px; }
        .am-del-btn-cancel {
          padding: 8px 20px; border-radius: 8px; border: 1px solid #e5e7eb;
          background: #fff; color: #374151; font-size: 13px; font-weight: 500;
          cursor: pointer; font-family: inherit; transition: background 0.15s;
        }
        .am-del-btn-cancel:hover { background: #f9fafb; }
        .am-del-btn-confirm {
          padding: 8px 20px; border-radius: 8px; border: none;
          background: #dc2626; color: #fff; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: inherit; transition: background 0.15s;
        }
        .am-del-btn-confirm:hover:not(:disabled) { background: #b91c1c; }
        .am-del-btn-confirm:disabled { background: #fca5a5; cursor: not-allowed; }

        /* ── Skill 配置弹窗 ── */
        .am-skill-mask {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,0.35);
          display: flex; align-items: center; justify-content: center;
        }
        .am-skill-dialog {
          background: #fff; border-radius: 14px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.18);
          width: 420px; padding: 24px 24px 20px;
          display: flex; flex-direction: column; gap: 0;
          font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
          max-height: 80vh;
        }
        .am-skill-title {
          font-size: 15px; font-weight: 700; color: #1a202c; margin-bottom: 4px;
        }
        .am-skill-subtitle {
          font-size: 12px; color: #9ca3af; margin-bottom: 16px;
        }
        .am-skill-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
          margin-bottom: 20px;
        }
        .am-skill-item {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 10px; border-radius: 8px;
          border: 1px solid #e5e7eb; cursor: pointer;
          transition: all 0.15s; user-select: none;
        }
        .am-skill-item:hover { border-color: #2a3b4d; background: #f9fafb; }
        .am-skill-item.active { border-color: #2a3b4d; background: #f0f5ff; }
        .am-skill-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }
        .am-skill-item-label { font-size: 13px; color: #374151; flex: 1; }
        .am-skill-item-status { font-size: 11px; color: #9ca3af; }
        .am-skill-btns { display: flex; justify-content: flex-end; gap: 10px; }

        /* ── 可见性选择器 ── */
        .am-vis-selector {
          display: flex; gap: 6px; margin-bottom: 16px;
        }
        .am-vis-btn {
          flex: 1; padding: 8px 0; border-radius: 8px; border: 1.5px solid #e5e7eb;
          background: #fff; cursor: pointer; text-align: center;
          font-size: 12px; color: #6b7280; transition: all 0.15s;
        }
        .am-vis-btn:hover { border-color: #2a3b4d; }
        .am-vis-btn.active { border-color: #2a3b4d; background: #f0f5ff; color: #2a3b4d; font-weight: 600; }
        .am-vis-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── 模型参数区 ── */
        .am-model-bar {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 10px;
          background: #f8f9fb;
          border: 1px solid #eff0f2;
          border-radius: 8px;
        }
        .am-model-channel {
          font-size: 11.5px; font-weight: 600; color: #374151;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          max-width: 100px;
        }
        .am-model-name {
          font-size: 11.5px; color: #6b7280;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          flex: 1; min-width: 0;
        }
        .am-model-sep {
          width: 1px; height: 12px; background: #e5e7eb; flex-shrink: 0;
        }

        @media (max-width: 900px) {
          .am-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 560px) {
          .am-grid { grid-template-columns: 1fr; }
          .am-scroll { padding: 16px; }
          .am-header { padding: 14px 16px; }
        }
      `}</style>

      <div className="am-wrap">
        <div className="am-shell">

          {/* 顶部 header */}
          <div className="am-header">
            <div className="am-header-left">
              <Bot size={18} color="#2a3b4d" />
              <div>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#1a202c' }}>智能体管理</span>
                <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 10 }}>
                  共 {agentList.length} 个智能体
                </span>
              </div>
            </div>
            <button className="am-header-btn" onClick={() => navigate('/agent-create')}>
              <Plus size={14} /> 新建智能体
            </button>
          </div>

          {/* 卡片列表 */}
          <div className="am-scroll">
            <div className="am-grid">
              {agentList.map(agent => (
                <div key={agent.id} className="am-item" onClick={() => handleCardClick(agent)}>
                  {/* 操作按钮（hover 显示） */}
                  <div className="am-item-actions">
                    <button
                      className="am-action-btn am-action-btn-edit"
                      title="Skill 配置"
                      onClick={(e) => { e.stopPropagation(); openSkillModal(agent); }}
                    >
                      <Settings size={12} />
                    </button>
                    <button
                      className="am-action-btn am-action-btn-edit"
                      title="编辑智能体"
                      onClick={(e) => handleEditClick(e, agent)}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      className="am-action-btn am-action-btn-del"
                      title="删除智能体"
                      onClick={(e) => handleDeleteClick(e, agent)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="am-item-top">
                    <AgentAvatar agent={agent} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="am-name" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {agent.name}
                        <VisibilityBadge visibility={agent.visibility} />
                        {agent.modelName && !VALID_MODELS.includes(agent.modelName) && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            padding: '1px 6px', borderRadius: 10,
                            background: '#fef2f2', border: '1px solid #fecaca',
                            fontSize: 10, color: '#dc2626', fontWeight: 500,
                          }} title={`模型 "${agent.modelName}" 无效`}>
                            <AlertTriangle size={10} />
                            无效模型
                          </span>
                        )}
                      </div>
                      <div className="am-style">{agent.writingStyle}</div>
                    </div>
                  </div>
                  {(agent.description || agent.systemPrompt) && (
                    <div className="am-desc">{agent.description || agent.systemPrompt}</div>
                  )}
                  {agent.expertise && agent.expertise.length > 0 && (
                    <div className="am-tags">
                      {agent.expertise.slice(0, 4).map(tag => (
                        <span key={tag} className="am-tag">{tag}</span>
                      ))}
                    </div>
                  )}

                  {/* ── 模型参数行 ── */}
                  <ModelParamBar agent={agent} routing={getRouting(agent.id)} />
                </div>
              ))}
              {/* 新建卡片 */}
              <div className="am-item-new" onClick={() => navigate('/agent-create')}>
                <Plus size={15} />
                新建智能体
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ══════════════ 删除确认弹窗 ══════════════ */}
      {deleteTarget && (
        <div className="am-del-mask" onClick={handleDeleteCancel}>
          <div className="am-del-dialog" onClick={e => e.stopPropagation()}>
            <div className="am-del-icon-wrap">
              <AlertTriangle size={22} color="#dc2626" />
            </div>
            <div className="am-del-title">确认删除智能体</div>
            <div className="am-del-desc">
              即将删除智能体 <strong>「{deleteTarget.name}」</strong>，删除后无法恢复，相关配置和数据将一并清除。
            </div>
            <div className="am-del-btns">
              <button className="am-del-btn-cancel" onClick={handleDeleteCancel} disabled={deleting}>
                取消
              </button>
              <button className="am-del-btn-confirm" onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ Skill 配置弹窗 ══════════════ */}
      {skillAgent && (
        <div className="am-skill-mask" onClick={closeSkillModal}>
          <div className="am-skill-dialog" onClick={e => e.stopPropagation()}>
            <div className="am-skill-title">Skill 安全配置</div>
            <div className="am-skill-subtitle">管理「{skillAgent.name}」的技能权限 · 🔴高危 🟡中危 🟢低危</div>

            {/* 可见性选择 */}
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>可见性</div>
            <div className="am-vis-selector">
              {(['private', 'public', 'template'] as const).map(v => {
                const labels = { private: '🔒 私有', public: '🌐 公开', template: '📋 模板' };
                return (
                  <button
                    key={v}
                    className={`am-vis-btn ${(skillAgent.visibility || 'private') === v ? 'active' : ''}`}
                    disabled={updatingVisibility === skillAgent.id}
                    onClick={async () => {
                      await handleVisibilityChange(skillAgent, v);
                    }}
                  >
                    {updatingVisibility === skillAgent.id ? '更新中...' : labels[v]}
                  </button>
                );
              })}
            </div>

            {/* Skill 开关 */}
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>技能开关</div>
            <div className="am-skill-grid">
              {SKILL_ITEMS.map(({ key, label, risk }) => {
                const active = tempSkills[key] ?? false;
                const dotColor = risk === 'high' ? '#dc2626' : risk === 'medium' ? '#f59e0b' : '#16a34a';
                return (
                  <div
                    key={key}
                    className={`am-skill-item${active ? ' active' : ''}`}
                    onClick={() => setTempSkills(prev => ({ ...prev, [key]: !prev[key] }))}
                  >
                    <div className="am-skill-dot" style={{ background: dotColor }} />
                    <span className="am-skill-item-label">{label}</span>
                    <span className="am-skill-item-status">{active ? 'ON' : 'OFF'}</span>
                  </div>
                );
              })}
            </div>

            <div className="am-skill-btns">
              <button className="am-del-btn-cancel" onClick={closeSkillModal} disabled={savingSkills}>取消</button>
              <button className="am-del-btn-confirm" onClick={saveSkillConfig} disabled={savingSkills} style={{ background: '#2a3b4d' }}>
                {savingSkills ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
