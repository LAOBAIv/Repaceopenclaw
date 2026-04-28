import apiClient from "./client";
import { Agent } from "../types";

export interface AgentRoutingInfo {
  id: string;
  name: string;
  color: string;
  status: string;
  source: 'private' | 'global' | 'gateway' | 'none';
  effectiveChannel: string;
  effectiveModel: string;
  hasPrivateToken: boolean;
  tokenProvider: string | null;
  modelName: string | null;
  modelProvider: string | null;
}

export const agentsApi = {
  list: async (): Promise<Agent[]> => {
    const res = await apiClient.get("/agents");
    return res.data.data;
  },
  getById: async (id: string): Promise<Agent> => {
    const res = await apiClient.get(`/agents/${id}`);
    return res.data.data;
  },
  create: async (data: Omit<Agent, "id" | "createdAt">): Promise<Agent> => {
    const res = await apiClient.post("/agents", data);
    return res.data.data;
  },
  update: async (id: string, data: Partial<Omit<Agent, "id" | "createdAt">>): Promise<Agent> => {
    const res = await apiClient.put(`/agents/${id}`, data);
    return res.data.data;
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/agents/${id}`);
  },
  routingOverview: async (): Promise<AgentRoutingInfo[]> => {
    const res = await apiClient.get("/agents/routing-overview");
    return res.data.data;
  },
};
