/**
 * AgentPanel/CollabFlow — 协作流程节点编辑组件
 *
 * 职责：渲染协作 Tab 下的流程节点编辑器，包括：
 * - 提示文字
 * - 节点渲染（串行开新行，并行并入当前行）
 * - 节点编辑（名称、描述、分配智能体）
 * - 节点操作（添加、删除、上移、下移）
 * - 开启协作按钮（为每个智能体生成专属初始消息并打开面板）
 * - 任务模式下的升级为项目按钮
 */
import React, { useState, useRef } from 'react';
import type { Agent, ConversationPanel } from '@/types';
import type { FlowNode, FlowNodeType } from '../types';
import { AddFlowNodeMenu } from './AddFlowNodeMenu';
import { AgentPickerModal } from './AgentPickerModal';
import { showToast } from '@/components/Toast';

export function CollabFlow({
  nodes,
  setNodes,
  allAgents,
  openPanels,
  isProject,
  onSwitchPanel,
  onOpenPanel,
  onClosePanel,
  onUpgradeToProject,
}: {
  /** 协作流程节点列表 */
  nodes: FlowNode[];
  /** 节点列表 setter */
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  /** 全部可用智能体 */
  allAgents: Agent[];
  /** 已打开的面板 */
  openPanels: ConversationPanel[];
  /** 当前是否为项目模式 */
  isProject: boolean;
  /** 切换到指定面板 */
  onSwitchPanel: (panelId: string) => void;
  /** 打开新面板 */
  onOpenPanel: (agentId: string, agentName: string, agentColor: string, initialMessage?: string) => void;
  /** 关闭面板 */
  onClosePanel: (panelId: string) => void;
  /** 升级为项目回调 */
  onUpgradeToProject?: (newAgentNames: string[]) => void;
}) {
  const [pickerNodeId, setPickerNodeId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  /* ── 节点 CRUD ── */
  function addNode(type: FlowNodeType) {
    setNodes(prev => {
      if (type === 'parallel') {
        // 并行节点限制：同一层最多 3 个
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

  /* ── 开启协作：为每个智能体生成专属初始消息并打开面板 ── */
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
          onSwitchPanel(existingPanel.id);
        } else {
          onOpenPanel(a.id, a.name, a.color, initialMessage);
        }
      });
    });
  }

  const pickerNode = pickerNodeId ? nodes.find(n => n.id === pickerNodeId) : null;

  /* ── 将节点分组成行（serial 开新行，parallel 并入当前行） ── */
  const rows: FlowNode[][] = [];
  nodes.forEach(n => {
    if (n.nodeType === 'serial' || rows.length === 0) {
      rows.push([n]);
    } else {
      rows[rows.length - 1].push(n);
    }
  });
  const globalIdx = (nodeId: string) => nodes.findIndex(n => n.id === nodeId);

  return (
    <>
      {/* 提示文字 */}
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10, lineHeight: 1.5 }}>
        {isProject
          ? '管理参与协作的智能体，配置流程节点分工后开启协作。'
          : '配置协作流程节点后可升级为项目，开启多智能体协同工作。'}
      </div>

      {/* ── 节点渲染 ── */}
      {rows.map((row, rowIdx) => (
        <div key={row[0].id + '-row'}>
          {/* 串行向下箭头（非首行） */}
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
      ))}

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

      {/* 智能体选择弹窗 */}
      {pickerNode && (
        <AgentPickerModal
          agentList={allAgents}
          selected={pickerNode.agentIds}
          onClose={() => setPickerNodeId(null)}
          onConfirm={ids => confirmAgents(pickerNode.id, ids)}
        />
      )}
    </>
  );
}
