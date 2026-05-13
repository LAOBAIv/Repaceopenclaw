# 后端开发任务文档

> **致小强：** 你负责本项目 `backend/` 目录下的所有后端开发工作。
> 开发前请先阅读根目录的 `COLLABORATION.md`，了解分工规则。
> **严禁修改 `frontend/` 目录下的任何文件。**

---

## 项目技术栈

| 项目 | 技术 |
|------|------|
| 运行时 | Node.js (tsx watch 热重载) |
| 框架 | Express 4.x |
| 数据库 | sql.js（纯 JS SQLite，无需 native build） |
| 类型系统 | TypeScript 5 |
| 校验 | Zod |
| 实时通信 | WebSocket (ws 库) |
| 包管理 | npm |

---

## 项目结构

```
backend/
├── src/
│   ├── db/
│   │   └── client.ts          # 数据库初始化、表创建、迁移（幂等 ALTER TABLE）
│   ├── middleware/
│   │   └── errorHandler.ts    # 全局错误处理中间件
│   ├── routes/
│   │   ├── agents.ts          # 智能体 CRUD API
│   │   ├── conversations.ts   # 会话 & 消息 API
│   │   ├── projects.ts        # 项目 & 文档树 API
│   │   ├── tasks.ts           # 看板任务 API
│   │   └── tokenChannels.ts   # LLM 渠道管理 API
│   ├── services/
│   │   ├── llm/
│   │   │   ├── LLMAdapter.ts      # ILLMAdapter 接口定义
│   │   │   ├── AutoLLMAdapter.ts  # Auto 智能路由（多渠道 fallback）
│   │   │   └── MockLLMAdapter.ts  # 模拟输出（兜底）
│   │   ├── AgentService.ts        # 智能体业务逻辑 + generateStream
│   │   ├── ConversationService.ts # 会话 & 消息业务逻辑
│   │   ├── ProjectService.ts      # 项目 & 文档业务逻辑
│   │   └── TaskService.ts         # 看板任务业务逻辑
│   ├── ws/
│   │   └── wsHandler.ts       # WebSocket 消息处理（流式对话核心）
│   └── index.ts               # 入口：初始化 DB、注册路由、启动 HTTP+WS
├── data/
│   └── platform.db            # SQLite 数据库文件（运行时自动创建）
├── package.json
├── tsconfig.json
└── BACKEND_TASKS.md           # 本文件
```

---

## 数据库表结构

### agents（智能体）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| name | TEXT | 智能体名称 |
| color | TEXT | 颜色标识 |
| system_prompt | TEXT | 系统提示词 |
| writing_style | TEXT | 写作风格 |
| expertise | TEXT | JSON 数组，专业领域 |
| description | TEXT | 描述 |
| status | TEXT | idle / active / busy |
| model_name | TEXT | 模型名称（如 gpt-4o） |
| model_provider | TEXT | 模型提供商（如 openai） |
| temperature | REAL | 温度参数 0~2 |
| max_tokens | INTEGER | 最大 token 数 |
| top_p | REAL | Top-P 采样 |
| frequency_penalty | REAL | 频率惩罚 |
| presence_penalty | REAL | 存在惩罚 |
| created_at | TEXT | ISO 时间字符串 |

### token_channels（LLM 渠道）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| provider | TEXT | 提供商名称（唯一键，upsert 用） |
| model_name | TEXT | 默认模型名 |
| base_url | TEXT | API 基础地址 |
| api_key | TEXT | API Key |
| auth_type | TEXT | Bearer / ApiKey / Basic |
| enabled | INTEGER | 0/1 布尔 |
| priority | INTEGER | 优先级（越大越优先） |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### projects（项目）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| title | TEXT | 项目标题 |
| description | TEXT | 项目描述 |
| tags | TEXT | JSON 数组 |
| status | TEXT | active / archived |
| goal | TEXT | 项目目标 |
| priority | TEXT | high / mid / low |
| start_time | TEXT | 开始时间 |
| end_time | TEXT | 结束时间 |
| decision_maker | TEXT | 决策者 |
| workflow_nodes | TEXT | JSON 数组，工作流节点 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### tasks（看板任务）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| title | TEXT | 任务标题 |
| description | TEXT | 任务描述 |
| column_id | TEXT | todo / progress / review / done |
| priority | TEXT | high / mid / low |
| tags | TEXT | JSON 数组 |
| agent | TEXT | 分配的智能体名称 |
| agent_color | TEXT | 智能体颜色 |
| due_date | TEXT | 截止日期 |
| sort_order | INTEGER | 排序权重 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### conversations（会话）& messages（消息）
- conversations：id, project_id, agent_id, title, created_at
- messages：id, conversation_id, role(user/agent), content, agent_id, created_at

### documents（项目文档节点）
- id, project_id, parent_id, title, content, node_order, assigned_agent_ids(JSON), created_at, updated_at

---

## 当前 API 接口全览

### 智能体 `/api/agents`
```
GET    /api/agents            # 获取所有智能体
GET    /api/agents/:id        # 获取单个智能体
POST   /api/agents            # 创建智能体
PUT    /api/agents/:id        # 更新智能体
DELETE /api/agents/:id        # 删除智能体
```

### 项目 `/api/projects`
```
GET    /api/projects                    # 获取所有项目
GET    /api/projects/:id                # 获取单个项目
POST   /api/projects                    # 创建项目
PUT    /api/projects/:id                # 更新项目
DELETE /api/projects/:id                # 删除项目
GET    /api/projects/:id/documents      # 获取项目文档树
POST   /api/projects/:id/documents      # 在项目下新建文档节点
PUT    /api/projects/documents/:docId   # 更新文档内容
DELETE /api/projects/documents/:docId   # 删除文档节点
```

### 会话 `/api/conversations`
```
GET    /api/conversations               # 获取会话列表（支持 ?projectId= 过滤）
POST   /api/conversations               # 创建会话
DELETE /api/conversations/:id           # 删除会话
GET    /api/conversations/:id/messages  # 获取消息列表
POST   /api/conversations/:id/messages  # 发送消息（user 角色）
```

### 任务 `/api/tasks`
```
GET    /api/tasks                  # 获取所有任务（按列分组返回）
GET    /api/tasks/column/:columnId # 获取单列任务
GET    /api/tasks/:id              # 获取单个任务
POST   /api/tasks                  # 创建任务
PUT    /api/tasks/:id              # 更新任务
DELETE /api/tasks/:id              # 删除任务
POST   /api/tasks/reorder          # 批量更新排序（拖拽后调用）
```

### 模型渠道 `/api/token-channels`
```
GET    /api/token-channels          # 获取所有渠道
POST   /api/token-channels          # 新增/更新渠道（按 provider upsert）
DELETE /api/token-channels/:provider # 删除渠道
```

### WebSocket `ws://localhost:3001/ws`
```
客户端发送：
{ type: "chat", conversationId, agentId, content }  # 发起对话
{ type: "ping" }                                     # 心跳

服务端推送：
{ type: "pong" }                                     # 心跳响应
{ type: "user_message", message }                    # 用户消息回写
{ type: "agent_start", messageId, agentId }          # AI 开始流式输出
{ type: "agent_chunk", messageId, chunk, agentId }   # AI 流式 chunk
{ type: "agent_done", messageId, message, agentId }  # AI 输出完成
{ type: "error", message }                           # 错误
```

---

## 待开发需求（优先级从高到低）

### 🔴 P0 - 高优先级

#### 1. 多智能体协作对话（WebSocket 扩展）
**背景：** 当前 WebSocket 只支持单个智能体回复，项目工作流中需要多个智能体按顺序或并行协作回复。

**需求：**
- 新增消息类型 `{ type: "multi_chat", projectId, workflowNodeId, content }` 触发多智能体协作
- 按项目的 `workflow_nodes` 中的 `agentIds` 顺序依次调用智能体
- `nodeType: "serial"` → 串行：上一个智能体回复完成后再调用下一个
- `nodeType: "parallel"` → 并行：同时触发所有智能体，各自流式输出
- 每个智能体的输出都通过 WebSocket 推送，并标注 `agentId`

**接口变更：** wsHandler.ts 扩展，新增 `multi_chat` 消息处理分支

---

#### 2. 任务与智能体关联增强
**背景：** 任务看板中智能体字段目前只存名称字符串，无法精确关联智能体 ID。

**需求：**
- tasks 表新增 `agent_id TEXT DEFAULT ''` 字段（幂等迁移）
- `POST /api/tasks` 和 `PUT /api/tasks/:id` 支持传入 `agentId`
- `GET /api/tasks` 返回数据中包含 `agentId` 字段

---

### 🟡 P1 - 中优先级

#### 3. 项目文档版本历史
**背景：** 数据库中已有 `document_versions` 表，但路由层尚未暴露接口。

**需求：**
- `GET /api/projects/documents/:docId/versions` → 获取文档历史版本列表
- `POST /api/projects/documents/:docId/versions` → 手动创建版本快照
- `GET /api/projects/documents/:docId/versions/:versionId` → 获取特定版本内容

---

#### 4. 对话消息 AI 自动回复接口（HTTP 补充）
**背景：** 当前 AI 回复只能通过 WebSocket，部分场景需要 HTTP 方式触发。

**需求：**
- `POST /api/conversations/:id/generate` → 触发 AI 对指定会话最新消息生成回复
- 非流式，等待完整回复后返回
- body: `{ agentId: string }`

---

#### 5. 全局搜索接口
**需求：**
- `GET /api/search?q=关键词` → 跨表搜索，返回匹配的智能体、项目、任务、文档
- 返回格式：`{ agents: [], projects: [], tasks: [], documents: [] }`
- 支持模糊匹配（LIKE %keyword%）

---

### 🟢 P2 - 低优先级

#### 6. 数据导入/导出
- `GET /api/export` → 导出全量数据为 JSON
- `POST /api/import` → 从 JSON 导入数据（覆盖或合并模式）

#### 7. 模型渠道连通性测试
- `POST /api/token-channels/:id/test` → 发送测试请求到对应渠道，返回是否连通

---

## 开发规范

### 数据库变更
- 新增字段必须用幂等迁移：`try { db.run("ALTER TABLE ... ADD COLUMN ...") } catch {}`
- 不得删除已有字段（前端可能依赖）
- 新建表在 `db/client.ts` 的 `createTables()` 函数中添加

### 路由规范
- 静态路由（如 `/column/:id`、`/reorder`）必须在动态路由（`/:id`）之前注册
- 所有路由参数用 Zod 校验
- 错误统一返回 `{ error: "描述" }`，成功返回 `{ data: ... }` 或 `{ success: true }`

### 新增路由注册
- 在 `src/index.ts` 中用 `app.use("/api/xxx", xxxRoutes)` 注册

### 不允许的操作
- ❌ 不得引入需要 native addon 的 npm 包（如 better-sqlite3，用 sql.js 替代）
- ❌ 不得修改 `frontend/` 目录
- ❌ 不得更改现有 API 的响应格式（可新增字段，不可删除）

---

## 启动方式

```bash
cd backend
npm install       # 首次安装依赖
npm run dev       # 开发模式（热重载）
```

服务启动后：
- HTTP API：`http://localhost:3001`
- 健康检查：`http://localhost:3001/health`
- WebSocket：`ws://localhost:3001/ws`

---

*文档由小张整理 | 最后更新：2026-03-15*

---

## 前端变更同步记录

> 小张在前端做的改动中，凡涉及到后端接口数据结构的，都记录在此。小强阅读后确认接口兼容性。

### 2026-03-15 工作流节点保存 Bug 修复

**背景：** 项目协作流程中，设置节点顺序、并行/串行、智能体分配后保存，这些数据之前没有被传给后端，属于前端漏传 Bug。

**前端改动文件：**
- `frontend/src/types/index.ts` — 新增 `WorkflowNode` 接口，`Project` 类型补充了以下字段：
  ```ts
  goal?: string
  priority?: 'high' | 'mid' | 'low'
  startTime?: string
  endTime?: string
  decisionMaker?: string
  workflowNodes?: WorkflowNode[]  // { id, name, nodeType, agentIds, taskDesc }
  ```
- `frontend/src/api/projects.ts` — `create` 方法扩展，现在会传以上所有字段
- `frontend/src/stores/projectStore.ts` — `createProject` 签名扩展
- `frontend/src/pages/AgentConsole.tsx` — 新建/编辑项目时完整传入工作流数据

**后端影响：**
- ✅ `POST /api/projects` 和 `PUT /api/projects/:id` 已支持 `workflowNodes`、`goal`、`priority`、`startTime`、`endTime`、`decisionMaker` 字段（后端路由和数据库均已就绪，**无需改动**）
- ⚠️ **注意：** `workflowNodes` 中每个节点的结构为：
  ```json
  {
    "id": "string",
    "name": "string",
    "nodeType": "serial" | "parallel",
    "agentIds": ["agentId1", "agentId2"],
    "taskDesc": "string"
  }
  ```
  前端字段名是 `taskDesc`（camelCase），后端 Zod Schema 中是 `taskDesc`，需确认一致。

**小强待确认：**
- [ ] 检查 `backend/src/routes/projects.ts` 中 `WorkflowNodeSchema` 的字段名是否与前端一致（前端传 `taskDesc`，后端接收字段需匹配）
- [ ] 确认 `GET /api/projects/:id` 返回数据中包含 `workflowNodes` 字段，方便前端编辑时回填节点数据
