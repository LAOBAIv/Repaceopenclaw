import apiClient from './client';

export interface MemoryRecord {
  id: string;
  userId: string;
  agentId: string | null;
  conversationId: string | null;
  category: string;
  title: string | null;
  content: string;
  source: string;
  importance: number;
  accessCount: number;
  lastAccess: string | null;
  createdAt: string;
}

export interface MemoryStats {
  totalMemories: number;
  totalVectors: number;
  byCategory: Array<{ category: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
}

export const memoriesApi = {
  list(params?: { agentId?: string; category?: string; source?: string; limit?: number; offset?: number }) {
    return apiClient.get<{ memories: MemoryRecord[]; total: number }>('/api/memories', { params });
  },

  getById(id: string) {
    return apiClient.get<MemoryRecord>(`/api/memories/${id}`);
  },

  create(data: { content: string; title?: string; category?: string; agentId?: string; importance?: number }) {
    return apiClient.post<MemoryRecord>('/api/memories', data);
  },

  update(id: string, data: Partial<{ content: string; title: string; category: string; importance: number }>) {
    return apiClient.put<MemoryRecord>(`/api/memories/${id}`, data);
  },

  delete(id: string) {
    return apiClient.delete(`/api/memories/${id}`);
  },

  search(query: string, options?: { agentId?: string; category?: string; topK?: number }) {
    return apiClient.post<{ results: Array<{ memoryId: string; score: number; content: string; title: string | null; category: string; importance: number }>; query: string }>('/api/memories/search', { query, ...options });
  },

  getStats() {
    return apiClient.get<MemoryStats>('/api/memories/stats');
  },
};
