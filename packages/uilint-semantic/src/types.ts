/**
 * Semantic Plugin Types
 *
 * All types for semantic code analysis and duplicate detection.
 */

// =============================================================================
// CHUNK TYPES
// =============================================================================

/**
 * Kind of code chunk
 */
export type ChunkKind = "component" | "hook" | "function";

/**
 * Code chunk extracted for analysis
 */
export interface Chunk {
  /** Unique identifier */
  id: string;
  /** File path */
  filePath: string;
  /** Start line (1-indexed) */
  startLine: number;
  /** End line (1-indexed) */
  endLine: number;
  /** Chunk name (function/component name) */
  name: string | null;
  /** Kind of chunk */
  kind: ChunkKind;
  /** Source code content */
  content: string;
  /** File content hash (for incremental updates) */
  fileHash: string;
}

// =============================================================================
// DUPLICATE DETECTION TYPES
// =============================================================================

/**
 * Confidence level for duplicate detection
 */
export type ConfidenceLevel = "high" | "medium" | "low";

/**
 * Duplicate match result
 */
export interface DuplicateMatch {
  /** Unique match ID */
  id: string;
  /** Similarity score (0-1) */
  score: number;
  /** Combined score (semantic + structural) */
  combinedScore?: number;
  /** File path of the duplicate */
  filePath: string;
  /** Start line of the duplicate */
  startLine: number;
  /** End line of the duplicate */
  endLine: number;
  /** Name of the duplicate chunk */
  name: string | null;
  /** Kind of the duplicate chunk */
  kind: ChunkKind;
  /** Confidence level */
  confidence: ConfidenceLevel;
  /** Source code of the match (for display) */
  sourceCode?: string;
}

/**
 * Duplicate group (set of similar chunks)
 */
export interface DuplicateGroup {
  /** Group ID */
  id: string;
  /** Representative chunk */
  representative: Chunk;
  /** All similar chunks in this group */
  members: DuplicateMatch[];
  /** Average similarity within group */
  averageSimilarity: number;
}

// =============================================================================
// INDEX TYPES
// =============================================================================

/**
 * Indexing status
 */
export type IndexStatus = "idle" | "indexing" | "ready" | "error";

/**
 * Indexing progress
 */
export interface IndexProgress {
  current: number;
  total: number;
  message?: string;
}

/**
 * Index statistics
 */
export interface IndexStats {
  totalChunks: number;
  added: number;
  modified: number;
  deleted: number;
  duration: number;
}

// =============================================================================
// QUERY TYPES
// =============================================================================

/**
 * Options for finding duplicates
 */
export interface FindDuplicatesOptions {
  /** Minimum similarity threshold (0-1) */
  threshold?: number;
  /** Minimum confidence level */
  confidenceLevel?: ConfidenceLevel;
  /** Filter by chunk kind */
  kind?: ChunkKind | "all";
  /** Include structural similarity boost */
  useStructuralBoost?: boolean;
  /** Include same-file duplicates */
  includeSameFile?: boolean;
  /** Minimum lines for a chunk */
  minLines?: number;
  /** Maximum results */
  limit?: number;
}

/**
 * Options for similarity search
 */
export interface SimilaritySearchOptions {
  /** Minimum similarity threshold (0-1) */
  threshold?: number;
  /** Maximum results */
  limit?: number;
  /** Filter by chunk kind */
  kind?: ChunkKind | "all";
}

// =============================================================================
// WEBSOCKET MESSAGE TYPES
// =============================================================================

/**
 * Server -> Client: Indexing started
 */
export interface DuplicatesIndexingStartMessage {
  type: "duplicates:indexing:start";
}

/**
 * Server -> Client: Indexing progress
 */
export interface DuplicatesIndexingProgressMessage {
  type: "duplicates:indexing:progress";
  message: string;
  current?: number;
  total?: number;
}

/**
 * Server -> Client: Indexing complete
 */
export interface DuplicatesIndexingCompleteMessage {
  type: "duplicates:indexing:complete";
  added: number;
  modified: number;
  deleted: number;
  totalChunks: number;
  duration: number;
}

/**
 * Server -> Client: Indexing error
 */
export interface DuplicatesIndexingErrorMessage {
  type: "duplicates:indexing:error";
  error: string;
}

/**
 * Union of all duplicates WebSocket messages
 */
export type DuplicatesMessage =
  | DuplicatesIndexingStartMessage
  | DuplicatesIndexingProgressMessage
  | DuplicatesIndexingCompleteMessage
  | DuplicatesIndexingErrorMessage;
