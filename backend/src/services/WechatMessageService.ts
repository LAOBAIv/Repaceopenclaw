/**
 * WechatMessageService — 微信消息长轮询和处理服务
 *
 * 方案 B：RC 代理 Gateway 模式
 * 根据 @tencent-weixin/openclaw-weixin 文档实现：
 * 1. 长轮询 getUpdates API 获取微信消息
 * 2. 调用 Gateway /v1/chat/completions 处理消息
 * 3. 调用 sendMessage API 发送回复
 */

import https from 'https';
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { resolveOpenClawGateway } from '../utils/openclawGateway';
import { ILinkResponse, isError, getErrorMessage, MediaItem } from '../types/ilink';

// ─── 配置 ────────────────────────────────────────────────────────────────

const ILINK_BASE = 'https://ilinkai.weixin.qq.com';
const POLL_TIMEOUT = 35000; // 长轮询超时 35 秒（服务器建议值）
const REQUEST_TIMEOUT = 60000; // 请求超时 60 秒

// ─── 类型定义 ────────────────────────────────────────────────────────────

interface WechatAccount {
  token: string;
  userId: string;
  baseUrl: string;
  getUpdatesBuf?: string;
}

interface WeixinMessage {
  seq?: number;
  message_id?: number;
  from_user_id?: string;
  to_user_id?: string;
  create_time_ms?: number;
  session_id?: string;
  message_type?: number; // 1 = USER, 2 = BOT
  message_state?: number; // 0 = NEW, 1 = GENERATING, 2 = FINISH
  item_list?: MessageItem[];
  context_token?: string;
}

interface MessageItem {
  type: number; // 1 = TEXT, 2 = IMAGE, 3 = VOICE, 4 = FILE, 5 = VIDEO
  text_item?: { text: string };
  image_item?: MediaItem;
  voice_item?: MediaItem;
  file_item?: MediaItem;
  video_item?: MediaItem;
}

interface GetUpdatesResponse {
  ret: number;
  errcode?: number;
  errmsg?: string;
  msgs?: WeixinMessage[];
  get_updates_buf?: string;
  longpolling_timeout_ms?: number;
}

interface SendMessageResponse {
  ret: number;
  errcode?: number;
  errmsg?: string;
  message_id?: number;
}

// ─── 辅助函数：从文件加载微信账号 ────────────────────────────────────────

const WECHAT_ACCOUNTS_DIR = '/root/.openclaw/openclaw-weixin/accounts';

function loadWechatAccountsFromFile(): WechatAccount[] {
  const accounts: WechatAccount[] = [];
  
  try {
    if (!fs.existsSync(WECHAT_ACCOUNTS_DIR)) {
      logger.warn(`[WechatMessageService] Accounts directory not found: ${WECHAT_ACCOUNTS_DIR}`);
      return accounts;
    }

    const files = fs.readdirSync(WECHAT_ACCOUNTS_DIR);
    
    for (const file of files) {
      if (!file.endsWith('-im-bot.json')) continue;
      
      try {
        const filePath = path.join(WECHAT_ACCOUNTS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        if (data.token && data.userId) {
          // 尝试加载同步状态文件
          const syncFile = file.replace('-im-bot.json', '-im-bot.sync.json');
          const syncPath = path.join(WECHAT_ACCOUNTS_DIR, syncFile);
          let getUpdatesBuf: string | undefined;
          
          if (fs.existsSync(syncPath)) {
            try {
              const syncContent = fs.readFileSync(syncPath, 'utf-8');
              const syncData = JSON.parse(syncContent);
              getUpdatesBuf = syncData.get_updates_buf;
            } catch (e) {
              // 忽略同步文件读取错误
            }
          }
          
          accounts.push({
            token: data.token,
            userId: data.userId,
            baseUrl: data.baseUrl || ILINK_BASE,
            getUpdatesBuf,
          });
          
          logger.info(`[WechatMessageService] Loaded account from file: ${data.userId}`);
        }
      } catch (err: unknown) {
        logger.warn(`[WechatMessageService] Failed to load account file ${file}: ${getErrorMessage(err)}`);
      }
    }
  } catch (err: unknown) {
    logger.error(`[WechatMessageService] Failed to read accounts directory: ${getErrorMessage(err)}`);
  }
  
  return accounts;
}

// ─── HTTP 请求函数（使用 Bearer Token 认证）────────────────────────────────

function makeRequest(
  method: string,
  url: string,
  token: string,
  body?: unknown,
  timeout = REQUEST_TIMEOUT
): Promise<ILinkResponse> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const payload = body ? JSON.stringify(body) : '';
    
    // 生成随机 X-WECHAT-UIN (Base64-encoded random uint32)
    const uin = crypto.randomBytes(4).readUInt32LE(0);
    const uinBase64 = Buffer.from(uin.toString()).toString('base64');
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'AuthorizationType': 'ilink_bot_token',
        'Authorization': `Bearer ${token}`,
        'X-WECHAT-UIN': uinBase64,
        'User-Agent': 'RepaceClaw/1.0',
      },
      timeout,
    };

    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode || 0, data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Gateway API 调用 ──────────────────────────────────────────────────────

async function callGatewayChat(
  message: string,
  userId: string,
  contextToken: string | undefined,
  agentId: string = 'rc-wechat-agent'
): Promise<string> {
  const { url: gatewayUrl, token: gatewayToken } = resolveOpenClawGateway();
  
  // 构建 session key: agent:{ocAgentId}:openclaw-weixin:direct:{ilinkUserId}
  const sessionKey = `agent:${agentId}:openclaw-weixin:direct:${userId}`;

  // 如果有 context_token，可以作为额外上下文传递
  const systemPrompt = contextToken 
    ? `微信对话上下文 token: ${contextToken}` 
    : undefined;

  const response = await makeRequest(
    'POST',
    `${gatewayUrl}/v1/chat/completions`,
    gatewayToken,
    {
      model: `openclaw/${agentId}`,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: message }
      ],
      stream: false,
      session: sessionKey,
    },
    60000 // 1 分钟超时
  );

  if (response.status !== 200) {
    logger.error(`[WechatMessageService] Gateway error: ${response.status} ${JSON.stringify(response.data)}`);
    throw new Error(`Gateway error: ${response.status}`);
  }

  // 解析响应
  const data = response.data as { choices?: Array<{ message?: { content?: string } }> };
  if (data.choices && data.choices[0]?.message?.content) {
    return data.choices[0].message.content;
  }

  logger.warn('[WechatMessageService] Unexpected Gateway response format');
  return '抱歉，处理消息时出现错误。';
}

// ─── 微信消息处理服务 ────────────────────────────────────────────────────

class WechatMessageService {
  private accounts: Map<string, WechatAccount> = new Map();
  private pollTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private isPolling: Map<string, boolean> = new Map();
  private running = false;

  // ─── 账号管理 ──────────────────────────────────────────────────────────

  addAccount(token: string, userId: string, baseUrl: string = ILINK_BASE): void {
    this.accounts.set(token, { token, userId, baseUrl });
    logger.info(`[WechatMessageService] Account added: ${userId}`);
  }

  removeAccount(token: string): void {
    const account = this.accounts.get(token);
    if (account) {
      this.stopPollForAccount(token);
      this.accounts.delete(token);
      logger.info(`[WechatMessageService] Account removed: ${account.userId}`);
    }
  }

  getAccounts(): WechatAccount[] {
    return Array.from(this.accounts.values());
  }

  // ─── 轮询控制 ───────────────────────────────────────────────────────────

  start(): void {
    if (this.running) {
      logger.warn('[WechatMessageService] Already running');
      return;
    }

    if (this.accounts.size === 0) {
      logger.warn('[WechatMessageService] No accounts configured');
      return;
    }

    this.running = true;
    logger.info(`[WechatMessageService] Starting poll service for ${this.accounts.size} accounts`);

    // 为每个账号启动长轮询
    for (const account of this.accounts.values()) {
      this.startPollForAccount(account);
    }
  }

  stop(): void {
    this.running = false;
    for (const token of this.pollTimers.keys()) {
      this.stopPollForAccount(token);
    }
    logger.info('[WechatMessageService] Stopped');
  }

  private startPollForAccount(account: WechatAccount): void {
    if (this.pollTimers.has(account.token)) return;
    
    this.isPolling.set(account.token, false);
    
    // 立即开始长轮询
    this.pollAccount(account);
    
    logger.info(`[WechatMessageService] Started polling for ${account.userId}`);
  }

  private stopPollForAccount(token: string): void {
    const timer = this.pollTimers.get(token);
    if (timer) {
      clearTimeout(timer);
      this.pollTimers.delete(token);
    }
    this.isPolling.delete(token);
  }

  // ─── 长轮询逻辑 ───────────────────────────────────────────────────────────

  private pollAccount(account: WechatAccount): void {
    // 防止并发轮询
    if (this.isPolling.get(account.token)) return;
    if (!this.running) return;
    
    this.isPolling.set(account.token, true);

    this.doLongPoll(account)
      .then(() => {
        this.isPolling.set(account.token, false);
        // 长轮询结束后立即开始下一次（长轮询本身就是等待）
        if (this.running) {
          this.pollAccount(account);
        }
      })
      .catch((err: Error) => {
        this.isPolling.set(account.token, false);
        logger.error(`[WechatMessageService] Long poll error for ${account.userId}: ${err.message}`);
        
        // 出错后延迟重试
        if (this.running) {
          const timer = setTimeout(() => this.pollAccount(account), 5000);
          this.pollTimers.set(account.token, timer);
        }
      });
  }

  private async doLongPoll(account: WechatAccount): Promise<void> {
    try {
      // 调用 getUpdates API（长轮询）
      const result = await makeRequest(
        'POST',
        `${account.baseUrl}/ilink/bot/getupdates`,
        account.token,
        { get_updates_buf: account.getUpdatesBuf || '' },
        POLL_TIMEOUT + 10000 // 长轮询超时 + 10秒缓冲
      );

      if (result.status !== 200 || (result.data as GetUpdatesResponse)?.ret !== 0) {
        const errCode = (result.data as GetUpdatesResponse)?.errcode;
        const errMsg = (result.data as GetUpdatesResponse)?.errmsg || JSON.stringify(result.data);
        
        // -14 表示 session timeout，需要重新登录
        if (errCode === -14) {
          logger.error(`[WechatMessageService] Session timeout for ${account.userId}, need re-login`);
          // 可以在这里触发重新登录逻辑
          return;
        }
        
        logger.warn(`[WechatMessageService] getUpdates failed for ${account.userId}: ${result.status} ${errMsg}`);
        return;
      }

      // 更新 get_updates_buf
      if ((result.data as GetUpdatesResponse).get_updates_buf) {
        account.getUpdatesBuf = (result.data as GetUpdatesResponse).get_updates_buf;
        // 保存到文件
        this.saveSyncState(account);
      }

      const msgs = (result.data as GetUpdatesResponse).msgs || [];
      if (msgs.length === 0) {
        // 长轮询超时，没有新消息，这是正常情况
        logger.debug(`[WechatMessageService] No new messages for ${account.userId}`);
        return;
      }

      logger.info(`[WechatMessageService] Received ${msgs.length} messages for ${account.userId}`);

      // 处理每条消息
      for (const msg of msgs) {
        await this.processMessage(account, msg);
      }
    } catch (err: unknown) {
      // 网络错误或超时
      throw err;
    }
  }

  private async processMessage(account: WechatAccount, msg: WeixinMessage): Promise<void> {
    // 只处理用户消息（message_type = 1）
    if (msg.message_type !== 1) {
      logger.debug(`[WechatMessageService] Skipping non-user message: type=${msg.message_type}`);
      return;
    }

    const userId = msg.from_user_id;
    const contextToken = msg.context_token;
    const items = msg.item_list || [];

    if (!userId) {
      logger.warn('[WechatMessageService] Message missing from_user_id');
      return;
    }

    // 提取文本内容
    let text = '';
    for (const item of items) {
      if (item.type === 1 && item.text_item?.text) {
        text += item.text_item.text;
      }
    }

    if (!text) {
      logger.debug(`[WechatMessageService] No text content in message from ${userId}`);
      return;
    }

    logger.info(`[WechatMessageService] Processing message from ${userId}: ${text.substring(0, 50)}...`);

    try {
      // 调用 Gateway 处理消息
      const reply = await callGatewayChat(text, userId, contextToken);

      // 发送回复
      await this.sendMessage(account, userId, reply, contextToken);

      logger.info(`[WechatMessageService] Reply sent to ${userId}`);
    } catch (err: unknown) {
      logger.error(`[WechatMessageService] Failed to process message: ${getErrorMessage(err)}`);
    }
  }

  private async sendMessage(
    account: WechatAccount,
    toUserId: string,
    text: string,
    contextToken?: string
  ): Promise<void> {
    const result = await makeRequest(
      'POST',
      `${account.baseUrl}/ilink/bot/sendmessage`,
      account.token,
      {
        msg: {
          to_user_id: toUserId,
          context_token: contextToken || '',
          item_list: [
            {
              type: 1,
              text_item: { text }
            }
          ]
        }
      }
    );

    if (result.status !== 200 || (result.data as SendMessageResponse)?.ret !== 0) {
      throw new Error(`sendMessage failed: ${result.status} ${JSON.stringify(result.data)}`);
    }
  }

  private saveSyncState(account: WechatAccount): void {
    if (!account.getUpdatesBuf) return;
    
    try {
      const botId = account.token.split('@')[0]; // e.g., "410860c3bb94@im.bot:..." -> "410860c3bb94"
      const syncPath = path.join(WECHAT_ACCOUNTS_DIR, `${botId}-im-bot.sync.json`);
      
      fs.writeFileSync(syncPath, JSON.stringify({
        get_updates_buf: account.getUpdatesBuf
      }, null, 2));
    } catch (err: unknown) {
      logger.warn(`[WechatMessageService] Failed to save sync state: ${getErrorMessage(err)}`);
    }
  }
}

// ─── 单例导出 ────────────────────────────────────────────────────────────

export const wechatMessageService = new WechatMessageService();
export { loadWechatAccountsFromFile };