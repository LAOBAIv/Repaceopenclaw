/**
 * MobileAgentLibrary 工具函数
 * 包含模板分类到智能体类型的转换逻辑
 */

import { AGENT_TYPE_LABELS } from './constants';

/**
 * 将模板分类映射为智能体类型
 */
export function templateCategoryToAgentType(category?: string): keyof typeof AGENT_TYPE_LABELS {
  switch (category) {
    case 'engineering':
    case 'integrations':
    case 'testing':
      return 'dev';
    case 'design':
      return 'creative';
    case 'project-management':
    case 'product':
      return 'pm';
    case 'academic':
      return 'research';
    case 'marketing':
    case 'paid-media':
    case 'strategy':
    case 'sales':
      return 'ops';
    default:
      return 'general';
  }
}
