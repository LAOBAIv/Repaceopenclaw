import apiClient from "./client";

/** 后端 Task 数据结构 */
export interface DbTask {
  id: string;
  title: string;
  description: string;
  column_id: string;  // 'todo' | 'progress' | 'review' | 'done'
  priority: string;   // 'high' | 'mid' | 'low'
  tags: string;       // JSON 数组字符串
  agent: string;
  agent_color: string;
  due_date: string;
  comment_count: number;
  file_count: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  agent_id: string;
  created_by: string | null;
  user_id: string;
}

/** 后端返回的任务列表（按列分组） */
export interface TaskListResponse {
  [column: string]: DbTask[];
}

export const tasksApi = {
  /** 获取所有任务，按列分组 */
  list: async (): Promise<TaskListResponse> => {
    const res = await apiClient.get("/tasks");
    return res.data?.data || {};
  },

  /** 删除任务 */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/tasks/${id}`);
  },
};
