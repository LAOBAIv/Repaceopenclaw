/**
 * DoubaoEmbeddingAdapter — 豆包 Embedding 适配器
 *
 * 使用火山引擎 Ark 平台的 text-embedding 模型。
 * API 文档: https://www.volcengine.com/docs/82379/1302008
 */

import https from 'https';
import http from 'http';
import { IEmbeddingAdapter } from './EmbeddingAdapter';

/**
 * 豆包 Embedding 适配器
 * 默认使用 text-embedding-3-large 模型（2048 维）
 */
export class DoubaoEmbeddingAdapter implements IEmbeddingAdapter {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(options?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  }) {
    this.apiKey = options?.apiKey || process.env.DOUBAO_API_KEY || '';
    this.baseUrl = options?.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';
    this.model = options?.model || 'text-embedding-3-large';
  }

  dimension(): number {
    return 2048;
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
      throw new Error('Doubao API key not configured for embedding');
    }

    const body = JSON.stringify({
      model: this.model,
      input: texts,
    });

    const response = await this.httpsRequest('/embeddings', body);
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
