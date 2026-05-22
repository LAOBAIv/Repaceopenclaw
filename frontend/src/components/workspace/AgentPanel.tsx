import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { showToast } from '@/components/Toast';
import type { Agent, ConversationPanel } from '@/types';
import type { KanbanProject } from '@/stores/projectKanbanStore';

export type FlowNodeType = 'serial' | 'parallel';

export interface FlowNode {
  id: string;
  name: string;
  nodeType: FlowNodeType;
  agentIds: string[];
  desc: string;
}

export function makeFlowNode(idx: number): FlowNode {
  return { id: `fn_${Date.now()}_${idx}`, name: `流程节点 ${idx + 1}`, nodeType: 'serial', agentIds: [], desc: '' };
}

function AddFlowNodeMenu({
  anchorRef,
  onAdd,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onAdd: (t: FlowNodeType) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ left: r.left + r.width / 2, top: r.top });
    }
    function handler(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [anchorRef, onClose]);

  if (!pos) return null;
  const MENU_W = 260;

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: Math.max(8, pos.left - MENU_W / 2),
        top: pos.top - 10,
        transform: 'translateY(-100%)',
        zIndex: 99999,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        boxShadow: '0 6px 24px rgba(0,0,0,0.13)',
        padding: 8,
        display: 'flex',
        gap: 8,
        width: MENU_W,
      }}
    >
      {/* 小三角（朝下） */}
      <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 10, height: 6, overflow: 'hidden' }}>
        <div style={{ width: 10, height: 10, background: '#fff', border: '1px solid #e5e7eb', transform: 'rotate(45deg) translate(-3px,-3px)' }} />
      </div>

      <button
        onClick={() => { onAdd('serial'); onClose(); }}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
          padding: '10px 0', borderRadius: 8, border: '1.5px solid #e5e7eb',
          background: '#fff', cursor: 'pointer',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#374151'; e.currentTarget.style.background = '#f5f7fa'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff'; }}
      >
        {/* ArrowDown SVG */}
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
        </svg>
        <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>下行节点</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>串行向下执行</span>
      </button>

      <button
        onClick={() => { onAdd('parallel'); onClose(); }}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
          padding: '10px 0', borderRadius: 8, border: '1.5px solid #e5e7eb',
          background: '#fff', cursor: 'pointer',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = '#f5f3ff'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff'; }}
      >
        {/* GitBranch SVG */}
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
        </svg>
        <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>并行节点</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>与上节点并行</span>
      </button>
    </div>,
    document.body
  );
}

/* ── 智能体多选弹窗（inline，挂到 TabPanel 内的 Portal） ── */
function AgentPickerModal({
  agentList,
  selected,
  onClose,
  onConfirm,
}: {
  agentList: Agent[];
  selected: string[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const [draft, setDraft] = useState<Set<string>>(() => new Set(selected));
  function toggle(id: string) {
    setDraft(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  return createPortal(
    <div
      onMouseDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12,
          width: 660, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 96px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
          marginBottom: 32,
        }}>
        {/* 头部 */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#1a202c' }}>
            选择智能体
            <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400, marginLeft: 6 }}>已选 {draft.size} 个</span>

          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2, fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        {/* 列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          {/* [2026-05-21] 过滤系统助手 */}
          {agentList.filter(a => !a.isSystem).map(agent => {
            const sel = draft.has(agent.id);
            const ac = agent.color ?? '#6366f1';
            return (
              <div
                key={agent.id}
                onClick={() => toggle(agent.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  border: `1.5px solid ${sel ? ac : '#e5e7eb'}`,
                  background: sel ? ac + '0d' : '#fff',
                  transition: 'all 0.12s',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: ac + '22', border: `1.5px solid ${ac}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: ac, fontWeight: 700, fontSize: 11,
                }}>{agent.name.charAt(0)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#1a202c' }}>{agent.name}</div>
                  {agent.modelName && (
                    <div style={{ fontSize: 11, color: '#6366f1', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {agent.modelProvider ? `${agent.modelProvider} · ` : ''}{agent.modelName}
                      {agent.temperature != null ? ` · T=${agent.temperature}` : ''}
                      {agent.maxTokens != null ? ` · ${agent.maxTokens}tk` : ''}
                    </div>
                  )}
                </div>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  border: `1.5px solid ${sel ? ac : '#d1d5db'}`,
                  background: sel ? ac : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {sel && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
              </div>
            );
          })}
        </div>
        {/* 底部按钮 */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '6px 16px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>取消</button>
          <button onClick={() => onConfirm([...draft])} style={{ padding: '6px 18px', borderRadius: 7, border: 'none', background: '#374151', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>确认</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AgentPanel({
  agents,
  agentStatusMap,
  taskName,
  matchedProject,
  onInject,
  incomingAgentNames,
  openPanels,
  activePanelId,
  onSwitchPanel,
  onOpenPanel,
  onSwitchAgent,
  onClosePanel,
  currentProjectId,
  collabNodes,
  setCollabNodes,
  isProject,
  participatingAgentNames,
  onUpgradeToProject,
  onDowngradeToTask,
}: {
  agents?: Agent[];
  agentStatusMap: Record<string, { label: string; color: string }>;
  taskName?: string;
  matchedProject?: KanbanProject | null;
  onInject?: (text: string) => void;
  incomingAgentNames?: string[];
  openPanels: ConversationPanel[];
  activePanelId: string | null;
  onSwitchPanel: (panelId: string) => void;
  onOpenPanel: (agentId: string, agentName: string, agentColor: string, initialMessage?: string) => void;
  onSwitchAgent: (agentId: string, agentName: string, agentColor: string) => void;
  onClosePanel: (panelId: string) => void;
  currentProjectId?: string;
  collabNodes: FlowNode[];
  setCollabNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  /** 当前是项目（true）还是任务（false），任务模式显示协作Tab但带升级入口 */
  isProject: boolean;
  /** 当前参与会话的智能体名称列表 */
  participatingAgentNames?: string[];
  /** 任务升级为项目回调 */
  onUpgradeToProject?: (newAgentNames: string[]) => void;
  /** 项目降级为任务回调 */
  onDowngradeToTask?: (keptAgentName: string) => void;
}) {
  const [subTab, setSubTab] = useState<'switch'|'collab'>('switch');

  /* ── 智能体列表 ── */
  const allAgents = agents ?? [];
  // 关键规则："切换智能体"必须能看到全部可用 agent，不能被看板传入的 incomingAgentNames 限制。
  // 否则从任务/会话列表进入时，弹窗通常只会剩当前那 1 个 agent，无法在同一 session 内切换到别的 agent。
  // incomingAgentNames 只适合做展示/默认关联，不适合限制切换候选池。
  const agentList = allAgents;

  /* ══════════ 协作 Tab：FlowNode 流程节点 ══════════ */
  // nodes/setNodes 是外层持久化状态的别名，关闭弹窗后数据不会丢失
  const nodes = collabNodes;
  const setNodes = setCollabNodes;
  const [pickerNodeId, setPickerNodeId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  function addNode(type: FlowNodeType) {
    setNodes(prev => {
      if (type === 'parallel') {
        let count = 0;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].nodeType === 'serial') { count++; break; }
          count++;
        }
        if (count >= 3) { showToast('同一层最多并行 3 个节点', 'warning'); return prev; }
      }
      return [...prev, {
        id: `fn_${Date.now()}`,
        name: `流程节点 ${prev.length + 1}`,
        nodeType: type,
        agentIds: [],
        desc: '',
      }];
    });
  }
  function removeNode(id: string) {
    setNodes(prev => prev.filter(n => n.id !== id));
  }
  function updateNode(id: string, patch: Partial<FlowNode>) {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n));
  }
  function moveNode(idx: number, dir: -1 | 1) {
    setNodes(prev => {
      const arr = [...prev];
      const t = idx + dir;
      if (t < 0 || t >= arr.length) return arr;
      [arr[idx], arr[t]] = [arr[t], arr[idx]];
      return arr;
    });
  }
  function confirmAgents(nodeId: string, ids: string[]) {
    updateNode(nodeId, { agentIds: ids });
    setPickerNodeId(null);
  }

  function applyCollab() {
    // 构建协作上下文：所有节点的概览（供每个智能体了解整体分工）
    const allNodes = nodes.filter(n => n.agentIds.length > 0);
    const contextLines = allNodes.map((n, i) => {
      const assignedNames = n.agentIds
        .map(id => allAgents.find(a => a.id === id)?.name ?? id)
        .join('、');
      const type = n.nodeType === 'parallel' ? '[并行]' : '[串行]';
      const desc = n.desc ? `：${n.desc}` : '';
      return `  ${i + 1}. ${type} ${n.name}（负责：${assignedNames}）${desc}`;
    }).join('\n');

    // 关闭不在协作列表中的面板
    const allAgentIds = [...new Set(nodes.flatMap(n => n.agentIds))];
    openPanels.forEach(p => {
      if (!allAgentIds.includes(p.agentId)) onClosePanel(p.id);
    });

    // 按节点维度，为每个智能体生成专属初始消息
    nodes.forEach(node => {
      if (node.agentIds.length === 0) return;
      node.agentIds.forEach(agentId => {
        const a = allAgents.find(ag => ag.id === agentId);
        if (!a) return;

        // 构建发给该智能体的初始消息
        const lines: string[] = [];
        lines.push(`【协作任务启动】`);
        lines.push(`你被分配到节点「${node.name}」${node.nodeType === 'parallel' ? '（并行节点）' : '（串行节点）'}。`);
        if (node.desc) {
          lines.push(`\n本节点任务描述：\n${node.desc}`);
        }
        if (allNodes.length > 1) {
          lines.push(`\n整体协作流程如下：\n${contextLines}`);
        }
        lines.push(`\n请根据上述任务描述开始执行。`);
        const initialMessage = lines.join('\n');

        const existingPanel = openPanels.find(p => p.agentId === agentId);
        if (existingPanel) {
          // 面板已存在：切换激活并补发初始消息
          onSwitchPanel(existingPanel.id);
        } else {
          onOpenPanel(a.id, a.name, a.color, initialMessage);
        }
      });
    });
  }

  const pickerNode = pickerNodeId ? nodes.find(n => n.id === pickerNodeId) : null;

  // 任务和项目都有「切换」和「协作」两个 Tab
  // 任务协作Tab内有升级入口，项目协作Tab内有降级入口
  const subTabs: { key: 'switch'|'collab'; label: string }[] = [
    { key: 'switch', label: isProject ? '切换' : '切换智能体' },
    { key: 'collab', label: '协作' },
  ];

  // activeSubTab 直接等于 subTab（不再需要强制重置）
  const activeSubTab = subTab;

  return (
    <div style={{ fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif' }}>

      {/* ── 子 Tab 切换条 ── */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 14,
        background: '#f3f4f6', borderRadius: 8, padding: 3,
      }}>
        {subTabs.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)} style={{
            flex: 1, padding: '5px 0', borderRadius: 6, border: 'none',
            background: activeSubTab === t.key ? '#fff' : 'transparent',
            color: activeSubTab === t.key ? '#374151' : '#9ca3af',
            fontWeight: activeSubTab === t.key ? 700 : 400,
            fontSize: 13, cursor: 'pointer',
            boxShadow: activeSubTab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s',
            fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ══════════ 切换 Tab：多列网格 ══════════ */}
      {activeSubTab === 'switch' && (
        <div>
          {agentList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: '#d1d5db' }}>
              暂无可用智能体
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 8,
            }}>
              {/* [2026-05-21] 过滤系统助手，用户不可选 */}
              {agentList.filter(a => !a.isSystem).map(agent => {
                const statusInfo = agentStatusMap[agent.status ?? 'idle'] ?? { label: '离线', color: '#9ca3af' };
                const currentSessionPanel = openPanels.find(p => p.id === activePanelId) ?? openPanels[0] ?? null;
                const isCurrentAgent = currentSessionPanel?.agentId === agent.id;
                const accentColor = agent.color ?? '#6366f1';
                return (
                  <button
                    key={agent.id}
                    onClick={() => {
                      onSwitchAgent(agent.id, agent.name, agent.color);
                    }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                      padding: '10px 11px', borderRadius: 9, border: '1.5px solid',
                      borderColor: isCurrentAgent ? accentColor : '#e5e7eb',
                      background: isCurrentAgent ? accentColor + '0d' : '#fafafa',
                      cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                      fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                      width: '100%', boxSizing: 'border-box',
                      position: 'relative',
                    }}
                    onMouseEnter={e => {
                      if (!isCurrentAgent) {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = accentColor + '88';
                        (e.currentTarget as HTMLButtonElement).style.background = accentColor + '08';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isCurrentAgent) {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb';
                        (e.currentTarget as HTMLButtonElement).style.background = '#fafafa';
                      }
                    }}
                  >
                    {/* 右上角状态标注：仅标识当前会话正在使用的 agent */}
                    {isCurrentAgent && (
                      <span style={{
                        position: 'absolute', top: 7, right: 8,
                        fontSize: 10, padding: '1px 6px', borderRadius: 20, flexShrink: 0,
                        background: accentColor + '18',
                        color: accentColor,
                        fontWeight: 600,
                      }}>
                        当前
                      </span>
                    )}

                    {/* 头像 + 状态点 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        background: accentColor + '22', border: `1.5px solid ${accentColor}44`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: accentColor, fontWeight: 700, fontSize: 12,
                      }}>{agent.name.charAt(0)}</div>
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: statusInfo.color,
                        boxShadow: `0 0 0 2px ${statusInfo.color}33`,
                      }} />
                    </div>

                    {/* 名称 */}
                    <div style={{
                      fontSize: 13, fontWeight: 600, lineHeight: 1.3,
                      color: isCurrentAgent ? accentColor : '#1a202c',
                      width: '100%', paddingRight: 36,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{agent.name}</div>

                    {/* 描述 */}
                    {agent.description && (
                      <div style={{
                        fontSize: 11, color: '#9ca3af', lineHeight: 1.4,
                        width: '100%',
                        overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>{agent.description}</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════ 协作 Tab：FlowNode 流程节点 ══════════ */}
      {activeSubTab === 'collab' && (
        <div>
          {/* 提示文字 */}
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10, lineHeight: 1.5 }}>
            {isProject
              ? '管理参与协作的智能体，配置流程节点分工后开启协作。'
              : '配置协作流程节点后可升级为项目，开启多智能体协同工作。'}
          </div>

          {/* ── 参与智能体管理区（项目模式：可删除；任务模式：只读展示+升级入口） ── */}
          {(() => {
            const agentsInSession = isProject
              ? (participatingAgentNames && participatingAgentNames.length > 0
                  ? (agents ?? []).filter(a => participatingAgentNames.includes(a.name))
                  : agentList)
              : agentList.filter(a => openPanels.some(p => p.agentId === a.id));

            if (agentsInSession.length === 0) return null;

            return (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>
                  {isProject ? '参与协作的智能体' : '当前会话智能体'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {agentsInSession.map(agent => {
                    const ac = agent.color ?? '#6366f1';
                    const canRemove = isProject && agentsInSession.length > 1;
                    const willDowngrade = isProject && agentsInSession.length === 2; // 删后只剩1个
                    return (
                      <div key={agent.id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 8px 4px 6px', borderRadius: 20,
                        background: ac + '15', border: `1px solid ${ac}40`,
                        fontSize: 12, color: ac, fontWeight: 600,
                        userSelect: 'none',
                      }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: '50%',
                          background: ac + '30', border: `1.5px solid ${ac}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 8, fontWeight: 700, flexShrink: 0,
                        }}>{agent.name.charAt(0)}</div>
                        {agent.name}
                        {canRemove && (
                          <button
                            title={willDowngrade ? '删除后降级为任务' : '移出协作'}
                            onClick={() => {
                              if (willDowngrade && onDowngradeToTask) {
                                // 找到另一个智能体
                                const keptAgent = agentsInSession.find(a => a.id !== agent.id);
                                if (keptAgent) onDowngradeToTask(keptAgent.name);
                              } else if (onUpgradeToProject) {
                                // 只是移出，更新参与列表
                                const newNames = agentsInSession
                                  .filter(a => a.id !== agent.id)
                                  .map(a => a.name);
                                onUpgradeToProject(newNames.filter(() => false)); // 触发重新计算
                                // 直接更新：通知外层减少参与智能体
                                if (onDowngradeToTask && agentsInSession.length - 1 === 1) {
                                  const kept = agentsInSession.find(a => a.id !== agent.id);
                                  if (kept) onDowngradeToTask(kept.name);
                                }
                              }
                              // 关闭该智能体的 Panel
                              const panel = openPanels.find(p => p.agentId === agent.id);
                              if (panel) onClosePanel(panel.id);
                            }}
                            style={{
                              width: 14, height: 14, borderRadius: '50%',
                              border: 'none', background: ac + '30',
                              color: ac, cursor: 'pointer', padding: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, lineHeight: 1, flexShrink: 0,
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = ac + '60'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = ac + '30'; }}
                          >×</button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 降级提示：项目只剩1个智能体时 */}
                {isProject && agentsInSession.length === 1 && onDowngradeToTask && (
                  <div style={{
                    marginTop: 8, padding: '8px 10px', borderRadius: 8,
                    background: '#fffbeb', border: '1px solid #fde68a',
                    fontSize: 11, color: '#92400e', lineHeight: 1.5,
                  }}>
                    ⚠️ 只剩1个智能体，项目将降级为任务。
                    <button
                      onClick={() => onDowngradeToTask(agentsInSession[0].name)}
                      style={{
                        marginLeft: 8, padding: '2px 8px', borderRadius: 10,
                        border: 'none', background: '#f59e0b', color: '#fff',
                        fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}
                    >确认降级</button>
                  </div>
                )}
              </div>
            );
          })()}



          {/* 节点渲染：分组成行（serial 开新行，parallel 并入当前行） */}
          {(() => {
            const rows: FlowNode[][] = [];
            nodes.forEach(n => {
              if (n.nodeType === 'serial' || rows.length === 0) {
                rows.push([n]);
              } else {
                rows[rows.length - 1].push(n);
              }
            });
            const globalIdx = (nodeId: string) => nodes.findIndex(n => n.id === nodeId);

            return rows.map((row, rowIdx) => (
              <div key={row[0].id + '-row'}>
                {/* 串行向下箭头 */}
                {rowIdx > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0', color: '#d1d5db' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                    </svg>
                  </div>
                )}

                {/* 一行内可能有多个节点（并行） */}
                <div style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
                  {row.map((node, colIdx) => {
                    const gIdx = globalIdx(node.id);
                    const isParallel = node.nodeType === 'parallel';
                    return (
                      <div key={node.id} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'stretch' }}>
                        {/* 并行节点间竖线 + 符号 */}
                        {colIdx > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 22, flexShrink: 0, gap: 2 }}>
                            <div style={{ flex: 1, width: 1, background: '#c7d2fe', minHeight: 16 }} />
                            <span style={{ fontSize: 13, color: '#818cf8', fontWeight: 700, lineHeight: 1 }}>⇋</span>
                            <div style={{ flex: 1, width: 1, background: '#c7d2fe', minHeight: 16 }} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* 节点卡片 */}
                          <div style={{
                            border: `1px solid ${isParallel ? '#a5b4fc' : '#e5e7eb'}`,
                            borderRadius: 9, background: '#fff', overflow: 'hidden',
                          }}>
                            {/* 节点 Header */}
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              padding: '6px 9px', borderBottom: `1px solid ${isParallel ? '#e0e7ff' : '#f0f0f0'}`,
                              background: isParallel ? '#f5f3ff' : '#fafafa',
                            }}>
                              {/* 序号圆圈 */}
                              <div style={{
                                width: 17, height: 17, borderRadius: '50%', flexShrink: 0,
                                background: isParallel ? '#6366f1' : '#374151',
                                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 9, fontWeight: 700,
                              }}>{gIdx + 1}</div>

                              {/* 并行标签 */}
                              {isParallel && (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 3,
                                  padding: '1px 6px', borderRadius: 20, flexShrink: 0,
                                  fontSize: 10, background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd',
                                }}>
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
                                  </svg>
                                  并行
                                </span>
                              )}

                              {/* 节点名称（可编辑） */}
                              <input
                                value={node.name}
                                onChange={e => updateNode(node.id, { name: e.target.value })}
                                placeholder="节点名称…"
                                style={{
                                  flex: 1, border: 'none', outline: 'none', minWidth: 0,
                                  fontSize: 12, fontWeight: 600, color: '#374151',
                                  background: 'transparent',
                                  fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                                }}
                                onFocus={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderRadius = '4px'; e.currentTarget.style.padding = '1px 4px'; }}
                                onBlur={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.padding = '0'; }}
                              />

                              {/* 上移 */}
                              <button
                                onClick={() => moveNode(gIdx, -1)}
                                disabled={gIdx === 0}
                                title="上移"
                                style={{ background: 'none', border: 'none', padding: '0 1px', cursor: gIdx === 0 ? 'default' : 'pointer', color: gIdx === 0 ? '#e5e7eb' : '#9ca3af', display: 'flex', lineHeight: 1 }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                              </button>
                              {/* 下移 */}
                              <button
                                onClick={() => moveNode(gIdx, 1)}
                                disabled={gIdx === nodes.length - 1}
                                title="下移"
                                style={{ background: 'none', border: 'none', padding: '0 1px', cursor: gIdx === nodes.length - 1 ? 'default' : 'pointer', color: gIdx === nodes.length - 1 ? '#e5e7eb' : '#9ca3af', display: 'flex', lineHeight: 1 }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                              </button>
                              {/* 删除 */}
                              <button
                                onClick={() => removeNode(node.id)}
                                title="删除节点"
                                style={{ background: 'none', border: 'none', padding: '0 1px', cursor: 'pointer', color: '#d1d5db', display: 'flex', lineHeight: 1, transition: 'color 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = '#d1d5db'; }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                                </svg>
                              </button>
                            </div>

                            {/* 节点 Body */}
                            <div style={{ padding: '9px 10px' }}>
                              {/* 任务描述 */}
                              <div style={{ marginBottom: 8 }}>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>节点任务描述</label>
                                <input
                                  value={node.desc}
                                  onChange={e => updateNode(node.id, { desc: e.target.value })}
                                  placeholder="描述该节点需完成的任务…"
                                  style={{
                                    width: '100%', padding: '5px 8px', boxSizing: 'border-box',
                                    border: '1px solid #e5e7eb', borderRadius: 6,
                                    fontSize: 11, color: '#374151', outline: 'none',
                                    fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                                    transition: 'border-color 0.15s',
                                  }}
                                  onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; }}
                                  onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
                                />
                              </div>

                              {/* 分配智能体 */}
                              <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>
                                  分配智能体
                                  <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: 4 }}>（可多选）</span>
                                </label>

                                {node.agentIds.length === 0 ? (
                                  /* 未选状态：全宽虚线按钮，引导选择 */
                                  <button
                                    onClick={() => setPickerNodeId(node.id)}
                                    style={{
                                      width: '100%', padding: '7px 0', borderRadius: 7,
                                      border: '1.5px dashed #d1d5db',
                                      background: 'transparent', color: '#9ca3af', fontSize: 12,
                                      cursor: 'pointer', fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                      transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => {
                                      (e.currentTarget as HTMLButtonElement).style.borderColor = '#6366f1';
                                      (e.currentTarget as HTMLButtonElement).style.color = '#6366f1';
                                      (e.currentTarget as HTMLButtonElement).style.background = '#f5f3ff';
                                    }}
                                    onMouseLeave={e => {
                                      (e.currentTarget as HTMLButtonElement).style.borderColor = '#d1d5db';
                                      (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af';
                                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                                    }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                                      <circle cx="9" cy="7" r="4"/>
                                      <line x1="19" y1="8" x2="19" y2="14"/>
                                      <line x1="22" y1="11" x2="16" y2="11"/>
                                    </svg>
                                    选择智能体
                                  </button>
                                ) : (
                                  /* 已选状态：头像列表 + 编辑按钮行 */
                                  <div style={{
                                    display: 'flex', alignItems: 'center', gap: 5,
                                    padding: '5px 8px', borderRadius: 7,
                                    border: '1px solid #e0e7ff', background: '#f5f3ff',
                                  }}>
                                    {/* 已选智能体头像 + 名字 */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap', minWidth: 0 }}>
                                      {node.agentIds.map(aid => {
                                        const a = allAgents.find(x => x.id === aid);
                                        if (!a) return null;
                                        const ac = a.color ?? '#6366f1';
                                        return (
                                          <span
                                            key={aid}
                                            style={{
                                              display: 'inline-flex', alignItems: 'center', gap: 3,
                                              padding: '1px 6px 1px 3px', borderRadius: 20,
                                              fontSize: 11, background: ac + '15',
                                              border: `1px solid ${ac}30`, color: ac, fontWeight: 500,
                                            }}
                                          >
                                            <div style={{
                                              width: 14, height: 14, borderRadius: '50%',
                                              background: ac, display: 'flex', alignItems: 'center',
                                              justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 700,
                                            }}>{a.name.charAt(0)}</div>
                                            {a.name}
                                          </span>
                                        );
                                      })}
                                    </div>
                                    {/* 右侧编辑按钮 */}
                                    <button
                                      onClick={() => setPickerNodeId(node.id)}
                                      title="修改智能体"
                                      style={{
                                        flexShrink: 0, padding: '3px 7px', borderRadius: 5,
                                        border: 'none', background: 'rgba(99,102,241,0.12)',
                                        color: '#6366f1', fontSize: 11, cursor: 'pointer',
                                        fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                                        display: 'flex', alignItems: 'center', gap: 3,
                                        transition: 'background 0.12s',
                                      }}
                                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.22)'; }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.12)'; }}
                                    >
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                      </svg>
                                      编辑
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}

          {/* 添加节点按钮 */}
          <div style={{ position: 'relative', marginTop: 10 }}>
            <button
              ref={addBtnRef}
              onClick={() => setShowAddMenu(v => !v)}
              style={{
                width: '100%', padding: '7px 0',
                border: `1.5px dashed ${showAddMenu ? '#374151' : '#d1d5db'}`,
                borderRadius: 8, background: showAddMenu ? '#f5f7fa' : 'transparent',
                color: showAddMenu ? '#374151' : '#6b7280',
                fontSize: 12, cursor: 'pointer',
                fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#374151'; e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = '#f5f7fa'; }}
              onMouseLeave={e => {
                if (!showAddMenu) {
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.color = '#6b7280';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              添加流程节点
            </button>
            {showAddMenu && (
              <AddFlowNodeMenu
                anchorRef={addBtnRef}
                onAdd={addNode}
                onClose={() => setShowAddMenu(false)}
              />
            )}
          </div>

          {/* 开启协作按钮 */}
          <button
            onClick={applyCollab}
            disabled={nodes.every(n => n.agentIds.length === 0)}
            style={{
              marginTop: 12, width: '100%', height: 36, borderRadius: 8, border: 'none',
              background: nodes.some(n => n.agentIds.length > 0) ? '#6366f1' : '#e5e7eb',
              color: nodes.some(n => n.agentIds.length > 0) ? '#fff' : '#9ca3af',
              fontSize: 13, fontWeight: 700,
              cursor: nodes.some(n => n.agentIds.length > 0) ? 'pointer' : 'not-allowed',
              fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
              transition: 'background 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            {nodes.some(n => n.agentIds.length > 0) ? '开启协作' : '请先为节点分配智能体'}
          </button>

          {/* 任务模式：升级为项目按钮 */}
          {!isProject && onUpgradeToProject && (() => {
            // 收集节点中所有已选智能体名称
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
          })()}

          {/* 智能体选择弹窗 */}
          {pickerNode && (
            <AgentPickerModal
              agentList={allAgents}
              selected={pickerNode.agentIds}
              onClose={() => setPickerNodeId(null)}
              onConfirm={ids => confirmAgents(pickerNode.id, ids)}
            />
          )}
        </div>
      )}
    </div>
  );
}

