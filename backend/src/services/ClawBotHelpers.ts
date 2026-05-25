/**
 * ClawBotHelpers — 工具函数
 *
 * 二维码缓存、图片下载、XML 转义、Gateway 代理、账号管理。
 */
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { resolveOpenClawGateway } from '../utils/openclawGateway';
import { ILinkResponse } from '../types/ilink';

// ─── 二维码缓存 ─────────────────────────────────────────────────────────

const qrcodeImageCache = new Map<string, { qrserverUrl: string; createdAt: number }>();
const QRCODE_CACHE_TTL_MS = 10 * 60 * 1000;

export function cleanupQrcodeCache(): void {
  const now = Date.now();
  for (const [key, value] of qrcodeImageCache.entries()) {
    if (now - value.createdAt > QRCODE_CACHE_TTL_MS) qrcodeImageCache.delete(key);
  }
}

export function setQrcodeCache(id: string, qrserverUrl: string): void {
  qrcodeImageCache.set(id, { qrserverUrl, createdAt: Date.now() });
}

export function getQrcodeFromCache(id: string): { qrserverUrl: string; createdAt: number } | null {
  return qrcodeImageCache.get(id) ?? null;
}

// ─── 图片下载 ───────────────────────────────────────────────────────────

export function fetchImageAsBase64DataUri(url: string, timeout = 8000): Promise<string | null> {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, { timeout }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || 'image/png';
        resolve(`data:${contentType};base64,${buf.toString('base64')}`);
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// ─── XML 转义 ───────────────────────────────────────────────────────────

export function escapeXmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Gateway 代理 ───────────────────────────────────────────────────────

const { url: GATEWAY_URL, token: GATEWAY_TOKEN } = resolveOpenClawGateway();

export function proxyToGateway(method: string, path: string, body?: unknown, timeout = 30000): Promise<ILinkResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(GATEWAY_URL + path);
    const payload = body ? JSON.stringify(body) : '';
    const lib = url.protocol === 'https:' ? https : http;

    const reqOptions: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GATEWAY_TOKEN,
      },
      timeout,
    };
    if (payload) reqOptions.headers!['Content-Length'] = Buffer.byteLength(payload);

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode || 0, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode || 0, data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Gateway request timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── 微信账号管理 ───────────────────────────────────────────────────────

export function getWeixinAccounts(): Array<{
  accountId: string; userId: string; baseUrl: string; hasToken: boolean; savedAt: string;
}> {
  const accountsDir = path.resolve('/root/.openclaw/openclaw-weixin/accounts');
  const accounts: Array<{ accountId: string; userId: string; baseUrl: string; hasToken: boolean; savedAt: string }> = [];

  try {
    if (!fs.existsSync(accountsDir)) {
      logger.warn('[ClawBotHelpers] Accounts directory not found: ' + accountsDir);
      return accounts;
    }
    const files = fs.readdirSync(accountsDir);
    for (const file of files) {
      if (!file.endsWith('.json') || file.includes('.context-tokens.') || file.includes('.sync.')) continue;
      if (file === 'accounts.json') continue;
      const accountId = file.replace('.json', '');
      const accountFile = path.join(accountsDir, file);
      try {
        const account = JSON.parse(fs.readFileSync(accountFile, 'utf-8'));
        accounts.push({
          accountId,
          userId: account.userId || 'unknown',
          baseUrl: account.baseUrl || 'unknown',
          hasToken: !!account.token,
          savedAt: account.savedAt || 'unknown',
        });
      } catch (err: unknown) {
        logger.warn(`[ClawBotHelpers] Failed to parse account file: ${file}`, err);
      }
    }
  } catch (err: unknown) {
    logger.error('[ClawBotHelpers] Failed to read weixin accounts: ' + (err instanceof Error ? err.message : String(err)));
  }
  return accounts;
}
