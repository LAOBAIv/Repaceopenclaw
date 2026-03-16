import apiClient from "./client";
import { Agent } from "../types";

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
};
