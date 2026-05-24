/**
 * Memory 模块导出
 */
export { VectorStore, type VectorRecord, type SearchResult } from './VectorStore';
export {
  IEmbeddingAdapter,
  OpenAIEmbeddingAdapter,
  createEmbeddingAdapter,
} from './EmbeddingAdapter';
export { DoubaoEmbeddingAdapter } from './DoubaoEmbeddingAdapter';
export { MemoryService, type MemoryRecord, type CreateMemoryInput, type MemorySearchInput, type MemoryStats } from './MemoryService';
