/**
 * AgentManager 工具函数
 */

import { VALID_MODELS } from './constants';
import type { AgentRoutingInfo } from '@/api/agents';

/**
 * 判断模型名称是否有效
 *
 * 后台"无效模型"只应作为弱提示，绝不能因为静态白名单落后而误伤真实可用模型。
 * 规则：
 * 1. 若后端 routing-overview 已成功给出 effectiveModel，视为有效
 * 2. 否则再做宽松字符串匹配（忽略大小写/常见别名）
 */
export function isValidModelName(modelName: string, routing?: AgentRoutingInfo): boolean {
  if (!modelName) return true;
  if (routing?.effectiveModel) return true;
  const lower = modelName.toLowerCase().trim();
  return VALID_MODELS.some(v => lower === v || lower.startsWith(v) || v.startsWith(lower));
}
