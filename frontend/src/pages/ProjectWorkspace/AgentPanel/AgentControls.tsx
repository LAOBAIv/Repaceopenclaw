/**
 * AgentControls — 智能体操作控制组件
 *
 * 职责：渲染子 Tab 切换条（切换/协作），以及参与协作的智能体管理区域。
 * 项目模式下可移除智能体（可能触发降级），任务模式下只读展示。
 */
import React from 'react';
import type { Agent, ConversationPanel } from '@/types';

export function AgentControls({
  isProject,
  subTab,
  onSubTabChange,
  participatingAgentNames,
  agentList,
  openPanels,
  onDowngradeToTask,
  onClosePanel,
}: {
  /** 当前是项目（true）还是任务（false） */
  isProject: boolean;
  /** 当前激活的子 Tab */
  subTab: 'switch' | 'collab';
  /** 切换子 Tab */
  onSubTabChange: (tab: 'switch' | 'collab') => void;
  /** 参与协作的智能体名称列表 */
  participatingAgentNames?: string[];
  /** 全部可用智能体列表 */
  agentList: Agent[];
  /** 已打开的面板列表 */
  openPanels: ConversationPanel[];
  /** 降级为任务回调 */
  onDowngradeToTask?: (keptAgentName: string) => void;
  /** 关闭面板回调 */
  onClosePanel: (panelId: string) => void;
}) {
  // 构建子 Tab 配置
  const subTabs: { key: 'switch' | 'collab'; label: string }[] = [
    { key: 'switch', label: isProject ? '切换' : '切换智能体' },
    { key: 'collab', label: '协作' },
  ];

  // 计算当前参与会话的智能体列表
  const agentsInSession = isProject
    ? (participatingAgentNames && participatingAgentNames.length > 0
        ? agentList.filter(a => participatingAgentNames.includes(a.name))
        : agentList)
    : agentList.filter(a => openPanels.some(p => p.agentId === a.id));

  return (
    <>
      {/* ── 子 Tab 切换条 ── */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 14,
        background: '#f3f4f6', borderRadius: 8, padding: 3,
      }}>
        {subTabs.map(t => (
          <button key={t.key} onClick={() => onSubTabChange(t.key)} style={{
            flex: 1, padding: '5px 0', borderRadius: 6, border: 'none',
            background: subTab === t.key ? '#fff' : 'transparent',
            color: subTab === t.key ? '#374151' : '#9ca3af',
            fontWeight: subTab === t.key ? 700 : 400,
            fontSize: 13, cursor: 'pointer',
            boxShadow: subTab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s',
            fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── 参与智能体管理区（仅协作 Tab 显示） ── */}
      {subTab === 'collab' && agentsInSession.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>
            {isProject ? '参与协作的智能体' : '当前会话智能体'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {agentsInSession.map(agent => {
              const ac = agent.color ?? '#6366f1';
              // 项目模式下且多于1个智能体时可移除
              const canRemove = isProject && agentsInSession.length > 1;
              // 移除后只剩1个智能体时将触发降级
              const willDowngrade = isProject && agentsInSession.length === 2;
              return (
                <div key={agent.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 8px 4px 6px', borderRadius: 20,
                  background: ac + '15', border: `1px solid ${ac}40`,
                  fontSize: 12, color: ac, fontWeight: 600,
                  userSelect: 'none',
                }}>
                  {/* 头像 */}
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: ac + '30', border: `1.5px solid ${ac}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700, flexShrink: 0,
                  }}>{agent.name.charAt(0)}</div>
                  {agent.name}
                  {/* 移除按钮 */}
                  {canRemove && (
                    <button
                      title={willDowngrade ? '删除后降级为任务' : '移出协作'}
                      onClick={() => {
                        if (willDowngrade && onDowngradeToTask) {
                          // 找到另一个智能体作为保留对象
                          const keptAgent = agentsInSession.find(a => a.id !== agent.id);
                          if (keptAgent) onDowngradeToTask(keptAgent.name);
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
      )}
    </>
  );
}
