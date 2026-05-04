import express from 'express';
import { logger } from '../utils/logger';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { REPACECLAW_MESSAGE_CHANNEL, resolveOpenClawGateway } from '../utils/openclawGateway';

// ==================== 类型定义 ====================

interface Agent {
  id: string;
  name: string;
  avatar: string;
  personality: string;
  model: string;
  responseStyle: string;
  replyProbability: number; // 回复概率 0-1
}

interface Message {
  id: string;
  roomId: string;
  senderType: 'human' | 'agent';
  senderId: string;
  senderName: string;
  content: string;
  replyTo?: string;
  createdAt: Date;
}

interface ChatRoom {
  id: string;
  name: string;
  members: { type: 'human' | 'agent'; id: string }[];
  messages: Message[];
  mode: 'round_robin' | 'all_respond' | 'mention_only';
  roundRobinIndex: number;
  maxConsecutiveAgentReplies: number;
}

// ==================== 模拟 Agent 配置 ====================

const AGENTS: Agent[] = [
  {
    id: 'agent_1',
    name: '小明',
    avatar: '🧑‍💻',
    personality: '你是一个热情的程序员，喜欢讨论技术，说话带点极客幽默。',
    model: 'qwen3.6-plus',
    responseStyle: 'technical',
    replyProbability: 0.7,
  },
  {
    id: 'agent_2',
    name: '小红',
    avatar: '👩‍🎨',
    personality: '你是一个创意设计师，关注用户体验和美学，偶尔会发散思维。',
    model: 'qwen3.6-plus',
    responseStyle: 'creative',
    replyProbability: 0.6,
  },
  {
    id: 'agent_3',
    name: '老王',
    avatar: '👨‍💼',
    personality: '你是一个产品经理，关注业务价值和用户需求，说话务实。',
    model: 'qwen3.6-plus',
    responseStyle: 'business',
    replyProbability: 0.5,
  },
];

// ==================== 内存存储（生产环境换成数据库） ====================

const rooms = new Map<string, ChatRoom>();

// ==================== LLM 调用 ====================

async function callLLM(
  model: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const { url: gatewayUrl, token: gatewayToken } = resolveOpenClawGateway();
  const response = await fetch(`${gatewayUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${gatewayToken}`,
      'x-openclaw-message-channel': REPACECLAW_MESSAGE_CHANNEL,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.8,
      max_tokens: 500,
      stream: false,
    }),
  });

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || '...';
}

// ==================== 消息路由逻辑 ====================

function decideResponders(
  room: ChatRoom,
  message: Message
): string[] {
  const agentMembers = room.members
    .filter((m) => m.type === 'agent')
    .map((m) => m.id);

  // 检查连续 Agent 回复次数
  const recentMessages = room.messages.slice(-room.maxConsecutiveAgentReplies);
  const consecutiveAgentReplies = recentMessages.every(
    (m) => m.senderType === 'agent'
  );

  if (consecutiveAgentReplies && recentMessages.length >= room.maxConsecutiveAgentReplies) {
    return []; // 防止无限对话
  }

  switch (room.mode) {
    case 'mention_only': {
      // 只回复被 @ 的
      const mentionedIds = agentMembers.filter((id) =>
        message.content.includes(`@${AGENTS.find((a) => a.id === id)?.name}`)
      );
      return mentionedIds;
    }

    case 'round_robin': {
      const agentId = agentMembers[room.roundRobinIndex % agentMembers.length];
      room.roundRobinIndex++;
      return [agentId];
    }

    case 'all_respond':
    default: {
      // 概率性回复
      return agentMembers.filter((id) => {
        const agent = AGENTS.find((a) => a.id === id);
        return agent && Math.random() < agent.replyProbability;
      });
    }
  }
}

// ==================== 构建 Agent Prompt ====================

function buildAgentPrompt(
  agent: Agent,
  room: ChatRoom,
  newMessage: Message
): { systemPrompt: string; contextMessages: { role: string; content: string }[] } {
  const memberNames = room.members.map((m) => {
    if (m.type === 'agent') return AGENTS.find((a) => a.id === m.id)?.name;
    return '用户';
  }).filter(Boolean);

  const systemPrompt = `你是 "${agent.name}"，正在一个群聊中。
${agent.personality}

当前参与者：${memberNames.join('、')}

规则：
1. 保持角色一致性
2. 回复简洁自然，像真人聊天（1-3句话）
3. 可以引用其他成员的消息
4. 不要暴露你是 AI
5. 如果话题与你无关，可以不回复`;

  const contextMessages = room.messages.slice(-15).map((m) => ({
    role: m.senderType === 'human' ? 'user' : 'assistant',
    content: `${m.senderName}: ${m.content}`,
  }));

  contextMessages.push({
    role: 'user',
    content: `${newMessage.senderName}: ${newMessage.content}`,
  });

  return { systemPrompt, contextMessages };
}

// ==================== 核心服务 ====================

class GroupChatService {
  async createRoom(
    name: string,
    agentIds: string[],
    mode: ChatRoom['mode'] = 'all_respond'
  ): Promise<ChatRoom> {
    const room: ChatRoom = {
      id: uuidv4(),
      name,
      members: [
        ...agentIds.map((id) => ({ type: 'agent' as const, id })),
      ],
      messages: [],
      mode,
      roundRobinIndex: 0,
      maxConsecutiveAgentReplies: 3,
    };
    rooms.set(room.id, room);
    return room;
  }

  async sendMessage(
    roomId: string,
    userId: string,
    content: string
  ): Promise<{ userMessage: Message; agentMessages: Message[] }> {
    const room = rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    // 创建用户消息
    const userMessage: Message = {
      id: uuidv4(),
      roomId,
      senderType: 'human',
      senderId: userId,
      senderName: '用户',
      content,
      createdAt: new Date(),
    };
    room.messages.push(userMessage);

    // 决定哪些 Agent 回复
    const responderIds = decideResponders(room, userMessage);

    // 并行触发 Agent 回复
    const agentMessages = await Promise.all(
      responderIds.map(async (agentId) => {
        const agent = AGENTS.find((a) => a.id === agentId);
        if (!agent) return null;

        const { systemPrompt, contextMessages } = buildAgentPrompt(
          agent,
          room,
          userMessage
        );

        const replyContent = await callLLM(
          agent.model,
          systemPrompt,
          contextMessages
        );

        const agentMessage: Message = {
          id: uuidv4(),
          roomId,
          senderType: 'agent',
          senderId: agent.id,
          senderName: agent.name,
          content: replyContent,
          createdAt: new Date(),
        };
        room.messages.push(agentMessage);
        return agentMessage;
      })
    );

    return {
      userMessage,
      agentMessages: agentMessages.filter(Boolean) as Message[],
    };
  }

  getRoom(roomId: string): ChatRoom | undefined {
    return rooms.get(roomId);
  }

  listRooms(): ChatRoom[] {
    return Array.from(rooms.values());
  }
}

// ==================== Express + WebSocket 服务器 ====================

const app = express();
app.use(express.json());

const chatService = new GroupChatService();

const server = app.listen(3001, () => {
  logger.info('Group Chat Server running on port 3001');
});

const wss = new WebSocketServer({ server });
const roomClients = new Map<string, Set<WebSocket>>();

wss.on('connection', (ws) => {
  let currentRoomId: string | null = null;

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'join') {
        currentRoomId = msg.roomId;
        if (!roomClients.has(currentRoomId)) {
          roomClients.set(currentRoomId, new Set());
        }
        roomClients.get(currentRoomId)!.add(ws);

        // 发送历史消息
        const room = chatService.getRoom(currentRoomId);
        if (room) {
          ws.send(JSON.stringify({ type: 'history', messages: room.messages }));
        }
        return;
      }

      if (msg.type === 'message' && currentRoomId) {
        const result = await chatService.sendMessage(
          currentRoomId,
          msg.userId || 'anonymous',
          msg.content
        );

        // 广播所有消息
        const clients = roomClients.get(currentRoomId);
        if (clients) {
          const broadcast = (m: Message) =>
            clients.forEach((c) =>
              c.send(JSON.stringify({ type: 'message', data: m }))
            );

          broadcast(result.userMessage);
          result.agentMessages.forEach(broadcast);
        }
      }
    } catch (err) {
      logger.error('Error:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomId) {
      roomClients.get(currentRoomId)?.delete(ws);
    }
  });
});

// ==================== REST API ====================

app.post('/api/rooms', async (req, res) => {
  const { name, agentIds, mode } = req.body;
  const room = await chatService.createRoom(name, agentIds, mode);
  res.json(room);
});

app.get('/api/rooms', (req, res) => {
  res.json(chatService.listRooms());
});

app.get('/api/agents', (req, res) => {
  res.json(AGENTS);
});

export { app, server, wss, GroupChatService };
