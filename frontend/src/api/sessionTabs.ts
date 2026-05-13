/**
 * Session Tabs API 客户端
 */
import apiClient from './client';

export interface SessionTabRecord {
  id: string;
  user_id: string;
  browser_tab_key: string;
  title: string;
  conversation_id: string;
  agent_id: string;
  agent_name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export const sessionTabsApi = {
  /** 获取用户所有 session tabs */
  async list(): Promise<SessionTabRecord[]> {
    const res = await apiClient.get('/session-tabs');
    return res.data?.data || [];
  },

  /** 创建或更新单个 tab */
  async upsert(data: {
    browser_tab_key: string;
    title: string;
    conversation_id?: string;
    agent_id?: string;
    agent_name?: string;
    color?: string;
  }): Promise<SessionTabRecord> {
    const res = await apiClient.post('/session-tabs/upsert', data);
    return res.data?.data;
  },

  /** 批量保存所有 tabs */
  async batch(tabs: Array<{
    browser_tab_key: string;
    title: string;
    conversation_id?: string;
    agent_id?: string;
    agent_name?: string;
    color?: string;
  }>): Promise<SessionTabRecord[]> {
    const res = await apiClient.post('/session-tabs/batch', { tabs });
    return res.data?.data || [];
  },

  /** 删除指定 tab */
  async remove(browserTabKey: string): Promise<void> {
    await apiClient.delete(`/session-tabs/${browserTabKey}`);
  },
};
