/**
 * AutoExtractService — 自动记忆提取服务
 *
 * 职责：
 * 1. 在对话达到一定轮数后，自动提取关键信息
 * 2. 调用 LLM 从对话历史中提取结构化记忆
 * 3. 去重：避免重复提取相同内容
 */

import { MemoryService, type CreateMemoryInput } from './MemoryService';
import { logger } from '../../utils/logger';
import { getDb } from '../../db/client';

export interface ExtractConfig {
  /** 触发提取的对话轮数阈值 */
  turnThreshold: number;
  /** 每次提取的最大记忆条数 */
  maxMemories: number;
  /** 提取间隔（秒），避免频繁提取 */
  extractIntervalSec: number;
}

const DEFAULT_CONFIG: ExtractConfig = {
  turnThreshold: 10,
  maxMemories: 3,
  extractIntervalSec: 300, // 5 分钟
};

export class AutoExtractService {
  /**
   * 检查是否应该触发提取
   */
  static shouldExtract(conversationId: string, config: ExtractConfig = DEFAULT_CONFIG): boolean {
    const db = getDb();

    // 检查消息数量
    const msgCount = db.prepare(
      `SELECT COUNT(*) as cnt FROM messages WHERE conversation_id = ?`
    ).get(conversationId) as { cnt: number };

    if (msgCount.cnt < config.turnThreshold) return false;

    // 检查上次提取时间
    const lastExtract = db.prepare(
      `SELECT MAX(created_at) as last_extract FROM memories WHERE conversation_id = ? AND source = 'auto_extract'`
    ).get(conversationId) as { last_extract: string | null };

    if (lastExtract.last_extract) {
      const lastTime = new Date(lastExtract.last_extract).getTime();
      const now = Date.now();
      if (now - lastTime < config.extractIntervalSec * 1000) return false;
    }

    return true;
  }

  /**
   * 从对话历史中提取记忆
   *
   * 这个方法需要调用方提供对话文本，由外部 LLM 适配器调用。
   * 提取结果直接存入 MemoryService。
   */
  static async extractFromConversation(
    conversationText: string,
    userId: string,
    conversationId: string,
    agentId?: string | null,
    config: ExtractConfig = DEFAULT_CONFIG
  ): Promise<CreateMemoryInput[]> {
    if (!this.shouldExtract(conversationId, config)) {
      return [];
    }

    logger.info(`[AutoExtract] Extracting memories from conversation ${conversationId.slice(0, 8)}...`);

    // 这里使用 LLM 提取的逻辑需要由调用方实现
    // 返回空数组，等待后续 LLM 集成
    // 实际实现时，应该：
    // 1. 构建 prompt 让 LLM 提取关键信息
    // 2. 解析 LLM 返回的 JSON 格式记忆
    // 3. 调用 MemoryService.createBatch 存储

    return [];
  }

  /**
   * 手动触发提取（用于测试或管理后台）
   */
  static async triggerExtract(
    conversationText: string,
    userId: string,
    conversationId: string,
    agentId?: string | null
  ): Promise<CreateMemoryInput[]> {
    return this.extractFromConversation(conversationText, userId, conversationId, agentId, {
      turnThreshold: 0, // 立即触发
      maxMemories: 5,
      extractIntervalSec: 0,
    });
  }

  /**
   * 从文本中提取记忆（简单关键词匹配版本，作为 LLM 提取的降级方案）
   */
  static extractKeywords(text: string, userId: string, maxCount: number = 3): CreateMemoryInput[] {
    // 简单的关键词提取作为降级方案
    // 实际应该使用 LLM 进行智能提取
    const memories: CreateMemoryInput[] = [];

    // 提取包含"我"、"我的"、"我喜欢"等关键词的句子
    const patterns = [
      /(?:我|我的|我喜欢|我讨厌|我希望|我需要|我习惯|我经常|我总是)\s*([^\n。！？]{5,50})/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null && memories.length < maxCount) {
        const content = match[0].trim();
        if (content.length > 10) {
          memories.push({
            userId,
            category: 'preference',
            content,
            source: 'auto_extract',
            importance: 3,
          });
        }
      }
    }

    return memories;
  }
}
