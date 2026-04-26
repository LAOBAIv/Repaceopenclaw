# 多 AI 群聊系统设计文档

## 一、架构概述

### 数据模型
```
user_id → room_id → agent_id → session_id（四级隔离）
```

### 核心流程
```
用户发消息 → WebSocket → 后端路由 → 决定哪些 Agent 回复 → 并行调用 LLM → 返回消息到群聊
```

## 二、数据库设计

### 表结构

```sql
-- 群聊房间
CREATE TABLE chat_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  mode TEXT DEFAULT 'round_robin',  -- round_robin | all_respond | mention_only
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 房间成员（人类 + AI）
CREATE TABLE room_members (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  member_type TEXT NOT NULL,  -- human | agent
  member_id TEXT NOT NULL,    -- user_id 或 agent_id
  role TEXT DEFAULT 'member', -- admin | member
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(room_id, member_type, member_id)
);

-- AI 角色配置
CREATE TABLE ai_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT,
  personality TEXT,          -- 人格设定 prompt
  model TEXT DEFAULT 'qwen3.6-plus',
  response_style TEXT,       -- 回复风格
  enabled BOOLEAN DEFAULT 1
);

-- 群聊消息
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  sender_type TEXT NOT NULL,  -- human | agent
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  reply_to TEXT,             -- 引用的消息 ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Agent 会话记录（用于上下文）
CREATE TABLE agent_sessions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  session_data TEXT,         -- JSON: 消息历史
  last_active DATETIME,
  UNIQUE(room_id, agent_id)
);
```

## 三、后端实现

### 3.1 消息路由策略

```typescript
// 三种模式
enum ResponseMode {
  ROUND_ROBIN = 'round_robin',   // 轮流发言
  ALL_RESPOND = 'all_respond',   // 所有 Agent 都回复
  MENTION_ONLY = 'mention_only'  // 仅被 @ 的回复
}
```

### 3.2 核心服务

```typescript
// services/GroupChatService.ts
class GroupChatService {
  // 1. 创建群聊
  async createRoom(userId: string, name: string, agentIds: string[]): Promise<ChatRoom>

  // 2. 发送消息并触发 AI 回复
  async sendMessage(roomId: string, userId: string, content: string): Promise<Message[]>

  // 3. 决定哪些 Agent 需要回复
  private async decideResponders(roomId: string, message: Message): Promise<string[]>

  // 4. 并行调用多个 Agent
  private async triggerAgentResponses(roomId: string, message: Message, agentIds: string[]): Promise<Message[]>

  // 5. 构建 Agent 的上下文 prompt
  private async buildAgentPrompt(roomId: string, agentId: string, newMessage: Message): Promise<ChatCompletionMessage[]>
}
```

### 3.3 Agent 回复触发

```typescript
// 触发逻辑
async function triggerAgentReply(roomId: string, agentId: string, context: ChatCompletionMessage[]): Promise<string> {
  const agent = await getAgent(agentId);
  const room = await getRoom(roomId);

  // 构建系统 prompt（注入人格）
  const systemPrompt = `
你是 "${agent.name}"，正在一个群聊中。
${agent.personality}

群聊模式：${room.mode}
当前参与者：${await getRoomMembers(roomId)}

规则：
1. 保持角色一致性
2. 回复简洁自然，像真人聊天
3. 可以引用其他成员的消息
4. 不要暴露你是 AI
`;

  // 调用 LLM
  const response = await callLLM({
    model: agent.model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...context.slice(-20) // 最近 20 条消息作为上下文
    ]
  });

  return response.content;
}
```

## 四、前端实现

### 4.1 组件结构
```
src/
├── components/
│   ├── GroupChat/
│   │   ├── ChatRoom.tsx        # 群聊主界面
│   │   ├── MessageBubble.tsx   # 消息气泡（区分角色）
│   │   ├── MemberList.tsx      # 成员列表
│   │   ├── CreateRoomModal.tsx # 创建群聊弹窗
│   │   └── AgentSelector.tsx   # AI 角色选择器
```

### 4.2 WebSocket 连接
```typescript
// hooks/useGroupChat.ts
function useGroupChat(roomId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const ws = useRef<WebSocket>();

  useEffect(() => {
    ws.current = new WebSocket(`ws://localhost:3001/ws/room/${roomId}`);

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages(prev => [...prev, message]);
    };

    return () => ws.current?.close();
  }, [roomId]);

  const sendMessage = (content: string) => {
    ws.current?.send(JSON.stringify({ type: 'message', content }));
  };

  return { messages, sendMessage };
}
```

## 五、部署方案

```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=file:./data/chat.db
      - LLM_API_URL=https://e.linkh5.cn/v1

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
```

## 六、关键设计点

### 1. 避免 AI 无限对话
- 设置最大回复轮次（默认 3 轮）
- 人类用户发送新消息可打断
- Agent 可以选择不回复（概率控制）

### 2. 上下文管理
- 每个 Agent 维护独立的会话上下文
- 消息历史截断（最近 N 条）
- 可选：向量数据库做语义检索相关历史

### 3. 并发控制
- 多个 Agent 并行调用 LLM（Promise.all）
- 回复按到达顺序显示（或加随机延迟模拟真人节奏）

### 4. 成本控制
- 可配置每个 Agent 的模型
- 消息长度限制
- 调用频率限制
