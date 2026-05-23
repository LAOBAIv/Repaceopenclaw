/**
 * MobileChatInput — 移动端底部输入框
 *
 * 封装 MobileBottomComposer 组件，传递聊天相关 props。
 */

import MobileBottomComposer from '../../components/mobile/MobileBottomComposer';

interface MobileChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: (text: string) => void;
  conversationId: string | null;
  taskName: string;
  placeholder: string;
  agents: any[];
  currentAgentId?: string;
  currentAgentIds?: string[];
}

export function MobileChatInput({
  value,
  onChange,
  onSend,
  conversationId,
  taskName,
  placeholder,
  agents,
  currentAgentId,
  currentAgentIds,
}: MobileChatInputProps) {
  return (
    <MobileBottomComposer
      value={value}
      onChange={onChange}
      onSend={onSend}
      conversationId={conversationId}
      taskName={taskName}
      placeholder={placeholder}
      agents={agents}
      currentAgentId={currentAgentId}
      currentAgentIds={currentAgentIds}
      isProject={false}
    />
  );
}
