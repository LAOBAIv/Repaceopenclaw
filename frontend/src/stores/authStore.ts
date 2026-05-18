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
        // [2026-05-18] 退出前记录当前激活会话 ID，登录时只恢复这一个
        try {
          const { useConversationStore } = require('../stores/conversationStore');
          const state = useConversationStore.getState();
          const activeTab = state.sessionTabs.find((t: any) => t.id === state.activeTabId);
          const activeConvId = activeTab?.panelId || activeTab?.conversationId || '';
          if (activeConvId && activeConvId !== 'home' && activeConvId !== 'wechat-assistant') {
            localStorage.setItem('rc:last-active-conversation', activeConvId);
          } else {
            localStorage.removeItem('rc:last-active-conversation');
          }
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
