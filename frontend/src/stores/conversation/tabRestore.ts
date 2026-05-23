/**
 * tabRestore.ts - TAB 恢复逻辑
 * 
 * 职责：
 * - 从后端恢复会话 TAB 列表
 * - 保持 TAB 顺序稳定（微信助手固定最左，其余按 last_message_at 倒序）
 * - 一次性设置，避免闪烁
 * 
 * 排序规则：
 * 1. 微信助手（固定第一位）
 * 2. 其余会话按 last_message_at 倒序（最近活跃的在左）
 */

import { Conversation, Message } from "../../types";
import { conversationsApi } from "../../api/conversations";

// 平台助手 / 微信助手 ID 集合
const PLATFORM_ASSISTANT_IDS = new Set([
  'platform-assistant',
  'repaceclaw-platform-assistant',
  '24cf6cc5-da0d-48df-814e-11582e398007',
]);
const WECHAT_ASSISTANT_IDS = new Set(['rc-wechat-agent']);

export function isGlobalAssistant(input: {
  agentId?: string | null;
  title?: string | null;
}) {
  const agentId = input.agentId || '';
  return (agentId && (PLATFORM_ASSISTANT_IDS.has(agentId) || WECHAT_ASSISTANT_IDS.has(agentId)))
    || input.title === 'RepaceClaw 平台助手'
    || input.title === '微信助手';
}

export interface PanelData {
  id: string;
  conversationId: string;
  sessionCode?: string;
  agentId: string;
  currentAgentCode?: string;
  agentIds: string[];
  agentName: string;
  agentColor: string;
  messages: Message[];
  isStreaming: boolean;
}

export interface TabData {
  id: string;
  type: 'home' | 'session' | 'wechat';
  title: string;
  panelId: string;
  color: string;
  conversationId: string;
  sessionCode?: string;
  agentId?: string;
  currentAgentCode?: string;
  agentName?: string;
  agentColor?: string;
}
export interface RestoreResult {
  panels: PanelData[];
  tabs: TabData[];
  activeTabId: string;
}

/**
 * 构建单个会话的 panel + tab
 * 优先从 sessionStorage 缓存恢复消息
 */
export async function buildPanelAndTab(
  convId: string,
  conv: Conversation | undefined,
  agents: any[],
  onCacheUpdate?: (convId: string, messages: Message[]) => void
): Promise<{ panel: PanelData; tab: TabData } | null> {
  let messages: Message[] = [];
  let usedCache = false;

  // 优先从 sessionStorage 缓存恢复
  try {
    const cached = sessionStorage.getItem(`rc:msg-cache:${convId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      messages = parsed.messages || [];
      usedCache = true;
    }
  } catch (e) { console.warn("[RC]", e); }

  if (!usedCache) {
    messages = await conversationsApi.getMessages(convId);
  }

  if (!messages || messages.length === 0) return null;

  const agentId = conv?.currentAgentId || conv?.agentId || conv?.agentIds?.[0] || '';
  const agent = agents.find((a: any) => a.id === agentId);
  const agentName = agent?.name || conv?.title || '会话';
  const agentColor = agent?.color || '#6366f1';

  const panel: PanelData = {
    id: convId, conversationId: convId, sessionCode: conv?.sessionCode,
    agentId: agentId || '', currentAgentCode: conv?.currentAgentCode,
    agentIds: conv?.agentIds?.length ? conv.agentIds : (agentId ? [agentId] : []),
    agentName, agentColor, messages, isStreaming: false,
  };

  const tab: TabData = {
    id: convId, type: 'session', title: conv?.title || agentName,
    panelId: convId, color: agentColor, conversationId: convId,
    sessionCode: conv?.sessionCode, agentId, currentAgentCode: conv?.currentAgentCode, agentName,
  };

  // 缓存命中后，后台增量更新
  if (usedCache && onCacheUpdate) {
    conversationsApi.getMessages(convId).then(freshMsgs => {
      if (freshMsgs?.length > 0) onCacheUpdate(convId, freshMsgs);
    }).catch(() => {});
  }

  return { panel, tab };
}

/**
 * 恢复所有 TAB
 * 
 * 策略：
 * 1. 一次性获取所有进行中的会话（active + in_progress）
 * 2. 微信助手固定第一位
 * 3. 其余会话按 last_message_at 倒序
 * 4. 一次性设置，不分批加载
 */
export async function restoreTabs(
  agents: any[],
  onCacheUpdate: (convId: string, messages: Message[]) => void
): Promise<RestoreResult> {
  // 并行获取：所有进行中会话 + 微信助手
  const [allConvs, wechatConv] = await Promise.all([
    conversationsApi.list(undefined, 'in_progress').catch(() => [] as Conversation[]),
    conversationsApi.getWechatAssistant().catch(() => null),
  ]);

  const panels: PanelData[] = [];
  const tabs: TabData[] = [];
  let activeTabId = '';

  // ① 微信助手固定第一位
  if (wechatConv?.id) {
    const wechatMessages = wechatConv.messages || 
      await conversationsApi.getMessages(wechatConv.id).catch(() => [] as Message[]);
    panels.push({
      id: wechatConv.id, conversationId: wechatConv.id,
      agentId: 'rc-wechat-agent', agentIds: ['rc-wechat-agent'],
      agentName: '微信助手', agentColor: '#2563eb',
      messages: wechatMessages || [], isStreaming: false,
    });
    tabs.push({
      id: 'wechat', type: 'wechat', title: '微信助手',
      panelId: wechatConv.id, conversationId: wechatConv.id, color: '#2563eb',
      agentId: 'rc-wechat-agent', agentName: '微信助手', agentColor: '#2563eb',
    });
  }

  // ② 过滤掉全局助手，保留普通会话
  const normalConvs = allConvs.filter(c => 
    !isGlobalAssistant({ agentId: c.currentAgentId || c.agentIds?.[0], title: c.title })
  );

  // ③ 并行构建所有普通会话的 panel + tab
  const results = await Promise.all(
    normalConvs.map(conv => buildPanelAndTab(conv.id, conv, agents, onCacheUpdate).catch(() => null))
  );

  // ④ 按原始顺序（后端 last_message_at DESC）追加
  for (let i = 0; i < normalConvs.length; i++) {
    const result = results[i];
    if (result) {
      panels.push(result.panel);
      tabs.push(result.tab);
    }
  }

  // ⑤ 确定 activeTabId
  // 优先：后端标记为 active 的会话
  const activeConv = allConvs.find(c => c.status === 'active');
  if (activeConv && tabs.some(t => t.conversationId === activeConv.id)) {
    activeTabId = tabs.find(t => t.conversationId === activeConv.id)!.id;
  }

  // 兜底：从 sessionStorage 恢复
  if (!activeTabId) {
    const lastActive = sessionStorage.getItem('rc:last-active-conv');
    if (lastActive && tabs.some(t => t.conversationId === lastActive)) {
      activeTabId = tabs.find(t => t.conversationId === lastActive)!.id;
      conversationsApi.updateStatus(lastActive, 'active').catch(() => {});
    }
  }

  // 最终兜底：微信助手
  if (!activeTabId && tabs.length > 0) {
    activeTabId = tabs[0].id;
    if (wechatConv?.id) {
      conversationsApi.updateStatus(wechatConv.id, 'active').catch(() => {});
    }
  }

  return { panels, tabs, activeTabId };
}
