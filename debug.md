# 代码修改记录（debug.md）

> 记录每次对代码的修改，包含修改日期、涉及文件、问题描述、修改原因和修改内容摘要。

---

## 2026-03-18 · 优化项目/任务名称编辑流程

**涉及文件（前端）：**
- `frontend/src/pages/AgentKanban.tsx` - 看板页面组件

**问题描述：**
用户之前在对话页面无法编辑任务/项目名称，需要优化为在看板列表页面就能快速编辑。

**修改原因：**
1. 对话页面（ProjectWorkspace）只用于对话交互，不应有编辑功能
2. 项目/任务的创建和编辑应在看板页面（AgentKanban）完成
3. 提升用户体验：看板卡片上直接双击标题即可编辑

**修改内容摘要：**

### ProjectCard 组件
- 新增编辑状态管理：`isEditingTitle`, `editingTitle`
- 新增 `saveTitle()` 方法：
  - 调用后端 `projectsApi.update()` 保存到数据库
  - 更新前端 kanban store
  - 捕获 403 错误并提示"只有创建人可修改"
  - 失败时恢复编辑框内容

- 标题显示改造：
  - 双击激活编辑模式：`onDoubleClick={() => setIsEditingTitle(true)}`
  - 编辑中显示 `<input>` 输入框
  - 鼠标悬停时显示编辑背景提示
  - Enter 键保存，Escape 键取消

### TaskCard 组件
- 同步 ProjectCard 的编辑逻辑
- 新增编辑状态管理：`isEditingTitle`, `editingTitle`
- 新增 `saveTitle()` 方法：
  - 更新前端 taskStore（当前无后端任务 API）
  
- 标题显示改造：同 ProjectCard

### 用户交互流程
```
用户在看板页面
  ↓
双击项目/任务标题
  ↓
输入框激活，可编辑（蓝色边框）
  ↓
输入新名称
  ↓
按 Enter 或点击其他地方 → 保存到后端/本地 store
```

### 权限保护
- 后端返回 403 时，前端提示"只有创建人可以修改项目名称"
- 用户体验优化：编辑失败时自动恢复为原始名称

---

## 2026-03-18 · 会话与任务/项目关联设计调整

**涉及文件（后端）：**
- `backend/src/db/client.ts` - 数据库模型
- `backend/src/services/ConversationService.ts` - 会话业务逻辑
- `backend/src/services/ProjectService.ts` - 项目业务逻辑
- `backend/src/services/TaskService.ts` - 任务业务逻辑
- `backend/src/routes/conversations.ts` - 会话 API
- `backend/src/routes/projects.ts` - 项目 API
- `backend/src/routes/tasks.ts` - 任务 API

**问题描述：**
目前会话创建和管理以"智能体"为单位，无法支持"一个任务/项目对应一个会话，多个智能体共享该会话"的业务模式。且项目/任务名称无权限保护，任何用户都可修改。

**修改原因：**
用户需求：
1. 一个任务/项目只能有一个 ID，可与多个智能体会话
2. 多用户打开同一任务时共享会话
3. 在会话页面的智能体弹窗中切换和添加智能体
4. 顶部任务/项目名称可在页面直接编辑，修改后存入数据库
5. 只有创建人可以修改项目/任务名称

**修改内容摘要：**

### 数据库迁移（client.ts）

1. **Conversations 表**：
   - 新增 `task_id TEXT UNIQUE` - 关联的任务 ID（一对一映射）
   - 新增 `created_by TEXT` - 创建人用户 ID（权限控制）

2. **Projects 表**：
   - 新增 `created_by TEXT` - 创建人用户 ID

3. **Tasks 表**：
   - 新增 `created_by TEXT` - 创建人用户 ID
   - 字段位置调整到 `sort_order` 之后

### 服务层调整

#### ConversationService.ts
- `Conversation` 接口新增 `taskId` 和 `createdBy` 字段
- `create()` 方法新增参数：`taskId?: string; createdBy?: string`
- `rowToConversation()` 函数适配新字段

#### ProjectService.ts
- `Project` 接口新增 `createdBy: string | null`
- `create()` 和 `update()` 方法支持 `createdBy` 参数
- `rowToProject()` 函数适配新字段

#### TaskService.ts
- `Task` 接口新增 `createdBy: string | null`
- `create()` 和 `update()` 方法支持 `createdBy` 参数
- `rowToTask()` 函数适配新字段

### API 路由调整

#### conversations.ts
- `CreateConvSchema` 新增 `taskId` 和 `createdBy` 字段
- `POST /api/conversations` 创建逻辑：
  - 若指定 `taskId`，先检查是否已存在会话
  - 若已存在，直接返回现有会话 ID（共享模式）
  - 若不存在，创建新会话并关联 `taskId`

#### projects.ts
- `ProjectSchema` 新增 `createdBy` 字段
- `PUT /api/projects/:id` 权限检查：
  - 只有创建人或未设置创建人的项目可修改名称
  - 非创建人修改 title 时返回 403 Forbidden

#### tasks.ts
- `TaskCreateSchema` 和 `TaskUpdateSchema` 新增 `createdBy` 字段
- `PUT /api/tasks/:id` 权限检查：
  - 同项目，只有创建人可修改名称
  - 非创建人修改 title 时返回 403 Forbidden

---

## 2026-03-17 · 会话页面新增多 Tab 管理功能

**涉及文件：**
- `frontend/src/stores/conversationStore.ts`
- `frontend/src/pages/ProjectWorkspace.tsx`

**问题描述：**
会话页面只能同时查看一个对话，用户需要在多个对话之间快速切换（例如与不同智能体的独立会话），缺乏多会话 Tab 管理机制。

**修改原因：**
用户需求：在会话页面增加新建会话的功能，多个会话通过顶部 Tab 页切换。

**修改内容摘要：**

### conversationStore.ts
1. 新增 `SessionTab` 接口：包含 `id`、`title`、`panelId`（绑定的 panel）、`color`（智能体颜色）、`isStreaming` 字段。
2. `ConversationStore` 接口新增字段：`sessionTabs`、`activeTabId`。
3. `openPanel` 的参数新增 `tabId?: string`，支持将新建 panel 绑定到指定 Tab。
4. 修复：若 agent 已有 panel 且传入 `tabId`，将现有 panel 绑定到该 Tab（处理空 Tab 复用已有会话的场景）。
5. 新增方法：
   - `createSessionTab(title?)` → 创建空 Tab，返回 tabId
   - `switchSessionTab(tabId)` → 切换激活 Tab
   - `closeSessionTab(tabId)` → 关闭 Tab（同时关闭绑定的 panel）
   - `bindPanelToTab(tabId, panelId, title, color?)` → 绑定 panel 到 Tab
   - `syncTabStreamingState()` → 同步 streaming 状态

### ProjectWorkspace.tsx
1. 从 store 引入新增的 Tab 管理方法。
2. 新增 `useEffect`：监听 `openPanels` 变化，自动为未绑定 Tab 的 panel 创建对应 Tab，并同步 streaming/color/title 等状态。
3. 新增 `useEffect`：监听 `activeTabId` 变化，自动同步 `activePanelId`。
4. 新增会话 Tab 栏 CSS（`.session-tab-bar`、`.session-tab`、`.session-tab-add`、`.tab-dot`、`.tab-close`）。
5. 在消息区域上方插入 Tab 栏 UI：
   - 每个 Tab 显示智能体颜色圆点、名称；正在流式输出时圆点有 pulse 动画；
   - 多于 1 个 Tab 时显示关闭按钮（×）；
   - 右侧 `+` 按钮新建空 Tab；
6. 消息区新增空 Tab 状态：显示"新会话"引导提示（区别于"无消息"状态）。
7. `handleSend`：在没有 panel 时（空 Tab），为当前 Tab 创建新 panel 并绑定，解决新 Tab 发消息时自动建会话的问题。
8. `onOpenAgentPanel`：从智能体面板打开新 panel 时，同步绑定到当前 Tab；若 panel 已存在，同步激活对应 Tab。



**涉及文件：**
- `backend/src/ws/wsHandler.ts`
- `backend/src/services/llm/LLMAdapter.ts`
- `backend/src/services/llm/AutoLLMAdapter.ts`
- `backend/src/services/llm/MockLLMAdapter.ts`
- `backend/src/services/AgentService.ts`
- `backend/src/services/ConversationService.ts`
- `backend/src/db/client.ts`
- `backend/src/routes/agents.ts`

**问题描述：**
1. 多智能体参与同一会话时，缺少明确的"默认选协作流程最靠前智能体"的文档说明
2. 智能体调用 LLM 大模型时没有 Token 用量统计，无法追踪每个智能体消耗了多少 Token

**修改原因：** 用户要求检查多智能体默认选取规则，并为 LLM 接口调用增加完整的 Token 用量统计。

**修改内容摘要：**

### 1. wsHandler.ts：多智能体默认顺序注释补全
- 明确注释 `activeAgentIds` 的三级优先级：前端传入 > DB `joined_at ASC` 排序 > 单个 agentId
- `activeAgentIds[0]` 即"协作流程最靠前的智能体"，第一个执行、其回复进入 history 供后续 agent 参考
- `runSingleAgent` 的 `onComplete` 回调改为接收 `tokenCount: number`，完成后：
  - 调用 `ConversationService.addMessage({ ..., tokenCount })` 将用量写入消息记录
  - 调用 `AgentService.addTokenUsed(agentId, tokenCount)` 将用量累加到 agent 统计列
  - WS 事件 `agent_done` 附带 `tokenCount` 字段，前端可直接展示

### 2. AutoLLMAdapter.ts：从 SSE usage 字段捕获真实 Token 用量
- 请求体新增 `stream_options: { include_usage: true }`，请求服务端在流末尾携带 usage 块
- SSE 解析时同时检查 `json.usage?.total_tokens`，有则记录实际值
- 流结束时若 `totalTokens === 0`（服务端不支持 stream_options），降级为本地 `estimateTokens` 估算（system + history）
- `callOpenAIStream` 返回值改为 `Promise<number>`（实际 token 数），`onComplete(tokenCount)` 传出
- `AutoLLMAdapter.generateStream` 的 `onComplete` 签名同步更新

### 3. LLMAdapter.ts（接口）/ MockLLMAdapter.ts
- `ILLMAdapter.generateStream` 的 `onComplete` 改为 `(tokenCount: number) => void`
- `MockLLMAdapter` 完成时传 mock token 数（回复字符数 / 2 粗估）

### 4. AgentService.ts
- `Agent` interface 新增 `tokenUsed: number` 字段
- `rowToAgent` 新增 `tokenUsed: obj.token_used ?? 0` 映射
- 新增 `addTokenUsed(agentId, delta)` 方法：执行 `UPDATE agents SET token_used = token_used + ? WHERE id = ?`
- `generateStream` 的 `onComplete` 签名同步更新

### 5. ConversationService.ts
- `Message` interface 新增 `tokenCount: number` 字段
- `addMessage()` 新增可选参数 `tokenCount?: number`，写入 `messages.token_count`
- `getMessages()` 返回时带 `tokenCount: r.token_count ?? 0`

### 6. db/client.ts（DB 迁移）
- `agents` 建表加 `token_used INTEGER NOT NULL DEFAULT 0`
- 幂等迁移：`ALTER TABLE agents ADD COLUMN token_used INTEGER NOT NULL DEFAULT 0`
- `messages` 建表加 `token_count INTEGER NOT NULL DEFAULT 0`
- 幂等迁移：`ALTER TABLE messages ADD COLUMN token_count INTEGER NOT NULL DEFAULT 0`

### 7. routes/agents.ts：新增 Token 统计查询接口
- 新增 `GET /api/agents/:id/token-stats`，返回：
  - `tokenUsed`：agents.token_used 累计值
  - `tokenFromMessages`：从 messages 表 SUM(token_count) 交叉验证
  - `messageCount`：该 agent 回复的消息数
  - `avgTokenPerMsg`：平均每条消息消耗 token 数
  - `perConversation`：按会话汇总的 token 用量列表（conversationId / totalTokens / messageCount）



## 2026-03-17 · 智能体管理页面模型参数展示调整

**涉及文件：** `frontend/src/pages/AgentManager.tsx`

**问题描述：** 智能体卡片底部的模型参数栏展示内容过多（Temperature、Max Tokens、Top-P、记忆轮数、输出格式等），用户反馈只需要显示渠道和模型名两个字段。

**修改原因：** 根据用户需求，只保留 `tokenProvider`（渠道）和 `modelName`（模型名）两个核心字段，移除其他参数，界面更简洁清晰。

**修改内容摘要：**
- `ModelParamBar` 组件逻辑简化：去掉 `temperature`、`maxTokens`、`topP`、`memoryTurns`、`outputFormat` 等参数的读取和渲染逻辑，仅保留 `agent.tokenProvider`（渠道）和 `agent.modelName`（模型名）
- 移除 `PROVIDER_LABEL` 渠道 ID 映射表（不再需要转换显示名）
- 移除不再使用的 `lucide-react` 图标引用：`Thermometer`、`Hash`、`Layers`
- CSS 精简：移除 `.am-param`、`.am-param-val`、`.am-param-badge` 等相关样式，新增 `.am-model-channel` 样式用于渠道名展示
- 展示格式：`🖥 渠道名 | 模型名`，任意一项缺失时隐藏对应部分，两者均缺失时显示"未配置模型"占位提示

---

## 2026-03-17 · 智能体创建页面布局重构

**涉及文件：** `frontend/src/pages/AgentCreate.tsx`

**问题描述：** 智能体创建页面表单字段纵向堆叠，内容超出页面可用高度，出现底部遮挡和滚动条。

**修改原因：** 用户要求布局不超出页面高度，不出现底部遮挡，也不出现滚动条。

**修改内容摘要：**
- `.ac-scroll` 去掉 `overflow-y: auto`，改为 `overflow: hidden`，彻底消除外层滚动条
- 新增 `.ac-cols` 两栏 grid 容器（`grid-template-columns: 1fr 1fr`）和 `.ac-col` 子列样式
- **左栏**：智能体名称、简介、角色设定（flex 弹性高度自适应）、语言风格 + 输出格式
- **右栏**：核心技能、CODE 渠道 + Token 接入、能力边界（flex 弹性高度自适应）、对话记忆 + 推理温度
- 两栏 textarea（角色设定、能力边界）从固定 `minHeight` 改为 `flex: 1; resize: none`，随容器自动撑满剩余高度
- 字段间距 `marginBottom` 从 14px 缩减为 10px，标签间距从 5px 缩减为 4px
- 响应式：≤760px 宽度时回退为单列布局并恢复 `overflow-y: auto`

---

## 2026-03-17 · 语言风格/输出格式上移并改为下拉选择

**涉及文件：** `frontend/src/pages/AgentCreate.tsx`

**问题描述：** 语言风格和输出格式在左栏底部，位置靠后且 tag 点击方式不够直观。

**修改原因：** 用户要求将这两个字段上移，并改成下拉选择（select）。

**修改内容摘要：**
- 将语言风格和输出格式从左栏最底部移至「简介」和「角色设定」之间
- 将两个字段的 tag 标签点击交互改为原生 `<select>` 下拉选择，选项内容不变（STYLE_TAGS / OUTPUT_TAGS）
- 两列 grid 布局（`1fr 1fr`）保留不变
- 移除不再使用的 `.ac-tag` / `.ac-tag.active` / `.ac-tag:hover` CSS 样式

---

## 2026-03-17 · 右栏字段顺序调整（记忆轮数/推理温度上移）

**涉及文件：** `frontend/src/pages/AgentCreate.tsx`

**问题描述：** 对话记忆轮数和推理温度在右栏最底部，位置偏后。

**修改原因：** 用户要求将这两个字段上移。

**修改内容摘要：**
- 右栏字段顺序调整为：核心技能 → 对话记忆（轮）+ 推理温度（覆盖）→ CODE 渠道 + Token 接入 → 能力边界
- 能力边界仍保留在最底部并以 `flex: 1` 撑满剩余高度

---

## 2026-03-17 · 上下文转发 Bug 修复（三处）

**涉及文件：**
- `backend/src/routes/openaiCompat.ts`
- `backend/src/ws/wsHandler.ts`
- `backend/src/services/llm/AutoLLMAdapter.ts`

**问题描述：** 上下文转发机制存在三处 Bug，导致外部工具调用时配置失效、串行多 Agent 模式崩溃、记忆轮数截断逻辑错误。

**修改原因：** 用户要求检查并修复上下文转发相关 Bug。

**修改内容摘要：**

### Bug 1：openaiCompat.ts agentConfig 缺少 memoryTurns / temperatureOverride
- 位置：`backend/src/routes/openaiCompat.ts` 第 103–127 行，`agentConfig` 对象构建处
- 原因：外部工具（OpenClaw 等）调用 `/v1/chat/completions` 时，`agentConfig` 未携带 `memoryTurns` 和 `temperatureOverride`，导致记忆轮数限制和温度覆盖对外部调用无效
- 修复：在 `agentConfig` 中补充 `memoryTurns: agent.memoryTurns` 和 `temperatureOverride: agent.temperatureOverride`（已在上一次会话完成）

### Bug 2：wsHandler.ts 串行模式前序 Agent 出错不写 DB，后续 Agent 收到连续 user 消息
- 位置：`backend/src/ws/wsHandler.ts`，serial 节点 `for` 循环内 `runSingleAgent` 调用处
- 原因：`runSingleAgent` 在 `onError` 路径只发 WS 事件，不写 DB。下一个 Agent 刷新 history 时末尾仍是 user 消息（前序 Agent 无回复），形成 `[..., user, user]` 结构，LLM 拒绝或输出异常
- 修复：循环内在调用 `runSingleAgent` 前检查 history 末尾 role；若非首 Agent 且末尾为 `user`（前序出错），自动向 DB 插入占位消息 `[上一个智能体未返回回复]` 并重新构建 history，保证 user→assistant 交替结构

### Bug 3：AutoLLMAdapter.ts memoryTurns 截断公式错误，可能丢失当前用户消息
- 位置：`backend/src/services/llm/AutoLLMAdapter.ts`，`generateStream` 中 memoryTurns 截断块
- 原因：原公式 `maxMsgs = memTurns * 2`，未计入末尾那条"尚未被回复的当前用户消息"。以 `memoryTurns=1` 为例，`maxMsgs=2`，对 `[user-A, asst-A, user-B]` 执行 `slice(-2)` 得 `[asst-A, user-B]`，开头是 assistant 消息，部分 LLM 拒绝此格式
- 修复：
  1. 公式改为 `maxMsgs = memTurns * 2 + 1`，保留完整的 N 轮历史 + 当前用户提问
  2. 截断后增加对齐检查：若首条 role 为 `assistant`，自动去掉该条，保证序列从 `user` 开始

---

## 2026-03-17 · 会话列表重复任务 Bug 修复

**涉及文件：** `frontend/src/pages/ProjectWorkspace.tsx`

**问题描述：** 会话列表（AgentKanban）中每次刷新页面后，再发送第一条消息，都会在会话列表中新增一条任务记录，导致任务数量不断叠加。

**修改原因：** 发现大 Bug——每一轮对话被定义成了一个新会话。

**根因分析：**
- 原防重逻辑使用 `const createdTaskPanels = useRef<Set<string>>(new Set())`
- `useRef` 是组件级内存变量，页面刷新或组件重挂后清零
- 清零后 `createdTaskPanels.current.has(panelId)` 恒为 `false`，防重失效
- 每次刷新后发第一条消息，`addTaskFromChat()` 都会被调用，会话列表新增一条任务
- 由于任务标题用的是消息内容 `title: text`，每次内容不同，看起来像独立任务，实际是同一 conversation

**修改内容摘要：**

### 修复1：防重集合持久化到 localStorage
- 将 `useRef(new Set())` 改为初始化时从 `localStorage.getItem('wb-created-task-convs')` 读取
- 新增 `persistCreatedTaskConv(convId)` 函数，每次添加时同步写回 localStorage
- 防重 key 以 `conversationId` 为准（即 `panelId`，它就是 DB 中的 conv.id）
- 页面刷新后重新加载 Set，已记录的 conversationId 不会再触发 `addTaskFromChat`

### 修复2：任务标题改用上下文名称
- 原代码 `title: text` 用第一条消息内容作任务标题，每次内容不同，重复任务标题各异
- 修复为：优先用 `resolvedCtx.projectName`（项目名），其次从 taskStore 查 `resolvedCtx.taskId` 对应的任务标题，最后降级为 `与 AgentName 的对话`
- 这样即使将来防重偶发失效，重复创建的任务标题也相同，便于发现和清理

---

## 2026-03-17 · 会话数据模型重构：支持多智能体参与同一会话

**涉及文件：**
- `backend/src/db/client.ts`
- `backend/src/services/ConversationService.ts`
- `backend/src/routes/conversations.ts`
- `backend/src/ws/wsHandler.ts`
- `frontend/src/types/index.ts`
- `frontend/src/api/conversations.ts`
- `frontend/src/stores/conversationStore.ts`

**问题描述：** 原设计中 conversations 表只有单值 `agent_id` 字段，一个会话只能关联一个智能体，无法支持多智能体共同参与同一会话 id 的协作场景。

**修改原因：** 用户要求"数据处理以会话 id 的方式，一个会话 id 可以有多个智能体参与"。

**修改内容摘要：**

### DB 层（client.ts）
- conversations 表去掉 `agent_id` 字段（SQLite 不支持 DROP COLUMN，旧列保留但不再写入）
- 新增 `conversation_agents` 关联表（多对多）：
  ```sql
  CREATE TABLE IF NOT EXISTS conversation_agents (
    conversation_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    PRIMARY KEY (conversation_id, agent_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
  )
  ```
- 新增幂等迁移：将旧 conversations 表中的 `agent_id` 数据自动迁移到 `conversation_agents`

### ConversationService.ts
- `Conversation` 接口新增 `agentIds: string[]`，`agentId` 保留为兼容字段（= `agentIds[0]`）
- `create()` 签名改为 `{ agentIds: string[], projectId?, title? }`，批量写入关联表
- 新增 `addAgent(conversationId, agentId)`：向已有会话追加智能体（幂等）
- 新增 `removeAgent(conversationId, agentId)`：从会话移除智能体
- `list()` / `getById()` 通过 `conversation_agents` 表批量查询 `agentIds`

### 路由 conversations.ts
- `POST /conversations` 同时支持 `agentId`（旧版单个）和 `agentIds`（新版数组），后端统一转为数组处理
- 新增 `POST /conversations/:id/agents`：向已有会话追加智能体
- 新增 `DELETE /conversations/:id/agents/:agentId`：从会话移除智能体

### wsHandler.ts（chat 消息）
- 接收 `agentIds` 字段（前端传来的全量参与列表）
- 优先级：前端传的 `agentIds` → DB `conversation_agents` 中的参与者 → 降级为单个 `agentId`
- 单智能体：直接 `runSingleAgent`（行为不变）
- 多智能体：串行依次回复，每个 agent 能看到前者的回复，附带防连续 user 消息保护

### 前端 types / api / store
- `Conversation` 接口新增 `agentIds: string[]`
- `ConversationPanel` 新增 `agentIds: string[]`
- `openPanel` 支持传入 `agentIds?: string[]`，自动去重合并
- `conversationsApi.create()` 支持 `agentIds` 数组参数
- 新增 `addAgent()` / `removeAgent()` API 方法

---

## 2026-03-17 · 创建会话传无效 agentId 无校验导致孤儿数据 Bug 修复

**涉及文件：**
- `backend/src/routes/conversations.ts`
- `backend/src/db/client.ts`

**问题描述：** `POST /api/conversations` 接口对 `agentId` 只做了格式校验（非空字符串），未验证 Agent 是否实际存在于数据库，导致传入任意无效 id 也能成功创建会话记录，产生 `agent_id` 指向不存在 Agent 的孤儿数据。

**修改原因：** sql.js（纯 JS 版 SQLite）不支持运行时 `PRAGMA foreign_keys`，数据库层外键约束对孤儿写入无防护，必须在应用层显式校验。

**修改内容摘要：**

### conversations.ts：POST 路由增加 agentId 存在性校验
- 在 `ConversationService.create()` 调用前，先用 `AgentService.getById(agentId)` 查询
- Agent 不存在时返回 `404 { error: "Agent not found: <id>" }`
- Agent 存在才继续创建会话，避免孤儿数据写入

### db/client.ts：conversations 表补全外键约束定义
- `agent_id` 补上 `FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE`
- `project_id` 补上 `FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL`
- 当前 sql.js 驱动无法执行外键约束，但显式声明有助于代码可读性，并为将来迁移到原生 SQLite 驱动时自动生效

---

## 2026-03-17 · 任务 id 改为使用 conversationId，防重逻辑下沉到 Store

**涉及文件：**
- `frontend/src/stores/taskStore.ts`
- `frontend/src/pages/ProjectWorkspace.tsx`

**问题描述：** 上一次修复将防重集合持久化到 localStorage，但仍属于外部维护防重状态，不够健壮。更彻底的方案是让任务 id 直接等于 conversationId，防重逻辑内聚到 Store。

**修改原因：** 用户要求"必须给第一次会话一个 id，用会话 id 来存储内容"。

**修改内容摘要：**

### taskStore.ts：task.id = conversationId（panelId）
- `addTaskFromChat` 中任务 id 从 `chat_${Date.now()}` 改为直接使用 `panelId`（即 conversationId）
- `panelId` 不存在时降级为 `chat_${Date.now()}`（理论上不会发生）
- `set()` 内部插入前先检查 `progress` 和 `done` 中是否已有同 id 的任务，若存在则直接返回原状态（幂等插入）
- 防重逻辑完全内聚在 Store，外部调用方无需任何防重集合



---

## 2026-03-17 · 输出格式"预览+完整代码"双方案实现

**涉及文件：**
- `backend/src/services/llm/AutoLLMAdapter.ts`
- `frontend/src/components/conversation/MessageBubble.tsx`
- `frontend/src/components/conversation/ConversationPanel.tsx`
- `frontend/src/components/conversation/MultiPanelContainer.tsx`
- `frontend/src/pages/ProjectWorkspace.tsx`

**问题描述：**
智能体编辑页面"输出格式"选项中的"预览+完整代码"从未生效——选了之后与"纯文本"效果完全一样。后端没有向 LLM 注入对应的格式指令，前端也没有做特殊渲染。

**修改原因：** 用户要求同时实现后端（system prompt 注入）和前端（双区渲染）两个方向。

**修改内容摘要：**

### 1. AutoLLMAdapter.ts：重写"预览+完整代码"的 prompt 指令
- 原来的提示词"先给出完整可运行代码，再附上预览效果说明"顺序反（名字叫"预览+完整代码"但代码在前）
- 改为严格规范：AI 必须先输出 `<!-- PREVIEW_START -->…<!-- PREVIEW_END -->` 预览说明区块，再输出 `<!-- CODE_START -->…<!-- CODE_END -->` 完整代码区块
- 不涉及代码的回复不需要使用标记，正常回复即可
- `buildSystemPrompt` 中格式指令的 key 从 `## 输出格式` 统一为 `## 输出格式要求`

### 2. MessageBubble.tsx：新增双区渲染组件
- 新增 `parsePreviewCode(content)` 函数：解析消息中的 PREVIEW/CODE HTML 注释标记，返回 `{ preview, code, rest }`；无匹配则返回 `null`
- 新增 `PreviewCodeView` 组件：
  - 流式输出中退化为普通 Markdown（标记未完整时无法解析）
  - 完成后：上方"预览效果"区块（带智能体颜色主题头）+ 下方"完整代码"折叠区（点击展开/收起，默认折叠）
  - 消息头显示"预览+代码"徽章标识
- 新增 `outputFormat` prop（可选），当值为"预览+完整代码"时激活双区渲染，否则走原有 Markdown 渲染
- 新增 `MARKDOWN_CLS` 常量避免重复样式字符串
- 引入 `ChevronDown`、`ChevronUp`、`Eye`、`Code2` 图标

### 3. ConversationPanel.tsx：透传 outputFormat
- 新增 `outputFormat?: string` prop
- 将 `outputFormat` 传入每个 `MessageBubble`

### 4. MultiPanelContainer.tsx：透传 outputFormatMap
- 新增 `outputFormatMap?: Record<string, string>` prop（agentId → outputFormat 映射）
- 按 `panel.agentId` 从 map 中取对应 outputFormat 传给 `ConversationPanel`

### 5. ProjectWorkspace.tsx：接入 MessageBubble + outputFormat
- 新增 `import { MessageBubble } from '@/components/conversation/MessageBubble'`
- 将消息区域的内联 `<div>` 渲染替换为 `MessageBubble` 组件，传入 `agentName`、`agentColor`、`outputFormat`
- `outputFormat` 从 `agents` 数组中按 `msg.agentId`（或 `activePanel.agentId`）查找智能体并取 `agent.outputFormat`

