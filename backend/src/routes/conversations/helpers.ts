/**
 * ConversationHelpers — 会话路由辅助函数
 *
 * ID 解析、权限校验、作用域规范化。
 */
import { ConversationService } from "../../services/ConversationService";
import { AgentService } from "../../services/AgentService";
import { TaskService } from "../../services/TaskService";
import { getErrorMessage } from "../../types/ilink";

/**
 * 将外部传入的 UUID/业务码解析成底层真实主键
 */
export function resolveAgentOr404(agentIdOrCode: string, userId?: string) {
  const agent = AgentService.getByIdOrCode(agentIdOrCode, userId);
  if (agent && AgentService.isPlatformAssistantId(agent.id)) return null;
  return agent;
}

export function resolveConversationOr404(conversationIdOrCode: string, userId?: string) {
  return ConversationService.getByIdOrCode(conversationIdOrCode, userId);
}

export function resolveTaskOr404(taskIdOrCode: string) {
  return TaskService.getByIdOrCode(taskIdOrCode);
}

/**
 * 权限校验：管理员或会话创建者/所有者
 */
export function canAccessConversation(
  conv: { userId?: string; createdBy?: string } | Record<string, unknown>,
  userId?: string,
  userRole?: string
): boolean {
  if (!conv) return false;
  if (userRole === 'super_admin' || userRole === 'admin') return true;
  if (conv.userId && conv.userId === userId) return true;
  if (conv.createdBy && conv.createdBy === userId) return true;
  return false;
}

/**
 * 规范化会话作用域参数
 */
export function normalizeConversationScope(
  input: { scopeType?: string; scopeId?: string; memoryPolicy?: string },
  userId: string,
  userRole?: string
) {
  const scopeType = (input.scopeType || 'user') as 'user' | 'department' | 'role' | 'enterprise';
  const memoryPolicy = (input.memoryPolicy || 'private') as 'private' | 'summary_shared';
  const scopeId = input.scopeId ?? (scopeType === 'user' ? userId : '');

  if (!['user', 'department', 'role', 'enterprise'].includes(scopeType)) throw new Error('scopeType invalid');
  if (!['private', 'summary_shared'].includes(memoryPolicy)) throw new Error('memoryPolicy invalid');
  if (scopeType !== 'user' && userRole !== 'super_admin' && userRole !== 'admin') {
    throw new Error('仅管理员可创建非 user 作用域会话');
  }
  if (scopeType === 'user' && scopeId !== userId && userRole !== 'super_admin' && userRole !== 'admin') {
    throw new Error('user 作用域会话只能绑定当前用户');
  }

  return { scopeType, scopeId, memoryPolicy };
}

/**
 * 判断是否全局助手会话
 */
export function isGlobalAssistantConv(conv: { agentIds?: string[]; title?: string; conversationType?: string }): boolean {
  return conv.agentIds?.some((id) => AgentService.isPlatformAssistantId(id))
    || conv.title === 'RepaceClaw 平台助手'
    || conv.title === '微信助手'
    || conv.conversationType === 'wechat_assistant';
}
