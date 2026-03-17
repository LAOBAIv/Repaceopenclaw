import { Router, Request, Response } from "express";
import { AgentService } from "../services/AgentService";
import { getDb } from "../db/client";
import { z } from "zod";

const router = Router();

const AgentSchema = z.object({
  name: z.string().min(1),
  color: z.string().default("#6366F1"),
  systemPrompt: z.string().default(""),
  writingStyle: z.string().default("balanced"),
  expertise: z.array(z.string()).default([]),
  description: z.string().default(""),
  status: z.enum(["active", "idle", "busy"]).default("idle"),
  // 模型参数
  modelName: z.string().default(""),
  modelProvider: z.string().default(""),
  temperature: z.number().default(0.7),
  maxTokens: z.number().default(4096),
  topP: z.number().default(1),
  frequencyPenalty: z.number().default(0),
  presencePenalty: z.number().default(0),
  // 用户配置的私有 Token 接入
  tokenProvider: z.string().default(""),
  tokenApiKey: z.string().default(""),
  tokenBaseUrl: z.string().default(""),
  // 输出格式 & 能力边界
  outputFormat: z.string().default("纯文本"),
  boundary: z.string().default(""),
  // 对话记忆轮数（0 = 不限）
  memoryTurns: z.number().default(0),
  // 简单温度快捷覆盖（null = 使用模型默认）
  temperatureOverride: z.number().nullable().default(null),
});

router.get("/", (req: Request, res: Response) => {
  const agents = AgentService.list();
  res.json({ data: agents });
});

router.get("/:id", (req: Request, res: Response) => {
  const agent = AgentService.getById(req.params.id);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  res.json({ data: agent });
});

/**
 * GET /api/agents/:id/token-stats
 * 返回该智能体的 token 用量统计：
 *   - tokenUsed        : agents 表中累计消耗总 token 数
 *   - messageCount     : 该 agent 回复的消息数
 *   - avgTokenPerMsg   : 平均每条消息消耗 token 数
 *   - perConversation  : 按会话汇总的 token 用量列表（conversationId, total, messageCount）
 */
router.get("/:id/token-stats", (req: Request, res: Response) => {
  const agent = AgentService.getById(req.params.id);
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  const db = getDb();

  // 汇总每条消息
  const msgResult = db.exec(
    `SELECT COUNT(*) as msg_count, SUM(token_count) as total_tokens
     FROM messages WHERE agent_id = ? AND role = 'agent'`,
    [req.params.id]
  );
  const msgRow = msgResult.length && msgResult[0].values.length ? msgResult[0].values[0] : [0, 0];
  const messageCount = Number(msgRow[0]) || 0;
  const totalFromMessages = Number(msgRow[1]) || 0;

  // 按会话汇总
  const convResult = db.exec(
    `SELECT conversation_id,
            COUNT(*) as msg_count,
            SUM(token_count) as total_tokens
     FROM messages
     WHERE agent_id = ? AND role = 'agent'
     GROUP BY conversation_id
     ORDER BY total_tokens DESC`,
    [req.params.id]
  );
  const perConversation: Array<{ conversationId: string; messageCount: number; totalTokens: number }> = [];
  if (convResult.length && convResult[0].values.length) {
    const cols = convResult[0].columns;
    for (const row of convResult[0].values) {
      const obj: any = {};
      cols.forEach((c, i) => (obj[c] = row[i]));
      perConversation.push({
        conversationId: obj.conversation_id,
        messageCount: Number(obj.msg_count) || 0,
        totalTokens: Number(obj.total_tokens) || 0,
      });
    }
  }

  res.json({
    data: {
      agentId: req.params.id,
      agentName: agent.name,
      /** agents.token_used：实时累计，从未重置 */
      tokenUsed: agent.tokenUsed,
      /** 从 messages 表统计（与 tokenUsed 理论一致，可做交叉验证） */
      tokenFromMessages: totalFromMessages,
      messageCount,
      avgTokenPerMsg: messageCount > 0 ? Math.round(totalFromMessages / messageCount) : 0,
      perConversation,
    },
  });
});

router.post("/", (req: Request, res: Response) => {
  const parsed = AgentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  // AgentSchema has defaults for all fields, so cast is safe
  const agent = AgentService.create(parsed.data as Parameters<typeof AgentService.create>[0]);
  res.status(201).json({ data: agent });
});

router.put("/:id", (req: Request, res: Response) => {
  const parsed = AgentSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const agent = AgentService.update(req.params.id, parsed.data);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  res.json({ data: agent });
});

router.delete("/:id", (req: Request, res: Response) => {
  AgentService.delete(req.params.id);
  res.json({ success: true });
});

export default router;

