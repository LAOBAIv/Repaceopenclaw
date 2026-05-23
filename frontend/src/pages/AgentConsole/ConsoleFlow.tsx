/**
 * @file ConsoleFlow - AgentConsole 右侧协作流程面板
 * 包含流程节点的渲染（串行/并行分组）、节点编辑、智能体分配、添加节点等
 */

import { Plus, Trash2, ChevronDown, ChevronUp, ArrowDown, Users, GitBranch } from 'lucide-react';
import { Agent } from '@/types';
import { SectionTitle, AddNodeMenu, AgentPicker } from './components';
import { AgentAvatar } from './constants';
import type { FlowNode } from './constants';

interface ConsoleFlowProps {
  nodes: FlowNode[];
  agentList: Agent[];
  // 节点操作
  updateNode: (id: string, patch: Partial<FlowNode>) => void;
  removeNode: (id: string) => void;
  moveNode: (idx: number, dir: -1 | 1) => void;
  addNode: (type: 'serial' | 'parallel') => void;
  // 弹窗控制
  pickerNodeId: string | null;
  setPickerNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  showAddMenu: boolean;
  setShowAddMenu: React.Dispatch<React.SetStateAction<boolean>>;
  addBtnRef: React.RefObject<HTMLButtonElement | null>;
}

export function ConsoleFlow({
  nodes, agentList,
  updateNode, removeNode, moveNode, addNode,
  pickerNodeId, setPickerNodeId,
  showAddMenu, setShowAddMenu, addBtnRef,
}: ConsoleFlowProps) {
  // 当前选中的节点（用于弹窗）
  const pickerNode = pickerNodeId ? nodes.find(n => n.id === pickerNodeId) : null;

  // 将节点列表分组为"行"：每遇到 serial 节点开新行，parallel 节点追加到当前行
  const rows: FlowNode[][] = [];
  nodes.forEach(n => {
    if (n.nodeType === 'serial' || rows.length === 0) {
      rows.push([n]);
    } else {
      rows[rows.length - 1].push(n);
    }
  });

  // 计算每个节点在 nodes[] 中的全局索引（用于上移/下移/删除）
  const globalIdx = (nodeId: string) => nodes.findIndex(n => n.id === nodeId);

  return (
    <div className="pc-right">
      <SectionTitle>协作流程设置</SectionTitle>

      {/* 渲染分组后的节点行 */}
      {rows.map((row, rowIdx) => (
        <div key={row[0].id + '-row'}>
          {/* 行间箭头（串行向下，第一行不显示） */}
          {rowIdx > 0 && (
            <div className="pc-arrow"><ArrowDown size={14} /></div>
          )}

          {/* 一行内可能有多个节点（并行）*/}
          <div style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
            {row.map((node, colIdx) => {
              const gIdx = globalIdx(node.id);
              return (
                <div key={node.id} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'stretch' }}>
                  {/* 同行并行节点间的竖线 + 并行符号 */}
                  {colIdx > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 28, flexShrink: 0, gap: 2 }}>
                      <div style={{ flex: 1, width: 1, background: '#c7d2fe', minHeight: 20 }} />
                      <span style={{ fontSize: 14, color: '#818cf8', fontWeight: 700, lineHeight: 1 }}>⇋</span>
                      <div style={{ flex: 1, width: 1, background: '#c7d2fe', minHeight: 20 }} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={`pc-node${node.nodeType === 'parallel' ? ' parallel' : ''}`}>
                      {/* 节点 header */}
                      <div className="pc-node-hd">
                        {/* 节点序号 */}
                        <div style={{ width: 19, height: 19, borderRadius: '50%', background: node.nodeType === 'parallel' ? '#6366f1' : '#2a3b4d', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{gIdx + 1}</div>

                        {/* 并行标签 */}
                        {node.nodeType === 'parallel' && (
                          <span className="pc-parallel-label">
                            <GitBranch size={10} /> 并行
                          </span>
                        )}

                        {/* 节点名称输入 */}
                        <input className="pc-node-name" value={node.name}
                          onChange={e => updateNode(node.id, { name: e.target.value })}
                          placeholder="请描述你的节点目标（必填）"
                          style={{ borderBottomColor: node.name.trim() === '' ? '#fca5a5' : 'transparent' }} />

                        {/* 上移按钮 */}
                        <button onClick={() => moveNode(gIdx, -1)} disabled={gIdx === 0}
                          style={{ background: 'none', border: 'none', cursor: gIdx === 0 ? 'default' : 'pointer', color: gIdx === 0 ? '#e5e7eb' : '#9ca3af', padding: '0 2px', display: 'flex' }}>
                          <ChevronUp size={14} />
                        </button>
                        {/* 下移按钮 */}
                        <button onClick={() => moveNode(gIdx, 1)} disabled={gIdx === nodes.length - 1}
                          style={{ background: 'none', border: 'none', cursor: gIdx === nodes.length - 1 ? 'default' : 'pointer', color: gIdx === nodes.length - 1 ? '#e5e7eb' : '#9ca3af', padding: '0 2px', display: 'flex' }}>
                          <ChevronDown size={14} />
                        </button>
                        {/* 删除按钮 */}
                        <button onClick={() => removeNode(node.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: '0 2px', display: 'flex', transition: 'color 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}>
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* 节点 body：智能体分配 */}
                      <div className="pc-node-bd">
                        <div>
                          <label className="pc-label" style={{ fontSize: 12, marginBottom: 6 }}>
                            分配智能体
                            <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: 5 }}>（可多选，同节点并行）</span>
                          </label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                            {node.agentIds.map(aid => {
                              const a = agentList.find(x => x.id === aid);
                              if (!a) return null;
                              return (
                                <span key={aid} className="pc-agent-tag" onClick={() => setPickerNodeId(node.id)}>
                                  <AgentAvatar agent={a} size={14} />{a.name}
                                </span>
                              );
                            })}
                            <button className="pc-pick-btn" onClick={() => setPickerNodeId(node.id)}>
                              <Users size={12} />{node.agentIds.length === 0 ? '选择智能体' : '修改'}
                            </button>
                          </div>
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

      {/* 添加节点按钮 + 弹出菜单 */}
      <div className="pc-add-wrap">
        <button
          ref={addBtnRef}
          className={`pc-add-node-btn${showAddMenu ? ' open' : ''}`}
          onClick={() => setShowAddMenu(v => !v)}
        >
          <Plus size={13} /> 添加流程节点
        </button>
        {showAddMenu && (
          <AddNodeMenu
            anchorRef={addBtnRef}
            onAdd={addNode}
            onClose={() => setShowAddMenu(false)}
          />
        )}
      </div>

      {/* 智能体选择弹窗 */}
      {pickerNode && (
        <AgentPicker agentList={agentList.filter(a => !a.isSystem)} selected={pickerNode.agentIds}
          onClose={() => setPickerNodeId(null)}
          onConfirm={ids => {
            updateNode(pickerNode.id, { agentIds: ids });
            setPickerNodeId(null);
          }} />
      )}
    </div>
  );
}
