import { create } from "zustand";
import { Agent } from "../types";
import { agentsApi } from "../api/agents";

interface AgentStore {
  agents: Agent[];
  loading: boolean;
  teamAgentIds: string[];
  fetchAgents: () => Promise<void>;
  createAgent: (data: Omit<Agent, "id" | "createdAt">) => Promise<Agent>;
  updateAgent: (id: string, data: Partial<Omit<Agent, "id" | "createdAt">>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  getAgentById: (id: string) => Agent | undefined;
  /** [2026-05-21] 用户可选智能体（过滤掉 isSystem，用于选择列表展示） */
  getUserAgents: () => Agent[];
  toggleTeamAgent: (id: string) => void;
  setTeamAgents: (ids: string[]) => void;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: [],
  loading: false,
  teamAgentIds: [],

  fetchAgents: async () => {
    set({ loading: true });
    try {
      const agents = await agentsApi.list();
      // 保留所有 agent（包括 visibility=system 的微信助手）
      // 过滤只在 agents 管理页面和多智能体切换列表里做，不在这里全局过滤
      set({ agents, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createAgent: async (data) => {
    const agent = await agentsApi.create(data);
    set((s) => ({ agents: [agent, ...s.agents] }));
    return agent;
  },

  updateAgent: async (id, data) => {
    const updated = await agentsApi.update(id, data);
    set((s) => ({ agents: s.agents.map((a) => (a.id === id ? updated : a)) }));
  },

  deleteAgent: async (id) => {
    await agentsApi.delete(id);
    set((s) => ({ agents: s.agents.filter((a) => a.id !== id) }));
  },

  getAgentById: (id) => get().agents.find((a) => a.id === id),

  /** [2026-05-21] 用户可选智能体：过滤掉 isSystem 的系统助手（平台助手、微信助手）
   *  仅用于用户选择列表展示，不影响 find/lookup 逻辑 */
  getUserAgents: () => get().agents.filter((a) => !a.isSystem),

  toggleTeamAgent: (id) => {
    const ids = get().teamAgentIds;
    set({ teamAgentIds: ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id] });
  },

  setTeamAgents: (ids) => set({ teamAgentIds: ids }),
}));
