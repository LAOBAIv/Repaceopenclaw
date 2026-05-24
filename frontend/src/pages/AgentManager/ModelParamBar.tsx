/**
 * ModelParamBar - 模型参数展示栏组件
 * 显示实际 LLM 路由 + 渠道 + 模型名，并在模型无效时给出警告标识
 */
import { Cpu, AlertTriangle } from 'lucide-react';
import type { Agent } from '@/types';
import type { AgentRoutingInfo } from '@/api/agents';
import { isValidModelName } from './utils';

export function ModelParamBar({ agent, routing }: { agent: Agent; routing?: AgentRoutingInfo }) {
  const channel = agent.tokenProvider;
  const model   = agent.modelName;
  const isValidModel = isValidModelName(model, routing);

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
