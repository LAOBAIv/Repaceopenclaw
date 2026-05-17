import apiClient from "./client";

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  /** 账号标识：支持邮箱或用户名 */
  identifier: string;
  password: string;
}

export interface UpdateMeInput {
  username?: string;
  avatar?: string;
  nickname?: string;  // [2026-05-17] 账号昵称
}

export const authApi = {
  register: (data: RegisterInput) =>
    apiClient.post("/auth/register", data).then((r) => r.data),

  login: (data: LoginInput) =>
    apiClient.post("/auth/login", data).then((r) => r.data),

  me: () =>
    apiClient.get("/auth/me").then((r) => r.data),

  updateMe: (data: UpdateMeInput) =>
    apiClient.put("/auth/me", data).then((r) => r.data),

  changePassword: (oldPassword: string, newPassword: string) =>
    apiClient.put("/auth/password", { oldPassword, newPassword }).then((r) => r.data),

  // [2026-05-17] 管理员重置用户密码
  resetPassword: (userId: string, newPassword: string) =>
    apiClient.put(`/auth/users/${userId}/reset-password`, { newPassword }).then((r) => r.data),

  listUsers: () =>
    apiClient.get("/auth/users").then((r) => r.data),

  updateUser: (id: string, data: { role?: string; status?: string }) =>
    apiClient.put(`/auth/users/${id}`, data).then((r) => r.data),
};
