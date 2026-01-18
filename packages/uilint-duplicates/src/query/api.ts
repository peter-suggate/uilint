/**
 * Query API for semantic duplicate detection
 *
 * High-level API for indexing, finding duplicates, and semantic search.
 */

import { dirname, resolve } from "path";
import type { CodeChunk, ChunkKind } from "../embeddings/types.js";
import type { StoredChunkMetadata } from "../index/types.js";
import {
  IncrementalIndexer,
  createIndexer,
  type IndexerOptions,
  type IndexUpdateResult,
} from "../cache/incremental-indexer.js";
import {
  findDuplicateGroups,
  findSimilarToLocation,
  findSimilarToQuery,
  type DuplicateGroup as InternalDuplicateGroup,
  type DuplicateMember,
} from "../detection/duplicate-finder.js";
import { OllamaEmbeddingClient } from "../embeddings/ollama-embeddings.js";

export interface IndexOptions {
  /** Embedding model to use */
  model?: string;
  /** Ollama server URL */
  baseUrl?: string;
  /** Glob patterns to exclude */
  exclude?: string[];
  /** Force reindex from scratch */
  force?: boolean;
  /** Progress callback */
  onProgress?: (message: string, current?: number, total?: number) => void;
}

export interface FindDuplicatesOptions {
  /** Path to search (defaults to current directory) */
  path?: string;
  /** Minimum similarity threshold (0-1). Default: 0.85 */
  threshold?: number;
  /** Minimum group size. Default: 2 */
  minGroupSize?: number;
  /** Filter by kind: component, hook, function */
  kind?: ChunkKind;
}

export interface SearchOptions {
  /** Path to search (defaults to current directory) */
  path?: string;
  /** Number of results to return. Default: 10 */
  top?: number;
  /** Minimum similarity threshold. Default: 0.5 */
  threshold?: number;
  /** Embedding model to use */
  model?: string;
  /** Ollama server URL */
  baseUrl?: string;
}

export interface SimilarLocationOptions extends SearchOptions {
  /** File path containing the code */
  filePath: string;
  /** Line number in the file */
  line: number;
}

export interface DuplicateGroupMember {
  /** File path */
  filePath: string;
  /** Start line */
  startLine: number;
  /** End line */
  endLine: number;
  /** Chunk name (component/function/hook name) */
  name: string | null;
  /** Kind of code */
  kind: ChunkKind;
  /** Similarity score (1.0 for the reference member) */
  score: number;
}

export interface DuplicateGroup {
  /** Members of the duplicate group */
  members: DuplicateGroupMember[];
  /** Average similarity between all group members */
  avgSimilarity: number;
  /** The kind of code in this group */
  kind: ChunkKind;
}

export interface SearchResult {
  /** File path */
  filePath: string;
  /** Start line */
  startLine: number;
  /** End line */
  endLine: number;
  /** Chunk name */
  name: string | null;
  /** Kind of code */
  kind: ChunkKind;
  /** Similarity score */
  score: number;
}

// Cache for loaded indexers to avoid reloading on every query
const indexerCache = new Map<string, IncrementalIndexer>();

/**
 * Get or create an indexer for a project path.
 */
function getIndexer(path: string, options?: IndexerOptions): IncrementalIndexer {
  const projectRoot = resolve(path);
  const cacheKey = projectRoot;

  let indexer = indexerCache.get(cacheKey);
  if (!indexer) {
    indexer = createIndexer(projectRoot, options);
    indexerCache.set(cacheKey, indexer);
  }

  return indexer;
}

/**
 * Clear the indexer cache for a path.
 */
export function clearIndexerCache(path?: string): void {
  if (path) {
    const projectRoot = resolve(path);
    indexerCache.delete(projectRoot);
  } else {
    indexerCache.clear();
  }
}

/**
 * Index a directory for semantic duplicate detection.
 * Creates or updates the index at .uilint/.duplicates-index/
 */
export async function indexDirectory(
  path: string,
  options: IndexOptions = {}
): Promise<IndexUpdateResult> {
  const projectRoot = resolve(path);

  // Clear cache to ensure fresh indexer
  clearIndexerCache(projectRoot);

  const indexer = createIndexer(projectRoot, {
    model: options.model,
    baseUrl: options.baseUrl,
    exclude: options.exclude,
    onProgress: options.onProgress,
  });

  // Update cache
  indexerCache.set(projectRoot, indexer);

  if (options.force) {
    return await indexer.indexAll(true);
  }

  // Try incremental update first, fall back to full index
  if (indexer.hasIndex()) {
    return await indexer.update();
  }

  return await indexer.indexAll(false);
}

/**
 * Find semantic duplicate groups in the indexed codebase.
 */
export async function findDuplicates(
  options: FindDuplicatesOptions = {}
): Promise<DuplicateGroup[]> {
  const projectRoot = resolve(options.path || process.cwd());
  const indexer = getIndexer(projectRoot);

  // Load the index
  await indexer.load();

  if (!indexer.hasIndex()) {
    throw new Error(
      `No index found at ${projectRoot}. Run 'uilint duplicates index' first.`
    );
  }

  const vectorStore = indexer.getVectorStore();
  const metadataStore = indexer.getMetadataStore();

  const groups = findDuplicateGroups(vectorStore, metadataStore, {
    threshold: options.threshold,
    minGroupSize: options.minGroupSize,
    kind: options.kind,
  });

  // Transform to public API format
  return groups.map((group) => ({
    members: group.members.map((m) => ({
      filePath: m.metadata.filePath,
      startLine: m.metadata.startLine,
      endLine: m.metadata.endLine,
      name: m.metadata.name,
      kind: m.metadata.kind,
      score: m.score,
    })),
    avgSimilarity: group.avgSimilarity,
    kind: group.kind,
  }));
}

/**
 * Search for code semantically similar to a text query.
 */
export async function searchSimilar(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const projectRoot = resolve(options.path || process.cwd());
  const indexer = getIndexer(projectRoot);

  // Load the index
  await indexer.load();

  if (!indexer.hasIndex()) {
    throw new Error(
      `No index found at ${projectRoot}. Run 'uilint duplicates index' first.`
    );
  }

  // Create embedding client
  const embeddingClient = new OllamaEmbeddingClient({
    model: options.model,
    baseUrl: options.baseUrl,
  });

  // Embed the query
  const queryResult = await embeddingClient.embed(query);

  const vectorStore = indexer.getVectorStore();
  const metadataStore = indexer.getMetadataStore();

  const results = findSimilarToQuery(vectorStore, queryResult.embedding, {
    top: options.top,
    threshold: options.threshold,
  });

  // Transform to public API format
  return results
    .map((r) => {
      const metadata = metadataStore.get(r.id);
      if (!metadata) return null;
      return {
        filePath: metadata.filePath,
        startLine: metadata.startLine,
        endLine: metadata.endLine,
        name: metadata.name,
        kind: metadata.kind,
        score: r.score,
      };
    })
    .filter((r): r is SearchResult => r !== null);
}

/**
 * Find code similar to a specific location (file:line).
 */
export async function findSimilarAtLocation(
  options: SimilarLocationOptions
): Promise<SearchResult[]> {
  const projectRoot = resolve(options.path || process.cwd());
  const indexer = getIndexer(projectRoot);

  // Load the index
  await indexer.load();

  if (!indexer.hasIndex()) {
    throw new Error(
      `No index found at ${projectRoot}. Run 'uilint duplicates index' first.`
    );
  }

  const vectorStore = indexer.getVectorStore();
  const metadataStore = indexer.getMetadataStore();

  const results = findSimilarToLocation(
    vectorStore,
    metadataStore,
    options.filePath,
    options.line,
    {
      top: options.top,
      threshold: options.threshold,
    }
  );

  // Transform to public API format
  return results
    .map((r) => {
      const metadata = metadataStore.get(r.id);
      if (!metadata) return null;
      return {
        filePath: metadata.filePath,
        startLine: metadata.startLine,
        endLine: metadata.endLine,
        name: metadata.name,
        kind: metadata.kind,
        score: r.score,
      };
    })
    .filter((r): r is SearchResult => r !== null);
}

/**
 * Check if an index exists for the given path.
 */
export function hasIndex(path: string = process.cwd()): boolean {
  const projectRoot = resolve(path);
  const indexer = getIndexer(projectRoot);
  return indexer.hasIndex();
}

/**
 * Get index statistics.
 */
export async function getIndexStats(path: string = process.cwd()): Promise<{
  totalFiles: number;
  totalChunks: number;
  indexSizeBytes: number;
  embeddingModel: string | null;
  lastUpdated: string | null;
}> {
  const projectRoot = resolve(path);
  const indexer = getIndexer(projectRoot);

  await indexer.load();

  const stats = indexer.getStats();
  return {
    totalFiles: stats.totalFiles,
    totalChunks: stats.totalChunks,
    indexSizeBytes: stats.indexSizeBytes,
    embeddingModel: stats.manifest?.embeddingModel || null,
    lastUpdated: stats.manifest?.updatedAt || null,
  };
}
