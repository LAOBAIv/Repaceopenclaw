/**
 * MobileAgentManager 类型定义
 * 包含组件 Props 接口
 */
import { Agent } from '@/types';

/* ─────────────────────────────────────────────
 * Props接口
 * ───────────────────────────────────────────── */
export interface Props {
  onBack: () => void;
  onEdit?: (agentId: string) => void;  // 可选：点击编辑回调
  // ⚠️ 防回归说明：当该页面作为 MobileWorkspace 内部视图使用时，
  // 新建按钮必须通过 onCreate 回到父组件内切视图，避免重新走 /mobile-agent-create 路由导致工作区重建。
  onCreate?: () => void;
}

/* ─────────────────────────────────────────────
 * AgentAvatar Props
 * ───────────────────────────────────────────── */
export interface AgentAvatarProps {
  agent: Agent;
}
