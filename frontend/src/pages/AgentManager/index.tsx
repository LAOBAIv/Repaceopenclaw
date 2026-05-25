/**
 * AgentManager - 智能体管理主页面
 * 展示智能体卡片列表，支持创建、编辑、删除、Skill 配置和可见性切换
 */
import { useEffect } from 'react';
import { Bot, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { agentManagerStyles } from './styles';
import { useAgentList, useRouting, useDeleteConfirm, useSkillConfig, useVisibility, useAgentNavigation, useIsAdmin } from './hooks';
import { AgentCard } from './components/AgentCard';
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog';
import { SkillConfigDialog } from './components/SkillConfigDialog';

export function AgentManager() {
  const isAdmin = useIsAdmin();
  const { agents: agentList, loading, fetchAgents } = useAgentList();
  const { getRouting, refreshRouting } = useRouting(fetchAgents);

  const doRefresh = () => {
    fetchAgents();
    refreshRouting();
  };

  const { deleteTarget, deleting, handleDeleteClick, handleDeleteConfirm, handleDeleteCancel } = useDeleteConfirm(doRefresh);
  const { skillAgent, tempSkills, setTempSkills, savingSkills, openSkillModal, closeSkillModal, saveSkillConfig } = useSkillConfig(isAdmin, doRefresh);
  const { updatingVisibility, handleVisibilityChange } = useVisibility(doRefresh);
  const { handleEditClick, handleCardClick } = useAgentNavigation(isAdmin);

  const navigate = useNavigate();

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return (
    <>
      <style>{agentManagerStyles}</style>

      <div className="am-wrap">
        <div className="am-shell">

          {/* 顶部 header */}
          <div className="am-header">
            <div className="am-header-left">
              <Bot size={18} color="#2a3b4d" />
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#1a202c' }}>智能体管理</span>
                <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 10 }}>
                  {loading ? '正在加载智能体...' : `共 ${agentList.length} 个智能体`}
                </span>
              </div>
            </div>
          </div>

          {/* 卡片列表 */}
          <div className="am-scroll">
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12 }}>正在加载智能体...</div>
            ) : agentList.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12 }}>暂无智能体，点击右上角创建一个吧</div>
            ) : (
            <div className="am-grid">
              {agentList.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  routing={getRouting(agent.id)}
                  isAdmin={isAdmin}
                  onCardClick={handleCardClick}
                  onEditClick={handleEditClick}
                  onDeleteClick={handleDeleteClick}
                  onSkillClick={openSkillModal}
                />
              ))}
              {/* 新建卡片 */}
              <div className="am-item-new" onClick={() => navigate('/agent-create')}>
                <Plus size={15} />
                新建智能体
              </div>
            </div>
            )}
          </div>

        </div>
      </div>

      {/* ══════════════ 删除确认弹窗 ══════════════ */}
      {deleteTarget && (
        <DeleteConfirmDialog
          agent={deleteTarget}
          deleting={deleting}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}

      {/* ══════════════ Skill 配置弹窗 ══════════════ */}
      {skillAgent && (
        <SkillConfigDialog
          agent={skillAgent}
          tempSkills={tempSkills}
          savingSkills={savingSkills}
          updatingVisibility={updatingVisibility}
          onSkillsChange={setTempSkills}
          onVisibilityChange={handleVisibilityChange}
          onSave={saveSkillConfig}
          onClose={closeSkillModal}
        />
      )}
    </>
  );
}
