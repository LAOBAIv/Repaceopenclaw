import { create } from "zustand";
import { Project, DocumentNode } from "../types";
import { projectsApi } from "../api/projects";

interface CreateDocumentInput {
  projectId: string;
  parentId?: string | null;
  title: string;
  content?: string;
  order?: number;
  assignedAgentIds?: string[];
}

interface ProjectStore {
  projects: Project[];
  currentProject: Project | null;
  documentTree: DocumentNode[];
  loading: boolean;
  fetchProjects: () => Promise<void>;
  selectProject: (project: Project) => void;
  setCurrentProject: (project: Project | null) => void;
  createProject: (data: { title: string; description: string; tags: string[]; status?: string }) => Promise<Project>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  fetchDocumentTree: (projectId: string) => Promise<void>;
  createDocument: (input: CreateDocumentInput) => Promise<DocumentNode>;
  updateDocument: (docId: string, data: Partial<DocumentNode>) => Promise<void>;
  deleteDocument: (docId: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProject: null,
  documentTree: [],
  loading: false,

  fetchProjects: async () => {
    set({ loading: true });
    try {
      const projects = await projectsApi.list();
      set({ projects, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  selectProject: (project) => set({ currentProject: project }),

  setCurrentProject: (project) => set({ currentProject: project }),

  createProject: async (data) => {
    const project = await projectsApi.create(data as any);
    set((s) => ({ projects: [project, ...s.projects] }));
    return project;
  },

  updateProject: async (id, data) => {
    const updated = await projectsApi.update(id, data);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? updated : p)),
      currentProject: s.currentProject?.id === id ? updated : s.currentProject,
    }));
  },

  deleteProject: async (id) => {
    await projectsApi.delete(id);
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      currentProject: s.currentProject?.id === id ? null : s.currentProject,
    }));
  },

  fetchDocumentTree: async (projectId) => {
    try {
      const tree = await projectsApi.getDocumentTree(projectId);
      set({ documentTree: tree });
    } catch {
      set({ documentTree: [] });
    }
  },

  createDocument: async (input) => {
    const { projectId, ...data } = input;
    const doc = await projectsApi.createDocument(projectId, data as any);
    await get().fetchDocumentTree(projectId);
    return doc;
  },

  updateDocument: async (docId, data) => {
    await projectsApi.updateDocument(docId, data);
    const currentProject = get().currentProject;
    if (currentProject) await get().fetchDocumentTree(currentProject.id);
  },

  deleteDocument: async (docId) => {
    await projectsApi.deleteDocument(docId);
    const currentProject = get().currentProject;
    if (currentProject) await get().fetchDocumentTree(currentProject.id);
  },
}));
