/**
 * AgentKanban 类型定义
 *
 * 存放 SessionCardItem 组件的 props 类型等共享类型。
 */
import type { SessionCard, SessionColumn } from '@/stores/sessionKanbanStore';

export interface SessionCardItemProps {
  session: SessionCard;
  col: SessionColumn;
  onDelete: () => void;
  onMoveToDeleted: () => void;
  onRestore: () => void;
}
