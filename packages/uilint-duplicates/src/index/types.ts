/**
 * Types for the index module
 */

import type { ChunkKind, ChunkMetadata } from "../embeddings/types.js";

/**
 * Metadata stored for each chunk in the metadata store
 */
export interface StoredChunkMetadata {
  /** Absolute file path */
  filePath: string;
  /** Start line number (1-indexed) */
  startLine: number;
  /** End line number (1-indexed) */
  endLine: number;
  /** Start column */
  startColumn: number;
  /** End column */
  endColumn: number;
  /** Type of code chunk */
  kind: ChunkKind;
  /** Name of the function/component/hook (null if anonymous) */
  name: string | null;
  /** Hash of the content for change detection */
  contentHash: string;
  /** Extracted metadata */
  metadata: ChunkMetadata;
}

/**
 * Manifest for the index
 */
export interface IndexManifest {
  /** Version of the index format */
  version: number;
  /** Timestamp when the index was created */
  createdAt: string;
  /** Timestamp when the index was last updated */
  updatedAt: string;
  /** Number of chunks in the index */
  chunkCount: number;
  /** Number of files indexed */
  fileCount: number;
  /** Embedding model used */
  embeddingModel: string;
  /** Vector dimension */
  dimension: number;
}
