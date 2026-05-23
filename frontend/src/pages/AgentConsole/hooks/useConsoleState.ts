/**
 * @file useConsoleState - AgentConsole 表单状态管理 Hook
 * 管理任务名称、描述、目标、优先级、标签、时间、决策人等表单状态
 * 包含标签弹窗的点击外部关闭逻辑
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { PRIORITY, PRIORITY_REV_MAP, nowLocal } from '../constants';
import type { DecisionMaker } from '../constants';

export interface ConsoleStateReturn {
  // 表单字段
  taskName: string;
  setTaskName: (v: string) => void;
  taskDesc: string;
  setTaskDesc: (v: string) => void;
  taskGoal: string;
  setTaskGoal: (v: string) => void;
  priority: string;
  setPriority: (v: string) => void;
  tags: string[];
  setTags: React.Dispatch<React.SetStateAction<string[]>>;
  tagInput: string;
  setTagInput: (v: string) => void;
  showTagPopup: boolean;
  setShowTagPopup: React.Dispatch<React.SetStateAction<boolean>>;
  tagPopupRef: React.RefObject<HTMLDivElement | null>;
  startTime: string;
  setStartTime: (v: string) => void;
  endTime: string;
  setEndTime: (v: string) => void;
  decisionMaker: DecisionMaker | null;
  setDecisionMaker: React.Dispatch<React.SetStateAction<DecisionMaker | null>>;
  // 重置所有表单状态
  resetForm: () => void;
  // 编辑模式标识
  editTask: any;
  editProject: any;
  prefill: any;
}

export function useConsoleState(): ConsoleStateReturn {
  const location = useLocation();

  /* 从看板「编辑」跳转时带入的预填数据 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const locationState = location.state as any;
  const editProject = locationState?.editProject ?? null;
  const editTask = locationState?.editTask ?? null;
  /** 统一预填源：任务优先，其次项目 */
  const prefill = editTask ?? editProject ?? null;

  /* 表单状态 */
  const [taskName, setTaskName] = useState(() => prefill?.title ?? '');
  const [taskDesc, setTaskDesc] = useState(() => prefill?.description ?? '');
  const [taskGoal, setTaskGoal] = useState('');
  const [priority, setPriority] = useState(() =>
    prefill?.priority ? (PRIORITY_REV_MAP[prefill.priority] ?? PRIORITY[0]) : PRIORITY[0]
  );
  const [tags, setTags] = useState<string[]>(() => prefill?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [showTagPopup, setShowTagPopup] = useState(false);
  const tagPopupRef = useRef<HTMLDivElement>(null);

  /* 点击弹窗外部时关闭标签弹窗 */
  useEffect(() => {
    if (!showTagPopup) return;
    function handleClick(e: MouseEvent) {
      if (tagPopupRef.current && !tagPopupRef.current.contains(e.target as Node)) {
        setShowTagPopup(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showTagPopup]);

  const [startTime, setStartTime] = useState(nowLocal);
  const [endTime, setEndTime] = useState('');
  const [decisionMaker, setDecisionMaker] = useState<DecisionMaker | null>(null);

  /** 重置所有表单字段到初始状态 */
  const resetForm = useCallback(() => {
    setTaskName('');
    setTaskDesc('');
    setTaskGoal('');
    setPriority(PRIORITY[0]);
    setTags([]);
    setTagInput('');
    setShowTagPopup(false);
    setStartTime(nowLocal());
    setEndTime('');
    setDecisionMaker(null);
  }, []); // PRIORITY 和 nowLocal 是稳定引用

  return {
    taskName, setTaskName,
    taskDesc, setTaskDesc,
    taskGoal, setTaskGoal,
    priority, setPriority,
    tags, setTags,
    tagInput, setTagInput,
    showTagPopup, setShowTagPopup,
    tagPopupRef,
    startTime, setStartTime,
    endTime, setEndTime,
    decisionMaker, setDecisionMaker,
    resetForm,
    editTask, editProject, prefill,
  };
}
