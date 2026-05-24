/**
 * MobileAgentLibrary 类型定义
 * 包含组件 Props 接口
 */

/**
 * MobileAgentLibrary 组件属性
 */
export interface Props {
  onBack: () => void;
  // ⚠️ 防回归说明：当该页面由 MobileWorkspace 内部视图承载时，
  // 选模板后必须通过回调把模板状态交还给父组件，再切到内部 agent-create 视图。
  // 不要强制改回 navigate('/mobile/agent-create')，否则会重新走路由，破坏左抽屉"无重建返回工作区"的修复。
  onUseTemplateState?: (state: {
    templateId?: string;
    name?: string;
    model?: string;
    description?: string;
    expertise?: string[];
    systemPrompt?: string;
    vibe?: string;
    category?: string;
    outputFormat?: string;
  }) => void;
}
