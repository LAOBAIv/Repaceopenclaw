/**
 * VectorStore — SQLite 向量存储
 *
 * 在 SQLite 中以 JSON 数组形式存储 embedding 向量，
 * 通过 JavaScript 计算余弦相似度进行语义检索。
 *
 * 适用场景：中小规模（< 10000 条记忆），无需外部向量数据库。
 */

import { getDb } from '../../db/client';

export interface VectorRecord {
  memoryId: string;
  vector: number[];
  model: string;
  dimension: number;
}

export interface SearchResult {
  memoryId: string;
  score: number;  // 余弦相似度 0~1
  content: string;
  title: string | null;
  category: string;
  importance: number;
}

export class VectorStore {
  /**
   * 存储向量
   */
  static save(record: VectorRecord): void {
    const db = getDb();
    db.run(
      `INSERT OR REPLACE INTO memory_vectors (memory_id, vector, model, dimension)
       VALUES (?, ?, ?, ?)`,
      [record.memoryId, JSON.stringify(record.vector), record.model, record.dimension]
    );
  }

  /**
   * 批量存储向量
   */
  static saveBatch(records: VectorRecord[]): void {
    const db = getDb();
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO memory_vectors (memory_id, vector, model, dimension)
       VALUES (?, ?, ?, ?)`
    );
    const insertMany = db.transaction((rows: any[]) => {
      for (const row of rows) {
        stmt.run(row.memoryId, JSON.stringify(row.vector), row.model, row.dimension);
      }
    });
    insertMany(records);
  }

  /**
   * 删除向量
   */
  static delete(memoryId: string): void {
    const db = getDb();
    db.run(`DELETE FROM memory_vectors WHERE memory_id = ?`, [memoryId]);
  }

  /**
   * 语义检索 — 余弦相似度排序
   *
   * @param queryVector 查询向量（1536 维）
   * @param topK 返回结果数量
   * @param userId 用户过滤（可选）
   * @param agentId 智能体过滤（可选）
   * @param category 分类过滤（可选）
   */
  static search(
    queryVector: number[],
    topK: number = 5,
    userId?: string,
    agentId?: string,
    category?: string
  ): SearchResult[] {
    const db = getDb();

    // 构建 WHERE 条件
    const conditions: string[] = [];
    const params: any[] = [];

    if (userId) { conditions.push('m.user_id = ?'); params.push(userId); }
    if (agentId !== undefined) {
      if (agentId === null) {
        conditions.push('m.agent_id IS NULL');
      } else {
        conditions.push('m.agent_id = ?');
        params.push(agentId);
      }
    }
    if (category) { conditions.push('m.category = ?'); params.push(category); }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // 查询所有符合条件的记忆及其向量
    const rows = db.prepare(`
      SELECT m.id, m.content, m.title, m.category, m.importance, mv.vector
      FROM memories m
      INNER JOIN memory_vectors mv ON m.id = mv.memory_id
      ${whereClause}
    `).all(...params) as Array<{
      id: string;
      content: string;
      title: string | null;
      category: string;
      importance: number;
      vector: string;
    }>;

    // 计算余弦相似度并排序
    const results = rows
      .map(row => {
        const vector = JSON.parse(row.vector) as number[];
        const score = cosineSimilarity(queryVector, vector);
        return {
          memoryId: row.id,
          score,
          content: row.content,
          title: row.title,
          category: row.category,
          importance: row.importance,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return results;
  }

  /**
   * 检查记忆是否已有向量
   */
  static hasVector(memoryId: string): boolean {
    const db = getDb();
    const row = db.prepare(
      `SELECT 1 FROM memory_vectors WHERE memory_id = ? LIMIT 1`
    ).get(memoryId) as { 1?: number } | undefined;
    return !!row;
  }

  /**
   * 统计向量数量
   */
  static count(userId?: string): number {
    const db = getDb();
    if (userId) {
      const row = db.prepare(
        `SELECT COUNT(*) as cnt FROM memory_vectors mv
         INNER JOIN memories m ON mv.memory_id = m.id
         WHERE m.user_id = ?`
      ).get(userId) as { cnt: number };
      return row.cnt;
    }
    const row = db.prepare(`SELECT COUNT(*) as cnt FROM memory_vectors`).get() as { cnt: number };
    return row.cnt;
  }
}

/**
 * 计算两个向量的余弦相似度
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
