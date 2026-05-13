import { create } from 'zustand';

export type ChannelType = 'text' | 'voice' | 'announcement' | 'task';

export interface Channel {
  id: string;
  groupId: string;
  name: string;
  type: ChannelType;
  description?: string;
  agentIds: string[];
  conversationId?: string;
  unreadCount: number;
  lastMessage?: string;
  lastMessageAt?: string;
  icon?: string;
  isPinned?: boolean;
  createdAt: string;
}

export interface ChannelGroup {
  id: string;
  name: string;
  isExpanded: boolean;
  order: number;
}

export interface ChannelMessage {
  id: string;
  channelId: string;
  conversationId?: string;
  role: 'user' | 'agent';
  content: string;
  agentId?: string;
  agentName?: string;
  agentColor?: string;
  createdAt: string;
  streaming?: boolean;
}

interface ChannelStore {
  groups: ChannelGroup[];
  channels: Channel[];
  activeChannelId: string | null;
  messagesMap: Record<string, ChannelMessage[]>;
  isStreaming: Record<string, boolean>;
  streamingContent: Record<string, string>;
  showMemberPanel: boolean;

  setActiveChannel: (channelId: string) => void;
  toggleGroup: (groupId: string) => void;
  toggleMemberPanel: () => void;
  addGroup: (name: string) => string;
  addChannel: (opts: { groupId: string; name: string; type?: ChannelType; description?: string; agentIds?: string[]; icon?: string }) => string;
  updateChannel: (channelId: string, patch: Partial<Channel>) => void;
  deleteChannel: (channelId: string) => void;
  addMessage: (channelId: string, message: ChannelMessage) => void;
  loadMessages: (channelId: string, messages: ChannelMessage[]) => void;
  startStreaming: (channelId: string, messageId: string) => void;
  appendChunk: (channelId: string, messageId: string, chunk: string) => void;
  finishStreaming: (channelId: string, messageId: string, finalMessage: ChannelMessage) => void;
  markRead: (channelId: string) => void;
  initDefaultChannels: () => void;
}

const DEFAULT_GROUPS: ChannelGroup[] = [
  { id: 'grp-general', name: '通用', isExpanded: true, order: 0 },
  { id: 'grp-ai', name: '智能体频道', isExpanded: true, order: 1 },
  { id: 'grp-project', name: '项目协作', isExpanded: true, order: 2 },
  { id: 'grp-private', name: '私人频道', isExpanded: false, order: 3 },
];

const DEFAULT_CHANNELS: Channel[] = [
  { id: 'ch-welcome', groupId: 'grp-general', name: '欢迎大厅', type: 'announcement', description: '新成员欢迎频道，查看项目介绍', agentIds: [], unreadCount: 0, icon: '👋', isPinned: true, createdAt: new Date().toISOString() },
  { id: 'ch-general', groupId: 'grp-general', name: '通用讨论', type: 'text', description: '自由讨论任意话题', agentIds: [], unreadCount: 2, lastMessage: '今天的任务进展如何？', lastMessageAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), icon: '💬', createdAt: new Date().toISOString() },
  { id: 'ch-writer', groupId: 'grp-ai', name: '写作助手', type: 'text', description: '专业写作、文案优化智能体频道', agentIds: [], unreadCount: 0, icon: '✍️', createdAt: new Date().toISOString() },
  { id: 'ch-analyst', groupId: 'grp-ai', name: '数据分析师', type: 'text', description: '数据处理、图表生成、趋势分析', agentIds: [], unreadCount: 5, lastMessage: '分析报告已生成，请查看', lastMessageAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), icon: '📊', createdAt: new Date().toISOString() },
  { id: 'ch-coder', groupId: 'grp-ai', name: '代码专家', type: 'text', description: '编程辅助、代码审查、技术方案', agentIds: [], unreadCount: 0, icon: '💻', createdAt: new Date().toISOString() },
  { id: 'ch-planning', groupId: 'grp-project', name: '项目规划', type: 'task', description: '任务拆解、里程碑跟踪', agentIds: [], unreadCount: 1, icon: '📋', createdAt: new Date().toISOString() },
  { id: 'ch-review', groupId: 'grp-project', name: '内容审核', type: 'text', description: '内容质量把关与反馈', agentIds: [], unreadCount: 0, icon: '🔍', createdAt: new Date().toISOString() },
];

export const useChannelStore = create<ChannelStore>((set, get) => ({
  groups: [],
  channels: [],
  activeChannelId: null,
  messagesMap: {},
  isStreaming: {},
  streamingContent: {},
  showMemberPanel: true,

  initDefaultChannels: () => {
    const { groups } = get();
    if (groups.length > 0) return;
    set({ groups: DEFAULT_GROUPS, channels: DEFAULT_CHANNELS, activeChannelId: 'ch-general' });
  },

  setActiveChannel: (channelId) => {
    set({ activeChannelId: channelId });
    get().markRead(channelId);
  },

  toggleGroup: (groupId) => {
    set((s) => ({
      groups: s.groups.map((g) => g.id === groupId ? { ...g, isExpanded: !g.isExpanded } : g),
    }));
  },

  toggleMemberPanel: () => set((s) => ({ showMemberPanel: !s.showMemberPanel })),

  addGroup: (name) => {
    const id = `grp-${Date.now()}`;
    set((s) => ({ groups: [...s.groups, { id, name, isExpanded: true, order: s.groups.length }] }));
    return id;
  },

  addChannel: ({ groupId, name, type = 'text', description, agentIds = [], icon }) => {
    const id = `ch-${Date.now()}`;
    const channel: Channel = { id, groupId, name, type, description, agentIds, unreadCount: 0, icon, createdAt: new Date().toISOString() };
    set((s) => ({ channels: [...s.channels, channel] }));
    return id;
  },

  updateChannel: (channelId, patch) => {
    set((s) => ({ channels: s.channels.map((c) => c.id === channelId ? { ...c, ...patch } : c) }));
  },

  deleteChannel: (channelId) => {
    set((s) => {
      const channels = s.channels.filter((c) => c.id !== channelId);
      const activeChannelId = s.activeChannelId === channelId ? (channels[0]?.id ?? null) : s.activeChannelId;
      return { channels, activeChannelId };
    });
  },

  addMessage: (channelId, message) => {
    set((s) => ({
      messagesMap: {
        ...s.messagesMap,
        [channelId]: [...(s.messagesMap[channelId] || []), message],
      },
    }));
  },

  loadMessages: (channelId, messages) => {
    set((s) => ({ messagesMap: { ...s.messagesMap, [channelId]: messages } }));
  },

  startStreaming: (channelId, messageId) => {
    const placeholder: ChannelMessage = {
      id: messageId, channelId, role: 'agent', content: '',
      createdAt: new Date().toISOString(), streaming: true,
    };
    set((s) => ({
      isStreaming: { ...s.isStreaming, [channelId]: true },
      streamingContent: { ...s.streamingContent, [channelId]: '' },
      messagesMap: { ...s.messagesMap, [channelId]: [...(s.messagesMap[channelId] || []), placeholder] },
    }));
  },

  appendChunk: (channelId, messageId, chunk) => {
    set((s) => {
      const newContent = (s.streamingContent[channelId] || '') + chunk;
      return {
        streamingContent: { ...s.streamingContent, [channelId]: newContent },
        messagesMap: {
          ...s.messagesMap,
          [channelId]: (s.messagesMap[channelId] || []).map((m) =>
            m.id === messageId ? { ...m, content: newContent } : m
          ),
        },
      };
    });
  },

  finishStreaming: (channelId, messageId, finalMessage) => {
    set((s) => ({
      isStreaming: { ...s.isStreaming, [channelId]: false },
      streamingContent: { ...s.streamingContent, [channelId]: '' },
      messagesMap: {
        ...s.messagesMap,
        [channelId]: (s.messagesMap[channelId] || []).map((m) =>
          m.id === messageId ? { ...finalMessage, streaming: false } : m
        ),
      },
    }));
  },

  markRead: (channelId) => {
    set((s) => ({
      channels: s.channels.map((c) => c.id === channelId ? { ...c, unreadCount: 0 } : c),
    }));
  },
}));
