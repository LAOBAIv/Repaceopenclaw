# 团队协作规则

> 本文件定义了小张（WorkBuddy A）和小强（WorkBuddy B）的开发分工边界。
> **所有开发人员在开始工作前必须阅读并严格遵守本规则。**

---

## 角色分工

| 角色 | 负责范围 | 禁止操作 |
|------|----------|----------|
| **小张**（WorkBuddy A） | 前端开发、UI/UX、组件样式 | 不得修改 `backend/` 目录下任何文件 |
| **小强**（WorkBuddy B） | 后端开发、API、数据库 | 不得修改 `frontend/` 目录下任何文件 |

---

## 目录归属

```
项目根目录/
├── frontend/         ← 【小张专属】禁止小强修改
│   ├── src/
│   ├── public/
│   └── ...
│
├── backend/          ← 【小强专属】禁止小张修改
│   ├── src/
│   ├── data/
│   └── ...
│
├── COLLABORATION.md  ← 共同维护，修改前需双方确认
└── ...
```

---

## 接口协作规范

### API 接口变更
- 小强新增或修改 API 接口时，**必须同步更新本文件末尾的《接口变更日志》**
- 小张根据接口变更日志更新前端调用代码

### 接口格式约定
- 所有 API 响应格式统一为：
  ```json
  { "data": { ... } }        // 成功
  { "error": "描述" }        // 失败
  { "success": true }        // 无返回值操作
  ```
- 服务地址：后端 `http://localhost:3001`，前端 `http://localhost:5173`

---

## 当前后端 API 清单（小强维护）

| 路由前缀 | 模块 | 说明 |
|----------|------|------|
| `GET/POST/PUT/DELETE /api/agents` | 智能体 | 智能体 CRUD + 模型参数 |
| `GET/POST/PUT/DELETE /api/projects` | 项目 | 项目 CRUD + 工作流节点 |
| `GET/POST/DELETE /api/conversations` | 会话 | 会话创建/删除/消息管理 |
| `GET/POST/PUT/DELETE /api/tasks` | 任务 | 看板任务管理 + 拖拽排序 |
| `GET/POST/DELETE /api/token-channels` | 模型渠道 | LLM API Key 管理 |
| `ws://localhost:3001/ws` | WebSocket | 流式对话通信 |

---

## 禁止事项

### 小强（后端）严格禁止：
1. ❌ 修改 `frontend/` 目录下的任何 `.tsx`、`.ts`、`.css`、`.html` 文件
2. ❌ 修改 `frontend/package.json` 或 `frontend/vite.config.ts`
3. ❌ 在前端代码中硬编码后端地址或逻辑
4. ❌ 删除或重命名已有 API 路由（需先与小张确认前端是否依赖）

### 小张（前端）严格禁止：
1. ❌ 修改 `backend/` 目录下的任何 `.ts` 文件
2. ❌ 修改 `backend/package.json`
3. ❌ 直接操作数据库文件 `backend/data/platform.db`

---

## 接口变更日志

> 每次后端接口有变更，小强在此记录，小强填写，小张阅读确认。

| 日期 | 变更类型 | 接口路径 | 变更说明 | 是否影响前端 |
|------|----------|----------|----------|--------------|
| 2026-03-14 | 新增 | `POST /api/token-channels` | 新增模型渠道管理 upsert 接口 | 是（前端已适配） |
| 2026-03-14 | 新增字段 | `PUT /api/agents/:id` | agents 表新增 model_name、temperature 等模型参数字段 | 是（前端已适配） |
| 2026-03-15 | Bug修复 | `POST /api/projects` `PUT /api/projects/:id` | 前端修复漏传工作流节点数据的 Bug，现在会完整传入 workflowNodes、goal、priority、startTime、endTime、decisionMaker | 后端已支持，无需改动；小强需确认 workflowNodes 字段名兼容性 |
| 2026-03-15 | WS扩展 | `ws://localhost:3001/ws` | 新增 `multi_chat` 消息类型，支持多智能体串行/并行协作；新增推送事件：`multi_agent_start`、`workflow_node_start`、`workflow_node_done`、`multi_agent_done` | 是（前端需处理新事件类型） |
| 2026-03-15 | 新增字段 | `POST/PUT/GET /api/tasks` | tasks 表新增 `agentId` 字段（精确关联智能体 UUID），CREATE/UPDATE/返回数据均已支持 | 是（前端可选传入 agentId） |
| 2026-03-15 | 新增 | `GET /api/projects/documents/:docId/versions` | 获取文档历史版本列表 | 否 |
| 2026-03-15 | 新增 | `POST /api/projects/documents/:docId/versions` | 手动创建文档版本快照 | 否 |
| 2026-03-15 | 新增 | `GET /api/projects/documents/:docId/versions/:versionId` | 获取特定版本内容 | 否 |
| 2026-03-15 | 新增 | `POST /api/conversations/:id/generate` | HTTP 方式触发 AI 生成回复（非流式），body: `{ agentId }` | 是（前端可用于非 WS 场景） |
| 2026-03-15 | 新增 | `GET /api/search?q=关键词` | 全局跨表模糊搜索（agents/projects/tasks/documents） | 是 |
| 2026-03-15 | 新增 | `GET /api/export` | 导出全量数据为 JSON | 否 |
| 2026-03-15 | 新增 | `POST /api/export` 或 `POST /api/import` | 导入数据，支持 merge/overwrite 模式 | 否 |
| 2026-03-15 | 新增 | `POST /api/token-channels/:id/test` | 渠道连通性测试，返回 connected/statusCode/latencyMs | 否 |
| 2026-03-15 | 新增 | `GET/POST/PUT/DELETE /api/skills` | 技能管理 CRUD；`PATCH /:id/enabled` 启用/禁用；`GET/POST/DELETE /api/skills/:id/bind` 技能与 agent 绑定；`GET /api/skills/agent/:agentId` 查 agent 的已绑定技能 | 是 |
| 2026-03-15 | 新增 | `GET/POST/PUT/DELETE /api/plugins` | 插件管理 CRUD（安装/卸载/更新）；`PATCH /:id/enabled` 启用/禁用；`PUT /:id/config` 单独更新配置；`GET/POST/DELETE /api/plugins/:id/bind` 插件与 agent 绑定；`GET /api/plugins/agent/:agentId` 查 agent 的已绑定插件 | 是 |

---

*最后更新：2026-03-15 | 维护人：小张（前端）+ 小强（后端）*
