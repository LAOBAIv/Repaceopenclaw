import React, { useState, useRef, useEffect } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';

// ==================== 类型 ====================

interface Message {
  id: string;
  roomId: string;
  senderType: 'human' | 'agent';
  senderId: string;
  senderName: string;
  content: string;
  replyTo?: string;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  avatar: string;
  personality: string;
}

interface ChatRoom {
  id: string;
  name: string;
  members: { type: 'human' | 'agent'; id: string }[];
  messages: Message[];
  mode: string;
}

const AGENT_COLORS: Record<string, string> = {
  agent_1: 'bg-blue-100 border-blue-300',
  agent_2: 'bg-pink-100 border-pink-300',
  agent_3: 'bg-green-100 border-green-300',
};

const AVATAR_MAP: Record<string, string> = {
  agent_1: '🧑‍💻',
  agent_2: '👩‍🎨',
  agent_3: '👨‍💼',
};

// ==================== 消息气泡 ====================

function MessageBubble({ message }: { message: Message }) {
  const isHuman = message.senderType === 'human';
  const agentColor = AGENT_COLORS[message.senderId] || 'bg-gray-100 border-gray-300';
  const avatar = isHuman ? '😎' : AVATAR_MAP[message.senderId] || '🤖';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 p-3 rounded-xl border ${isHuman ? 'bg-white' : agentColor} max-w-2xl`}
    >
      <span className="text-2xl flex-shrink-0">{avatar}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-semibold text-sm">{message.senderName}</span>
          <span className="text-xs text-gray-400">
            {new Date(message.createdAt).toLocaleTimeString()}
          </span>
        </div>
        <p className="text-gray-800 whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </motion.div>
  );
}

// ==================== 成员列表 ====================

function MemberList({ room, agents }: { room: ChatRoom; agents: Agent[] }) {
  return (
    <div className="w-48 bg-gray-50 p-4 rounded-xl border h-full overflow-auto">
      <h3 className="font-bold text-sm mb-3 text-gray-600">成员</h3>
      <ul className="space-y-2">
        <li className="flex items-center gap-2 text-sm">
          <span>😎</span>
          <span>你</span>
        </li>
        {room.members
          .filter((m) => m.type === 'agent')
          .map((m) => {
            const agent = agents.find((a) => a.id === m.id);
            return agent ? (
              <li key={m.id} className="flex items-center gap-2 text-sm">
                <span>{agent.avatar}</span>
                <span>{agent.name}</span>
              </li>
            ) : null;
          })}
      </ul>
    </div>
  );
}

// ==================== 创建房间弹窗 ====================

interface CreateRoomProps {
  agents: Agent[];
  onCreate: (name: string, selectedAgents: string[], mode: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreateRoomModal({ agents, onCreate, open, onOpenChange }: CreateRoomProps) {
  const [name, setName] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [mode, setMode] = useState('all_respond');

  const toggleAgent = (id: string) => {
    setSelectedAgents((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleCreate = () => {
    if (name && selectedAgents.length > 0) {
      onCreate(name, selectedAgents, mode);
      setName('');
      setSelectedAgents([]);
      onOpenChange(false);
    }
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-overlayShow" />
        <RadixDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-2xl w-full max-w-md shadow-xl">
          <RadixDialog.Title className="text-lg font-bold mb-4">创建 AI 群聊</RadixDialog.Title>

          <input
            className="w-full border rounded-lg p-2 mb-4"
            placeholder="群聊名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">选择 AI 成员</label>
            <div className="space-y-2">
              {agents.map((agent) => (
                <label
                  key={agent.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedAgents.includes(agent.id)}
                    onChange={() => toggleAgent(agent.id)}
                  />
                  <span>{agent.avatar}</span>
                  <span>{agent.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">回复模式</label>
            <select
              className="w-full border rounded-lg p-2"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="all_respond">全部回复</option>
              <option value="round_robin">轮流发言</option>
              <option value="mention_only">仅 @ 回复</option>
            </select>
          </div>

          <div className="flex gap-2 justify-end">
            <RadixDialog.Close asChild>
              <button className="px-4 py-2 rounded-lg border">取消</button>
            </RadixDialog.Close>
            <button
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={!name || selectedAgents.length === 0}
              onClick={handleCreate}
            >
              创建
            </button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

// ==================== 群聊主界面 ====================

export default function GroupChat() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 加载 Agent 列表
  useEffect(() => {
    fetch('http://localhost:3001/api/agents')
      .then((r) => r.json())
      .then(setAgents);
  }, []);

  // 加载房间列表
  useEffect(() => {
    fetch('http://localhost:3001/api/rooms')
      .then((r) => r.json())
      .then(setRooms);
  }, []);

  // 创建房间
  const handleCreateRoom = async (name: string, agentIds: string[], mode: string) => {
    const res = await fetch('http://localhost:3001/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, agentIds, mode }),
    });
    const room = await res.json();
    setRooms((prev) => [...prev, room]);
    joinRoom(room);
  };

  // 加入房间
  const joinRoom = (room: ChatRoom) => {
    setCurrentRoom(room);
    setMessages([]);

    const socket = new WebSocket('ws://localhost:3001');
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'join', roomId: room.id }));
    };
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'history') {
        setMessages(data.messages);
      } else if (data.type === 'message') {
        setMessages((prev) => [...prev, data.data]);
      }
    };
    setWs(socket);
  };

  // 发送消息
  const sendMessage = () => {
    if (!input.trim() || !ws) return;
    ws.send(JSON.stringify({ type: 'message', content: input.trim() }));
    setInput('');
  };

  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 左侧：房间列表 */}
      <div className="w-64 bg-white border-r p-4 flex flex-col">
        <h2 className="font-bold text-lg mb-4">群聊列表</h2>
        <ul className="space-y-2 flex-1 overflow-auto">
          {rooms.map((room) => (
            <li
              key={room.id}
              className={`p-3 rounded-lg cursor-pointer hover:bg-gray-100 ${
                currentRoom?.id === room.id ? 'bg-blue-50' : ''
              }`}
              onClick={() => joinRoom(room)}
            >
              <div className="font-medium">{room.name}</div>
              <div className="text-xs text-gray-400">{room.members.length} 成员</div>
            </li>
          ))}
        </ul>
        <button
          className="mt-2 w-full py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => setShowCreateModal(true)}
        >
          + 新建群聊
        </button>
      </div>

      {/* 中间：聊天区 */}
      <div className="flex-1 flex flex-col">
        {currentRoom ? (
          <>
            <div className="p-4 border-b bg-white">
              <h2 className="font-bold text-lg">{currentRoom.name}</h2>
              <p className="text-sm text-gray-400">
                {currentRoom.members.filter((m) => m.type === 'agent').length} 个 AI 成员
              </p>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t flex gap-2">
              <input
                className="flex-1 border rounded-lg px-4 py-2"
                placeholder="输入消息..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button
                className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                onClick={sendMessage}
              >
                发送
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            选择或创建一个群聊开始对话
          </div>
        )}
      </div>

      {/* 右侧：成员列表 */}
      {currentRoom && <MemberList room={currentRoom} agents={agents} />}

      <CreateRoomModal
        agents={agents}
        onCreate={handleCreateRoom}
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  );
}
