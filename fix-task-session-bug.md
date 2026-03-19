# 修复任务-会话关联 Bug

## 问题描述
1. 新建任务后，任务栏顶部的 tag 没有更新
2. 任务ID、会话ID、用户ID、智能体ID 没有正确关联
3. 项目/任务升级降级时，ID 应该保持一致（只改变类型，不改变数字）

## 已完成的修改

### 1. taskStore.ts - 扩展 Task 类型
添加了以下字段：
- baseId: 基础ID，用于项目/任务升级降级时保持一致
- agentIds: 智能体ID列表
- sessionIds: 关联的会话ID列表
- isProject: 是否为项目
- projectId: 项目ID
- userId: 创建者用户ID

### 2. CreateTaskModal.tsx - 修复创建逻辑
- 使用统一的 baseId 生成任务ID
- 创建任务时自动关联 sessionIds
- 添加 ID 作为 tag，便于任务栏更新

## 待完成的修改

### 3. conversationStore.ts
- 修改 openPanel 方法，返回创建的 panelId
- 确保会话创建后能正确关联到任务

### 4. AgentKanban.tsx
- 确保任务列表能正确显示新创建的任务
- 检查 tag 更新逻辑

## 关联关系设计

```
任务/项目 (Task/Project)
├── id: task_{baseId} 或 proj_{baseId}
├── baseId: 统一的基础ID
├── agentIds: [agentId1, agentId2, ...]
├── sessionIds: [sessionId1, sessionId2, ...]
├── userId: 创建者ID
├── isProject: true/false
└── projectId: 项目ID（如果是项目）

会话 (Session/Panel)
├── id: sessionId
├── taskId: 关联的任务ID
├── agentId: 智能体ID
├── userId: 用户ID
└── projectId: 项目ID
```

## 升级降级逻辑

当任务升级为项目时：
1. 保持 baseId 不变
2. id 从 task_{baseId} 改为 proj_{baseId}
3. isProject 从 false 改为 true
4. 保留所有关联的 sessionIds 和 agentIds

当项目降级为任务时：
1. 保持 baseId 不变
2. id 从 proj_{baseId} 改为 task_{baseId}
3. isProject 从 true 改为 false
4. 保留主智能体，其他智能体转为协作记录
