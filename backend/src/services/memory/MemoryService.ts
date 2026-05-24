/**
 * MemoryService — 向量记忆核心服务
 *
 * 职责：
 * 1. 记忆的 CRUD 操作
 * 2. 语义检索（embedding + VectorStore）
 * 3. 自动提取（调用 LLM 从对话中提取关键信息）
 * 4. 统计信息
 */

import { getDb } from '../../db/client';
import { VectorStore, type SearchResult } from './VectorStore';
import { IEmbeddingAdapter, createEmbeddingAdapter } from './EmbeddingAdapter';
import { logger } from '../../utils/logger';

export interface MemoryRecord {
  id: string;
  userId: string;
  agentId: string | null;
  conversationId: string | null;
  category: string;
  title: string | null;
  content: string;
  source: string;
  importance: number;
  accessCount: number;
  lastAccess: string | null;
  createdAt: string;
}

export interface CreateMemoryInput {
  userId: string;
  agentId?: string | null;
  conversationId?: string | null;
  category?: string;
  title?: string;
  content: string;
  source?: string;
  importance?: number;
}

export interface MemorySearchInput {
  query: string;
  userId?: string;
  agentId?: string | null;
  category?: string;
  topK?: number;
}

export interface MemoryStats {
  totalMemories: number;
  totalVectors: number;
  byCategory: Array<{ category: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
}

export class MemoryService {
  private static embeddingAdapter: IEmbeddingAdapter | null = null;

  /**
   * 获取或创建 embedding 适配器
   */
  private static getAdapter(): IEmbeddingAdapter {
    if (!this.embeddingAdapter) {
      this.embeddingAdapter = createEmbeddingAdapter({
        provider: (process.env.EMBEDDING_PROVIDER as 'openai' | 'doubao') || 'openai',
        apiKey: process.env.EMBEDDING_API_KEY,
        baseUrl: process.env.EMBEDDING_BASE_URL,
        model: process.env.EMBEDDING_MODEL,
      });
    }
    return this.embeddingAdapter;
  }

  /**
   * 创建记忆（自动向量化）
   */
  static async create(input: CreateMemoryInput): Promise<MemoryRecord> {
    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const category = input.category || 'other';
    const source = input.source || 'manual';
    const importance = input.importance ?? 5;

    db.run(
      `INSERT INTO memories (id, user_id, agent_id, conversation_id, category, title, content, source, importance, access_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [id, input.userId, input.agentId || null, input.conversationId || null, category, input.title || null, input.content, source, importance, now]
    );

    // 自动向量化
    try {
      const adapter = this.getAdapter();
      const vector = await adapter.embed(input.content);
      VectorStore.save({
        memoryId: id,
        vector,
        model: adapter.modelName(),
        dimension: adapter.dimension(),
      });
      logger.info(`[Memory] Created and embedded: ${id.slice(0, 8)}...`);
    } catch (err) {
      logger.warn(`[Memory] Embedding failed for ${id.slice(0, 8)}...: ${(err as Error).message}`);
    }

    return this.getById(id)!;
  }

  /**
   * 批量创建记忆
   */
  static async createBatch(inputs: CreateMemoryInput[]): Promise<MemoryRecord[]> {
    const db = getDb();
    const results: MemoryRecord[] = [];
    const texts: string[] = [];
    const ids: string[] = [];
    const now = new Date().toISOString();

    for (const input of inputs) {
      const id = crypto.randomUUID();
      ids.push(id);
      texts.push(input.content);

      const category = input.category || 'other';
      const source = input.source || 'manual';
      const importance = input.importance ?? 5;

      db.run(
        `INSERT INTO memories (id, user_id, agent_id, conversation_id, category, title, content, source, importance, access_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [id, input.userId, input.agentId || null, input.conversationId || null, category, input.title || null, input.content, source, importance, now]
      );
    }

    // 批量向量化
    try {
      const adapter = this.getAdapter();
      const vectors = await adapter.embedBatch(texts);
      const records = ids.map((id, i) => ({
        memoryId: id,
        vector: vectors[i],
        model: adapter.modelName(),
        dimension: adapter.dimension(),
      }));
      VectorStore.saveBatch(records);
      logger.info(`[Memory] Batch embedded: ${ids.length} memories`);
    } catch (err) {
      logger.warn(`[Memory] Batch embedding failed: ${(err as Error).message}`);
    }

    for (const id of ids) {
      const record = this.getById(id);
      if (record) results.push(record);
    }

    return results;
  }

  /**
   * 获取单条记忆
   */
  static getById(id: string): MemoryRecord | null {
    const db = getDb();
    const row = db.prepare(`SELECT * FROM memories WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToMemory(row);
  }

  /**
   * 列表查询（支持分页和筛选）
   */
  static list(options?: {
    userId?: string;
    agentId?: string | null;
    category?: string;
    source?: string;
    limit?: number;
    offset?: number;
  }): { memories: MemoryRecord[]; total: number } {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options?.userId) { conditions.push('user_id = ?'); params.push(options.userId); }
    if (options?.agentId !== undefined) {
      if (options.agentId === null) {
        conditions.push('agent_id IS NULL');
      } else {
        conditions.push('agent_id = ?'); params.push(options.agentId);
      }
    }
    if (options?.category) { conditions.push('category = ?'); params.push(options.category); }
    if (options?.source) { conditions.push('source = ?'); params.push(options.source); }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM memories ${whereClause}`).get(...params) as { cnt: number };
    const rows = db.prepare(`SELECT * FROM memories ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as Array<Record<string, unknown>>;

    return {
      memories: rows.map(this.rowToMemory),
      total: totalRow.cnt,
    };
  }

  /**
   * 语义检索
   */
  static async search(input: MemorySearchInput): Promise<SearchResult[]> {
    const adapter = this.getAdapter();
    const queryVector = await adapter.embed(input.query);

    const results = VectorStore.search(
      queryVector,
      input.topK ?? 5,
      input.userId,
      input.agentId,
      input.category
    );

    // 更新访问统计
    const db = getDb();
    const now = new Date().toISOString();
    for (const result of results) {
      db.run(
        `UPDATE memories SET access_count = access_count + 1, last_access = ? WHERE id = ?`,
        [now, result.memoryId]
      );
    }

    return results;
  }

  /**
   * 更新记忆
   */
  static async update(id: string, patch: Partial<CreateMemoryInput>): Promise<MemoryRecord | null> {
    const existing = this.getById(id);
    if (!existing) return null;

    const db = getDb();
    const fields: string[] = [];
    const params: unknown[] = [];

    if (patch.category !== undefined) { fields.push('category = ?'); params.push(patch.category); }
    if (patch.title !== undefined) { fields.push('title = ?'); params.push(patch.title); }
    if (patch.content !== undefined) { fields.push('content = ?'); params.push(patch.content); }
    if (patch.importance !== undefined) { fields.push('importance = ?'); params.push(patch.importance); }

    if (fields.length === 0) return existing;

    params.push(id);
    db.run(`UPDATE memories SET ${fields.join(', ')} WHERE id = ?`, params);

    // 如果内容变更，重新向量化
    if (patch.content) {
      try {
        const adapter = this.getAdapter();
        const vector = await adapter.embed(patch.content);
        VectorStore.save({
          memoryId: id,
          vector,
          model: adapter.modelName(),
          dimension: adapter.dimension(),
        });
      } catch (err) {
        logger.warn(`[Memory] Re-embedding failed for ${id.slice(0, 8)}...: ${(err as Error).message}`);
      }
    }

    return this.getById(id);
  }

  /**
   * 删除记忆
   */
  static delete(id: string): boolean {
    const db = getDb();
    const existing = db.prepare(`SELECT 1 FROM memories WHERE id = ?`).get(id);
    if (!existing) return false;

    VectorStore.delete(id);
    db.run(`DELETE FROM memories WHERE id = ?`, [id]);
    return true;
  }

  /**
   * 统计信息
   */
  static getStats(userId?: string): MemoryStats {
    const db = getDb();
    const whereClause = userId ? `WHERE user_id = ?` : '';
    const params = userId ? [userId] : [];

    const totalMemories = db.prepare(`SELECT COUNT(*) as cnt FROM memories ${whereClause}`).get(...params) as { cnt: number };
    const totalVectors = VectorStore.count(userId);

    const byCategory = db.prepare(
      `SELECT category, COUNT(*) as count FROM memories ${whereClause} GROUP BY category ORDER BY count DESC`
    ).all(...params) as Array<{ category: string; count: number }>;

    const bySource = db.prepare(
      `SELECT source, COUNT(*) as count FROM memories ${whereClause} GROUP BY source ORDER BY count DESC`
    ).all(...params) as Array<{ source: string; count: number }>;

    return {
      totalMemories: totalMemories.cnt,
      totalVectors,
      byCategory,
      bySource,
    };
  }

  /**
   * 行转对象
   */
  private static rowToMemory(row: Record<string, unknown>): MemoryRecord {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      agentId: (row.agent_id as string) || null,
      conversationId: (row.conversation_id as string) || null,
      category: row.category as string,
      title: (row.title as string) || null,
      content: row.content as string,
      source: row.source as string,
      importance: row.importance as number,
      accessCount: row.access_count as number,
      lastAccess: (row.last_access as string) || null,
      createdAt: row.created_at as string,
    };
  }
}
