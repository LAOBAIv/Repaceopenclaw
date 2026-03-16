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

  toggleTeamAgent: (id) => {
    const ids = get().teamAgentIds;
    set({ teamAgentIds: ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id] });
  },

  setTeamAgents: (ids) => set({ teamAgentIds: ids }),
}));
