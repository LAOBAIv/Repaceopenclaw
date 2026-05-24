/**
 * MobileAgentCreate 类型定义
 * 包含组件 Props 接口
 */

/**
 * 模板预填数据类型
 * 当页面由 MobileWorkspace 内部视图切入时，模板数据来自父组件内存态
 */
export interface TemplateState {
  templateId?: string;
  name?: string;
  model?: string;
  description?: string;
  expertise?: string;
  systemPrompt?: string;
  vibe?: string;
  category?: string;
  outputFormat?: string;
}

/**
 * MobileAgentCreate 组件 Props
 */
export interface Props {
  onBack: () => void;
  // ⚠️ 防回归说明：当该页面由 MobileWorkspace 内部视图切入时，
  // 模板预填数据来自父组件内存态，而不是 react-router location.state。
  // 这里保留 initialTemplateState，就是为了避免再次依赖路由跳转。
  initialTemplateState?: TemplateState | null;
}
