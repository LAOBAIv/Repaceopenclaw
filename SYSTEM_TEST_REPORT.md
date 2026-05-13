# 系统测试报告 — AI 可读结构化格式
> 测试时间：2026-03-17  
> 测试范围：前端表单 → API 传参 → 后端路由 → Service 层 → 数据库存储 → LLM 调用链  
> 项目路径：f:/Users/Administrator/WorkBuddy/20260314153116

---

## 一、字段映射测试（核心缺陷）

### 1.1 前端有 UI，但数据未能正确进入数据库

| 字段ID | 前端标签 | 前端变量 | 提交时的行为 | 数据库字段 | 缺陷类型 | 严重度 |
|--------|----------|----------|-------------|----------|----------|--------|
| F-001 | 输出格式规范 | `outputFmt` | **未写入 payload** | `output_format` | 字段丢失 | HIGH |
| F-002 | 能力边界 | `boundary` | **未写入 payload** | `boundary` | 字段丢失 | HIGH |
| F-003 | 对话记忆长度 | `memory` | 被当作 `systemPrompt: memory.trim()` 存入 | `system_prompt` | 字段语义错误 | CRITICAL |
| F-004 | 推理温度值 | `temp` | **未写入 payload（完全忽略）** | `temperature_override` | 字段丢失 | MEDIUM |
| F-005 | 角色设定 | `role` | 存入 `writingStyle: role.trim() \|\| style` | `writing_style` | 字段语义错误 | HIGH |

**说明：**
- F-003：前端 `memory` 是 `type="number"` 的输入框（标签写「对话记忆长度，如10」），但 `handleSubmit` 里 `systemPrompt: memory.trim()` 将其当成 System Prompt 字符串存入数据库。这意味着智能体的 System Prompt 实际被设置为一个纯数字字符串（如 "10"），完全无效。
- F-005：前端 `role` 是「角色设定」大段文本框（placeholder: "定义智能体的人设和核心定位..."），但实际存入了 `writing_style` 字段（数据库设计语义是语言风格标签，如 "balanced"）。导致真实的角色定位长文本混入了风格字段。

---

### 1.2 数据库有字段，但前端无对应 UI

| 数据库字段 | 后端接口字段 | 前端是否有UI | 当前行为 | 缺陷类型 | 严重度 |
|-----------|------------|------------|---------|---------|--------|
| `color` | `color` | ❌ 无颜色选择器 | 写死 `#6366f1` | 功能缺失 | LOW |
| `status` | `status` | ❌ 无状态选择器 | 写死 `active` | 功能缺失 | LOW |
| `output_format` | `outputFormat` | ✅ 有标签UI | 但 payload 未包含此字段 → 始终存默认值 `"纯文本"` | 参见 F-001 | HIGH |
| `boundary` | `boundary` | ✅ 有文本框UI | 但 payload 未包含此字段 → 始终存空字符串 | 参见 F-002 | HIGH |
| `memory_turns` | `memoryTurns` | ✅ 有数字输入框 | payload 未包含 → 始终存默认值 0 | 参见 F-004/F-003 | HIGH |
| `temperature_override` | `temperatureOverride` | ✅ 有数字输入框 | 前端变量 `temp` 未使用 → 始终为 null | 参见 F-004 | MEDIUM |

---

### 1.3 后端路由 vs Service 层字段不一致

| 字段 | 路由 Schema（agents.ts） | Service 接口（AgentService.ts） | 数据库 DDL（client.ts） | 状态 |
|------|--------------------------|----------------------------------|------------------------|------|
| `outputFormat` | ✅ 定义（`z.string().default("纯文本")`） | ❌ **未出现在 Agent 接口** | ❌ **agents 表无此列** | 三层均不一致，路由接收后无法存库 |
| `boundary` | ✅ 定义（`z.string().default("")`） | ❌ **未出现在 Agent 接口** | ❌ **agents 表无此列** | 三层均不一致，路由接收后无法存库 |
| `memoryTurns` | ✅ 定义（`z.number().default(0)`） | ❌ **未出现在 Agent 接口** | ❌ **agents 表无此列** | 三层均不一致，路由接收后无法存库 |
| `temperatureOverride` | ✅ 定义（`z.number().nullable()`） | ❌ **未出现在 Agent 接口** | ❌ **agents 表无此列** | 三层均不一致，路由接收后无法存库 |

**关键发现：** 路由层（agents.ts）中已定义了 `outputFormat`、`boundary`、`memoryTurns`、`temperatureOverride` 这4个字段的 Schema 校验，但 AgentService.ts 和数据库 DDL 从未实现这4个字段的读写和存储列，导致即使前端正确传参，后端也会静默丢弃这些值。

---

## 二、数据流链路测试

### 2.1 完整链路追踪（以「能力边界 boundary」为例）

```
前端 AgentCreate.tsx
  state: boundary = "不允许回答竞品相关问题"
  handleSubmit payload: { name, systemPrompt, writingStyle, ... }
       ↓ ❌ boundary 未包含在 payload 中
  
POST /api/agents  body: { ... }（无 boundary）

后端 agents.ts 路由
  AgentSchema.safeParse(req.body)
  → boundary 字段虽在 Schema 有定义，但值为默认空字符串 ""
       ↓

AgentService.create(parsed.data)
  INSERT INTO agents (...)
  → boundary 列不存在于 SQL 语句中
  → 即使传来也被静默丢弃
       ↓

数据库 agents 表
  → 无 boundary 列
  → 数据永久丢失

结果: 用户填写的「能力边界」从未被保存
```

### 2.2 System Prompt 错误链路（memory 字段）

```
前端 AgentCreate.tsx
  state: memory = "10"  (用户输入的对话记忆轮数)
  handleSubmit payload: { systemPrompt: memory.trim() }
                                         ↑
                               实际值为字符串 "10"
       ↓

POST /api/agents  body: { systemPrompt: "10", ... }

AgentService.create({ systemPrompt: "10", ... })
  INSERT agents SET system_prompt = "10"
       ↓

AutoLLMAdapter.buildSystemPrompt(agent)
  → parts.push("10")     ← 智能体的实际 System Prompt 为 "10"
  → parts.push("写作风格：<角色设定长文本>")  ← role 被错误地存入了 writingStyle
  → parts.push("你的名字是 xxx")
       ↓

发给 LLM 的实际 System Prompt:
  "10\n\n写作风格：[用户填写的角色设定]\n\n你的名字是 xxx"

结果: LLM 收到错误且混乱的 System Prompt，角色设定实际上会生效
      但 systemPrompt 字段的真正语义（系统级别的行为指令）永久缺失
```

---

## 三、LLM 调用链测试

### 3.1 AutoLLMAdapter 调用逻辑

| 测试项 | 实现状态 | 说明 |
|--------|---------|------|
| 私有 Key 优先 | ✅ 正确 | agent.tokenApiKey 非空时优先使用 |
| 全局渠道 fallback | ✅ 正确 | token_channels 表按 priority 排序依次尝试 |
| Mock 保底 | ✅ 正确 | 所有渠道失败时触发 MockLLMAdapter |
| 上下文截断 | ✅ 已实现 | `truncateMessages` 按 token 预算裁剪历史消息 |
| 技能注入 | ✅ 已实现 | `loadAgentSkillsPrompt` 将绑定技能追加到 System Prompt |
| `outputFormat` 使用 | ❌ 未使用 | AutoLLMAdapter 和 buildSystemPrompt 均未读取此字段 |
| `boundary` 使用 | ❌ 未使用 | buildSystemPrompt 未将能力边界注入 System Prompt |
| `memoryTurns` 使用 | ❌ 未使用 | truncateMessages 使用 token 预算裁剪，未使用轮数限制 |
| `temperatureOverride` 使用 | ❌ 未使用 | temperature 直接取 agent.temperature，无覆盖逻辑 |

### 3.2 buildSystemPrompt 当前拼接内容

```
[agent.systemPrompt]        ← 实际存的是用户输入的"对话记忆轮数"数字字符串
[写作风格: agent.writingStyle] ← 实际存的是用户输入的"角色设定"长文本
[专业领域: agent.expertise.join("、")]  ← ✅ 正确
[你的名字是 {name}]           ← ✅ 正确
[可用技能: ...]               ← ✅ 正确（若已绑定技能）
```

**语义期望 vs 实际差异：**
- 期望：`systemPrompt` = 用户定义的系统级行为指令
- 实际：`systemPrompt` = 用户填的对话记忆轮数（如 "10"）
- 期望：`writingStyle` = 语言风格标签（如 "极简简洁"）
- 实际：`writingStyle` = 用户填写的角色设定长文本

---

## 四、前端类型定义测试

### 4.1 frontend/src/types/index.ts vs 前端实际使用字段

| 类型字段 | 类型定义有 | AgentCreate 实际用 | AgentService 有 | 数据库有 | 一致性 |
|---------|-----------|-------------------|----------------|---------|------|
| `outputFormat` | ✅ | ✅（变量名 outputFmt） | ❌ | ❌ | ❌ 三层不一致 |
| `boundary` | ✅ | ✅ | ❌ | ❌ | ❌ 三层不一致 |
| `memoryTurns` | ✅ | ✅（变量名 memory，但是数字被当字符串用） | ❌ | ❌ | ❌ 三层不一致 |
| `temperatureOverride` | ✅ | ✅（变量名 temp，但未使用） | ❌ | ❌ | ❌ 三层不一致 |
| `systemPrompt` | ✅ | ⚠️ 误用（存了 memory 的值） | ✅ | ✅ | ⚠️ 语义错误 |
| `writingStyle` | ✅ | ⚠️ 误用（存了 role 的值） | ✅ | ✅ | ⚠️ 语义错误 |
| `color` | ✅ | ❌ 无UI，写死 #6366f1 | ✅ | ✅ | ⚠️ 功能缺失 |

---

## 五、需要修复的文件清单

### 需修改的文件（按优先级排序）

#### P0 — 数据丢失类（必须修）

**1. `backend/src/db/client.ts`**
- 在 `agents` 表 DDL 中增加以下列：
  ```sql
  output_format TEXT NOT NULL DEFAULT '纯文本'
  boundary TEXT NOT NULL DEFAULT ''
  memory_turns INTEGER NOT NULL DEFAULT 0
  temperature_override REAL
  ```
- 在 migration 段增加对应 `ALTER TABLE agents ADD COLUMN ...` 语句（幂等）

**2. `backend/src/services/AgentService.ts`**
- 在 `Agent` interface 增加字段：`outputFormat`, `boundary`, `memoryTurns`, `temperatureOverride`
- 在 `rowToAgent()` 中增加字段映射
- 在 `create()` 的 INSERT SQL 和参数数组中增加4个字段
- 在 `update()` 的 UPDATE SQL 和参数数组中增加4个字段

**3. `frontend/src/pages/AgentCreate.tsx`**
- `handleSubmit` 的 payload 中增加：
  ```ts
  outputFormat: outputFmt,
  boundary: boundary.trim(),
  memoryTurns: Number(memory) || 0,
  temperatureOverride: temp !== '' ? Number(temp) : null,
  ```
- 修正 `systemPrompt` 映射：需要增加一个真正的 systemPrompt 输入框，或明确某个已有字段对应（当前无任何字段正确填充 systemPrompt）
- 修正 `writingStyle` 映射：`writingStyle: style`（只用语言风格标签，不要用 role）
- `role`（角色设定）应单独存为 `systemPrompt`（或新增字段）

**4. `frontend/src/pages/AgentCreate.tsx` — 编辑回填**
- `fillForm()` 中增加从 agent 对象回填：
  ```ts
  setOutputFmt(agent.outputFormat ?? '纯文本')
  setBoundary(agent.boundary ?? '')
  setMemory(String(agent.memoryTurns ?? ''))
  setTemp(agent.temperatureOverride != null ? String(agent.temperatureOverride) : '')
  ```
  当前 `setBoundary('')` 写死为空，每次编辑都会覆盖已保存的 boundary

#### P1 — 功能无效类（建议修）

**5. `backend/src/services/llm/AutoLLMAdapter.ts`**
- `buildSystemPrompt()` 中注入 `boundary` 和 `outputFormat`：
  ```ts
  if (agent.boundary) parts.push(`你不能做的事：${agent.boundary}`)
  if (agent.outputFormat && agent.outputFormat !== '纯文本')
    parts.push(`输出格式要求：${agent.outputFormat}`)
  ```
- `truncateMessages()` 增加基于 `memoryTurns` 的轮数裁剪逻辑
- `generateStream()` 增加 `temperatureOverride` 覆盖逻辑：
  ```ts
  const temperature = agentConfig.temperatureOverride ?? agentConfig.temperature ?? 0.7
  ```

#### P2 — 体验优化类（可选修）

**6. `frontend/src/pages/AgentCreate.tsx` — 颜色选择**
- 增加颜色选择器 UI（当前 `color` 写死 `#6366f1`，数据库支持存储但没有入口）

---

## 六、测试结论汇总

```
总缺陷数: 15项
├── CRITICAL (数据完全损坏): 2项
│   ├── [F-003] systemPrompt 字段被错误值覆盖
│   └── [F-005] writingStyle 字段存了角色设定长文本
├── HIGH (数据静默丢失): 5项
│   ├── [F-001] outputFormat 前端选择后端不存
│   ├── [F-002] boundary 前端输入后端不存
│   ├── 后端 Service 层未实现4个新字段的读写
│   ├── 数据库 DDL 缺少4个字段的列定义
│   └── 编辑回填时 boundary 始终被重置为空
├── MEDIUM (功能无效): 4项
│   ├── [F-004] temp 变量完全未使用
│   ├── outputFormat 未注入 LLM System Prompt
│   ├── boundary 未注入 LLM System Prompt
│   └── memoryTurns 未影响上下文裁剪逻辑
└── LOW (UI功能缺失): 4项
    ├── color 颜色选择器缺失
    ├── status 状态选择器缺失
    ├── 编辑时 temp 无回填
    └── 编辑时 outputFmt 无回填

可正常运行的功能:
✅ 智能体名称/描述/技能绑定
✅ 模型渠道选择与参数（temperature/maxTokens/topP 等）
✅ Token API Key 配置与存储
✅ LLM 调用链（私有Key优先 → 全局渠道 → Mock保底）
✅ 上下文 Token 裁剪
✅ 技能描述注入 System Prompt
```

---

## 七、修复建议执行顺序

```
Step 1: 修改 backend/src/db/client.ts       → 数据库加4列 + 迁移语句
Step 2: 修改 backend/src/services/AgentService.ts → Service读写同步更新
Step 3: 修改 frontend/src/pages/AgentCreate.tsx   → 修正payload映射 + 回填逻辑
Step 4: 修改 backend/src/services/llm/AutoLLMAdapter.ts → 新字段注入LLM
Step 5: (可选) frontend AgentCreate.tsx 增加颜色选择器
```

---
*本报告由自动化代码分析生成，覆盖静态代码测试。如需运行时测试，请启动后端服务后通过 test_api.js 补充接口实测。*
