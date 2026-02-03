/**
 * uilint-duplicates
 *
 * Semantic code duplicate detection for React/TypeScript codebases.
 * Uses local Ollama embeddings to find semantically similar code.
 */

// Types
export type {
  CodeChunk,
  ChunkKind,
  ChunkMetadata,
  ChunkingOptions,
} from "./embeddings/types.js";

// Chunker
export { chunkFile, prepareEmbeddingInput } from "./embeddings/chunker.js";

// Ollama Embedding Client
export {
  OllamaEmbeddingClient,
  getOllamaEmbeddingClient,
} from "./embeddings/ollama-embeddings.js";
export type {
  EmbeddingOptions,
  EmbeddingResult,
} from "./embeddings/ollama-embeddings.js";

// Query API
export {
  indexDirectory,
  findDuplicates,
  searchSimilar,
  findSimilarAtLocation,
  hasIndex,
  getIndexStats,
  clearIndexerCache,
} from "./query/api.js";
export type {
  IndexOptions,
  FindDuplicatesOptions,
  SearchOptions,
  SimilarLocationOptions,
  DuplicateGroup,
  DuplicateGroupMember,
  SearchResult,
} from "./query/api.js";

// Detection
export {
  findDuplicateGroups,
  findSimilarToLocation,
  findSimilarToQuery,
} from "./detection/duplicate-finder.js";
export type {
  DuplicateMember,
  DuplicateGroup as InternalDuplicateGroup,
  FindDuplicatesOptions as InternalFindDuplicatesOptions,
} from "./detection/duplicate-finder.js";

export {
  calculateSizeRatio,
  calculateDuplicateScore,
  calculateGroupAverageSimilarity,
  sortDuplicateGroups,
} from "./detection/scorer.js";
export type { DuplicateScore } from "./detection/scorer.js";

// Structural Similarity
export {
  jaccard,
  calculateSizeRatio as calculateStructuralSizeRatio,
  calculateStructuralSimilarity,
  hasHighStructuralSimilarity,
  findStructurallySimilar,
} from "./detection/structural-scorer.js";
export type {
  StructuralScore,
  StructuralScorerWeights,
} from "./detection/structural-scorer.js";

// Confidence Levels
export {
  getConfidenceLevel,
  getConfidenceResult,
  getConfidenceEmoji,
  getConfidenceAnsiColor,
  formatConfidence,
  formatConfidenceVerbose,
  meetsMinimumThreshold,
  compareConfidenceLevels,
  filterByConfidence,
  DEFAULT_CONFIDENCE_CONFIG,
} from "./detection/confidence.js";
export type {
  ConfidenceLevel,
  ConfidenceConfig,
  ConfidenceResult,
} from "./detection/confidence.js";

// Code Normalizer
export {
  normalizeCode,
  calculateNormalizedSimilarity,
  isNearIdentical,
  prepareForEmbedding,
  levenshteinDistance,
} from "./detection/normalizer.js";
export type { NormalizationOptions } from "./detection/normalizer.js";

// Combined Scorer
export {
  calculateCombinedScore,
  isPotentialDuplicate,
  calculateQuickScore,
  getRecommendedAction,
  formatCombinedScore,
  DEFAULT_COMBINED_SCORER_OPTIONS,
} from "./detection/combined-scorer.js";
export type {
  CombinedScore,
  CombinedScorerOptions,
} from "./detection/combined-scorer.js";

// Vector Storage
export { VectorStore } from "./index/vector-store.js";
export type { SimilarityResult, VectorStoreOptions } from "./index/vector-store.js";
export type { IndexManifest, StoredChunkMetadata } from "./index/types.js";

// Metadata Store
export { MetadataStore } from "./index/metadata-store.js";

// File Tracker
export {
  FileTracker,
  hashContent,
  hashContentSync,
} from "./cache/file-tracker.js";
export type {
  FileHashEntry,
  HashStore,
  FileChange,
} from "./cache/file-tracker.js";

// Indexer
export {
  IncrementalIndexer,
  createIndexer,
} from "./cache/incremental-indexer.js";
export type {
  IndexerOptions,
  IndexUpdateResult,
} from "./cache/incremental-indexer.js";
