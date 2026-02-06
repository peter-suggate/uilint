/**
 * Semantic Plugin Types
 *
 * Type definitions for the semantic analysis plugin, including
 * duplicates indexing status and semantic issue types.
 *
 * Re-exports common types from uilint-semantic package for consistency.
 */

// =============================================================================
// Re-exports from uilint-semantic
// =============================================================================

// WebSocket message types - re-export directly
export type {
  DuplicatesIndexingStartMessage,
  DuplicatesIndexingProgressMessage,
  DuplicatesIndexingCompleteMessage,
  DuplicatesIndexingErrorMessage,
  DuplicatesMessage,
} from "uilint-semantic";

// Index types - re-export with aliases for backward compatibility
import type {
  IndexStatus,
  IndexProgress,
  IndexStats,
} from "uilint-semantic";

/**
 * Status of the duplicates index
 * @alias IndexStatus from uilint-semantic
 */
export type DuplicatesIndexStatus = IndexStatus;

/**
 * Progress information for duplicates indexing
 * @alias IndexProgress from uilint-semantic
 */
export type DuplicatesIndexProgress = IndexProgress;

/**
 * Statistics from a completed indexing operation
 * @alias IndexStats from uilint-semantic
 */
export type DuplicatesIndexStats = IndexStats;

// =============================================================================
// React-specific Types (not in uilint-semantic)
// =============================================================================

/**
 * State slice for the semantic plugin (React-specific)
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
 * A semantic issue detected by LLM analysis (React-specific)
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
 * A duplicate detection result for display in React components
 *
 * Note: This is a simplified version of DuplicateMatch from uilint-semantic,
 * tailored for React UI display purposes. The full DuplicateMatch type from
 * uilint-semantic includes additional fields like `confidence`, `combinedScore`,
 * and `sourceCode`.
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
