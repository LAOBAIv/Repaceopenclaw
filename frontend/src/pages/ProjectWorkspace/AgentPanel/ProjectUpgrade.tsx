/**
 * AgentPanel/ProjectUpgrade — 任务升级为项目按钮组件
 *
 * 职责：在任务模式的协作 Tab 底部显示"升级为项目"按钮。
 * 当流程节点中已分配至少 2 个不同智能体时可点击升级。
 */
import React from 'react';
import type { Agent } from '@/types';
import type { FlowNode } from '../types';

export function ProjectUpgrade({
  nodes,
  agentList,
  onUpgradeToProject,
}: {
  /** 协作流程节点列表 */
  nodes: FlowNode[];
  /** 全部可用智能体列表 */
  agentList: Agent[];
  /** 升级为项目回调 */
  onUpgradeToProject?: (newAgentNames: string[]) => void;
}) {
  if (!onUpgradeToProject) return null;

  // 收集节点中所有已选智能体名称（去重）
  const selectedAgentIds = [...new Set(nodes.flatMap(n => n.agentIds))];
  const selectedNames = selectedAgentIds
    .map(id => agentList.find(a => a.id === id)?.name)
    .filter(Boolean) as string[];
  const canUpgrade = selectedNames.length >= 2;

  return (
    <button
      onClick={() => { if (canUpgrade) onUpgradeToProject(selectedNames); }}
      disabled={!canUpgrade}
      title={canUpgrade ? '将当前任务升级为多智能体协作项目' : '需在流程节点中分配至少2个不同智能体'}
      style={{
        marginTop: 8, width: '100%', height: 36, borderRadius: 8,
        border: `1.5px solid ${canUpgrade ? '#f59e0b' : '#e5e7eb'}`,
        background: canUpgrade ? '#fffbeb' : '#f9fafb',
        color: canUpgrade ? '#92400e' : '#9ca3af',
        fontSize: 13, fontWeight: 700,
        cursor: canUpgrade ? 'pointer' : 'not-allowed',
        fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
        transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}
      onMouseEnter={e => { if (canUpgrade) { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.borderColor = '#d97706'; } }}
      onMouseLeave={e => { if (canUpgrade) { e.currentTarget.style.background = '#fffbeb'; e.currentTarget.style.borderColor = '#f59e0b'; } }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17 11 12 6 7 11"/><line x1="12" y1="6" x2="12" y2="18"/>
      </svg>
      {canUpgrade ? `升级为项目（${selectedNames.length}个智能体）` : '分配≥2个智能体后可升级为项目'}
    </button>
  );
}
