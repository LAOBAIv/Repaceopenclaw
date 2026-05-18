import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type UserRole = "super_admin" | "admin" | "user";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: string;
  avatar: string;
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  updateUser: (data: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, token) => {
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        // [2026-05-18] 退出前记录所有打开的会话 + 激活会话，登录时恢复
        try {
          const { useConversationStore } = require('../stores/conversationStore');
          const state = useConversationStore.getState();
          const activeTab = state.sessionTabs.find((t: any) => t.id === state.activeTabId);
          const activeConvId = activeTab?.panelId || activeTab?.conversationId || '';
          // 收集所有有效会话 tab 的 ID
          const openConvIds = state.sessionTabs
            .filter((t: any) => t.panelId && t.id !== 'home' && t.id !== 'wechat' && t.panelId !== 'wechat-assistant')
            .map((t: any) => t.panelId || t.conversationId);
          localStorage.setItem('rc:last-session-state', JSON.stringify({
            activeConvId: activeConvId || '',
            openConvIds: openConvIds || [],
          }));
          useConversationStore.setState({
            openPanels: [],
            sessionTabs: [],
            activeTabId: null,
            closedSessionIds: [],
          });
        } catch {}
        set({ user: null, token: null, isAuthenticated: false });
      },

      updateUser: (data) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...data } : null,
        }));
      },
    }),
    {
      name: "repaceclaw-auth",
      // Plan C: 使用 sessionStorage 实现 tab 级隔离
      // 同一浏览器不同 tab 可以登录不同账号，关闭 tab 后自动失效
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
