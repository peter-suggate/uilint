/**
 * Duplicate Finder
 *
 * Finds groups of semantically similar code chunks using the vector index.
 */

import type { VectorStore, SimilarityResult } from "../index/vector-store.js";
import type { MetadataStore } from "../index/metadata-store.js";
import type { StoredChunkMetadata } from "../index/types.js";
import type { ChunkKind } from "../embeddings/types.js";
import {
  calculateGroupAverageSimilarity,
  sortDuplicateGroups,
} from "./scorer.js";

export interface DuplicateMember {
  /** Chunk ID */
  id: string;
  /** Chunk metadata */
  metadata: StoredChunkMetadata;
  /** Similarity score to the group centroid/first member */
  score: number;
}

export interface DuplicateGroup {
  /** Members of the duplicate group */
  members: DuplicateMember[];
  /** Average similarity between all group members */
  avgSimilarity: number;
  /** The kind of code in this group (component, hook, function) */
  kind: ChunkKind;
}

export interface FindDuplicatesOptions {
  /** Minimum cosine similarity threshold (0-1). Default: 0.85 */
  threshold?: number;
  /** Minimum group size. Default: 2 */
  minGroupSize?: number;
  /** Filter by chunk kind */
  kind?: ChunkKind;
  /** Exclude specific file paths */
  excludePaths?: string[];
}

/**
 * Find groups of semantically similar code.
 *
 * Algorithm:
 * 1. Iterate through all chunks
 * 2. For each unprocessed chunk, find similar chunks above threshold
 * 3. Group similar chunks together
 * 4. Mark all grouped chunks as processed
 * 5. Sort groups by size and similarity
 */
export function findDuplicateGroups(
  vectorStore: VectorStore,
  metadataStore: MetadataStore,
  options: FindDuplicatesOptions = {}
): DuplicateGroup[] {
  const {
    threshold = 0.85,
    minGroupSize = 2,
    kind,
    excludePaths = [],
  } = options;

  const groups: DuplicateGroup[] = [];
  const processed = new Set<string>();

  // Get all entries and filter by kind if specified
  let entries = [...metadataStore.entries()];

  if (kind) {
    entries = entries.filter(([, meta]) => meta.kind === kind);
  }

  // Exclude specified paths
  if (excludePaths.length > 0) {
    entries = entries.filter(
      ([, meta]) => !excludePaths.some((p) => meta.filePath.includes(p))
    );
  }

  for (const [id, metadata] of entries) {
    if (processed.has(id)) continue;

    const vector = vectorStore.get(id);
    if (!vector) continue;

    // Find similar chunks
    const similar = vectorStore.findSimilar(vector, 50, threshold);

    // Filter out self, already-processed, and potentially filter by kind
    let candidates = similar.filter((s) => {
      if (s.id === id) return false;
      if (processed.has(s.id)) return false;

      const candidateMeta = metadataStore.get(s.id);
      if (!candidateMeta) return false;

      // If kind filter is set, only include same kind
      if (kind && candidateMeta.kind !== kind) return false;

      // Exclude paths
      if (excludePaths.some((p) => candidateMeta.filePath.includes(p)))
        return false;

      return true;
    });

    // If not filtering by kind, prefer same-kind groupings
    if (!kind && candidates.length > 0) {
      const sameKindCandidates = candidates.filter((c) => {
        const meta = metadataStore.get(c.id);
        return meta?.kind === metadata.kind;
      });
      if (sameKindCandidates.length > 0) {
        candidates = sameKindCandidates;
      }
    }

    // Check if we have enough candidates for a group
    if (candidates.length >= minGroupSize - 1) {
      const members: DuplicateMember[] = [
        { id, metadata, score: 1.0 }, // First member (reference)
      ];

      const similarities: number[] = [];

      for (const candidate of candidates) {
        const candidateMeta = metadataStore.get(candidate.id);
        if (candidateMeta) {
          members.push({
            id: candidate.id,
            metadata: candidateMeta,
            score: candidate.score,
          });
          similarities.push(candidate.score);
          processed.add(candidate.id);
        }
      }

      // Mark the original chunk as processed
      processed.add(id);

      groups.push({
        members,
        avgSimilarity: calculateGroupAverageSimilarity(similarities),
        kind: metadata.kind,
      });
    }
  }

  // Sort groups by relevance
  return sortDuplicateGroups(groups);
}

/**
 * Find similar code to a given location (file:line).
 */
export function findSimilarToLocation(
  vectorStore: VectorStore,
  metadataStore: MetadataStore,
  filePath: string,
  line: number,
  options: { top?: number; threshold?: number } = {}
): SimilarityResult[] {
  const { top = 10, threshold = 0.5 } = options;

  // Find the chunk at this location
  const chunk = metadataStore.getAtLocation(filePath, line);
  if (!chunk) {
    return [];
  }

  // Get the vector for this chunk
  const vector = vectorStore.get(chunk.id);
  if (!vector) {
    return [];
  }

  // Find similar chunks (excluding self)
  const similar = vectorStore.findSimilar(vector, top + 1, threshold);

  return similar.filter((s) => s.id !== chunk.id).slice(0, top);
}

/**
 * Search for code similar to a text query.
 * Requires embedding the query first.
 */
export function findSimilarToQuery(
  vectorStore: VectorStore,
  queryEmbedding: number[],
  options: { top?: number; threshold?: number } = {}
): SimilarityResult[] {
  const { top = 10, threshold = 0.5 } = options;

  return vectorStore.findSimilar(queryEmbedding, top, threshold);
}
