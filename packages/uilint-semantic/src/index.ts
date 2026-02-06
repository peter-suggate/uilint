/**
 * uilint-semantic - Browser-safe exports
 *
 * This entry point is safe to import in browser contexts.
 * For Node.js-specific features (duplicate detection), use the /node subpath.
 */

// Types
export type {
  // Chunk types
  ChunkKind,
  Chunk,
  // Duplicate types
  ConfidenceLevel,
  DuplicateMatch,
  DuplicateGroup,
  // Index types
  IndexStatus,
  IndexProgress,
  IndexStats,
  // Query types
  FindDuplicatesOptions,
  SimilaritySearchOptions,
  // WebSocket message types
  DuplicatesIndexingStartMessage,
  DuplicatesIndexingProgressMessage,
  DuplicatesIndexingCompleteMessage,
  DuplicatesIndexingErrorMessage,
  DuplicatesMessage,
} from "./types.js";

// Plugin definition
export { semanticPlugin } from "./plugin/index.js";
export type { SemanticState } from "./plugin/state.js";
