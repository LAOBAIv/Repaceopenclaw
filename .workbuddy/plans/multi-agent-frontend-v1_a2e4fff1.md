---
name: multi-agent-frontend-v1
overview: 开发多智能体协作前端页面，优先实现核心工作区和智能体管理，使用简化版编辑器
design:
  architecture:
    framework: react
    component: shadcn
  styleKeywords:
    - 深色系
    - Glassmorphism
    - 现代科技感
    - 三栏布局
  fontSystem:
    fontFamily: Inter, system-ui, sans-serif
    heading:
      size: 24px
      weight: 600
    subheading:
      size: 18px
      weight: 500
    body:
      size: 14px
      weight: 400
  colorSystem:
    primary:
      - "#6366F1"
      - "#8B5CF6"
      - "#3B82F6"
    background:
      - "#0F172A"
      - "#1E293B"
      - "#334155"
    text:
      - "#F8FAFC"
      - "#94A3B8"
    functional:
      - "#22C55E"
      - "#EF4444"
      - "#F59E0B"
todos:
  - id: setup-types-and-stores
    content: 创建全局类型定义和 Zustand stores
    status: completed
  - id: setup-api-client
    content: 创建 API 客户端封装和 hooks
    status: completed
    dependencies:
      - setup-types-and-stores
  - id: create-layout
    content: 创建全局布局组件 AppShell
    status: completed
    dependencies:
      - setup-api-client
  - id: agent-manager-page
    content: 实现智能体管理页面（AgentCard + AgentFormModal）
    status: completed
    dependencies:
      - create-layout
  - id: document-components
    content: 实现文档树和简化版编辑器组件
    status: completed
    dependencies:
      - create-layout
  - id: conversation-components
    content: 实现多对话面板组件（MultiPanel + ConversationPanel + MessageBubble）
    status: completed
    dependencies:
      - create-layout
  - id: project-workspace-page
    content: 实现核心工作区页面 ProjectWorkspace
    status: completed
    dependencies:
      - document-components
      - conversation-components
  - id: dashboard-page
    content: 实现简化版 Dashboard 首页
    status: completed
    dependencies:
      - create-layout
  - id: project-list-page
    content: 实现项目列表页面
    status: completed
    dependencies:
      - create-layout
  - id: configure-routing
    content: 配置 React Router 路由
    status: completed
    dependencies:
      - agent-manager-page
      - project-workspace-page
      - dashboard-page
      - project-list-page
---

## 用户需求

开发一个多智能体写作协同平台的前端页面，支持用户与多个 AI 智能体交互，协作完成大型写作项目。

## 产品定位

前后端分离的 Web 应用，前端采用 React + TypeScript + shadcn/ui + Tailwind CSS + Zustand。后端已有骨架，前端需完全自主开发。

## 核心功能（本次实现）

### 1. 智能体管理（AgentManager）

- 智能体列表展示：卡片式布局，显示头像、名称、专长标签
- 创建/编辑智能体：名称、头像颜色、系统提示词、写作风格、专长标签
- 删除智能体
- 搜索与筛选功能

### 2. 核心工作区（ProjectWorkspace）- 最重要

- 左侧文档树：树形章节列表，支持增删改、拖拽排序
- 中部编辑器：简化版 textarea，支持 Markdown 预览切换，章节内容自动保存
- 右侧多对话面板：支持同时打开 1-4 个对话面板，每个面板独立与智能体交互
- 消息流式显示：WebSocket 接收智能体回复
- 内容插入：可将对话内容插入到当前编辑章节

### 3. 项目管理（简化）

- 项目列表：卡片展示，创建、编辑、归档
- 文档树结构：多级章节/节点管理

### 4. Dashboard 首页（简化）

- 欢迎横幅：项目/智能体数量统计
- 快速入口：新建项目、新建智能体
- 项目卡片网格

## 非本次实现（后续可选）

- 完整 TipTap 富文本编辑器
- 版本历史与回滚
- 协同看板完整功能

## 技术栈

- 前端框架：React 18 + TypeScript
- 路由：React Router v6
- 状态管理：Zustand
- UI 组件库：shadcn/ui + Tailwind CSS
- HTTP 客户端：axios
- 实时通信：原生 WebSocket API
- 简化编辑器：textarea + react-markdown 预览

## 后端接口（已有）

- REST API：
- GET/POST /api/agents - 智能体 CRUD
- GET/POST /api/projects - 项目 CRUD
- GET/POST /api/documents - 文档 CRUD
- GET/POST /api/conversations - 对话管理
- WebSocket：ws://localhost:3001 - 流式对话

## 实现方案

### 前端目录结构

```
frontend/src/
├── types/
│   └── index.ts               # [NEW] 全局类型定义
├── stores/
│   ├── agentStore.ts          # [NEW] 智能体状态管理
│   ├── projectStore.ts        # [NEW] 项目状态管理
│   ├── conversationStore.ts   # [NEW] 对话面板状态管理
│   └── documentStore.ts       # [NEW] 文档编辑状态管理
├── api/
│   ├── client.ts              # [NEW] axios 封装
│   ├── agents.ts              # [NEW] 智能体 API
│   ├── projects.ts           # [NEW] 项目 API
│   ├── documents.ts          # [NEW] 文档 API
│   └── conversations.ts       # [NEW] 对话 API
├── hooks/
│   └── useWebSocket.ts        # [NEW] WebSocket hook
├── pages/
│   ├── Dashboard.tsx          # [NEW] 首页（简化）
│   ├── AgentManager.tsx       # [NEW] 智能体管理页
│   ├── ProjectWorkspace.tsx   # [NEW] 核心工作区
│   └── ProjectList.tsx        # [NEW] 项目列表页
├── components/
│   ├── layout/
│   │   └── AppShell.tsx       # [NEW] 全局布局
│   ├── agent/
│   │   ├── AgentCard.tsx      # [NEW] 智能体卡片
│   │   └── AgentFormModal.tsx # [NEW] 智能体表单弹窗
│   ├── conversation/
│   │   ├── ConversationPanel.tsx    # [NEW] 单对话面板
│   │   ├── MultiPanelContainer.tsx  # [NEW] 多面板容器
│   │   └── MessageBubble.tsx        # [NEW] 消息气泡
│   └── document/
│       ├── DocumentTree.tsx   # [NEW] 文档树
│       └── SimpleEditor.tsx   # [NEW] 简化编辑器
└── App.tsx                    # [MODIFY] 路由配置
```

### 核心模块设计

#### Zustand Stores

- **agentStore**: agents[], selectedAgent, fetchAgents, createAgent, updateAgent, deleteAgent
- **projectStore**: projects[], currentProject, documentTree, fetchProjects, createProject, selectProject
- **conversationStore**: openPanels[], messagesMap, sendMessage, closePanel, addPanel
- **documentStore**: currentDocument, content, saveContent, fetchDocument

#### WebSocket 对接

- 建立单例 WebSocket 连接
- 消息格式：{ type: 'message', conversationId, agentId, content, done }
- 重连机制：连接断开自动重连（最多 3 次）
- 消息队列：发送中状态缓存

### 性能考虑

- 对话列表使用虚拟滚动（react-virtual）
- 文档树使用递归懒加载
- 自动保存防抖：500ms

采用深色系 Glassmorphism + 现代科技感设计风格。整体以深蓝/深灰为底色，玻璃磨砂卡片、渐变高亮边框、柔和发光效果营造 AI 工具产品氛围。

布局采用三栏式工作区（文档树 / 编辑器 / 对话面板），最大化信息密度同时保持层次清晰。

页面包括：

1. Dashboard - 首页欢迎横幅 + 统计卡片 + 快速入口
2. AgentManager - 智能体卡片网格 + 表单弹窗
3. ProjectWorkspace - 三栏布局（文档树 + 编辑器 + 多对话面板）
4. ProjectList - 项目卡片网格