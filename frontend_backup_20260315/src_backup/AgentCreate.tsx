import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PlusCircle, X, Check, ChevronDown, Code2, KeyRound, Eye, EyeOff, Copy, CheckCheck } from 'lucide-react';
import { useAgentStore } from '@/stores/agentStore';
import { DEFAULT_AGENTS } from '@/data/defaultAgents';

/* ─── 技能选项 ─────────────────────────────────────────────── */
const SKILL_OPTIONS = [
  { name: '代码生成',   category: '开发工具', desc: '自动生成多语言代码片段，支持 React、Python、SQL 等。' },
  { name: '数据分析',   category: '数据处理', desc: '统计分析结构化数据，自动生成图表与报告。' },
  { name: '文本创作',   category: '内容生产', desc: '生成营销文案、产品描述，支持多种风格调节。' },
  { name: '智能问答',   category: '交互能力', desc: '意图识别与 FAQ 自动匹配，快速响应用户咨询。' },
  { name: '工具调用',   category: '集成能力', desc: '通过 Function Calling 调用外部 API 与系统工具。' },
  { name: '多模态处理', category: '感知能力', desc: '支持图片识别、语音输入等多模态输入。' },
  { name: '自定义技能', category: '扩展能力', desc: '通过插件机制接入自定义工具或业务逻辑。' },
];

const STYLE_TAGS  = ['极简简洁', '详细全面', '口语化', '正式专业'];
const OUTPUT_TAGS = ['纯文本', '代码优先', '预览+完整代码', '结构化JSON'];

/* ─── CODE 模型预设列表 ───────────────────────────────────── */
interface CodeModel {
  id: string;
  name: string;
  provider: string;
  desc: string;
  contextWindow: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  badge?: string;   // 可选角标：推荐 / 新 / 高性能
}

const CODE_MODEL_PRESETS: CodeModel[] = [
  {
    id: 'deepseek-coder-v2',
    name: 'DeepSeek-Coder-V2',
    provider: 'DeepSeek',
    badge: '推荐',
    desc: '专为代码优化的混合专家模型，支持 338 种编程语言，代码补全与调试能力出色。',
    contextWindow: '128K',
    maxTokens: 8192,
    temperature: 0.2,
    topP: 0.95,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    badge: '高性能',
    desc: '多模态旗舰模型，代码理解与生成能力强，支持函数调用与 JSON 模式。',
    contextWindow: '128K',
    maxTokens: 4096,
    temperature: 0.3,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    badge: '推荐',
    desc: '擅长长上下文代码理解与重构，在工程类任务中推理准确，输出稳定。',
    contextWindow: '200K',
    maxTokens: 8192,
    temperature: 0.25,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  {
    id: 'qwen2.5-coder-32b',
    name: 'Qwen2.5-Coder-32B',
    provider: '阿里云',
    badge: '新',
    desc: '通义千问代码专用版，中文注释友好，支持代码补全、Bug 修复、单测生成。',
    contextWindow: '32K',
    maxTokens: 4096,
    temperature: 0.2,
    topP: 0.95,
    frequencyPenalty: 0.1,
    presencePenalty: 0,
  },
  {
    id: 'codestral-latest',
    name: 'Codestral',
    provider: 'Mistral',
    desc: '轻量高速代码模型，适合低延迟实时补全场景，支持 80+ 编程语言。',
    contextWindow: '32K',
    maxTokens: 4096,
    temperature: 0.15,
    topP: 0.95,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    desc: '超长上下文支持，适合整库代码理解与大型项目重构。',
    contextWindow: '1M',
    maxTokens: 8192,
    temperature: 0.3,
    topP: 0.95,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
];

/* ─── 角标颜色 ─────────────────────────────────────────────── */
const BADGE_COLOR: Record<string, { bg: string; color: string }> = {
  推荐:  { bg: '#e6f4ff', color: '#1677ff' },
  高性能: { bg: '#fff7e6', color: '#d48806' },
  新:    { bg: '#f6ffed', color: '#389e0d' },
};

/* ─── Token 接入渠道预设 ──────────────────────────────────── */
interface TokenChannel {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  authType: 'Bearer' | 'ApiKey' | 'Basic';
  desc: string;
  badge?: string;
  docsUrl?: string;
}

const TOKEN_CHANNELS: TokenChannel[] = [
  {
    id: 'openai',
    name: 'OpenAI API',
    provider: 'OpenAI',
    badge: '通用',
    baseUrl: 'https://api.openai.com/v1',
    authType: 'Bearer',
    desc: '官方 OpenAI 接入，支持 GPT-4o、GPT-4 Turbo 等，需 sk- 开头的 API Key。',
    docsUrl: 'https://platform.openai.com/docs',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek API',
    provider: 'DeepSeek',
    badge: '推荐',
    baseUrl: 'https://api.deepseek.com/v1',
    authType: 'Bearer',
    desc: '高性价比大模型接口，兼容 OpenAI SDK，适合代码生成与推理任务。',
    docsUrl: 'https://platform.deepseek.com/docs',
  },
  {
    id: 'qwen',
    name: '通义千问 API',
    provider: '阿里云',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    authType: 'ApiKey',
    desc: '阿里云百炼平台接入，支持 Qwen 系列及多模态模型，国内访问稳定。',
    docsUrl: 'https://help.aliyun.com/zh/dashscope',
  },
  {
    id: 'anthropic',
    name: 'Anthropic API',
    provider: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    authType: 'ApiKey',
    desc: '接入 Claude 系列模型，长上下文处理能力强，适合文档理解与复杂推理。',
    docsUrl: 'https://docs.anthropic.com',
  },
  {
    id: 'azure-openai',
    name: 'Azure OpenAI',
    provider: 'Microsoft',
    badge: '企业级',
    baseUrl: 'https://{resource}.openai.azure.com',
    authType: 'ApiKey',
    desc: '微软 Azure 托管的 OpenAI 服务，支持私有部署与合规要求，企业首选。',
    docsUrl: 'https://learn.microsoft.com/azure/ai-services/openai',
  },
  {
    id: 'custom',
    name: '自定义接入',
    provider: '自定义',
    baseUrl: '',
    authType: 'Bearer',
    desc: '手动填写 Base URL 与 Token，适用于私有化部署或第三方代理服务。',
  },
];

const AUTH_TYPE_LABEL: Record<string, string> = {
  Bearer: 'Bearer Token',
  ApiKey: 'API Key',
  Basic:  'Basic Auth',
};

/* ═══════════════════════════════════════════════════════════ */
export function AgentCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');           // 编辑模式：携带 ?id=xxx
  const isEdit = !!editId;

  const { getAgentById, fetchAgents, createAgent, updateAgent, agents } = useAgentStore();

  const [name, setName]         = useState('');
  const [role, setRole]         = useState('');
  const [style, setStyle]       = useState('极简简洁');
  const [skills, setSkills]         = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [boundary, setBoundary]     = useState('');
  const [outputFmt, setOutputFmt]   = useState('纯文本');
  const [memory, setMemory]     = useState('');
  const [temp, setTemp]         = useState('');
  const [saving, setSaving]     = useState(false);

  /* ── 辅助：按 id 查找智能体（store + 默认预设双兜底） ─── */
  function findAgent(id: string) {
    return getAgentById(id) ?? DEFAULT_AGENTS.find(a => a.id === id) ?? null;
  }

  /* ── 预填表单 ─────────────────────────────────────────── */
  function fillForm(agent: ReturnType<typeof findAgent>) {
    if (!agent) return;
    setName(agent.name);
    setRole(agent.writingStyle ?? '');
    setSkills(agent.expertise ?? []);
    setDescription(agent.description ?? '');
    setBoundary('');
    setMemory(agent.systemPrompt ?? '');
  }

  /* ── 编辑模式：加载智能体数据预填表单 ─────────────────── */
  useEffect(() => {
    if (!isEdit) return;
    const agent = findAgent(editId!);
    if (agent) {
      fillForm(agent);
    } else {
      // store 里也没有，去后端拉一次
      fetchAgents();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  /* ── fetchAgents 完成后再次尝试预填（针对后端智能体） ─── */
  useEffect(() => {
    if (!isEdit || !editId) return;
    const agent = findAgent(editId);
    fillForm(agent);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents]);

  /* ── 技能弹窗 ─────────────────────────────────────────── */
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [tempSkills, setTempSkills]         = useState<string[]>([]);

  function openSkillModal() { setTempSkills([...skills]); setSkillModalOpen(true); }
  function closeSkillModal() { setSkillModalOpen(false); }
  function confirmSkillModal() { setSkills([...tempSkills]); setSkillModalOpen(false); }
  function toggleTempSkill(n: string) {
    setTempSkills(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]);
  }
  function removeSkill(n: string) { setSkills(prev => prev.filter(x => x !== n)); }

  /* ── Token 接入弹窗 ───────────────────────────────────── */
  const [tokenModalOpen, setTokenModalOpen]   = useState(false);
  const [tokenChannel, setTokenChannel]       = useState<TokenChannel | null>(null);
  const [tempChannel, setTempChannel]         = useState<TokenChannel | null>(null);
  const [tokenValue, setTokenValue]           = useState('');
  const [tempTokenValue, setTempTokenValue]   = useState('');
  const [customBaseUrl, setCustomBaseUrl]     = useState('');
  const [tempCustomUrl, setTempCustomUrl]     = useState('');
  const [showToken, setShowToken]             = useState(false);
  const [copied, setCopied]                   = useState(false);

  function openTokenModal() {
    setTempChannel(tokenChannel);
    setTempTokenValue(tokenValue);
    setTempCustomUrl(customBaseUrl);
    setShowToken(false);
    setTokenModalOpen(true);
  }
  function closeTokenModal() { setTokenModalOpen(false); }
  function confirmTokenModal() {
    if (!tempChannel) return;
    setTokenChannel(tempChannel);
    setTokenValue(tempTokenValue);
    setCustomBaseUrl(tempChannel.id === 'custom' ? tempCustomUrl : tempChannel.baseUrl);
    setTokenModalOpen(false);
  }
  function handleCopyToken() {
    if (!tokenValue) return;
    navigator.clipboard.writeText(tokenValue).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  /* ── CODE 模型弹窗 ────────────────────────────────────── */
  const [codeModelOpen, setCodeModelOpen]   = useState(false);
  const [selectedModel, setSelectedModel]   = useState<CodeModel | null>(null);
  const [tempModel, setTempModel]           = useState<CodeModel | null>(null);

  // 弹窗内自定义参数（可在预设基础上二次调整）
  const [customMaxTokens, setCustomMaxTokens]         = useState('');
  const [customTemp, setCustomTemp]                   = useState('');
  const [customTopP, setCustomTopP]                   = useState('');
  const [customFreqPenalty, setCustomFreqPenalty]     = useState('');
  const [customPresPenalty, setCustomPresPenalty]     = useState('');

  function openCodeModal() {
    setTempModel(selectedModel);
    // 将已选模型参数填入自定义框
    if (selectedModel) {
      setCustomMaxTokens(String(selectedModel.maxTokens));
      setCustomTemp(String(selectedModel.temperature));
      setCustomTopP(String(selectedModel.topP));
      setCustomFreqPenalty(String(selectedModel.frequencyPenalty));
      setCustomPresPenalty(String(selectedModel.presencePenalty));
    } else {
      setCustomMaxTokens(''); setCustomTemp(''); setCustomTopP('');
      setCustomFreqPenalty(''); setCustomPresPenalty('');
    }
    setCodeModelOpen(true);
  }

  function closeCodeModal() { setCodeModelOpen(false); }

  function selectPreset(m: CodeModel) {
    setTempModel(m);
    setCustomMaxTokens(String(m.maxTokens));
    setCustomTemp(String(m.temperature));
    setCustomTopP(String(m.topP));
    setCustomFreqPenalty(String(m.frequencyPenalty));
    setCustomPresPenalty(String(m.presencePenalty));
  }

  function confirmCodeModal() {
    if (!tempModel) return;
    setSelectedModel({
      ...tempModel,
      maxTokens:        Number(customMaxTokens) || tempModel.maxTokens,
      temperature:      Number(customTemp)       ?? tempModel.temperature,
      topP:             Number(customTopP)        ?? tempModel.topP,
      frequencyPenalty: Number(customFreqPenalty) ?? tempModel.frequencyPenalty,
      presencePenalty:  Number(customPresPenalty) ?? tempModel.presencePenalty,
    });
    setCodeModelOpen(false);
  }

  /* ── 是否为预设智能体（前端 fallback，无后端记录） ──────── */
  const isDefaultAgent = isEdit && editId?.startsWith('default-');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { alert('请填写智能体名称'); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        color: '#6366f1',
        systemPrompt: memory.trim(),
        writingStyle: role.trim() || style,
        expertise: skills,
        description: description.trim(),
        status: 'active' as const,
      };
      if (isEdit && editId && !isDefaultAgent) {
        // 普通编辑：更新已有后端记录
        await updateAgent(editId, payload);
      } else {
        // 新建 or 预设智能体编辑 → 另存为新智能体
        await createAgent(payload);
      }
      navigate('/agents');
    } catch {
      alert(isEdit && !isDefaultAgent ? '保存失败，请重试' : '创建失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  /* ── 样式辅助 ─────────────────────────────────────────── */
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', fontSize: 13,
    border: '1px solid #d1d5db', borderRadius: 7,
    outline: 'none', color: '#111827', background: '#fff',
    boxSizing: 'border-box', transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  };
  const numInputStyle: React.CSSProperties = {
    ...inputStyle, width: '100%', padding: '6px 8px', fontSize: 12,
  };
  function focusStyle(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.currentTarget.style.borderColor = '#2a3b4d';
  }
  function blurStyle(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.currentTarget.style.borderColor = '#d1d5db';
  }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 };
  const fieldStyle: React.CSSProperties = { marginBottom: 14 };

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
        .ac-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 20px 28px 0; display: flex; flex-direction: column; }
        .ac-form { flex: 1; min-height: 0; background: transparent; padding: 0; box-sizing: border-box; display: flex; flex-direction: column; }
        .ac-footer {
          padding: 11px 24px; border-top: 1px solid #ebebeb;
          background: #fff; display: flex; justify-content: center; gap: 10px; flex-shrink: 0;
        }

        /* ── 技能触发器 ── */
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

        /* ── CODE 模型触发器 ── */
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
        .ac-model-trigger-placeholder { font-size: 13px; color: #9ca3af; flex: 1; }
        .ac-model-badge {
          font-size: 11px; padding: 1px 7px; border-radius: 4px; font-weight: 500;
        }

        /* ── 标签 ── */
        .ac-tag {
          display: inline-flex; align-items: center;
          padding: 3px 11px; border-radius: 20px; font-size: 12px; cursor: pointer;
          border: 1px solid #e5e7eb; background: #fff; color: #4a5568;
          transition: all 0.15s; user-select: none;
        }
        .ac-tag.active { background: #2a3b4d; border-color: #2a3b4d; color: #fff; }
        .ac-tag:hover:not(.active) { border-color: #2a3b4d; color: #2a3b4d; }

        /* ── 底部按钮 ── */
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

        /* ── 通用弹窗遮罩 ── */
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
        /* CODE 模型 & Token 渠道选中态 */
        .cm-preset-item.selected .ac-modal-check { background: #2a3b4d; border-color: #2a3b4d; }
        .tk-channel-item.selected .ac-modal-check { background: #2a3b4d; border-color: #2a3b4d; }
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

        /* ── Token 接入触发器 ── */
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
        .ac-token-trigger-placeholder { font-size: 13px; color: #9ca3af; flex: 1; }
        .ac-token-dot {
          width: 7px; height: 7px; border-radius: 50%; background: #22c55e; flex-shrink: 0;
        }

        /* ── Token 弹窗专属 ── */
        .tk-modal { width: 500px; }
        .tk-section-title {
          font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase;
          letter-spacing: 0.05em; padding: 10px 14px 6px;
        }
        .tk-channel-list { padding: 0 14px 4px; }
        .tk-channel-item {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 10px 12px; border-radius: 8px; cursor: pointer;
          border: 1.5px solid #e5e7eb; transition: all 0.15s; margin-bottom: 7px; background: #fff;
        }
        .tk-channel-item:last-child { margin-bottom: 0; }
        .tk-channel-item:hover { border-color: #2a3b4d; background: #f5f7fa; }
        .tk-channel-item.selected { border-color: #2a3b4d; background: #2a3b4d08; }
        .tk-channel-info { flex: 1; min-width: 0; }
        .tk-channel-name-row { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
        .tk-channel-name { font-size: 13px; font-weight: 600; color: #1a202c; }
        .tk-channel-provider { font-size: 11px; padding: 1px 7px; border-radius: 4px; background: #f3f4f6; color: #6b7280; }
        .tk-channel-auth { font-size: 11px; padding: 1px 7px; border-radius: 4px; background: #f0fdf4; color: #15803d; font-weight: 500; }
        .tk-channel-desc { font-size: 12px; color: #9ca3af; line-height: 1.5; }
        .tk-input-area { padding: 4px 14px 14px; display: flex; flex-direction: column; gap: 10px; }
        .tk-input-row { display: flex; flex-direction: column; gap: 4px; }
        .tk-input-label { font-size: 11px; font-weight: 600; color: #374151; }
        .tk-token-wrap { position: relative; display: flex; align-items: center; }
        .tk-token-input {
          width: 100%; padding: 7px 72px 7px 10px; font-size: 12px;
          border: 1px solid #d1d5db; border-radius: 7px;
          outline: none; color: #111827; background: #fff;
          box-sizing: border-box; transition: border-color 0.15s;
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
        .tk-docs-link {
          font-size: 11px; color: #1677ff; text-decoration: none; display: inline-flex; align-items: center; gap: 3px;
        }
        .tk-docs-link:hover { text-decoration: underline; }
        .tk-divider { height: 1px; background: #f0f0f0; margin: 4px 0; }

        /* ── CODE 模型弹窗专属 ── */
        .cm-modal { width: 560px; }
        .cm-body  { display: flex; flex-direction: column; gap: 0; }
        .cm-section-title {
          font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase;
          letter-spacing: 0.05em; padding: 10px 14px 6px;
        }
        .cm-preset-list { padding: 0 14px; }
        .cm-preset-item {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 10px 12px; border-radius: 8px; cursor: pointer;
          border: 1.5px solid #e5e7eb; transition: all 0.15s; margin-bottom: 7px; background: #fff;
        }
        .cm-preset-item:last-child { margin-bottom: 0; }
        .cm-preset-item:hover { border-color: #2a3b4d; background: #f5f7fa; }
        .cm-preset-item.selected { border-color: #2a3b4d; background: #2a3b4d08; }
        .cm-preset-info { flex: 1; min-width: 0; }
        .cm-preset-name-row {
          display: flex; align-items: center; gap: 6px; margin-bottom: 2px;
        }
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
          display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
          padding: 10px 14px 14px;
        }
        .cm-param-item { display: flex; flex-direction: column; gap: 4px; }
        .cm-param-label { font-size: 11px; font-weight: 600; color: #374151; }
        .cm-param-sub   { font-size: 10px; color: #9ca3af; margin-top: 1px; }
        .cm-divider     { height: 1px; background: #f0f0f0; margin: 4px 0; }

        @media (max-width: 768px) {
          .ac-scroll { padding: 20px; }
          .ac-btn-cancel, .ac-btn-create { width: 100%; }
          .cm-modal { width: 95vw; }
          .cm-params-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ══════════════════════ 技能选择弹窗 ══════════════════════ */}
      {skillModalOpen && (
        <div className="ac-modal-mask" onClick={closeSkillModal}>
          <div className="ac-modal" onClick={e => e.stopPropagation()}>
            <div className="ac-modal-head">
              <span className="ac-modal-title">选择核心技能</span>
              <button className="ac-modal-close" onClick={closeSkillModal}><X size={18} /></button>
            </div>
            <div className="ac-modal-body">
              {SKILL_OPTIONS.map(skill => {
                const sel = tempSkills.includes(skill.name);
                return (
                  <div
                    key={skill.name}
                    className={`ac-modal-item${sel ? ' selected' : ''}`}
                    onClick={() => toggleTempSkill(skill.name)}
                  >
                    <div className="ac-modal-check">
                      {sel && <Check size={13} color="#fff" strokeWidth={3} />}
                    </div>
                    <div className="ac-modal-item-info">
                      <div className="ac-modal-item-name">
                        {skill.name}
                        <span className="ac-modal-item-cat">{skill.category}</span>
                      </div>
                      <div className="ac-modal-item-desc">{skill.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="ac-modal-foot">
              <span className="ac-modal-selected-tip">已选 {tempSkills.length} 个技能</span>
              <div className="ac-modal-foot-btns">
                <button className="ac-modal-btn-cancel" onClick={closeSkillModal}>取消</button>
                <button className="ac-modal-btn-confirm" onClick={confirmSkillModal}>确认</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ Token 接入弹窗 ══════════════════════ */}
      {tokenModalOpen && (
        <div className="ac-modal-mask" onClick={closeTokenModal}>
          <div className="ac-modal tk-modal" onClick={e => e.stopPropagation()}>

            <div className="ac-modal-head">
              <span className="ac-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <KeyRound size={16} color="#2a3b4d" />
                Token 接入配置
              </span>
              <button className="ac-modal-close" onClick={closeTokenModal}><X size={18} /></button>
            </div>

            <div className="ac-modal-body" style={{ padding: 0 }}>

              {/* 渠道列表 */}
              <div className="tk-section-title">选择接入渠道</div>
              <div className="tk-channel-list">
                {TOKEN_CHANNELS.map(ch => {
                  const sel = tempChannel?.id === ch.id;
                  const bc  = ch.badge ? BADGE_COLOR[ch.badge] ?? null : null;
                  return (
                    <div
                      key={ch.id}
                      className={`tk-channel-item${sel ? ' selected' : ''}`}
                      onClick={() => setTempChannel(ch)}
                    >
                      <div className="ac-modal-check" style={{ marginTop: 2 }}>
                        {sel && <Check size={13} color="#fff" strokeWidth={3} />}
                      </div>
                      <div className="tk-channel-info">
                        <div className="tk-channel-name-row">
                          <span className="tk-channel-name">{ch.name}</span>
                          <span className="tk-channel-provider">{ch.provider}</span>
                          <span className="tk-channel-auth">{AUTH_TYPE_LABEL[ch.authType]}</span>
                          {ch.badge && bc && (
                            <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, fontWeight: 500, background: bc.bg, color: bc.color }}>
                              {ch.badge}
                            </span>
                          )}
                        </div>
                        <div className="tk-channel-desc">{ch.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Token 输入区 */}
              {tempChannel && (
                <>
                  <div className="tk-divider" />
                  <div className="tk-section-title">填写认证信息</div>
                  <div className="tk-input-area">

                    {/* Base URL（自定义时才显示） */}
                    {tempChannel.id === 'custom' ? (
                      <div className="tk-input-row">
                        <label className="tk-input-label">Base URL</label>
                        <input
                          type="text"
                          style={{ padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 7, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: '"Courier New", monospace' }}
                          value={tempCustomUrl}
                          onChange={e => setTempCustomUrl(e.target.value)}
                          placeholder="https://your-api-host.com/v1"
                          onFocus={e => e.currentTarget.style.borderColor = '#2a3b4d'}
                          onBlur={e => e.currentTarget.style.borderColor = '#d1d5db'}
                        />
                      </div>
                    ) : (
                      <div className="tk-input-row">
                        <label className="tk-input-label">Base URL（预设，只读）</label>
                        <input
                          type="text"
                          readOnly
                          style={{ padding: '7px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 7, outline: 'none', width: '100%', boxSizing: 'border-box', background: '#f9fafb', color: '#6b7280', fontFamily: '"Courier New", monospace' }}
                          value={tempChannel.baseUrl}
                        />
                      </div>
                    )}

                    {/* Token 输入 */}
                    <div className="tk-input-row">
                      <label className="tk-input-label">{AUTH_TYPE_LABEL[tempChannel.authType]}</label>
                      <div className="tk-token-wrap">
                        <input
                          className="tk-token-input"
                          type={showToken ? 'text' : 'password'}
                          value={tempTokenValue}
                          onChange={e => setTempTokenValue(e.target.value)}
                          placeholder={
                            tempChannel.authType === 'Bearer' ? 'sk-xxxxxxxxxxxxxxxxxxxxxxxx'
                            : tempChannel.authType === 'ApiKey' ? '输入 API Key'
                            : 'username:password'
                          }
                          autoComplete="off"
                          spellCheck={false}
                        />
                        <div className="tk-token-actions">
                          <button type="button" className="tk-icon-btn" onClick={() => setShowToken(v => !v)} title={showToken ? '隐藏' : '显示'}>
                            {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button type="button" className="tk-icon-btn" onClick={() => { navigator.clipboard.writeText(tempTokenValue).catch(() => {}); }} title="复制">
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 文档链接 */}
                    {tempChannel.docsUrl && (
                      <a className="tk-docs-link" href={tempChannel.docsUrl} target="_blank" rel="noreferrer">
                        📄 查看官方接入文档 →
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="ac-modal-foot">
              <span className="ac-modal-selected-tip">
                {tempChannel ? `已选：${tempChannel.name}` : '请选择接入渠道'}
              </span>
              <div className="ac-modal-foot-btns">
                <button className="ac-modal-btn-cancel" onClick={closeTokenModal}>取消</button>
                <button
                  className="ac-modal-btn-confirm"
                  disabled={!tempChannel || !tempTokenValue.trim()}
                  onClick={confirmTokenModal}
                >确认</button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════ CODE 模型弹窗 ══════════════════════ */}
      {codeModelOpen && (
        <div className="ac-modal-mask" onClick={closeCodeModal}>
          <div className="ac-modal cm-modal" onClick={e => e.stopPropagation()}>

            <div className="ac-modal-head">
              <span className="ac-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Code2 size={16} color="#2a3b4d" />
                选择 CODE 模型
              </span>
              <button className="ac-modal-close" onClick={closeCodeModal}><X size={18} /></button>
            </div>

            <div className="ac-modal-body cm-body">

              {/* 预设列表 */}
              <div className="cm-section-title">预设模型</div>
              <div className="cm-preset-list">
                {CODE_MODEL_PRESETS.map(m => {
                  const sel = tempModel?.id === m.id;
                  const bc  = m.badge ? BADGE_COLOR[m.badge] : null;
                  return (
                    <div
                      key={m.id}
                      className={`cm-preset-item${sel ? ' selected' : ''}`}
                      onClick={() => selectPreset(m)}
                    >
                      <div className="ac-modal-check" style={{ marginTop: 2 }}>
                        {sel && <Check size={13} color="#fff" strokeWidth={3} />}
                      </div>
                      <div className="cm-preset-info">
                        <div className="cm-preset-name-row">
                          <span className="cm-preset-name">{m.name}</span>
                          <span className="cm-preset-provider">{m.provider}</span>
                          {m.badge && bc && (
                            <span
                              className="cm-preset-badge"
                              style={{ background: bc.bg, color: bc.color }}
                            >{m.badge}</span>
                          )}
                        </div>
                        <div className="cm-preset-ctx">上下文窗口：{m.contextWindow}</div>
                        <div className="cm-preset-desc">{m.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 参数调节区 */}
              {tempModel && (
                <>
                  <div className="cm-divider" style={{ margin: '8px 0 0' }} />
                  <div className="cm-section-title">参数调节（基于预设可微调）</div>
                  <div className="cm-params-grid">
                    {/* Max Tokens */}
                    <div className="cm-param-item">
                      <label className="cm-param-label">Max Tokens</label>
                      <input
                        type="number" min={256} max={32768} step={256}
                        style={numInputStyle}
                        value={customMaxTokens}
                        onChange={e => setCustomMaxTokens(e.target.value)}
                        onFocus={focusStyle} onBlur={blurStyle}
                        placeholder={String(tempModel.maxTokens)}
                      />
                      <span className="cm-param-sub">最大输出 token 数</span>
                    </div>

                    {/* Temperature */}
                    <div className="cm-param-item">
                      <label className="cm-param-label">Temperature</label>
                      <input
                        type="number" min={0} max={2} step={0.05}
                        style={numInputStyle}
                        value={customTemp}
                        onChange={e => setCustomTemp(e.target.value)}
                        onFocus={focusStyle} onBlur={blurStyle}
                        placeholder={String(tempModel.temperature)}
                      />
                      <span className="cm-param-sub">0 = 精准确定，2 = 高度发散</span>
                    </div>

                    {/* Top P */}
                    <div className="cm-param-item">
                      <label className="cm-param-label">Top P</label>
                      <input
                        type="number" min={0} max={1} step={0.05}
                        style={numInputStyle}
                        value={customTopP}
                        onChange={e => setCustomTopP(e.target.value)}
                        onFocus={focusStyle} onBlur={blurStyle}
                        placeholder={String(tempModel.topP)}
                      />
                      <span className="cm-param-sub">核采样概率阈值</span>
                    </div>

                    {/* Frequency Penalty */}
                    <div className="cm-param-item">
                      <label className="cm-param-label">Frequency Penalty</label>
                      <input
                        type="number" min={-2} max={2} step={0.1}
                        style={numInputStyle}
                        value={customFreqPenalty}
                        onChange={e => setCustomFreqPenalty(e.target.value)}
                        onFocus={focusStyle} onBlur={blurStyle}
                        placeholder={String(tempModel.frequencyPenalty)}
                      />
                      <span className="cm-param-sub">降低重复词语出现频率</span>
                    </div>

                    {/* Presence Penalty */}
                    <div className="cm-param-item">
                      <label className="cm-param-label">Presence Penalty</label>
                      <input
                        type="number" min={-2} max={2} step={0.1}
                        style={numInputStyle}
                        value={customPresPenalty}
                        onChange={e => setCustomPresPenalty(e.target.value)}
                        onFocus={focusStyle} onBlur={blurStyle}
                        placeholder={String(tempModel.presencePenalty)}
                      />
                      <span className="cm-param-sub">鼓励引入新话题与词汇</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="ac-modal-foot">
              <span className="ac-modal-selected-tip">
                {tempModel ? `已选：${tempModel.name}` : '请选择一个模型'}
              </span>
              <div className="ac-modal-foot-btns">
                <button className="ac-modal-btn-cancel" onClick={closeCodeModal}>取消</button>
                <button
                  className="ac-modal-btn-confirm"
                  disabled={!tempModel}
                  onClick={confirmCodeModal}
                >确认</button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════ 主页面 ══════════════════════ */}
      <div className="ac-wrap">
        <div className="ac-card">

          {/* 顶部 header */}
          <div className="ac-header">
            <PlusCircle size={18} color="#2a3b4d" />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#1a202c' }}>
              {isDefaultAgent ? '基于预设创建智能体' : isEdit ? '编辑智能体' : '智能体创建'}
            </span>
            {isDefaultAgent && (
              <span style={{
                fontSize: 11, padding: '2px 7px', borderRadius: 4,
                background: '#fffbe6', color: '#d48806', border: '1px solid #ffe58f',
                marginLeft: 4,
              }}>预设模板</span>
            )}
          </div>

          <div className="ac-scroll">
            <form className="ac-form" onSubmit={handleSubmit}>

              {/* 智能体名称 */}
              <div style={fieldStyle}>
                <label style={labelStyle}>智能体名称</label>
                <input
                  style={inputStyle}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="例如：前端开发助手、电商客服智能体"
                  onFocus={focusStyle} onBlur={blurStyle}
                />
              </div>

              {/* 一句话简介 */}
              <div style={fieldStyle}>
                <label style={labelStyle}>一句话简介</label>
                <input
                  style={inputStyle}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="简要描述该智能体的用途，将显示在选择弹窗中..."
                  onFocus={focusStyle} onBlur={blurStyle}
                />
              </div>

              {/* 角色设定 */}
              <div style={fieldStyle}>
                <label style={labelStyle}>角色设定</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 100, resize: 'vertical' } as React.CSSProperties}
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  placeholder="定义智能体的人设和核心定位..."
                  onFocus={focusStyle} onBlur={blurStyle}
                />
              </div>

              {/* 语言风格 + 输出格式规范 */}
              <div style={{ ...fieldStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
                <div>
                  <label style={labelStyle}>语言风格</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {STYLE_TAGS.map(tag => (
                      <span key={tag} className={`ac-tag${style === tag ? ' active' : ''}`} onClick={() => setStyle(tag)}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>输出格式规范</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {OUTPUT_TAGS.map(tag => (
                      <span key={tag} className={`ac-tag${outputFmt === tag ? ' active' : ''}`} onClick={() => setOutputFmt(tag)}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 核心技能 */}
              <div style={fieldStyle}>
                <label style={labelStyle}>核心技能</label>
                <div className="ac-skill-trigger" onClick={openSkillModal}>
                  {skills.length === 0
                    ? <span className="ac-skill-placeholder">点击选择技能...</span>
                    : skills.map(s => (
                        <span key={s} className="ac-skill-chip">
                          {s}
                          <button type="button" className="ac-skill-chip-del"
                            onClick={e => { e.stopPropagation(); removeSkill(s); }}>
                            <X size={11} />
                          </button>
                        </span>
                      ))
                  }
                  <span className="ac-skill-arrow"><ChevronDown size={15} /></span>
                </div>
              </div>

              {/* ── CODE 模型参数 & Token 接入（同行两列） ── */}
              <div style={{ ...fieldStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

                {/* CODE 模型参数 */}
                <div>
                  <label style={labelStyle}>CODE 模型参数</label>
                  <div className="ac-model-trigger" onClick={openCodeModal}>
                    <span className="ac-model-trigger-icon"><Code2 size={16} /></span>
                    {selectedModel ? (
                      <div className="ac-model-trigger-info">
                        <div className="ac-model-trigger-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {selectedModel.name}
                          <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, background: '#f3f4f6', color: '#6b7280' }}>
                            {selectedModel.provider}
                          </span>
                        </div>
                        <div className="ac-model-trigger-sub">
                          maxTokens: {selectedModel.maxTokens} · temp: {selectedModel.temperature}
                        </div>
                      </div>
                    ) : (
                      <span className="ac-model-trigger-placeholder">选择模型及参数...</span>
                    )}
                    <span style={{ marginLeft: 'auto', color: '#9ca3af', flexShrink: 0 }}><ChevronDown size={15} /></span>
                  </div>
                </div>

                {/* Token 接入 */}
                <div>
                  <label style={labelStyle}>Token 接入</label>
                  <div className="ac-token-trigger" onClick={openTokenModal}>
                    <span className="ac-token-trigger-icon"><KeyRound size={16} /></span>
                    {tokenChannel ? (
                      <div className="ac-token-trigger-info">
                        <div className="ac-token-trigger-name">
                          {tokenChannel.name}
                          <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, background: '#f0fdf4', color: '#15803d' }}>
                            {AUTH_TYPE_LABEL[tokenChannel.authType]}
                          </span>
                          {tokenValue && <span className="ac-token-dot" />}
                        </div>
                        <div className="ac-token-trigger-sub">
                          {tokenValue
                            ? `${tokenValue.slice(0, 6)}${'•'.repeat(Math.min(12, tokenValue.length - 6))}  已配置`
                            : '未填写 Token'}
                        </div>
                      </div>
                    ) : (
                      <span className="ac-token-trigger-placeholder">配置 API Token...</span>
                    )}
                    <span style={{ marginLeft: 'auto', color: '#9ca3af', flexShrink: 0 }}><ChevronDown size={15} /></span>
                  </div>
                  {/* 已配置时显示快捷复制 */}
                  {tokenChannel && tokenValue && (
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      style={{
                        marginTop: 5, display: 'flex', alignItems: 'center', gap: 4,
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 11, color: copied ? '#15803d' : '#9ca3af', padding: 0,
                        transition: 'color 0.15s',
                      }}
                    >
                      {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
                      {copied ? 'Token 已复制' : '复制 Token'}
                    </button>
                  )}
                </div>

              </div>

              {/* 能力边界 */}
              <div style={fieldStyle}>
                <label style={labelStyle}>能力边界</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 80, resize: 'vertical' } as React.CSSProperties}
                  value={boundary}
                  onChange={e => setBoundary(e.target.value)}
                  placeholder="明确智能体不能做的事..."
                  onFocus={focusStyle} onBlur={blurStyle}
                />
              </div>

              {/* 对话记忆长度 & 推理温度值 */}
              <div style={{ ...fieldStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>对话记忆长度</label>
                  <input
                    type="number" min={1} max={50}
                    style={inputStyle}
                    value={memory}
                    onChange={e => setMemory(e.target.value)}
                    placeholder="输入数字（轮数），例如：10"
                    onFocus={focusStyle} onBlur={blurStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>推理温度值</label>
                  <input
                    type="number" min={0} max={1} step={0.1}
                    style={inputStyle}
                    value={temp}
                    onChange={e => setTemp(e.target.value)}
                    placeholder="0=精准，1=创意..."
                    onFocus={focusStyle} onBlur={blurStyle}
                  />
                </div>
              </div>

            </form>
          </div>

          {/* 底部按钮 */}
          <div className="ac-footer">
            <button type="button" className="ac-btn-cancel"
              onClick={() => navigate('/agents')} disabled={saving}>
              取消
            </button>
            <button type="button" className="ac-btn-create" onClick={handleSubmit as any} disabled={saving}>
              {saving
                ? (isEdit && !isDefaultAgent ? '保存中...' : '创建中...')
                : (isDefaultAgent ? '基于此模板创建' : isEdit ? '保存' : '创建')}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
