import type { Message, OpenPanel } from '../../types';
import { ConversationPanel } from './ConversationPanel';

interface MultiPanelContainerProps {
  panels: OpenPanel[];
  messagesMap: Record<string, Message[]>;
  onSend: (panelId: string, content: string) => void;
  onClose: (panelId: string) => void;
  onInsertToEditor?: (content: string) => void;
  /** agentId -> outputFormat 映射，用于传递给每个面板的消息渲染 */
  outputFormatMap?: Record<string, string>;
}

export function MultiPanelContainer({
  panels,
  messagesMap,
  onSend,
  onClose,
  onInsertToEditor,
  outputFormatMap,
}: MultiPanelContainerProps) {
  const count = panels.length;

  // Vertical layout: 1 panel = full height, 2+ = split vertically
  const panelHeight =
    count === 1 ? 'h-full' :
    count === 2 ? 'h-[calc(50%-4px)]' :
    count === 3 ? 'h-[calc(33.333%-6px)]' :
    'h-[calc(25%-6px)]';

  return (
    <div className="h-full flex flex-col gap-2 overflow-auto">
      {panels.map((panel) => (
        <div key={panel.id} className={`flex-none ${panelHeight} min-h-[200px]`}>
          <ConversationPanel
            panel={panel}
            messages={messagesMap[panel.id] ?? panel.messages}
            onSend={onSend}
            onClose={onClose}
            onInsertToDoc={onInsertToEditor}
            outputFormat={outputFormatMap?.[panel.agentId]}
          />
        </div>
      ))}
    </div>
  );
}

