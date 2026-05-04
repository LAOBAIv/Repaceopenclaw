import { Router, Request, Response } from "express";
import { ConversationService } from "../services/ConversationService";
import { AgentService } from "../services/AgentService";
import { TaskService } from "../services/TaskService";
import { authenticate } from "../middleware/auth";
import { z } from "zod";
import { broadcastToConversation } from "../ws/wsHandler";
import { logger } from "../utils/logger";

const router = Router();
router.use(authenticate);

// Dual-code Phase 2:路由层统一把外部传入的 UUID/业务码解析成底层真实主键。
// 这样后续 update/delete/query 只处理真实 UUID,避免业务码和 UUID 混写导致的隐性 bug。
function resolveAgentOr404(agentIdOrCode: string, userId?: string) {
  const agent = AgentService.getByIdOrCode(agentIdOrCode, userId);
  // ⚠️ 安全拦截：平台助手是系统级独立服务，用户智能体会话/多智能体协作中不能引用
  if (agent && AgentService.isPlatformAssistantId(agent.id)) {
    return null;  // 统一返回 null，上游按 404 处理
  }
  return agent;
}

function resolveConversationOr404(conversationIdOrCode: string, userId?: string) {
  return ConversationService.getByIdOrCode(conversationIdOrCode, userId);
}

function resolveTaskOr404(taskIdOrCode: string) {
  return TaskService.getByIdOrCode(taskIdOrCode);
}

function canAccessConversation(conv: any, userId?: string, userRole?: string) {
  if (!conv) return false;
  if (userRole === 'super_admin' || userRole === 'admin') return true;
  if (conv.userId && conv.userId === userId) return true;
  if (conv.createdBy && conv.createdBy === userId) return true;
  // V1: 非 user 作用域会话先收口为"仅创建者可见",后续再由组织/角色权限接管。
  return false;
}

function normalizeConversationScope(input: { scopeType?: string; scopeId?: string; memoryPolicy?: string }, userId: string, userRole?: string) {
  const scopeType = (input.scopeType || 'user') as 'user' | 'department' | 'role' | 'enterprise';
  const memoryPolicy = (input.memoryPolicy || 'private') as 'private' | 'summary_shared';
  const scopeId = input.scopeId ?? (scopeType === 'user' ? userId : '');

  if (!['user', 'department', 'role', 'enterprise'].includes(scopeType)) {
    throw new Error('scopeType invalid');
  }
  if (!['private', 'summary_shared'].includes(memoryPolicy)) {
    throw new Error('memoryPolicy invalid');
  }
  if (scopeType !== 'user' && userRole !== 'super_admin' && userRole !== 'admin') {
    throw new Error('仅管理员可创建非 user 作用域会话');
  }
  if (scopeType === 'user' && scopeId !== userId && userRole !== 'super_admin' && userRole !== 'admin') {
    throw new Error('user 作用域会话只能绑定当前用户');
  }

  return { scopeType, scopeId, memoryPolicy };
}

// 创建会话:支持单个或多个 agentIds
const CreateConvSchema = z.object({
  // 兼容旧版传 agentId(字符串)以及新版传 agentIds(数组)
  agentId: z.string().min(1).optional(),
  agentIds: z.array(z.string().min(1)).min(1).optional(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  title: z.string().optional(),
  createdBy: z.string().optional(),
  scopeType: z.enum(['user', 'department', 'role', 'enterprise']).optional(),
  scopeId: z.string().optional(),
  memoryPolicy: z.enum(['private', 'summary_shared']).optional(),
}).refine(
  (data) => data.agentId || (data.agentIds && data.agentIds.length > 0),
  { message: "agentId or agentIds (non-empty array) is required" }
);

router.get("/", (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const projectId = req.query.projectId as string | undefined;
  res.json({ data: ConversationService.list(userId, projectId) });
});

/**
 * GET /api/conversations/platform-assistant
 * 获取或创建当前用户的平台助手专属会话
 * - 每个用户有且仅有一个平台助手会话
 * - 首次访问自动创建
 * - 用户不可删除
 */
router.get("/platform-assistant", (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: '未认证' });

  // 查找是否已有平台助手会话
  const existingList = ConversationService.list(userId).filter(
    c => c.title === 'RepaceClaw 平台助手' && c.agentIds.some(id => AgentService.isPlatformAssistantId(id))
  );

  if (existingList.length > 0) {
    const conv = existingList[0];
    const messages = ConversationService.getMessages(conv.id);
    return res.json({ data: { ...conv, messages } });
  }

  // 首次访问：自动创建平台助手会话
  const paAgent = AgentService.getByIdOrCode('repaceclaw-platform-assistant', userId);
  if (!paAgent) return res.status(500).json({ error: '平台助手未找到' });

  const conv = ConversationService.create({
    agentIds: [paAgent.id],
    title: 'RepaceClaw 平台助手',
    createdBy: userId,
    userId,
    currentAgentId: paAgent.id,
    scopeType: 'user',
    scopeId: userId,
    memoryPolicy: 'private',
  });

  logger.info(`[Platform Assistant] Created conversation ${conv.id} for user ${userId}`);
  const messages = ConversationService.getMessages(conv.id);
  res.status(201).json({ data: { ...conv, messages } });
});

router.post("/", (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const userRole = (req as any).user?.role;
  const parsed = CreateConvSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { agentId, agentIds, projectId, taskId, title, createdBy } = parsed.data;
  let scope;
  try {
    scope = normalizeConversationScope(parsed.data, userId, userRole);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'scope invalid' });
  }

  // 统一成数组(兼容旧版单 agentId 传参)
  const ids: string[] = agentIds?.length ? agentIds : [agentId!];

  // 应用层外键校验:确认每个 agentId/agent_code 都真实存在,防止孤儿数据
  const resolvedAgents = ids.map((id) => resolveAgentOr404(id, userId));
  const missingAgent = resolvedAgents.findIndex((a) => !a);
  if (missingAgent >= 0) {
    return res.status(404).json({ error: `Agent not found: ${ids[missingAgent]}` });
  }

  const normalizedAgentIds = resolvedAgents.map((a) => a!.id);
  const resolvedTask = taskId ? resolveTaskOr404(taskId) : null;
  if (taskId && !resolvedTask) {
    return res.status(404).json({ error: `Task not found: ${taskId}` });
  }

  // 如果指定了 taskId/task_code,检查是否已存在会话(一个任务只能有一个会话)
  if (resolvedTask) {
    const existingConvs = ConversationService.list(userId).filter(c => c.taskId === resolvedTask.id || c.sessionCode === resolvedTask.taskCode);
    if (existingConvs.length > 0) {
      return res.status(200).json({ data: existingConvs[0] });
    }
  }

  res.status(201).json({ data: ConversationService.create({ agentIds: normalizedAgentIds, projectId, taskId: resolvedTask?.id || resolvedTask?.taskCode, title, createdBy, userId, scopeType: scope.scopeType, scopeId: scope.scopeId, memoryPolicy: scope.memoryPolicy }) });
});

/**
 * PUT /api/conversations/:id
 * 更新会话信息(标题、项目关联等)
 */
/**
 * POST /api/conversations/:id/switch-agent - 切换当前会话的 Agent
 */
router.post("/:id/switch-agent", (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const userRole = (req as any).user?.role;
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: "agentId required" });

  const conv = resolveConversationOr404(req.params.id, userId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (!canAccessConversation(conv, userId, userRole)) {
    return res.status(403).json({ error: "无权操作此会话" });
  }

  const agent = resolveAgentOr404(agentId, userId);
  if (!agent) return res.status(404).json({ error: `Agent not found: ${agentId}` });

  const success = ConversationService.switchAgent(conv.id, agent.id);
  if (!success) return res.status(404).json({ error: "Conversation not found" });

  const updated = ConversationService.getById(conv.id);
  res.json({
    code: 0,
    data: {
      conversationId: conv.id,
      sessionCode: updated?.sessionCode,
      currentAgentId: updated?.currentAgentId || agent.id,
      currentAgentCode: updated?.currentAgentCode,
      agentIds: updated?.agentIds || [agent.id],
      agentId: updated?.currentAgentId || agent.id,
    },
    msg: "ok",
  });
});

router.put("/:id", (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const userRole = (req as any).user?.role;
  const { title, projectId, taskId, scopeType, scopeId, memoryPolicy, summary } = req.body;
  const conv = resolveConversationOr404(req.params.id, userId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (!canAccessConversation(conv, userId, userRole)) {
    return res.status(403).json({ error: "无权操作此会话" });
  }
  const resolvedTask = taskId ? resolveTaskOr404(taskId) : null;
  if (taskId && !resolvedTask) return res.status(404).json({ error: `Task not found: ${taskId}` });
  let scope;
  try {
    scope = normalizeConversationScope({ scopeType, scopeId, memoryPolicy }, userId, userRole);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'scope invalid' });
  }
  const updated = ConversationService.update(conv.id, { title, projectId, taskId: resolvedTask?.id || undefined, scopeType: scope.scopeType, scopeId: scope.scopeId, memoryPolicy: scope.memoryPolicy, summary });
  if (!updated) return res.status(404).json({ error: "Conversation not found" });
  res.json({ data: updated });
});

router.delete("/:id", (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const userRole = (req as any).user?.role;

  // Dual-code Phase 2:删除前先把 session_code/UUID 解析成真实会话主键。
  const conv = resolveConversationOr404(req.params.id, userId);
  if (!conv) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  // ⚠️ 安全拦截：平台助手专属会话不可删除
  if (conv.agentIds.some(id => AgentService.isPlatformAssistantId(id))) {
    return res.status(403).json({ error: "平台助手会话不可删除" });
  }

  // V1 会话权限:当前仅允许管理员或会话所有者操作;共享作用域后续接组织/角色权限。
  if (!canAccessConversation(conv, userId, userRole)) {
    return res.status(403).json({ error: "无权删除此会话" });
  }

  const deleted = ConversationService.delete(conv.id);
  if (!deleted) {
    return res.status(500).json({ error: "Failed to delete conversation" });
  }

  res.json({ success: true, message: "Conversation deleted" });
});

/**
 * PATCH /api/conversations/:id/status
 * 更新会话状态:in_progress | completed | archived
 */
router.patch("/:id/status", (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const userRole = (req as any).user?.role;
  const { status } = req.body;
  if (!status || !['in_progress', 'completed', 'archived', 'deleted'].includes(status)) {
    return res.status(400).json({ error: "status must be one of: in_progress, completed, archived, deleted" });
  }
  const conv = resolveConversationOr404(req.params.id, userId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (!canAccessConversation(conv, userId, userRole)) {
    return res.status(403).json({ error: "无权操作此会话" });
  }
  const updated = ConversationService.updateStatus(conv.id, status as 'in_progress' | 'completed' | 'archived' | 'deleted');
  if (!updated) return res.status(404).json({ error: "Conversation not found" });
  res.json({ data: updated });
});

router.get("/:id/messages", (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const userRole = (req as any).user?.role;
  const conv = resolveConversationOr404(req.params.id, userId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (!canAccessConversation(conv, userId, userRole)) {
    return res.status(403).json({ error: "无权限访问此会话消息" });
  }
  res.json({ data: ConversationService.getMessages(conv.id) });
});

router.post("/:id/messages", async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const userRole = (req as any).user?.role;
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: "content required" });
  const conv = resolveConversationOr404(req.params.id, userId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (!canAccessConversation(conv, userId, userRole)) {
    return res.status(403).json({ error: "无权限操作此会话" });
  }
  const msg = ConversationService.addMessage({ conversationId: conv.id, role: "user", content });

  // 平台助手会话：使用 Tool Calling 模式自动调度 API
  const isPA = conv.agentIds?.some((id: string) => AgentService.isPlatformAssistantId(id));
  if (isPA) {
    try {
      const paAgent = conv.agentIds
        .map((id: string) => AgentService.getByIdOrCode(id, userId))
        .find((a: any) => a && AgentService.isPlatformAssistantId(a.id));

      if (paAgent) {
        const { resolveOpenClawGateway } = require('../utils/openclawGateway');
        const gateway = resolveOpenClawGateway();
        const https = require('https');
        const http = require('http');
        const { PLATFORM_TOOLS, executeToolCall } = require('../services/PlatformAssistantTools');

        let systemPrompt = paAgent.systemPrompt || '';
        if (paAgent.writingStyle) systemPrompt += `\n\n写作风格：${paAgent.writingStyle}`;
        if (paAgent.expertise?.length) systemPrompt += `\n\n专业领域：${paAgent.expertise.join('、')}`;
        if (paAgent.outputFormat && paAgent.outputFormat !== '纯文本') {
          systemPrompt += `\n\n## 输出格式要求\n${paAgent.outputFormat}`;
        }
        if (paAgent.boundary?.trim()) {
          systemPrompt += `\n\n## 能力边界\n${paAgent.boundary.trim()}`;
        }
        systemPrompt += `\n\n你的名字是 ${paAgent.name}，请始终以第一人称回复。`;
        systemPrompt += `\n\n## 可用工具\n你可以使用以下工具获取实时数据。当用户询问平台状态、数量、列表等信息时，优先调用工具而非凭记忆回答。`;

        const historyMessages = ConversationService.getMessages(conv.id);
        const messages: any[] = [
          { role: "system", content: systemPrompt },
          ...historyMessages.slice(-20).map((m: any) => ({
            role: m.role === "agent" ? "assistant" : "user",
            content: m.content,
          })),
        ];

        // Tool Calling 循环：最多 3 轮工具调用
        for (let toolRound = 0; toolRound < 3; toolRound++) {
          const payload = JSON.stringify({
            model: `openclaw/${paAgent.openclawAgentId}`,
            stream: false,
            messages,
            tools: PLATFORM_TOOLS,
            tool_choice: 'auto',
          });

          const gatewayUrl = new URL(`${gateway.url}/v1/chat/completions`);
          const lib = gatewayUrl.protocol === "https:" ? https : http;

          const response = await new Promise<any>((resolve) => {
            const apiReq = lib.request(gatewayUrl.toString(), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
                "Authorization": `Bearer ${gateway.token}`,
              },
            }, (apiRes: any) => {
              let body = "";
              apiRes.on("data", (d: Buffer) => (body += d.toString()));
              apiRes.on("end", () => {
                try {
                  resolve(JSON.parse(body));
                } catch { resolve(null); }
              });
            });
            apiReq.on("error", () => resolve(null));
            apiReq.setTimeout(30000, () => { apiReq.destroy(); resolve(null); });
            apiReq.write(payload);
            apiReq.end();
          });

          if (!response?.choices?.[0]) {
            logger.error('[Platform Assistant] Gateway returned no response');
            break;
          }

          const choice = response.choices[0];
          const assistantMsg = choice.message;

          // 检查是否有工具调用
          if (assistantMsg?.tool_calls && assistantMsg.tool_calls.length > 0) {
            // 把助手的工具调用请求加入消息
            messages.push({
              role: 'assistant',
              content: assistantMsg.content || null,
              tool_calls: assistantMsg.tool_calls,
            });

            // 执行每个工具调用
            for (const tc of assistantMsg.tool_calls) {
              const toolCall = {
                name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments || '{}'),
              };
              logger.info('[Platform Assistant] Executing tool', { tool: toolCall.name, args: toolCall.arguments });
              const result = await executeToolCall(toolCall, userId);
              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: result,
              });
            }
            // 继续下一轮，让模型根据工具结果生成最终回复
            continue;
          }

          // 没有工具调用，这就是最终回复
          if (assistantMsg?.content) {
            const aiMsg = ConversationService.addMessage({
              conversationId: conv.id,
              role: "agent",
              content: assistantMsg.content,
              agentId: paAgent.id,
              tokenCount: response.usage?.total_tokens || 0,
            });
            return res.status(201).json({ data: { userMessage: msg, agentMessage: aiMsg } });
          }
          break;
        }
      }
    } catch (err: any) {
      logger.error('[Platform Assistant] AI reply failed:', err.message);
    }
  }

  res.status(201).json({ data: msg });
});

/**
 * POST /api/conversations/:id/agents
 * 向已有会话追加智能体(多对多关联,幂等)
 */
router.post("/:id/agents", (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const userRole = (req as any).user?.role;
  const conv = resolveConversationOr404(req.params.id, userId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (!canAccessConversation(conv, userId, userRole)) {
    return res.status(403).json({ error: "无权操作此会话" });
  }

  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: "agentId required" });

  const agent = resolveAgentOr404(agentId, userId);
  if (!agent) return res.status(404).json({ error: `Agent not found: ${agentId}` });

  ConversationService.addAgent(conv.id, agent.id);
  const updated = ConversationService.getById(conv.id);
  res.json({ success: true, data: updated });
});

/**
 * DELETE /api/conversations/:id/agents/:agentId
 * 从会话移除某个智能体
 */
router.delete("/:id/agents/:agentId", (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const userRole = (req as any).user?.role;
  const conv = resolveConversationOr404(req.params.id, userId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (!canAccessConversation(conv, userId, userRole)) {
    return res.status(403).json({ error: "无权操作此会话" });
  }
  const agent = resolveAgentOr404(req.params.agentId, userId);
  if (!agent) return res.status(404).json({ error: `Agent not found: ${req.params.agentId}` });
  ConversationService.removeAgent(conv.id, agent.id);
  const updated = ConversationService.getById(conv.id);
  res.json({ success: true, data: updated });
});

/**
 * POST /api/conversations/:id/generate
 * Trigger AI to generate a reply for the latest messages in this conversation.
 * Non-streaming, waits for full response before returning.
 * Body: { agentId: string }
 */
router.post("/:id/generate", authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: "agentId required" });

  const conv = resolveConversationOr404(req.params.id, userId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });

  const agent = resolveAgentOr404(agentId, userId);
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  // ── 配额检查 ──────────────────────────────────────────────────────
  const quotaResult = AgentService.checkQuota(agent.id, userId);
  if (!quotaResult.allowed) {
    return res.status(429).json({ error: quotaResult.reason });
  }

  const maxTokensPerMsg = AgentService.getMaxTokensPerMessage(agent.id);

  // Build conversation history
  const messages = ConversationService.getMessages(conv.id);
  const history = messages.map((m) => ({
    role: m.role === "agent" ? "assistant" : "user",
    content: m.content,
  }));

  let fullContent = "";
  let errorMsg: string | null = null;
  let tokenCount = 0;

  await new Promise<void>((resolve) => {
    AgentService.generateStream(
      agent.id,
      history,
      (chunk) => {
        // maxTokensPerMessage 限制:超出部分丢弃且不保存到回复中
        if (maxTokensPerMsg && fullContent.length >= maxTokensPerMsg) return;
        fullContent += chunk;
      },
      (tokens) => { tokenCount = tokens; resolve(); },
      (err) => { errorMsg = err.message; resolve(); }
    );
  });

  if (errorMsg) {
    return res.status(500).json({ error: errorMsg });
  }

  // ── 记录用量 ──────────────────────────────────────────────────────
  AgentService.recordUsage(userId, agent.id, tokenCount);
  AgentService.addTokenUsed(agent.id, tokenCount);

  const agentMsg = ConversationService.addMessage({
    conversationId: conv.id,
    role: "agent",
    content: fullContent,
    agentId: agent.id,
  });

  res.status(201).json({ data: agentMsg });
});

/**
 * POST /api/conversations/create-with-overview
 * 创建全新会话 + 异步生成项目概述（秒级响应，后台生成概述）
 * Body: { title, agentIds[], projectId?, description? }
 * 
 * ⚠️ 修复：之前是同步等待 AI 概述生成（8-15s），前端 10s 超时导致"提示失败但列表有会话"
 *    现在改为：先返回空会话 → 前端秒开 → 后台异步生成概述 → 通过 WebSocket 推送概述消息
 */
router.post("/create-with-overview", authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { title, agentIds, projectId, description } = req.body;

  if (!title || !agentIds || !agentIds.length) {
    return res.status(400).json({ error: "title and agentIds (non-empty array) are required" });
  }

  // Dual-code Phase 2：agentIds 入参支持 UUID / agent_code，先统一解析成真实 Agent。
  const resolvedAgents = [] as NonNullable<ReturnType<typeof resolveAgentOr404>>[];
  for (const id of agentIds) {
    const agent = resolveAgentOr404(id, userId);
    if (!agent) {
      return res.status(404).json({ error: `Agent not found: ${id}` });
    }
    resolvedAgents.push(agent);
  }

  const businessAgentIds = resolvedAgents.map(agent => agent.id);

  // 1. 创建全新会话（立即返回，不等概述生成）
  const conv = ConversationService.create({
    agentIds: businessAgentIds,
    projectId,
    title,
    createdBy: userId,
    userId,
    currentAgentId: businessAgentIds[0],
  });

  // 2. 立即返回空会话，前端可以秒开
  const messages = ConversationService.getMessages(conv.id);
  res.status(201).json({ data: { ...conv, messages } });

  // 3. 后台异步生成 AI 概述（不阻塞响应）
  const mainAgentId = resolvedAgents[0].id;
  const selectedAgents = resolvedAgents;
  const agentNames = selectedAgents.map(a => a.name).join('、');
  const isProject = agentIds.length >= 2;
  const typeLabel = isProject ? '项目' : '任务';
  const descText = description ? `\n\n任务描述：${description}` : '';
  const convId = conv.id;
  const convSessionCode = conv.sessionCode || '';

  const overviewPrompt = `你是一名${isProject ? '项目经理' : '任务助手'}。请根据以下信息生成一份简洁的项目概述。

${typeLabel}名称：${title}
参与智能体：${agentNames}
智能体详情：${selectedAgents.map(a => `  - ${a.name}：擅长${a.expertise?.join('、') || '通用'}，${a.description || '暂无描述'}`).join('\n')}${descText}

请按以下格式输出（使用 Markdown）：

# ${title} — 项目概述

## 项目简介\n简要说明本项目的目标和范围（2-3 句）\n\n## 参与角色\n列出每个智能体的职责分工\n\n## 初始建议\n给出 2-3 条可立即执行的下一步建议\n
请保持简洁专业。`;

  // 用 setImmediate 确保响应已发送后再开始生成
  setImmediate(async () => {
    try {
      logger.info(`[create-with-overview] Async overview generation started for conv=${convId}`);

      AgentService.checkQuota(mainAgentId, userId);

      let fullContent = "";
      let errorMsg: string | null = null;
      let tokenCount = 0;

      await new Promise<void>((resolve) => {
        AgentService.generateStream(
          mainAgentId,
          [{ role: "user", content: overviewPrompt }],
          (chunk) => {
            fullContent += chunk;
            // 流式推送概述片段到前端
            const { broadcastToConversation } = require('../ws/wsHandler');
            broadcastToConversation(convId, {
              type: 'overview_chunk',
              conversationId: convId,
              sessionCode: convSessionCode,
              chunk,
            });
          },
          (tokens) => { tokenCount = tokens; resolve(); },
          (err) => { errorMsg = err?.message || '生成失败'; resolve(); }
        );
      });

      if (!errorMsg && fullContent) {
        AgentService.recordUsage(userId, mainAgentId, tokenCount);
        AgentService.addTokenUsed(mainAgentId, tokenCount);

        const agentMsg = ConversationService.addMessage({
          conversationId: convId,
          role: "agent",
          content: fullContent,
          agentId: mainAgentId,
          tokenCount,
        });

        // 推送概述完成事件到前端
        const { broadcastToConversation } = require('../ws/wsHandler');
        broadcastToConversation(convId, {
          type: 'overview_done',
          conversationId: convId,
          sessionCode: convSessionCode,
          message: agentMsg,
        });

        logger.info(`[create-with-overview] Async overview completed for conv=${convId}, tokens=${tokenCount}`);
      } else {
        logger.warn(`[create-with-overview] Async overview failed for conv=${convId}: ${errorMsg}`);
      }
    } catch (err: any) {
      logger.error(`[create-with-overview] Async overview error for conv=${convId}:`, { error: err.message });
    }
  });
});

export default router;
