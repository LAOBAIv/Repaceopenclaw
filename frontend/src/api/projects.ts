import apiClient from "./client";
import { Project, DocumentNode } from "../types";

export const projectsApi = {
  list: async (): Promise<Project[]> => {
    const res = await apiClient.get("/projects");
    return res.data.data;
  },
  getById: async (id: string): Promise<Project> => {
    const res = await apiClient.get(`/projects/${id}`);
    return res.data.data;
  },
  create: async (data: {
    title: string;
    description: string;
    tags: string[];
    status?: string;
    goal?: string;
    priority?: string;
    startTime?: string;
    endTime?: string;
    decisionMaker?: string;
    workflowNodes?: Array<{ id: string; name: string; nodeType: string; agentIds: string[]; taskDesc: string }>;
  }): Promise<Project> => {
    const res = await apiClient.post("/projects", data);
    return res.data.data;
  },
  update: async (id: string, data: Partial<Project>): Promise<Project> => {
    const res = await apiClient.put(`/projects/${id}`, data);
    return res.data.data;
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}`);
  },
  getDocumentTree: async (projectId: string): Promise<DocumentNode[]> => {
    const res = await apiClient.get(`/projects/${projectId}/documents`);
    return res.data.data;
  },
  createDocument: async (projectId: string, data: { title: string; parentId?: string }): Promise<DocumentNode> => {
    const res = await apiClient.post(`/projects/${projectId}/documents`, data);
    return res.data.data;
  },
  updateDocument: async (docId: string, data: Partial<DocumentNode>): Promise<DocumentNode> => {
    const res = await apiClient.put(`/projects/documents/${docId}`, data);
    return res.data.data;
  },
  deleteDocument: async (docId: string): Promise<void> => {
    await apiClient.delete(`/projects/documents/${docId}`);
  },
};
