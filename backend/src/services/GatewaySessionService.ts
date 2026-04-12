// GatewaySessionService — 通过 OpenClaw Gateway 管理会话
//
// RepaceClaw 不再自己管理会话和消息，所有会话操作委托给 OpenClaw Gateway。
// Gateway 提供：
//   1. 会话创建和管理
//   2. 模型路由和 LLM 调用
//   3. 流式输出
//   4. 子代理编排

import https from 'https';
import http from 'http';
import { URL } from 'url';

// ─── 配置 ────────────────────────────────────────────────────────────────
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '021a420c0665ef2813ffe22e10725a629c58565ced1345d3';

// ─── 类型 ────────────────────────────────────────────────────────────────
export interface GatewaySession {
  id: string;
  agentName?: string;
  agentId?: string;
  modelName?: string;
  createdAt: string;
}

export interface GatewayMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  tokenCount?: number;
}

// ─── HTTP 请求封装 ──────────────────────────────────────────────────────
function gatewayFetch(path: string, body: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${GATEWAY_URL}${path}`);
    const payload = JSON.stringify(body);

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Gateway response parse error: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Gateway timeout')); });
    req.write(payload);
    req.end();
  });
}

// ─── 会话管理 ────────────────────────────────────────────────────────────
export const GatewaySessionService = {

  /**
   * 创建新会话（通过 Gateway 的 /v1/chat/completions 或 sessions API）
   * 实际上 Gateway 的会话是隐式创建的——每次请求都是一次独立会话
   * 这里我们维护一个 session ID 映射表，让 RepaceClaw 可以追踪
   */
  createSession(opts: { agentName?: string; agentId?: string; modelName?: string; systemPrompt?: string }): GatewaySession {
    const session: GatewaySession = {
      id: `gw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      agentName: opts.agentName,
      agentId: opts.agentId,
      modelName: opts.modelName,
      createdAt: new Date().toISOString(),
    };
    // 存储在内存中（RepaceClaw 维护 session → agent 映射）
    sessionStore.set(session.id, {
      ...session,
      systemPrompt: opts.systemPrompt || '',
      modelName: opts.modelName || '',
      messages: [],
    });
    console.log(`[GatewaySession] Created session ${session.id} for agent "${opts.agentName}" model="${opts.modelName || 'default'}"`);
    return session;
  },

  /**
   * 发送消息到 Gateway，获取流式回复
   * 通过 /v1/chat/completions 接口调用 Gateway
   */
  async sendMessage(
    sessionId: string,
    content: string,
    onChunk: (chunk: string) => void,
    onComplete: (tokenCount: number) => void,
    onError: (err: Error) => void
  ): Promise<void> {
    const session = sessionStore.get(sessionId);
    if (!session) {
      onError(new Error(`Session ${sessionId} not found`));
      return;
    }

    // 构建消息历史
    const messages: Array<{ role: string; content: string }> = [];

    // 添加 system prompt
    if (session.systemPrompt) {
      messages.push({ role: 'system', content: session.systemPrompt });
    }

    // 添加历史消息
    session.messages.forEach(msg => {
      messages.push({ role: msg.role === 'assistant' ? 'assistant' : msg.role, content: msg.content });
    });

    // 添加当前用户消息
    messages.push({ role: 'user', content });
    session.messages.push({ id: `msg_${Date.now()}`, role: 'user', content, createdAt: new Date().toISOString() });

    try {
      console.log(`[GatewaySession] → /v1/chat/completions (session=${sessionId}, messages=${messages.length})`);

      const url = new URL(`${GATEWAY_URL}/v1/chat/completions`);
      const payload = JSON.stringify({
        model: `openclaw/${session.agentId || 'default'}`,
        messages,
        stream: true,
      });

      const lib = url.protocol === 'https:' ? https : http;
      const req = lib.request(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization': `Bearer ${GATEWAY_TOKEN}`,
        },
      }, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          let errBody = '';
          res.on('data', (d) => (errBody += d));
          res.on('end', () => onError(new Error(`Gateway ${res.statusCode}: ${errBody.slice(0, 200)}`)));
          return;
        }

        let buffer = '';
        let fullContent = '';
        let totalTokens = 0;

        res.on('data', (data: Buffer) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (!trimmed.startsWith('data: ')) continue;

            try {
              const json = JSON.parse(trimmed.slice(6));
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                onChunk(delta);
              }
              if (json.usage?.total_tokens) {
                totalTokens = json.usage.total_tokens;
              }
            } catch { /* skip malformed */ }
          }
        });

        res.on('end', () => {
          // 保存助手消息
          session.messages.push({
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: fullContent,
            createdAt: new Date().toISOString(),
            tokenCount: totalTokens,
          });

          // 限制历史长度，避免上下文爆炸
          if (session.messages.length > 50) {
            session.messages = session.messages.slice(-40);
          }

          console.log(`[GatewaySession] ✓ session=${sessionId}, tokens=${totalTokens}, length=${fullContent.length}`);
          onComplete(totalTokens);
        });

        res.on('error', (err) => onError(err));
      });

      req.on('error', (err) => onError(err));
      req.setTimeout(120000, () => { req.destroy(); onError(new Error('Gateway timeout')); });
      req.write(payload);
      req.end();

    } catch (err: any) {
      onError(err);
    }
  },

  /**
   * 获取会话消息历史
   */
  getMessages(sessionId: string): GatewayMessage[] {
    const session = sessionStore.get(sessionId);
    return session ? session.messages : [];
  },

  /**
   * 删除会话
   */
  deleteSession(sessionId: string): boolean {
    return sessionStore.delete(sessionId);
  },

  /**
   * 列出所有会话
   */
  listSessions(): GatewaySession[] {
    return Array.from(sessionStore.values()).map(s => ({
      id: s.id,
      agentName: s.agentName,
      agentId: s.agentId,
      createdAt: s.createdAt,
    }));
  },
};

// ─── 内存会话存储 ────────────────────────────────────────────────────────
interface SessionData extends GatewaySession {
  systemPrompt: string;
  modelName: string;
  messages: GatewayMessage[];
}

const sessionStore = new Map<string, SessionData>();
