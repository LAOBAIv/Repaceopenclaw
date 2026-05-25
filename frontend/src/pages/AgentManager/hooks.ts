/**
 * AgentManager 自定义 hooks
 * 包含列表逻辑、删除、Skill 配置、可见性切换等状态管理
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgentStore } from '@/stores/agentStore';
import { useAuthStore } from '@/stores/authStore';
import { Agent } from '@/types';
import apiClient from '@/api/client';
import { agentsApi, type AgentRoutingInfo } from '@/api/agents';
import { SYSTEM_AGENT_IDS } from './constants';

/** 获取当前用户是否为管理员 */
export function useIsAdmin(): boolean {
  const user = useAuthStore((s) => s.user);
  return user?.role === 'admin' || user?.role === 'super_admin';
}

/** 过滤系统智能体 */
export function useAgentList() {
  const { agents, loading, fetchAgents } = useAgentStore();

  const agentList: Agent[] = agents.filter(a =>
    a.visibility !== 'system' &&
    !SYSTEM_AGENT_IDS.includes(a.id)
  );

  return { agents: agentList, loading, fetchAgents };
}

/** 路由信息 */
export function useRouting(fetchTrigger: unknown) {
  const [routings, setRoutings] = useState<AgentRoutingInfo[]>([]);

  useEffect(() => {
    agentsApi.routingOverview().then(setRoutings).catch(() => {});
  }, [fetchTrigger]);

  function getRouting(agentId: string): AgentRoutingInfo | undefined {
    return routings.find(r => r.id === agentId);
  }

  return { getRouting, refreshRouting: () => agentsApi.routingOverview().then(setRoutings).catch(() => {}) };
}

/** 删除确认逻辑 */
export function useDeleteConfirm(onRefresh: () => void) {
  const { deleteAgent } = useAgentStore();
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);

  function handleDeleteClick(e: React.MouseEvent, agent: Agent) {
    e.stopPropagation();
    if (agent.isSystem) return;
    setDeleteTarget(agent);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAgent(deleteTarget.id);
      onRefresh();
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

  return { deleteTarget, deleting, handleDeleteClick, handleDeleteConfirm, handleDeleteCancel };
}

/** Skill 配置逻辑 */
export function useSkillConfig(isAdmin: boolean, onRefresh: () => void) {
  const [skillAgent, setSkillAgent] = useState<Agent | null>(null);
  const [tempSkills, setTempSkills] = useState<Record<string, boolean>>({});
  const [savingSkills, setSavingSkills] = useState(false);

  function openSkillModal(agent: Agent) {
    if (agent.isSystem && !isAdmin) return;
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
      onRefresh();
      setSkillAgent(null);
    } catch {
      alert('保存 Skill 配置失败');
    } finally {
      setSavingSkills(false);
    }
  }

  return { skillAgent, tempSkills, setTempSkills, savingSkills, openSkillModal, closeSkillModal, saveSkillConfig };
}

/** 可见性切换逻辑 */
export function useVisibility(onRefresh: () => void) {
  const [updatingVisibility, setUpdatingVisibility] = useState<string | null>(null);

  async function handleVisibilityChange(agent: Agent, visibility: string) {
    setUpdatingVisibility(agent.id);
    try {
      await apiClient.put(`/agents/${agent.id}`, { visibility });
      onRefresh();
    } catch {
      alert('更新可见性失败');
    } finally {
      setUpdatingVisibility(null);
    }
  }

  return { updatingVisibility, handleVisibilityChange };
}

/** 导航逻辑 */
export function useAgentNavigation(isAdmin: boolean) {
  const navigate = useNavigate();

  function handleEditClick(e: React.MouseEvent, agent: Agent) {
    e.stopPropagation();
    if (agent.isSystem && !isAdmin) return;
    navigate(`/agent-create?id=${agent.id}`);
  }

  function handleCardClick(agent: Agent) {
    if (agent.isSystem && !isAdmin) return;
    navigate(`/agent-create?id=${agent.id}`);
  }

  return { handleEditClick, handleCardClick };
}
