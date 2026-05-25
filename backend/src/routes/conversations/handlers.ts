/**
 * conversationHandlers — 会话路由处理器
 *
 * 所有 Express 路由 handler，按功能分组。
 */
import { Request, Response } from "express";
import { ConversationService } from "../../services/ConversationService";
import { AgentService } from "../../services/AgentService";
import { TaskService } from "../../services/TaskService";
import { MemoryService } from "../../services/memory/MemoryService";
import { z } from "zod";
import { broadcastToConversation } from "../../ws/wsHandler";
import { logger } from "../../utils/logger";
import { getErrorMessage } from "../../types/ilink";
import {
  resolveAgentOr404,
  resolveConversationOr404,
  resolveTaskOr404,
  canAccessConversation,
  normalizeConversationScope,
  isGlobalAssistantConv,
} from "./helpers";

// ─── Schema ─────────────────────────────────────────────────────────────

export const CreateConvSchema = z.object({
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

// ─── 列表 & 专属助手 ────────────────────────────────────────────────────

export const listConversations = (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const projectId = req.query.projectId as string | undefined;
  const status = req.query.status as string | undefined;
  logger.debug(`[conversations.list] userId=${userId} status=${status} projectId=${projectId}`);
  const data = ConversationService.list(userId, projectId, status);
  logger.debug(`[conversations.list] returned ${data.length} items`);
  res.json({ data });
};

export const getPlatformAssistant = (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: '未认证' });

  const existingList = ConversationService.list(userId).filter(
    c => c.title === 'RepaceClaw 平台助手' && c.agentIds.some(id => AgentService.isPlatformAssistantId(id))
  );

  if (existingList.length > 0) {
    const conv = existingList[0];
    const paAgent = AgentService.getByIdOrCode('repaceclaw-platform-assistant', userId);
    if (paAgent) {
      const ocSessionKey = `agent:repaceclaw-platform-assistant:rc:${conv.id}`;
      ConversationService.bindOpenClawSession(conv.id, ocSessionKey, paAgent.id, [paAgent.id]);
    }
    const messages = ConversationService.getMessages(conv.id);
    return res.json({ data: { ...conv, messages } });
  }

  const paAgent = AgentService.getByIdOrCode('repaceclaw-platform-assistant', userId);
  if (!paAgent) return res.status(500).json({ error: '平台助手未找到' });

  const conv = ConversationService.create({
    agentIds: [paAgent.id], title: 'RepaceClaw 平台助手', createdBy: userId, userId,
    currentAgentId: paAgent.id, scopeType: 'user', scopeId: userId, memoryPolicy: 'private',
  });
  const ocSessionKey = `agent:repaceclaw-platform-assistant:rc:${conv.id}`;
  ConversationService.bindOpenClawSession(conv.id, ocSessionKey, paAgent.id, [paAgent.id]);
  logger.info(`[Platform Assistant] Created conversation ${conv.id} for user ${userId}`);
  const messages = ConversationService.getMessages(conv.id);
  res.status(201).json({ data: { ...conv, messages } });
};

export const getWechatAssistant = (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: '未认证' });

  const existingList = ConversationService.list(userId).filter(
    c => c.conversationType === 'wechat_assistant' ||
         c.scopeType === 'wechat' ||
         (c.title === '微信助手' && (c.agentIds.some(id => id === 'rc-wechat-agent') || c.currentAgentId === 'rc-wechat-agent'))
  );

  if (existingList.length > 0) {
    const conv = existingList[0];
    const waAgent = AgentService.getByIdOrCode('rc-wechat-agent', userId);
    if (waAgent) {
      const ocSessionKey = `agent:rc-wechat-agent:rc:${conv.id}`;
      ConversationService.bindOpenClawSession(conv.id, ocSessionKey, waAgent.id, [waAgent.id]);
      logger.info(`[Wechat Assistant] Ensured oc_session_key for existing conversation ${conv.id}`);
    }
    const messages = ConversationService.getMessages(conv.id);
    return res.json({ data: { ...conv, messages } });
  }

  const waAgent = AgentService.getByIdOrCode('rc-wechat-agent', userId);
  if (!waAgent) return res.status(500).json({ error: '微信助手未找到' });

  const conv = ConversationService.create({
    agentIds: [waAgent.id], title: '微信助手', createdBy: userId, userId,
    currentAgentId: waAgent.id, scopeType: 'user', scopeId: userId, memoryPolicy: 'private',
    conversationType: 'wechat_assistant',
  });
  const ocSessionKey = `agent:rc-wechat-agent:rc:${conv.id}`;
  ConversationService.bindOpenClawSession(conv.id, ocSessionKey, waAgent.id, [waAgent.id]);
  logger.info(`[Wechat Assistant] Created conversation ${conv.id} for user ${userId}, ocSessionKey=${ocSessionKey}`);
  const messages = ConversationService.getMessages(conv.id);
  res.status(201).json({ data: { ...conv, messages } });
};

// ─── CRUD ───────────────────────────────────────────────────────────────

export const createConversation = (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const userRole = (req as any).user?.role;
  const parsed = CreateConvSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { agentId, agentIds, projectId, taskId, title, createdBy } = parsed.data;
  let scope;
  try { scope = normalizeConversationScope(parsed.data, userId, userRole); }
  catch (err: unknown) { return res.status(400).json({ error: getErrorMessage(err) || 'scope invalid' }); }

  const ids: string[] = agentIds?.length ? agentIds : [agentId!];
  const resolvedAgents = ids.map((id) => resolveAgentOr404(id, userId));
  const missingAgent = resolvedAgents.findIndex((a) => !a);
  if (missingAgent >= 0) return res.status(404).json({ error: `Agent not found: ${ids[missingAgent]}` });

  const normalizedAgentIds = resolvedAgents.map((a) => a!.id);
  const resolvedTask = taskId ? resolveTaskOr404(taskId) : null;
  if (taskId && !resolvedTask) return res.status(404).json({ error: `Task not found: ${taskId}` });

  if (resolvedTask) {
    const existingConvs = ConversationService.list(userId).filter(c => c.taskId === resolvedTask.id || c.sessionCode === resolvedTask.taskCode);
    if (existingConvs.length > 0) return res.status(200).json({ data: existingConvs[0] });
  }

  res.status(201).json({ data: ConversationService.create({
    agentIds: normalizedAgentIds, projectId, taskId: resolvedTask?.id || resolvedTask?.taskCode,
    title, createdBy, userId, scopeType: scope.scopeType, scopeId: scope.scopeId, memoryPolicy: scope.memoryPolicy,
  }) });
};

export const updateConversation = (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const userRole = (req as any).user?.role;
  const { title, projectId, taskId, scopeType, scopeId, memoryPolicy, summary } = req.body;
  const conv = resolveConversationOr404(req.params.id, userId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (!canAccessConversation(conv, userId, userRole)) return res.status(403).json({ error: "无权操作此会话" });

  const resolvedTask = taskId ? resolveTaskOr404(taskId) : null;
  if (taskId && !resolvedTask) return res.status(404).json({ error: `Task not found: ${taskId}` });

  let scope;
  try { scope = normalizeConversationScope({ scopeType, scopeId, memoryPolicy }, userId, userRole); }
  catch (err: unknown) { return res.status(400).json({ error: getErrorMessage(err) || 'scope invalid' }); }

  const updated = ConversationService.update(conv.id, {
    title, projectId, taskId: resolvedTask?.id || undefined,
    scopeType: scope.scopeType, scopeId: scope.scopeId, memoryPolicy: scope.memoryPolicy, summary,
  });
  if (!updated) return res.status(404).json({ error: "Conversation not found" });
  res.json({ data: updated });
};

export const deleteConversation = (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const userRole = (req as any).user?.role;
  const conv = resolveConversationOr404(req.params.id, userId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (conv.agentIds.some(id => AgentService.isPlatformAssistantId(id))) {
    return res.status(403).json({ error: "平台助手会话不可删除" });
  }
  if (!canAccessConversation(conv, userId, userRole)) return res.status(403).json({ error: "无权删除此会话" });

  const deleted = ConversationService.delete(conv.id);
  if (!deleted) return res.status(500).json({ error: "Failed to delete conversation" });
  res.json({ success: true, message: "Conversation deleted" });
};

export const updateConversationStatus = (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const userRole = (req as any).user?.role;
  const { status } = req.body;
  if (!status || !['active', 'in_progress', 'completed', 'archived', 'deleted', 'closed'].includes(status)) {
    return res.status(400).json({ error: "status must be one of: active, in_progress, completed, archived, deleted, closed" });
  }
  const conv = resolveConversationOr404(req.params.id, userId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (!canAccessConversation(conv, userId, userRole)) return res.status(403).json({ error: "无权操作此会话" });

  if (isGlobalAssistantConv(conv) && !['active', 'in_progress'].includes(status)) {
    return res.status(400).json({ error: "全局助手会话只允许 active/in_progress 状态" });
  }

  const updated = ConversationService.updateStatus(conv.id, status as 'active' | 'in_progress' | 'completed' | 'archived' | 'deleted' | 'closed');
  if (!updated) return res.status(404).json({ error: "Conversation not found" });
  res.json({ data: updated });
};

export const switchAgent = (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const userRole = (req as any).user?.role;
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: "agentId required" });

  const conv = resolveConversationOr404(req.params.id, userId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (!canAccessConversation(conv, userId, userRole)) return res.status(403).json({ error: "无权操作此会话" });

  const agent = resolveAgentOr404(agentId, userId);
  if (!agent) return res.status(404).json({ error: `Agent not found: ${agentId}` });

  const success = ConversationService.switchAgent(conv.id, agent.id);
  if (!success) return res.status(404).json({ error: "Conversation not found" });

  const updated = ConversationService.getById(conv.id);
  res.json({
    code: 0,
    data: {
      conversationId: conv.id, sessionCode: updated?.sessionCode,
      currentAgentId: updated?.currentAgentId || agent.id,
      currentAgentCode: updated?.currentAgentCode,
      agentIds: updated?.agentIds || [agent.id],
      agentId: updated?.currentAgentId || agent.id,
    },
    msg: "ok",
  });
};

// ─── Agent 管理 ─────────────────────────────────────────────────────────

export const addAgentToConversation = (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const userRole = (req as any).user?.role;
  const conv = resolveConversationOr404(req.params.id, userId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (!canAccessConversation(conv, userId, userRole)) return res.status(403).json({ error: "无权操作此会话" });

  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: "agentId required" });

  const agent = resolveAgentOr404(agentId, userId);
  if (!agent) return res.status(404).json({ error: `Agent not found: ${agentId}` });

  ConversationService.addAgent(conv.id, agent.id);
  const updated = ConversationService.getById(conv.id);
  res.json({ success: true, data: updated });
};

export const removeAgentFromConversation = (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const userRole = (req as any).user?.role;
  const conv = resolveConversationOr404(req.params.id, userId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (!canAccessConversation(conv, userId, userRole)) return res.status(403).json({ error: "无权操作此会话" });

  const agent = resolveAgentOr404(req.params.agentId, userId);
  if (!agent) return res.status(404).json({ error: `Agent not found: ${req.params.agentId}` });

  ConversationService.removeAgent(conv.id, agent.id);
  const updated = ConversationService.getById(conv.id);
  res.json({ success: true, data: updated });
};

// ─── 消息 ───────────────────────────────────────────────────────────────

export const getMessages = (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const userRole = (req as any).user?.role;
  const conv = resolveConversationOr404(req.params.id, userId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (!canAccessConversation(conv, userId, userRole)) return res.status(403).json({ error: "无权限访问此会话消息" });
  res.json({ data: ConversationService.getMessages(conv.id) });
};

export const addMessage = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const userRole = (req as any).user?.role;
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: "content required" });

  const conv = resolveConversationOr404(req.params.id, userId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (!canAccessConversation(conv, userId, userRole)) return res.status(403).json({ error: "无权限操作此会话" });

  const msg = ConversationService.addMessage({ conversationId: conv.id, role: "user", content });

  const isPA = conv.agentIds?.some((id: string) => AgentService.isPlatformAssistantId(id));
  if (isPA) {
    try {
      const paAgent = conv.agentIds
        .map((id: string) => AgentService.getByIdOrCode(id, userId))
        .find((a: any) => a && AgentService.isPlatformAssistantId(a.id));

      if (paAgent) {
        const { resolveOpenClawGateway } = require('../../utils/openclawGateway');
        const gateway = resolveOpenClawGateway();
        const https = require('https');
        const http = require('http');
        const { PLATFORM_TOOLS, executeToolCall } = require('../../services/PlatformAssistantTools');

        let systemPrompt = paAgent.systemPrompt || '';
        if (paAgent.writingStyle) systemPrompt += `\n\n写作风格：${paAgent.writingStyle}`;
        if (paAgent.expertise?.length) systemPrompt += `\n\n专业领域：${paAgent.expertise.join('、')}`;
        if (paAgent.outputFormat && paAgent.outputFormat !== '纯文本') {
          systemPrompt += `\n\n## 输出格式要求\n${paAgent.outputFormat}`;
        }
        if (paAgent.boundary?.trim()) systemPrompt += `\n\n## 能力边界\n${paAgent.boundary.trim()}`;
        systemPrompt += `\n\n你的名字是 ${paAgent.name}，请始终以第一人称回复。`;
        systemPrompt += `\n\n## 可用工具\n你可以使用以下工具获取实时数据。当用户询问平台状态、数量、列表等信息时，优先调用工具而非凭记忆回答。`;

        try {
          const memoryContext = await MemoryService.search({ query: content, userId, agentId: paAgent.id, topK: 3 }).catch(() => []);
          if (memoryContext.length > 0) {
            const memoryText = memoryContext.map((m: any) => `【记忆】${m.title || m.content.slice(0, 100)} (相关度: ${(m.score * 100).toFixed(0)}%)`).join('\n');
            systemPrompt = `[相关记忆]\n${memoryText}\n\n${systemPrompt}`;
            logger.info(`[Memory Inject] ${memoryContext.length} memories injected for conv=${conv.id}`);
          }
        } catch (err: unknown) {
          logger.warn(`[Memory Inject] Failed to retrieve memories: ${getErrorMessage(err)}`);
        }

        const historyMessages = ConversationService.getMessages(conv.id);
        const messages: Array<{ role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string }> = [
          { role: "system", content: systemPrompt },
          ...historyMessages.slice(-20).map((m: any) => ({
            role: m.role === "agent" ? "assistant" : "user", content: m.content,
          })),
        ];

        for (let toolRound = 0; toolRound < 3; toolRound++) {
          const payload = JSON.stringify({
            model: `openclaw/${paAgent.openclawAgentId}`, stream: false, messages,
            tools: PLATFORM_TOOLS, tool_choice: 'auto',
          });
          const gatewayUrl = new URL(`${gateway.url}/v1/chat/completions`);
          const lib = gatewayUrl.protocol === "https:" ? https : http;

          const response = await new Promise<Record<string, unknown>>((resolve) => {
            const apiReq = lib.request(gatewayUrl.toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), "Authorization": `Bearer ${gateway.token}` },
            }, (apiRes: import('http').IncomingMessage) => {
              let body = "";
              apiRes.on("data", (d: Buffer) => (body += d.toString()));
              apiRes.on("end", () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
            });
            apiReq.on("error", () => resolve(null));
            apiReq.setTimeout(30000, () => { apiReq.destroy(); resolve(null); });
            apiReq.write(payload); apiReq.end();
          });

          if (!(response as Record<string, unknown>)?.choices?.[0]) {
            logger.error('[Platform Assistant] Gateway returned no response'); break;
          }

          const choice = ((response as Record<string, unknown>).choices as Array<{ message: { content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }>)[0];
          const assistantMsg = choice.message;

          if (assistantMsg?.tool_calls && assistantMsg.tool_calls.length > 0) {
            messages.push({ role: 'assistant', content: assistantMsg.content || null, tool_calls: assistantMsg.tool_calls });
            for (const tc of assistantMsg.tool_calls) {
              const toolCall = { name: tc.function.name, arguments: JSON.parse(tc.function.arguments || '{}') };
              logger.info('[Platform Assistant] Executing tool', { tool: toolCall.name, args: toolCall.arguments });
              const result = await executeToolCall(toolCall, userId);
              messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
            }
            continue;
          }

          if (assistantMsg?.content) {
            const aiMsg = ConversationService.addMessage({
              conversationId: conv.id, role: "agent", content: assistantMsg.content,
              agentId: paAgent.id, tokenCount: ((response as Record<string, unknown>).usage as Record<string, unknown>)?.total_tokens as number || 0,
            });
            return res.status(201).json({ data: { userMessage: msg, agentMessage: aiMsg } });
          }
          break;
        }
      }
    } catch (err: unknown) {
      logger.error('[Platform Assistant] AI reply failed: ' + getErrorMessage(err));
    }
  }
  res.status(201).json({ data: msg });
};

// ─── 生成 & 概述 ────────────────────────────────────────────────────────

export const generateReply = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: "agentId required" });

  const conv = resolveConversationOr404(req.params.id, userId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });

  const agent = resolveAgentOr404(agentId, userId);
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  const quotaResult = AgentService.checkQuota(agent.id, userId);
  if (!quotaResult.allowed) return res.status(429).json({ error: quotaResult.reason });

  const maxTokensPerMsg = AgentService.getMaxTokensPerMessage(agent.id);
  const messages = ConversationService.getMessages(conv.id);
  const history = messages.map((m) => ({ role: m.role === "agent" ? "assistant" : "user", content: m.content }));

  let fullContent = "";
  let errorMsg: string | null = null;
  let tokenCount = 0;

  await new Promise<void>((resolve) => {
    AgentService.generateStream(agent.id, history,
      (chunk) => { if (maxTokensPerMsg && fullContent.length >= maxTokensPerMsg) return; fullContent += chunk; },
      (tokens) => { tokenCount = tokens; resolve(); },
      (err) => { errorMsg = err.message; resolve(); }
    );
  });

  if (errorMsg) return res.status(500).json({ error: errorMsg });

  AgentService.recordUsage(userId, agent.id, tokenCount);
  AgentService.addTokenUsed(agent.id, tokenCount);

  const agentMsg = ConversationService.addMessage({
    conversationId: conv.id, role: "agent", content: fullContent, agentId: agent.id,
  });
  res.status(201).json({ data: agentMsg });
};

export const createWithOverview = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { title, agentIds, projectId, description } = req.body;

  if (!title || !agentIds || !agentIds.length) {
    return res.status(400).json({ error: "title and agentIds (non-empty array) are required" });
  }

  const resolvedAgents = [];
  for (const id of agentIds) {
    const agent = resolveAgentOr404(id, userId);
    if (!agent) return res.status(404).json({ error: `Agent not found: ${id}` });
    resolvedAgents.push(agent);
  }

  const businessAgentIds = resolvedAgents.map(agent => agent.id);

  const conv = ConversationService.create({
    agentIds: businessAgentIds, projectId, title, createdBy: userId, userId,
    currentAgentId: businessAgentIds[0],
  });

  const messages = ConversationService.getMessages(conv.id);
  res.status(201).json({ data: { ...conv, messages } });

  // 后台异步生成概述
  const mainAgentId = resolvedAgents[0].id;
  const agentNames = resolvedAgents.map(a => a.name).join('、');
  const isProject = agentIds.length >= 2;
  const typeLabel = isProject ? '项目' : '任务';
  const descText = description ? `\n\n任务描述：${description}` : '';
  const convId = conv.id;
  const convSessionCode = conv.sessionCode || '';

  const overviewPrompt = `你是一名${isProject ? '项目经理' : '任务助手'}。请根据以下信息生成一份简洁的项目概述。

${typeLabel}名称：${title}
参与智能体：${agentNames}
智能体详情：${resolvedAgents.map(a => `  - ${a.name}：擅长${a.expertise?.join('、') || '通用'}，${a.description || '暂无描述'}`).join('\n')}${descText}

请按以下格式输出（使用 Markdown）：

# ${title} — 项目概述

## 项目简介\n简要说明本项目的目标和范围（2-3 句）\n\n## 参与角色\n列出每个智能体的职责分工\n\n## 初始建议\n给出 2-3 条可立即执行的下一步建议\n`;

  setImmediate(async () => {
    try {
      logger.info(`[create-with-overview] Async overview generation started for conv=${convId}`);
      AgentService.checkQuota(mainAgentId, userId);

      let fullContent = "";
      let errorMsg: string | null = null;
      let tokenCount = 0;

      await new Promise<void>((resolve) => {
        AgentService.generateStream(mainAgentId, [{ role: "user", content: overviewPrompt }],
          (chunk) => {
            fullContent += chunk;
            broadcastToConversation(convId, { type: 'overview_chunk', conversationId: convId, sessionCode: convSessionCode, chunk });
          },
          (tokens) => { tokenCount = tokens; resolve(); },
          (err) => { errorMsg = err?.message || '生成失败'; resolve(); }
        );
      });

      if (!errorMsg && fullContent) {
        AgentService.recordUsage(userId, mainAgentId, tokenCount);
        AgentService.addTokenUsed(mainAgentId, tokenCount);
        const agentMsg = ConversationService.addMessage({
          conversationId: convId, role: "agent", content: fullContent, agentId: mainAgentId, tokenCount,
        });
        broadcastToConversation(convId, { type: 'overview_done', conversationId: convId, sessionCode: convSessionCode, message: agentMsg });
        logger.info(`[create-with-overview] Async overview completed for conv=${convId}, tokens=${tokenCount}`);
      } else {
        logger.warn(`[create-with-overview] Async overview failed for conv=${convId}: ${errorMsg}`);
      }
    } catch (err: unknown) {
      logger.error(`[create-with-overview] Async overview error for conv=${convId}:`, { error: getErrorMessage(err) });
    }
  });
};
