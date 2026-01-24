/**
 * Semantic Plugin Types
 *
 * Type definitions for the semantic analysis plugin, including
 * duplicates indexing status and semantic issue types.
 */

/**
 * Status of the duplicates index
 */
export type DuplicatesIndexStatus = "idle" | "indexing" | "ready" | "error";

/**
 * Progress information for duplicates indexing
 */
export interface DuplicatesIndexProgress {
  /** Current item being processed */
  current: number;
  /** Total items to process */
  total: number;
}

/**
 * Statistics from a completed indexing operation
 */
export interface DuplicatesIndexStats {
  /** Total number of chunks in the index */
  totalChunks: number;
  /** Number of chunks added */
  added: number;
  /** Number of chunks modified */
  modified: number;
  /** Number of chunks deleted */
  deleted: number;
  /** Duration of the indexing operation in milliseconds */
  duration: number;
}

/**
 * State slice for the semantic plugin
 */
export interface SemanticPluginState {
  /** Current status of the duplicates index */
  duplicatesIndexStatus: DuplicatesIndexStatus;
  /** Current indexing progress message */
  duplicatesIndexMessage: string | null;
  /** Current indexing progress (current/total) */
  duplicatesIndexProgress: DuplicatesIndexProgress | null;
  /** Last indexing error message */
  duplicatesIndexError: string | null;
  /** Statistics from the last indexing operation */
  duplicatesIndexStats: DuplicatesIndexStats | null;
}

/**
 * A semantic issue detected by LLM analysis
 */
export interface SemanticIssue {
  /** Line number in the source file (1-indexed) */
  line: number;
  /** Column number in the source file (1-indexed, optional) */
  column?: number;
  /** Human-readable issue message */
  message: string;
  /** Rule ID that generated this issue */
  ruleId: string;
  /** Severity level (1 = warning, 2 = error) */
  severity: 1 | 2;
}

/**
 * A duplicate detection result
 */
export interface DuplicateMatch {
  /** Chunk ID of the similar code */
  id: string;
  /** Similarity score (0-1) */
  score: number;
  /** File path of the similar code */
  filePath: string;
  /** Start line of the similar code */
  startLine: number;
  /** End line of the similar code */
  endLine: number;
  /** Name of the function/component (if available) */
  name: string | null;
  /** Kind of code chunk (e.g., "function", "component") */
  kind: string;
}

// ============================================================================
// WebSocket Message Types
// ============================================================================

/**
 * Message sent when duplicates indexing starts
 */
export interface DuplicatesIndexingStartMessage {
  type: "duplicates:indexing:start";
}

/**
 * Message sent during duplicates indexing progress
 */
export interface DuplicatesIndexingProgressMessage {
  type: "duplicates:indexing:progress";
  message: string;
  current?: number;
  total?: number;
}

/**
 * Message sent when duplicates indexing completes
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
 * Message sent when duplicates indexing fails
 */
export interface DuplicatesIndexingErrorMessage {
  type: "duplicates:indexing:error";
  error: string;
}

/**
 * Union of all duplicates-related WebSocket messages
 */
export type DuplicatesMessage =
  | DuplicatesIndexingStartMessage
  | DuplicatesIndexingProgressMessage
  | DuplicatesIndexingCompleteMessage
  | DuplicatesIndexingErrorMessage;
