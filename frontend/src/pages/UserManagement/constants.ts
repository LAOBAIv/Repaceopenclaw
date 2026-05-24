/**
 * @file constants.ts
 * @description 用户管理模块的常量定义（角色映射、状态映射）
 */

/** 角色映射表 */
export const ROLE_MAP: Record<string, { label: string; color: string; bg: string }> = {
  super_admin: { label: '超级管理员', color: '#d97706', bg: '#fef3c7' },
  admin: { label: '管理员', color: '#2563eb', bg: '#eff6ff' },
  user: { label: '普通用户', color: '#6b7280', bg: '#f3f4f6' },
};

/** 状态映射表 */
export const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: '活跃', color: '#059669', bg: '#ecfdf5' },
  disabled: { label: '禁用', color: '#dc2626', bg: '#fef2f2' },
};
