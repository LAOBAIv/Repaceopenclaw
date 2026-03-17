import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ─── 业务规则（重要）───────────────────────────────────────────
 * 【单任务智能体规则】
 *   每个任务（Task）必须至少包含 1 个智能体参与对话。
 *   - agents 数组长度 >= 1（必填，不可为空数组）
 *   - 创建/编辑任务时前端需校验：agents.length >= 1，否则提示用户选择智能体
 *   - agent（string）字段保留，记录"主负责智能体"名称，便于列表展示
 * ─────────────────────────────────────────────────────────── */

/* ─── 智能体引用类型（轻量）────────────────────────────────── */
export interface TaskAgent {
  /** 智能体名称（唯一标识）*/
  name: string;
  /** 头像颜色，用于 Avatar 着色 */
  color: string;
}

/* ─── 类型 ─────────────────────────────────────────────────── */
export interface Task {
  id: string;
  title: string;
  description: string;
  /**
   * 主负责智能体名称（用于列表 Avatar 展示）
   * 必须与 agents[0].name 保持一致
   */
  agent: string;
  agentColor: string;
  /**
   * 参与本任务对话的智能体列表
   * 【规则】长度必须 >= 1，单任务至少包含 1 个智能体
   */
  agents: TaskAgent[];
  priority: 'high' | 'mid' | 'low';
  tags: string[];
  updatedAt: string;
  dueDate: string;
  commentCount: number;
  fileCount: number;
  /** 来源：'manual'=手动新建，'chat'=对话自动生成 */
  source?: 'manual' | 'chat';
  /** 关联的对话 panel id（对话自动生成时记录）*/
  panelId?: string;
  /** 任务进度 0-100，仅进行中任务展示 */
  progress?: number;
}

export type Column = 'progress' | 'done';

export type TaskBoard = Record<Column, Task[]>;

/* ─── Mock 初始数据 ─────────────────────────────────────────── */
const INIT_TASKS: TaskBoard = {
  progress: [
    {
      id: 't4', title: '市场趋势分析',
      description: '基于过去 12 个月的行业数据，分析 AI 工具市场的增长趋势和主要驱动因素。',
      agent: '研究员', agentColor: '#3b82f6',
      /* 本任务包含 1 个智能体（满足最低要求：>=1）*/
      agents: [{ name: '研究员', color: '#3b82f6' }],
      priority: 'high', tags: ['市场分析', '数据'],
      updatedAt: '30min前', dueDate: '03/18', commentCount: 3, fileCount: 1, source: 'manual',
      progress: 65,
    },
    {
      id: 't5', title: '产品功能规划',
      description: '整理 Q2 产品路线图，优先级排序核心功能，并拆解成可执行的迭代任务。',
      agent: '策划助手', agentColor: '#6366f1',
      /* 本任务包含 1 个智能体（满足最低要求：>=1）*/
      agents: [{ name: '策划助手', color: '#6366f1' }],
      priority: 'mid', tags: ['产品'],
      updatedAt: '1h前', dueDate: '03/19', commentCount: 5, fileCount: 0, source: 'manual',
      progress: 30,
    },
  ],
  done: [
    {
      id: 't7', title: '需求文档初稿',
      description: '完成核心功能的需求说明文档，包括用例流程图和接口定义。',
      agent: '撰写助手', agentColor: '#22c55e',
      agents: [{ name: '撰写助手', color: '#22c55e' }],
      priority: 'low', tags: ['文档'],
      updatedAt: '2d前', dueDate: '03/10', commentCount: 2, fileCount: 1, source: 'manual',
    },
    {
      id: 't8', title: '技术架构图',
      description: '绘制系统整体架构图，标注各模块职责和数据流向。',
      agent: '策划助手', agentColor: '#6366f1',
      agents: [{ name: '策划助手', color: '#6366f1' }],
      priority: 'mid', tags: ['技术'],
      updatedAt: '3d前', dueDate: '03/08', commentCount: 1, fileCount: 2, source: 'manual',
    },
  ],
};

/* ─── Store ─────────────────────────────────────────────────── */
interface TaskState {
  tasks: TaskBoard;

  /** 新建任务（手动）- 调用方须保证 task.agents.length >= 1 */
  addTask: (task: Task, col?: Column) => void;

  /**
   * 从对话自动生成任务，默认进入"进行中"
   * 对话生成时自动以当前对话智能体作为参与者（agents[0]）
   * 满足单任务最低 1 个智能体的要求
   */
  addTaskFromChat: (opts: {
    title: string;
    agentName: string;
    agentColor: string;
    panelId?: string;
  }) => Task;

  /** 移动任务到另一列 */
  moveTask: (taskId: string, fromCol: Column, toCol: Column) => void;

  /** 更新任务字段 */
  updateTask: (taskId: string, patch: Partial<Task>) => void;

  /** 删除任务 */
  removeTask: (taskId: string) => void;

  /** 查找某任务所在列 */
  findTaskCol: (taskId: string) => Column | null;
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
  tasks: INIT_TASKS,

  addTask: (task, col = 'progress') => {
    /* 前端防御：确保 agents 不为空，至少保留主智能体 */
    const safeAgents: TaskAgent[] =
      task.agents && task.agents.length > 0
        ? task.agents
        : [{ name: task.agent, color: task.agentColor }];
    set(state => ({
      tasks: { ...state.tasks, [col]: [{ ...task, agents: safeAgents }, ...state.tasks[col]] },
    }));
  },

  addTaskFromChat: ({ title, agentName, agentColor, panelId }) => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const taskId = panelId ?? `chat_${Date.now()}`;
    const newTask: Task = {
      // 直接用 conversationId（panelId）作为任务 id，保证任务与会话一对一绑定
      // 同一 conversationId 不会创建两个 Task，天然防重
      id: taskId,
      title: title.length > 40 ? title.slice(0, 40) + '...' : title,
      description: '',
      agent: agentName,
      agentColor,
      /* 对话生成时自动将当前对话智能体加入 agents，满足 >=1 的规则 */
      agents: [{ name: agentName, color: agentColor }],
      priority: 'mid',
      tags: ['对话生成'],
      updatedAt: '刚刚',
      dueDate: `${mm}/${String(Number(dd) + 7).padStart(2, '0')}`,
      commentCount: 0,
      fileCount: 0,
      source: 'chat',
      panelId,
    };
    set(state => {
      // 幂等插入：若同 conversationId 的任务已存在，直接跳过，不重复创建
      const alreadyExists = state.tasks.progress.some(t => t.id === taskId)
        || state.tasks.done.some(t => t.id === taskId);
      if (alreadyExists) return state;
      return { tasks: { ...state.tasks, progress: [newTask, ...state.tasks.progress] } };
    });
    return newTask;
  },

  moveTask: (taskId, fromCol, toCol) => {
    set(state => {
      const task = state.tasks[fromCol].find(t => t.id === taskId);
      if (!task) return state;
      return {
        tasks: {
          ...state.tasks,
          [fromCol]: state.tasks[fromCol].filter(t => t.id !== taskId),
          [toCol]: [{ ...task, updatedAt: '刚刚' }, ...state.tasks[toCol]],
        },
      };
    });
  },

  updateTask: (taskId, patch) => {
    set(state => {
      const cols: Column[] = ['progress', 'done'];
      const newTasks = { ...state.tasks };
      for (const col of cols) {
        const idx = newTasks[col].findIndex(t => t.id === taskId);
        if (idx !== -1) {
          newTasks[col] = [...newTasks[col]];
          newTasks[col][idx] = { ...newTasks[col][idx], ...patch, updatedAt: '刚刚' };
          break;
        }
      }
      return { tasks: newTasks };
    });
  },

  removeTask: (taskId) => {
    set(state => {
      const cols: Column[] = ['progress', 'done'];
      const newTasks = { ...state.tasks };
      for (const col of cols) {
        const idx = newTasks[col].findIndex(t => t.id === taskId);
        if (idx !== -1) {
          newTasks[col] = newTasks[col].filter(t => t.id !== taskId);
          break;
        }
      }
      return { tasks: newTasks };
    });
  },

  findTaskCol: (taskId) => {
    const cols: Column[] = ['progress', 'done'];
    const { tasks } = get();
    for (const col of cols) {
      if (tasks[col].find(t => t.id === taskId)) return col;
    }
    return null;
  },
}),
    {
      name: 'wb-task-store',   // localStorage key
    }
  )
);
