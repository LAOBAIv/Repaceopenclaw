import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ─── 业务规则（重要）───────────────────────────────────────────
 * 【单项目智能体规则】
 *   项目（KanbanProject）的 agents 数组如实记录用户选择的参与智能体。
 *   - agents 数组长度 >= 1（至少包含 1 个主负责智能体）
 *   - agent（string）字段保留，记录"主负责智能体"名称，便于列表展示
 *   - 与任务的区别：任务只需 1 个，项目鼓励多智能体协同
 * ─────────────────────────────────────────────────────────── */

/* ─── 类型 ─────────────────────────────────────────────────── */
export type ProjectPriority = 'high' | 'mid' | 'low';

/** 项目参与智能体（轻量引用，与 taskStore.TaskAgent 结构一致）*/
export interface ProjectAgent {
  /** 智能体名称（唯一标识）*/
  name: string;
  /** 头像颜色，用于 Avatar 着色 */
  color: string;
}

export interface KanbanProject {
  id: string;
  title: string;
  description: string;
  tags: string[];
  /** 优先级 */
  priority: ProjectPriority;
  /**
   * 主负责智能体名称（列表 Avatar 展示）
   * 必须与 agents[0].name 保持一致
   */
  agent: string;
  agentColor: string;
  /**
   * 参与本项目协作的智能体列表
   * 【规则】如实记录用户选择的智能体，长度 >= 1
   */
  agents: ProjectAgent[];
  /** 进度 0-100 */
  progress: number;
  dueDate: string;
  updatedAt: string;
  taskCount: number;
  memberCount: number;
  /** 关联的会话 ID */
  sessionId?: string;
}

export type ProjectColumn = 'progress' | 'done';
export type ProjectBoard = Record<ProjectColumn, KanbanProject[]>;

/* ─── Mock 初始数据 ─────────────────────────────────────────── */
const INIT_PROJECTS: ProjectBoard = {
  progress: [
    {
      id: 'p1', title: 'AI 助手产品迭代',
      description: '完成 Q2 核心功能开发，包含多智能体协同、任务看板和文档协作模块。',
      tags: ['产品', 'AI'], priority: 'high',
      agent: '策划助手', agentColor: '#6366f1',
      /* 本项目包含 3 个智能体（满足最低要求：>=2）*/
      agents: [
        { name: '策划助手', color: '#6366f1' },
        { name: '研究员',   color: '#3b82f6' },
        { name: '撰写助手', color: '#22c55e' },
      ],
      progress: 65, dueDate: '04/15', updatedAt: '1h前', taskCount: 12, memberCount: 4,
    },
    {
      id: 'p2', title: '市场调研报告',
      description: '收集竞品数据，完成行业分析报告，为产品决策提供数据支撑。',
      tags: ['市场', '调研'], priority: 'mid',
      agent: '研究员', agentColor: '#3b82f6',
      /* 本项目包含 2 个智能体（满足最低要求：>=2）*/
      agents: [
        { name: '研究员',   color: '#3b82f6' },
        { name: '撰写助手', color: '#22c55e' },
      ],
      progress: 40, dueDate: '03/28', updatedAt: '3h前', taskCount: 6, memberCount: 2,
    },
    {
      id: 'p3', title: '官网改版',
      description: '基于新品牌视觉规范重新设计官网，提升转化率和用户留存。',
      tags: ['设计', '前端'], priority: 'low',
      agent: '撰写助手', agentColor: '#22c55e',
      /* 本项目包含 2 个智能体（满足最低要求：>=2）*/
      agents: [
        { name: '撰写助手', color: '#22c55e' },
        { name: '策划助手', color: '#6366f1' },
      ],
      progress: 20, dueDate: '04/30', updatedAt: '2d前', taskCount: 8, memberCount: 3,
    },
  ],
  done: [
    {
      id: 'p4', title: '用户访谈计划',
      description: '完成 20 名目标用户深度访谈，输出需求洞察报告。',
      tags: ['用户研究'], priority: 'mid',
      agent: '研究员', agentColor: '#3b82f6',
      agents: [
        { name: '研究员',   color: '#3b82f6' },
        { name: '撰写助手', color: '#22c55e' },
      ],
      progress: 100, dueDate: '03/10', updatedAt: '5d前', taskCount: 5, memberCount: 2,
    },
    {
      id: 'p5', title: '技术架构评审',
      description: '完成新版本系统架构设计文档，通过全员评审。',
      tags: ['技术'], priority: 'high',
      agent: '策划助手', agentColor: '#6366f1',
      agents: [
        { name: '策划助手', color: '#6366f1' },
        { name: '研究员',   color: '#3b82f6' },
        { name: '撰写助手', color: '#22c55e' },
      ],
      progress: 100, dueDate: '03/05', updatedAt: '1w前', taskCount: 4, memberCount: 5,
    },
  ],
};

/* ─── Store ─────────────────────────────────────────────────── */
interface ProjectKanbanState {
  projects: ProjectBoard;
  /** 新建项目 */
  addProject: (project: KanbanProject, col?: ProjectColumn) => void;
  moveProject: (projectId: string, fromCol: ProjectColumn, toCol: ProjectColumn) => void;
  updateProject: (projectId: string, patch: Partial<KanbanProject>) => void;
  removeProject: (projectId: string) => void;
}

export const useProjectKanbanStore = create<ProjectKanbanState>()(
  persist(
    (set) => ({
  projects: INIT_PROJECTS,

  addProject: (project, col = 'progress') => {
    /*
     * 确保 agents 数组存在且不为空（至少包含主智能体）
     * 不再强制要求 >= 2，以如实反映用户实际选择的智能体数量
     */
    const safeAgents: ProjectAgent[] =
      project.agents && project.agents.length > 0
        ? project.agents
        : [{ name: project.agent, color: project.agentColor }];
    set(state => ({
      projects: { ...state.projects, [col]: [{ ...project, agents: safeAgents }, ...state.projects[col]] },
    }));
  },

  moveProject: (projectId, fromCol, toCol) => {
    set(state => {
      const project = state.projects[fromCol].find(p => p.id === projectId);
      if (!project) return state;
      return {
        projects: {
          ...state.projects,
          [fromCol]: state.projects[fromCol].filter(p => p.id !== projectId),
          [toCol]: [{ ...project, updatedAt: '刚刚' }, ...state.projects[toCol]],
        },
      };
    });
  },

  updateProject: (projectId, patch) => {
    set(state => {
      const cols: ProjectColumn[] = ['progress', 'done'];
      const newProjects = { ...state.projects };
      for (const col of cols) {
        const idx = newProjects[col].findIndex(p => p.id === projectId);
        if (idx !== -1) {
          newProjects[col] = [...newProjects[col]];
          newProjects[col][idx] = { ...newProjects[col][idx], ...patch, updatedAt: '刚刚' };
          break;
        }
      }
      return { projects: newProjects };
    });
  },

  removeProject: (projectId) => {
    set(state => {
      const cols: ProjectColumn[] = ['progress', 'done'];
      const newProjects = { ...state.projects };
      for (const col of cols) {
        const idx = newProjects[col].findIndex(p => p.id === projectId);
        if (idx !== -1) {
          newProjects[col] = newProjects[col].filter(p => p.id !== projectId);
          break;
        }
      }
      return { projects: newProjects };
    });
  },
}),
    {
      name: 'wb-project-kanban-store',  // localStorage key
    }
  )
);
