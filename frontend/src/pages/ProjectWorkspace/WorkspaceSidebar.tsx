/**
 * WorkspaceSidebar — 侧边栏组件
 *
 * 职责：渲染功能标签栏（FUNCTION_TABS）和 TabPanel 弹窗。
 * 处理 Tab 点击、消息渠道弹窗、TabPanel 的各种回调传递。
 */
import React from 'react';
import {
  TabPanel,
  ChannelConfigModal,
  FUNCTION_TABS,
} from '@/components/workspace';

/**
 * WorkspaceSidebar — 功能标签栏 + TabPanel 弹窗
 *
 * @param activeSideTab 当前激活的侧边 Tab
 * @param onSideTabClick 侧边 Tab 点击回调
 * @param showChannelModal 是否显示消息渠道弹窗
 * @param onCloseChannelModal 关闭消息渠道弹窗回调
 * @param activePanelAgentId 当前激活 panel 的 agentId（用于过滤微信助手的"多智能体"Tab）
 * @param activePanelAgentName 当前激活 panel 的 agentName
 * @param tabPanelProps TabPanel 所需的所有 props（不含 tab 和 onClose）
 */
export function WorkspaceSidebar({
  activeSideTab,
  onSideTabClick,
  showChannelModal,
  onCloseChannelModal,
  activePanelAgentId,
  activePanelAgentName,
  tabPanelProps,
}: {
  activeSideTab: string | null;
  onSideTabClick: (tab: string) => void;
  showChannelModal: boolean;
  onCloseChannelModal: () => void;
  activePanelAgentId?: string;
  activePanelAgentName?: string;
  tabPanelProps: Omit<React.ComponentProps<typeof TabPanel>, 'tab' | 'onClose'>;
}) {
  return (
    <>
      {/* 功能标签栏 */}
      <div className="function-tabs">
        {FUNCTION_TABS
          .filter(tab => {
            // 微信助手面板隐藏"多智能体"Tab，智能体固定不可切换
            if (tab === '多智能体' && (activePanelAgentId === 'rc-wechat-agent' || activePanelAgentName === '微信助手')) return false;
            return true;
          })
          .map(tab => (
            <button
              key={tab}
              className={`function-tab${activeSideTab === tab ? ' active' : ''}`}
              onClick={() => onSideTabClick(tab)}
            >
              {tab}
            </button>
          ))}
      </div>

      {/* TabPanel 弹窗（标签管理、快捷指令、技能应用、定时任务、多智能体等） */}
      {activeSideTab && activeSideTab !== '消息渠道' && (
        // 微信助手面板不渲染多智能体 TabPanel
        (!(activeSideTab === '多智能体' && (activePanelAgentId === 'rc-wechat-agent' || activePanelAgentName === '微信助手')) && (
          <TabPanel
            {...tabPanelProps}
            tab={activeSideTab}
            onClose={() => onSideTabClick(activeSideTab)}
          />
        ))
      )}

      {/* 消息渠道配置弹窗 */}
      {showChannelModal && (
        <ChannelConfigModal onClose={onCloseChannelModal} />
      )}
    </>
  );
}
