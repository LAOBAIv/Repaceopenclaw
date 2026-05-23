/**
 * useSkills - 技能加载与管理 Hook
 *
 * 职责：
 * - 管理后端技能列表加载（backendSkills）
 * - 管理技能弹窗状态（skillModalOpen, tempSkills）
 * - 提供技能选择/确认/移除等操作函数
 * - 提供技能显示名解析（skillDisplayName）
 */
import { useState, useCallback } from 'react';
import apiClient from '@/api/client';
import type { BackendSkill } from '../types';

export interface UseSkillsReturn {
  // 技能列表
  backendSkills: BackendSkill[];
  skillsLoading: boolean;
  // 弹窗状态
  skillModalOpen: boolean;
  tempSkills: string[];
  // 操作函数
  loadBackendSkills: () => Promise<void>;
  openSkillModal: (currentSkills: string[]) => void;
  closeSkillModal: () => void;
  confirmSkillModal: () => string[];
  toggleTempSkill: (id: string) => void;
  removeSkill: (currentSkills: string[], id: string) => string[];
  skillDisplayName: (id: string) => string;
}

export function useSkills(): UseSkillsReturn {
  const [backendSkills, setBackendSkills] = useState<BackendSkill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [tempSkills, setTempSkills] = useState<string[]>([]);

  // 加载真实技能列表
  const loadBackendSkills = useCallback(async () => {
    if (backendSkills.length > 0) return; // 已加载过
    setSkillsLoading(true);
    try {
      const res = await apiClient.get('/skills');
      setBackendSkills((res.data.data as BackendSkill[]).filter(s => s.enabled));
    } catch {
      // 加载失败不阻断流程
    } finally {
      setSkillsLoading(false);
    }
  }, [backendSkills.length]);

  const openSkillModal = useCallback((currentSkills: string[]) => {
    setTempSkills([...currentSkills]);
    setSkillModalOpen(true);
    loadBackendSkills();
  }, [loadBackendSkills]);

  const closeSkillModal = useCallback(() => {
    setSkillModalOpen(false);
  }, []);

  const confirmSkillModal = useCallback((): string[] => {
    const confirmed = [...tempSkills];
    setSkillModalOpen(false);
    return confirmed;
  }, [tempSkills]);

  const toggleTempSkill = useCallback((id: string) => {
    setTempSkills(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const removeSkill = useCallback((currentSkills: string[], id: string): string[] => {
    return currentSkills.filter(x => x !== id);
  }, []);

  // 根据 id 获取技能显示名
  const skillDisplayName = useCallback((id: string): string => {
    const found = backendSkills.find(s => s.id === id);
    return found ? found.name : id;
  }, [backendSkills]);

  return {
    backendSkills, skillsLoading,
    skillModalOpen, tempSkills,
    loadBackendSkills, openSkillModal, closeSkillModal, confirmSkillModal,
    toggleTempSkill, removeSkill, skillDisplayName,
  };
}
