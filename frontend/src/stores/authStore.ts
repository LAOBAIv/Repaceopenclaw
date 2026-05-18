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
        set({ user: null, token: null, isAuthenticated: false });
        // [2026-05-18] 退出登录时清空会话数据，避免重新登录后加载旧会话
        try {
          const { useConversationStore } = require('../stores/conversationStore');
          useConversationStore.setState({
            openPanels: [],
            sessionTabs: [],
            activeTabId: null,
            closedSessionIds: [],
          });
        } catch {}
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
