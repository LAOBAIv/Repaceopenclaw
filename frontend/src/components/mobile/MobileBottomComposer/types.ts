/**
 * 移动端底部输入区组件 - 类型定义
 *
 * 提取 MobileBottomComposerProps 接口及其类型依赖。
 */

import type { Agent } from '@/types';
import type { FlowNode } from './MobileMultiAgentPanel';

/** 移动端底部输入区组件 Props */
export interface MobileBottomComposerProps {
  /** 输入框当前值（非受控时可不传） */
  value?: string;
  /** 输入框值变更回调 */
  onChange?: (value: string) => void;
  /** 发送消息回调 */
  onSend: (text: string) => void;
  /** 注入文本到输入框 */
  onInject?: (text: string) => void;
  /** 切换会话智能体 */
  onSwitchAgent?: (agentId: string, agentName: string, agentColor: string) => void;
  /** 当前功能 tab（受控模式，可选） */
  activeTab?: string | null;
  /** 会话 ID，用于 TaskTagPanel */
  conversationId?: string;
  /** 任务/项目名称 */
  taskName?: string;
  /** 文件上传回调，未传入时显示占位入口 */
  onFileUpload?: (file: File) => void;
  /** 自定义占位符文本 */
  placeholder?: string;
  /** 当前可选智能体列表 */
  agents?: Agent[];
  /** 当前激活智能体 */
  currentAgentId?: string;
  /** 当前会话参与的智能体 */
  currentAgentIds?: string[];
  /** 协作节点（外部受控） */
  collabNodes?: FlowNode[];
  /** 协作节点 setter（外部受控） */
  setCollabNodes?: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  /** 是否项目协作模式 */
  isProject?: boolean;
}
