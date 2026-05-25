/**
 * MobileChatArea — 移动端消息展示区
 *
 * 包含空状态占位和所有 openPanels 常驻 DOM 渲染。
 * ⚠️ 防回归说明：必须保留所有 openPanels 常驻 DOM，
 * 只能通过 activePanelId + 显隐来切换当前 panel，不能只渲染当前 panel。
 */

import MobileChatPanelContainer from '../../components/mobile/MobileChatPanelContainer';
import { COLORS } from './constants';
import type { Agent } from '../../types';
import type { ConversationPanel } from '../../stores/conversation';

interface MobileChatAreaProps {
  activePanel: ConversationPanel | null;
  openPanels: ConversationPanel[];
  activePanelId: string | null;
  agents: Agent[];
}

export function MobileChatArea({
  activePanel,
  openPanels,
  activePanelId,
  agents,
}: MobileChatAreaProps) {
  if (!activePanel) {
    /* 纯静态空状态：不混入真实会话/智能体数据，避免刷新时闪出业务内容 */
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        gap: 16,
        textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: `linear-gradient(135deg, ${COLORS.accent}, #3b82f6)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, color: '#fff', fontWeight: 700,
          boxShadow: '0 10px 30px rgba(99,102,241,0.25)',
        }}>
          RC
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: COLORS.textPrimary }}>
          RepaceClaw
        </div>
        <div style={{ fontSize: 13, color: COLORS.textMuted, maxWidth: 280, lineHeight: 1.6 }}>
          点击右上角打开会话列表创建对话
        </div>
      </div>
    );
  }

  /*
   * 聊天区必须保留所有 openPanels 常驻 DOM，
   * 只能通过 activePanelId + 显隐来切换当前 panel。
   * 根因：如果改回"只渲染当前 panel / return null / display:none 后重挂载"的方案，
   * 会重新触发消息区挂载、滚动定位和空状态闪现。
   */
  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      position: 'relative',
      overflow: 'hidden',
      touchAction: 'pan-y',
    }}>
      {openPanels.map((panel) => {
        const isActive = panel.id === activePanelId;
        return (
          <MobileChatPanelContainer
            key={panel.id}
            panel={panel}
            agents={agents}
            isActive={isActive}
          />
        );
      })}
    </div>
  );
}
