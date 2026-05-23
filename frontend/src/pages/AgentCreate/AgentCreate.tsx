/**
 * AgentCreate - 智能体创建/编辑页面主入口
 *
 * 职责：
 * - 整合所有 hooks（useAgentForm, useSkills, useCodeModel, useToken）
 * - 整合所有子组件（BasicInfoSection, PromptSection, SkillSection,
 *   ModelTokenSection, AdvancedSection）
 * - 整合所有弹窗（SkillModal, TokenModal, CodeModal）
 * - 管理动态渠道加载逻辑
 * - 渲染页面整体布局（header + 左右两栏 form + footer）
 */
import { useState, useEffect } from 'react';
import { PlusCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { tokenChannelsApi } from '@/api/tokenChannels';
import apiClient from '@/api/client';
import type { BackendSkill, CodeChannel, CodeModel } from './types';
import { CODE_CHANNELS } from './constants';
import { TOKEN_CACHE_PREFIX, saveTokenCache } from './utils';
// Hooks
import { useAgentForm } from './hooks/useAgentForm';
import { useSkills } from './hooks/useSkills';
import { useCodeModel } from './hooks/useCodeModel';
import { useToken } from './hooks/useToken';
// Section components
import { BasicInfoSection } from './BasicInfoSection';
import { PromptSection } from './PromptSection';
import { SkillSection } from './SkillSection';
import { ModelTokenSection } from './ModelTokenSection';
import { AdvancedSection } from './AdvancedSection';
// Modal components
import { SkillModal } from './SkillModal';
import { TokenModal } from './TokenModal';
import { CodeModal } from './CodeModal';

export function AgentCreate() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  /* ═══════════════════════════════════════════════════════════
   * 动态渠道加载：从后台 /api/token-channels 拉取已配置渠道
   * ═══════════════════════════════════════════════════════════ */
  const [dynamicChannels, setDynamicChannels] = useState<CodeChannel[]>([]);
  const [presetChannel, setPresetChannel] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      apiClient.get('/token-channels'),
      apiClient.get('/models'),
      apiClient.get('/model-providers'),
    ]).then(([chRes, mRes, pRes]) => {
        const rawChannels: Array<{ id: string; provider: string; modelName: string; baseUrl: string; apiKey: string; authType: string; enabled: boolean; priority: number; isPreset?: boolean }> = chRes.data.data || [];
        if (!rawChannels.length) return;
        const backendChannels = rawChannels.filter(c => c.enabled);
        if (!backendChannels.length) return;

        const allModels = mRes.data.data || [];
        const allProviders = pRes.data.data || [];

        const channels: CodeChannel[] = backendChannels.map(bc => {
          const chBase = (bc.baseUrl || '').replace(/\/$/, '');
          const matchedProv = allProviders.find((p: any) => (p.baseUrl || '').replace(/\/$/, '') === chBase);
          const chModels = matchedProv
            ? allModels.filter((m: any) => m.providerId === matchedProv.id && m.enabled)
            : [];

          const modelList = chModels.length > 0
            ? chModels.map((m: any) => ({
                id: m.name, name: m.name, contextWindow: m.contextWindow || '-',
                maxTokens: m.maxTokens || 4096, temperature: 0.7, topP: 0.95,
                frequencyPenalty: 0, presencePenalty: 0, desc: `${m.name}`,
              }))
            : [{
                id: 'auto', name: 'Auto（后台调度）', contextWindow: '-',
                maxTokens: 4096, temperature: 0.7, topP: 0.95,
                frequencyPenalty: 0, presencePenalty: 0, desc: '使用后台配置的默认模型',
              }];

          return {
            id: bc.provider, name: bc.provider, provider: bc.provider,
            badge: bc.isPreset ? '预设' : undefined, isPreset: !!bc.isPreset,
            hasBackendKey: !!bc.apiKey, desc: `${bc.baseUrl || 'OpenAI 兼容格式'}`,
            baseUrl: bc.baseUrl, authType: (bc.authType as 'Bearer' | 'ApiKey' | 'Basic') || 'Bearer',
            keyLabel: 'API Key',
            keyPlaceholder: '使用后台配置的 Key（如需覆盖请重新填写）',
            models: modelList,
          };
        });

        setDynamicChannels(channels);

        // 写入本地缓存（仅在没有缓存时）
        for (const bc of backendChannels) {
          if (bc.apiKey) {
            const cacheKey = TOKEN_CACHE_PREFIX + bc.provider;
            if (!localStorage.getItem(cacheKey)) {
              try { localStorage.setItem(cacheKey, JSON.stringify({ apiKey: bc.apiKey, baseUrl: bc.baseUrl || '' })); } catch { /* ignore */ }
            }
          }
        }

        // 自动选中预设渠道，否则选第一个
        const presetBc = backendChannels.find(c => c.isPreset);
        const defaultBc = presetBc || backendChannels[0];
        const presetCh = channels.find(c => c.isPreset);
        const defaultCh = presetCh || channels[0];
        if (defaultCh) {
          // 注意：这里暂存到 ref，等 hooks 初始化后由 useEffect 处理
          (window as any).__ac_defaultChannel = defaultCh;
          (window as any).__ac_defaultModel = defaultCh.models.find((m: CodeModel) => m.id === defaultBc.modelName) || defaultCh.models[0];
        }
      })
      .catch(() => { setDynamicChannels([]); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 获取平台预设（兜底）渠道 ── */
  useEffect(() => {
    tokenChannelsApi.getPreset().then(ch => {
      if (ch) setPresetChannel(ch);
    }).catch(() => {});
  }, []);

  /* ═══════════════════════════════════════════════════════════
   * Hooks 初始化
   * ═══════════════════════════════════════════════════════════ */

  // 先声明 state 供 hooks 交叉引用
  const [selChannel, setSelChannel] = useState<CodeChannel>(CODE_CHANNELS[0]);
  const [selModel, setSelModel] = useState<CodeModel | null>(CODE_CHANNELS[0].models[0]);
  const [tValue, setTValue] = useState('');
  const [cBaseUrl, setCBaseUrl] = useState('');

  // 渠道加载完成后，自动选中预设渠道
  useEffect(() => {
    const dc = (window as any).__ac_defaultChannel;
    const dm = (window as any).__ac_defaultModel;
    if (dc && dm) {
      setSelChannel(dc);
      setSelModel(dm);
      delete (window as any).__ac_defaultChannel;
      delete (window as any).__ac_defaultModel;
    }
  }, [dynamicChannels]);

  // Form hook
  const form = useAgentForm(
    dynamicChannels, setSelChannel, setSelModel,
    // 这些 setter 会被 useCodeModel 覆盖，这里传空函数占位
    () => {}, () => {}, () => {}, () => {}, () => {},
    setTValue, setCBaseUrl,
  );

  // Skills hook
  const skills = useSkills();

  // CodeModel hook
  const codeModel = useCodeModel(dynamicChannels, tValue, cBaseUrl, setTValue, setCBaseUrl);

  // Token hook
  const token = useToken(dynamicChannels, selChannel);

  // 同步 selectedChannel/selectedModel 到 form 的 fillForm 回调
  useEffect(() => {
    if (selChannel.id !== CODE_CHANNELS[0].id) {
      // 渠道已更新，确保 form 能访问到最新值
    }
  }, [selChannel]);

  /* ═══════════════════════════════════════════════════════════
   * 编辑模式：加载已绑定技能 ID
   * ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!form.isEdit || !form.editId) return;
    Promise.all([
      apiClient.get('/skills').catch(() => ({ data: { data: [] } })),
      apiClient.get(`/skills/agent/${form.editId}`).catch(() => ({ data: { data: [] } })),
    ]).then(([allRes, boundRes]) => {
      const allSkills: BackendSkill[] = allRes.data.data ?? [];
      const boundSkills: BackendSkill[] = boundRes.data.data ?? [];
      skills.loadBackendSkills().then(() => {
        // loadBackendSkills 内部会设置 backendSkills
      });
      // 直接设置 backendSkills（如果还没加载）
      if (skills.backendSkills.length === 0) {
        // 通过 loadBackendSkills 加载
      }
      if (boundSkills.length > 0) {
        form.setSkills(boundSkills.map((s: BackendSkill) => s.id));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.editId]);

  /* ═══════════════════════════════════════════════════════════
   * 事件处理
   * ═══════════════════════════════════════════════════════════ */

  // 技能弹窗
  const handleOpenSkillModal = () => {
    skills.openSkillModal(form.skills);
  };
  const handleConfirmSkillModal = () => {
    const confirmed = skills.confirmSkillModal();
    form.setSkills(confirmed);
  };
  const handleRemoveSkill = (id: string) => {
    form.setSkills(skills.removeSkill(form.skills, id));
  };

  // Token 弹窗
  const handleOpenTokenModal = () => {
    token.openTokenModal(selChannel, selModel);
  };
  const handleConfirmTokenModal = () => {
    token.confirmTokenModal(
      selChannel, token.hasBackendKey, presetChannel,
      codeModel.customMaxTokens, codeModel.customTemp, codeModel.customTopP,
      codeModel.customFreqPenalty, codeModel.customPresPenalty,
      setSelModel,
    );
  };

  // Code 弹窗
  const handleConfirmCodeModal = () => {
    codeModel.confirmCodeModal();
  };

  // 提交
  const handleSubmit = (e: React.FormEvent) => {
    form.handleSubmit(
      e, skills.backendSkills,
      selChannel, selModel,
      codeModel.customMaxTokens, codeModel.customTemp, codeModel.customTopP,
      codeModel.customFreqPenalty, codeModel.customPresPenalty,
      tValue, cBaseUrl,
    );
  };

  /* ═══════════════════════════════════════════════════════════
   * 渲染
   * ═══════════════════════════════════════════════════════════ */
  return (
    <>
      <style>{`
        .ac-wrap {
          width: 100%; flex: 1; min-height: 0;
          display: flex; flex-direction: column;
          font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
          background: #f5f7fa; padding: 16px; box-sizing: border-box; overflow: hidden;
        }
        .ac-card {
          flex: 1; min-height: 0; display: flex; flex-direction: column;
          background: #fafbfc; border: 1px solid #e5e6eb;
          border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); overflow: hidden;
        }
        .ac-header {
          padding: 16px 32px; border-bottom: 1px solid #e5e6eb;
          background: #ffffff; display: flex; align-items: center; gap: 10px; flex-shrink: 0;
        }
        .ac-scroll {
          flex: 1; min-height: 0; overflow: hidden;
          padding: 16px 20px 0; display: flex; flex-direction: column;
        }
        .ac-form {
          flex: 1; min-height: 0; background: transparent; padding: 0;
          box-sizing: border-box; display: flex; flex-direction: column;
        }
        .ac-cols {
          flex: 1; min-height: 0;
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
          overflow: hidden;
        }
        .ac-col {
          display: flex; flex-direction: column; gap: 0;
          min-height: 0; overflow: hidden;
        }
        .ac-footer {
          padding: 10px 24px; border-top: 1px solid #ebebeb;
          background: #fff; display: flex; justify-content: center; gap: 10px; flex-shrink: 0;
        }
        .ac-skill-trigger {
          display: flex; align-items: center; gap: 10px;
          padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 7px;
          background: #fff; cursor: pointer; transition: border-color 0.15s;
          min-height: 36px; flex-wrap: wrap;
        }
        .ac-skill-trigger:hover { border-color: #2a3b4d; }
        .ac-skill-chip {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 10px; border-radius: 20px;
          background: #2a3b4d12; color: #2a3b4d; font-size: 12px;
          border: 1px solid #2a3b4d30;
        }
        .ac-skill-chip-del {
          display: flex; align-items: center; cursor: pointer; color: #9ca3af;
          background: none; border: none; padding: 0; line-height: 1; transition: color 0.1s;
        }
        .ac-skill-chip-del:hover { color: #2a3b4d; }
        .ac-skill-placeholder { font-size: 13px; color: #9ca3af; flex: 1; }
        .ac-skill-arrow { margin-left: auto; color: #9ca3af; flex-shrink: 0; }
        .ac-model-trigger {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 7px;
          background: #fff; cursor: pointer; transition: border-color 0.15s; min-height: 38px;
        }
        .ac-model-trigger:hover { border-color: #2a3b4d; }
        .ac-model-trigger-icon { color: #2a3b4d; flex-shrink: 0; }
        .ac-model-trigger-info { flex: 1; min-width: 0; }
        .ac-model-trigger-name { font-size: 13px; font-weight: 600; color: #1a202c; }
        .ac-model-trigger-sub  { font-size: 11px; color: #9ca3af; margin-top: 1px; }
        .ac-token-trigger {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 7px;
          background: #fff; cursor: pointer; transition: border-color 0.15s; min-height: 38px;
        }
        .ac-token-trigger:hover { border-color: #2a3b4d; }
        .ac-token-trigger-icon { color: #2a3b4d; flex-shrink: 0; }
        .ac-token-trigger-info { flex: 1; min-width: 0; }
        .ac-token-trigger-name { font-size: 13px; font-weight: 600; color: #1a202c; display: flex; align-items: center; gap: 6px; }
        .ac-token-trigger-sub  { font-size: 11px; color: #9ca3af; margin-top: 1px; }
        .ac-token-dot {
          width: 7px; height: 7px; border-radius: 50%; background: #22c55e; flex-shrink: 0;
        }
        .ac-btn-cancel {
          padding: 7px 18px; border-radius: 7px; border: 1px solid #d1d5db;
          background: #fff; color: #6b7280; font-size: 13px;
          cursor: pointer; transition: all 0.15s; font-family: inherit;
        }
        .ac-btn-cancel:hover { border-color: #e53e3e; color: #e53e3e; background: #fff5f5; }
        .ac-btn-create {
          padding: 7px 22px; border-radius: 7px; border: none;
          background: #2a3b4d; color: #fff; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: background 0.15s; font-family: inherit;
        }
        .ac-btn-create:hover { background: #1e2d3d; }
        .ac-modal-mask {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,0.25);
          display: flex; align-items: center; justify-content: center;
        }
        .ac-modal {
          background: #fff; border-radius: 12px;
          width: 480px; max-width: 95vw;
          box-shadow: 0 8px 32px rgba(0,0,0,0.14);
          display: flex; flex-direction: column; overflow: hidden; max-height: 80vh;
        }
        .ac-modal-head {
          padding: 14px 18px; border-bottom: 1px solid #f0f0f0;
          display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
        }
        .ac-modal-title { font-size: 14px; font-weight: 700; color: #1a202c; }
        .ac-modal-close {
          cursor: pointer; color: #9ca3af; display: flex; align-items: center;
          background: none; border: none; padding: 2px; transition: color 0.15s;
        }
        .ac-modal-close:hover { color: #374151; }
        .ac-modal-body { flex: 1; overflow-y: auto; padding: 10px 14px; }
        .ac-modal-item {
          display: flex; align-items: center; gap: 14px;
          padding: 9px 12px; border-radius: 8px; cursor: pointer;
          border: 1.5px solid #e5e7eb; transition: all 0.15s; margin-bottom: 7px; background: #fff;
        }
        .ac-modal-item:last-child { margin-bottom: 0; }
        .ac-modal-item:hover { border-color: #2a3b4d; background: #f5f7fa; }
        .ac-modal-item.selected { border-color: #2a3b4d; background: #2a3b4d08; }
        .ac-modal-check {
          width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
          border: 1.5px solid #d1d5db; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .ac-modal-item.selected .ac-modal-check { background: #2a3b4d; border-color: #2a3b4d; }
        .ac-modal-item-info { flex: 1; min-width: 0; }
        .ac-modal-item-name {
          font-size: 13px; font-weight: 600; color: #1a202c; margin-bottom: 2px;
          display: flex; align-items: center; gap: 6px;
        }
        .ac-modal-item-cat {
          font-size: 11px; padding: 1px 7px; border-radius: 4px;
          background: #f3f4f6; color: #6b7280; font-weight: 400;
        }
        .ac-modal-item-desc { font-size: 12px; color: #9ca3af; line-height: 1.5; }
        .ac-modal-foot {
          padding: 12px 18px; border-top: 1px solid #f0f0f0;
          display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
        }
        .ac-modal-selected-tip { font-size: 12px; color: #9ca3af; }
        .ac-modal-foot-btns { display: flex; gap: 8px; }
        .ac-modal-btn-cancel {
          padding: 7px 18px; border-radius: 7px; border: 1px solid #d1d5db;
          background: #fff; color: #6b7280; font-size: 13px;
          cursor: pointer; transition: all 0.15s; font-family: inherit;
        }
        .ac-modal-btn-cancel:hover { background: #f3f4f6; }
        .ac-modal-btn-confirm {
          padding: 7px 20px; border-radius: 7px; border: none;
          background: #2a3b4d; color: #fff; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: background 0.15s; font-family: inherit;
        }
        .ac-modal-btn-confirm:hover { background: #1e2d3d; }
        .ac-modal-btn-confirm:disabled { background: #9ca3af; cursor: not-allowed; }
        .tk-modal { width: 500px; }
        .tk-section-title {
          font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase;
          letter-spacing: 0.05em; padding: 10px 14px 6px;
        }
        .tk-input-area { padding: 4px 14px 14px; display: flex; flex-direction: column; gap: 10px; }
        .tk-input-row { display: flex; flex-direction: column; gap: 4px; }
        .tk-input-label { font-size: 11px; font-weight: 600; color: #374151; }
        .tk-token-wrap { position: relative; display: flex; align-items: center; }
        .tk-token-input {
          width: 100%; padding: 7px 72px 7px 10px; font-size: 12px;
          border: 1px solid #d1d5db; border-radius: 7px;
          outline: none; color: #111827; background: #fff;
          box-sizing: 'border-box'; transition: border-color 0.15s;
          font-family: "Courier New", monospace; letter-spacing: 0.03em;
        }
        .tk-token-input:focus { border-color: #2a3b4d; }
        .tk-token-actions {
          position: absolute; right: 6px; display: flex; align-items: center; gap: 4px;
        }
        .tk-icon-btn {
          display: flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; border-radius: 5px;
          border: none; background: none; cursor: pointer; color: #9ca3af;
          transition: color 0.15s, background 0.15s;
        }
        .tk-icon-btn:hover { color: #2a3b4d; background: #f3f4f6; }
        .tk-divider { height: 1px; background: #f0f0f0; margin: 4px 0; }
        .cm-modal { width: 880px; }
        .cm-body  { display: flex; flex-direction: column; gap: 0; overflow: hidden; }
        .cm-two-cols {
          display: flex; flex-direction: row; flex: 1; min-height: 0; overflow: hidden;
        }
        .cm-col-models {
          width: 380px; flex-shrink: 0; border-right: 1px solid #f0f0f0;
          overflow-y: auto; display: flex; flex-direction: column;
        }
        .cm-col-params {
          flex: 1; min-width: 0; overflow-y: auto; display: flex; flex-direction: column;
        }
        .cm-section-title {
          font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase;
          letter-spacing: 0.05em; padding: 10px 14px 6px; flex-shrink: 0;
        }
        .cm-preset-list { padding: 0 14px 14px; }
        .cm-preset-item {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 10px 12px; border-radius: 8px; cursor: pointer;
          border: 1.5px solid #e5e7eb; transition: all 0.15s; margin-bottom: 7px; background: #fff;
        }
        .cm-preset-item:last-child { margin-bottom: 0; }
        .cm-preset-item:hover { border-color: #2a3b4d; background: #f5f7fa; }
        .cm-preset-item.selected { border-color: #2a3b4d; background: #2a3b4d08; }
        .cm-preset-info { flex: 1; min-width: 0; }
        .cm-preset-name-row { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
        .cm-preset-name  { font-size: 13px; font-weight: 600; color: #1a202c; }
        .cm-preset-provider {
          font-size: 11px; padding: 1px 7px; border-radius: 4px;
          background: #f3f4f6; color: #6b7280;
        }
        .cm-preset-badge {
          font-size: 11px; padding: 1px 7px; border-radius: 4px; font-weight: 500;
        }
        .cm-preset-ctx  { font-size: 11px; color: #6b7280; margin-bottom: 3px; }
        .cm-preset-desc { font-size: 12px; color: #9ca3af; line-height: 1.5; }
        .cm-params-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 6px 16px 16px;
        }
        .cm-param-item { display: flex; flex-direction: column; gap: 4px; }
        .cm-param-label { font-size: 11px; font-weight: 600; color: #374151; }
        .cm-param-sub   { font-size: 10px; color: #9ca3af; margin-top: 1px; }
        .cm-params-empty {
          flex: 1; display: flex; align-items: center; justify-content: center;
          color: #c0c8d4; font-size: 13px; padding: 40px 20px;
        }
        @media (max-width: 960px) {
          .cm-modal { width: 95vw; }
          .cm-two-cols { flex-direction: column; }
          .cm-col-models { width: 100%; border-right: none; border-bottom: 1px solid #f0f0f0; }
          .cm-params-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 760px) {
          .ac-cols { grid-template-columns: 1fr; overflow-y: auto; }
          .ac-scroll { overflow-y: auto; }
        }
        @media (max-width: 600px) {
          .ac-scroll { padding: 12px; }
          .ac-btn-cancel, .ac-btn-create { width: 100%; }
          .cm-params-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ══════════════════════ 技能选择弹窗 ══════════════════════ */}
      <SkillModal
        open={skills.skillModalOpen}
        onClose={skills.closeSkillModal}
        onConfirm={handleConfirmSkillModal}
        skills={skills.backendSkills}
        loading={skills.skillsLoading}
        tempSkills={skills.tempSkills}
        onToggleSkill={skills.toggleTempSkill}
      />

      {/* ══════════════════════ Token 接入弹窗 ══════════════════════ */}
      <TokenModal
        open={token.tokenModalOpen}
        onClose={token.closeTokenModal}
        onConfirm={handleConfirmTokenModal}
        selectedChannel={selChannel}
        hasBackendKey={token.hasBackendKey}
        presetChannel={presetChannel}
        tempTokenValue={token.tempTokenValue}
        onTempTokenValueChange={token.setTokenValue}
        tempCustomUrl={token.tempCustomUrl}
        onTempCustomUrlChange={token.setCustomBaseUrl}
        tempTokenModel={token.tempTokenModel}
        onTempTokenModelChange={(m) => {/* handled in confirmTokenModal */}}
        showToken={token.showToken}
        onShowTokenToggle={() => token.setTokenValue(token.tempTokenValue)}
      />

      {/* ══════════════════════ CODE 模型弹窗 ══════════════════════ */}
      <CodeModal
        open={codeModel.codeModelOpen}
        onClose={codeModel.closeCodeModal}
        onConfirm={handleConfirmCodeModal}
        dynamicChannels={dynamicChannels}
        tempChannel={codeModel.tempChannel}
        tempModel={codeModel.tempModel}
        tempCustomUrl={codeModel.tempCustomUrl}
        tempTokenValue={codeModel.tempTokenValue}
        customMaxTokens={codeModel.customMaxTokens}
        customTemp={codeModel.customTemp}
        customTopP={codeModel.customTopP}
        customFreqPenalty={codeModel.customFreqPenalty}
        customPresPenalty={codeModel.customPresPenalty}
        onSelectChannel={codeModel.selectTempChannel}
        onSelectModel={codeModel.selectPreset}
        onTempCustomUrlChange={() => {}}
        onTempTokenValueChange={() => {}}
        onCustomMaxTokensChange={codeModel.setCustomMaxTokens}
        onCustomTempChange={codeModel.setCustomTemp}
        onCustomTopPChange={codeModel.setCustomTopP}
        onCustomFreqPenaltyChange={codeModel.setCustomFreqPenalty}
        onCustomPresPenaltyChange={codeModel.setCustomPresPenalty}
        onShowTokenToggle={() => {}}
        showToken={false}
        numInputStyle={form.numInputStyle}
        focusStyle={form.focusStyle}
        blurStyle={form.blurStyle}
      />

      {/* ══════════════════════ 主页面 ══════════════════════ */}
      <div className="ac-wrap">
        <div className="ac-card">

          {/* 顶部 header */}
          <div className="ac-header">
            <PlusCircle size={18} color="#2a3b4d" />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#1a202c' }}>
              {form.isDefaultAgent ? '基于预设创建智能体' : form.isEdit ? '编辑智能体' : '智能体创建'}
            </span>
            {form.isDefaultAgent && (
              <span style={{
                fontSize: 11, padding: '2px 7px', borderRadius: 4,
                background: '#fffbe6', color: '#d48806', border: '1px solid #ffe58f',
                marginLeft: 4,
              }}>预设模板</span>
            )}
          </div>

          <div className="ac-scroll">
            <form className="ac-form" onSubmit={handleSubmit}>
              <div className="ac-cols">

                {/* ══ 左栏：基本信息 + 角色设定 ══ */}
                <div className="ac-col">
                  <BasicInfoSection
                    name={form.name} setName={form.setName}
                    description={form.description} setDescription={form.setDescription}
                    style={form.style} setStyle={form.setStyle}
                    outputFmt={form.outputFmt} setOutputFmt={form.setOutputFmt}
                    agentType={form.agentType} setAgentType={form.setAgentType}
                    inputStyle={form.inputStyle}
                    focusStyle={form.focusStyle}
                    blurStyle={form.blurStyle}
                    labelStyle={form.labelStyle}
                    fieldStyle={form.fieldStyle}
                  />
                  <PromptSection
                    role={form.role} setRole={form.setRole}
                    boundary={form.boundary} setBoundary={form.setBoundary}
                    inputStyle={form.inputStyle}
                    focusStyle={form.focusStyle}
                    blurStyle={form.blurStyle}
                    labelStyle={form.labelStyle}
                    fieldStyle={form.fieldStyle}
                  />
                </div>

                {/* ══ 右栏：技能 + 模型 + Token + 高级设置 ══ */}
                <div className="ac-col">
                  <SkillSection
                    skills={form.skills}
                    onOpenModal={handleOpenSkillModal}
                    onRemoveSkill={handleRemoveSkill}
                    skillDisplayName={skills.skillDisplayName}
                  />
                  <ModelTokenSection
                    selectedChannel={selChannel}
                    selectedModel={selModel}
                    tokenValue={tValue}
                    hasBackendKey={token.hasBackendKey}
                    copied={token.copied}
                    onOpenCodeModal={codeModel.openCodeModal}
                    onOpenTokenModal={handleOpenTokenModal}
                    onCopyToken={token.handleCopyToken}
                    labelStyle={form.labelStyle}
                    fieldStyle={form.fieldStyle}
                  />
                  <AdvancedSection
                    memoryTurns={form.memoryTurns} setMemoryTurns={form.setMemoryTurns}
                    tempOverride={form.tempOverride} setTempOverride={form.setTempOverride}
                    visibility={form.visibility} setVisibility={form.setVisibility}
                    skillsConfig={form.skillsConfig} setSkillsConfig={form.setSkillsConfig}
                    inputStyle={form.inputStyle}
                    focusStyle={form.focusStyle}
                    blurStyle={form.blurStyle}
                    labelStyle={form.labelStyle}
                    fieldStyle={form.fieldStyle}
                  />
                </div>
              </div>
            </form>
          </div>

          {/* 底部按钮 */}
          <div className="ac-footer">
            <button type="button" className="ac-btn-cancel"
              onClick={() => form.navigate('/agents')} disabled={form.saving}>
              取消
            </button>
            <button type="button" className="ac-btn-create" onClick={handleSubmit as any} disabled={form.saving}>
              {form.saving
                ? (form.isEdit && !form.isDefaultAgent ? '保存中...' : '创建中...')
                : (form.isDefaultAgent ? '基于此模板创建' : form.isEdit ? '保存' : '创建')}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
