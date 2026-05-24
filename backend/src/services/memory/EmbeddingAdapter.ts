/**
 * EmbeddingAdapter — 文本向量化适配器
 *
 * 定义统一的 embedding 接口，支持多种后端（OpenAI、豆包等）。
 * 使用 Adapter 模式，后续接入新 provider 只需实现接口。
 */

import https from 'https';
import http from 'http';
import { logger } from '../../utils/logger';

/**
 * Embedding 适配器接口
 */
export interface IEmbeddingAdapter {
  /** 向量维度 */
  dimension(): number;
  /** 模型名称 */
  modelName(): string;
  /** 单条文本向量化 */
  embed(text: string): Promise<number[]>;
  /** 批量文本向量化 */
  embedBatch(texts: string[]): Promise<number[][]>;
}

/**
 * OpenAI Embedding 适配器
 * 使用 text-embedding-3-small 模型（1536 维）
 */
export class OpenAIEmbeddingAdapter implements IEmbeddingAdapter {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(options?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  }) {
    this.apiKey = options?.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseUrl = options?.baseUrl || 'https://api.openai.com';
    this.model = options?.model || 'text-embedding-3-small';
  }

  dimension(): number {
    return 1536;
  }

  modelName(): string {
    return this.model;
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured for embedding');
    }

    const body = JSON.stringify({
      model: this.model,
      input: texts,
      encoding_format: 'float',
    });

    const response = await this.httpsRequest('/v1/embeddings', body);
    const data = JSON.parse(response) as { data: Array<{ embedding: number[] }> };

    return data.data.map(item => item.embedding);
  }

  private httpsRequest(path: string, body: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + path);
      const lib = url.protocol === 'https:' ? https : http;

      const req = lib.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          } else {
            resolve(data);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Embedding request timeout'));
      });

      req.write(body);
      req.end();
    });
  }
}

/**
 * 工厂函数 — 根据配置创建 embedding 适配器
 */
export function createEmbeddingAdapter(options?: {
  provider?: 'openai' | 'doubao';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}): IEmbeddingAdapter {
  const provider = options?.provider || 'openai';

  if (provider === 'openai') {
    return new OpenAIEmbeddingAdapter({
      apiKey: options?.apiKey,
      baseUrl: options?.baseUrl,
      model: options?.model,
    });
  }

  // 默认返回 OpenAI adapter
  return new OpenAIEmbeddingAdapter({
    apiKey: options?.apiKey,
    baseUrl: options?.baseUrl,
  });
}
