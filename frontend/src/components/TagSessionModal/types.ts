/**
 * TagSessionModal 类型定义
 */

export interface TagSessionModalProps {
  open: boolean;
  tag: string;
  onClose: () => void;
  onCreated: (convId: string) => void;
}
