/**
 * ClawBotILink — iLink API 客户端
 *
 * 封装 iLink HMAC-SHA256 签名和 HTTP 请求。
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { logger } from '../utils/logger';
import { ILinkResponse } from '../types/ilink';

// iLink API 配置
const ILINK_BASE = 'https://ilinkai.weixin.qq.com';
const ILINK_APP_ID = process.env.ILINK_APP_ID || '';
const ILINK_SECRET_KEY = process.env.ILINK_SECRET_KEY || '';
const ILINK_ACCOUNTS_DIR = '/root/.openclaw/openclaw-weixin/accounts';

/**
 * 生成 iLink HMAC-SHA256 签名
 */
export function createILinkSignature(method: string, urlPath: string, body: string): { timestamp: string; nonce: string; signature: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(8).toString('hex');
  const signContent = `${method.toUpperCase()}\n${urlPath}\n${timestamp}\n${nonce}\n${body}`;
  const signature = crypto.createHmac('sha256', ILINK_SECRET_KEY).update(signContent).digest('hex');
  return { timestamp, nonce, signature };
}

/**
 * 读取已绑定的 iLink 账号列表
 */
export function getBoundAccounts(): Array<{ botId: string; token: string; userId: string; baseUrl: string }> {
  const accounts: Array<{ botId: string; token: string; userId: string; baseUrl: string }> = [];
  try {
    if (!fs.existsSync(ILINK_ACCOUNTS_DIR)) return accounts;
    const files = fs.readdirSync(ILINK_ACCOUNTS_DIR);
    for (const file of files) {
      if (!file.endsWith('.json') || file.includes('.context-tokens.') || file.includes('.sync.')) continue;
      try {
        const filePath = path.join(ILINK_ACCOUNTS_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (data.token) {
          accounts.push({
            botId: file.replace('.json', ''),
            token: data.token,
            userId: data.userId || '',
            baseUrl: data.baseUrl || ILINK_BASE,
          });
        }
      } catch (err) {
        logger.warn(`[ClawBotILink] Failed to parse account file: ${file}`, err);
      }
    }
  } catch (err) {
    logger.error('[ClawBotILink] Failed to read accounts directory', err);
  }
  return accounts;
}

/**
 * 向 iLink API 发起 HTTP 请求（自动 HMAC-SHA256 签名）
 */
export function callILink(method: string, urlPath: string, body?: unknown, timeout = 30000): Promise<ILinkResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(ILINK_BASE + urlPath);
    const payload = body ? JSON.stringify(body) : '';
    const { timestamp, nonce, signature } = createILinkSignature(method, url.pathname + url.search, payload);

    const reqOptions: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RepaceClaw/1.0',
        'x-app-id': ILINK_APP_ID,
        'x-timestamp': timestamp,
        'x-nonce': nonce,
        'x-signature': signature,
      },
      timeout,
    };
    if (payload) reqOptions.headers!['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode || 0, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode || 0, data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('iLink request timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * iLink GET 请求（无签名）— 用于 get_qrcode_status 等
 */
export function callILinkGet(urlPath: string, timeout = 35000): Promise<ILinkResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(ILINK_BASE + urlPath);
    const reqOptions: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'iLink-App-Id': ILINK_APP_ID,
        'iLink-App-ClientVersion': '65547',
      },
      timeout,
    };
    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode || 0, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode || 0, data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('iLink GET request timeout')); });
    req.end();
  });
}
