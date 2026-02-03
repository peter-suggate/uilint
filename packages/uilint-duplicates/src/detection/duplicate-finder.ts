/**
 * Duplicate Finder
 *
 * Finds groups of semantically similar code chunks using the vector index.
 * Enhanced with structural similarity scoring and confidence levels.
 */

import type { VectorStore, SimilarityResult } from "../index/vector-store.js";
import type { MetadataStore } from "../index/metadata-store.js";
import type { StoredChunkMetadata } from "../index/types.js";
import type { ChunkKind } from "../embeddings/types.js";
import {
  calculateGroupAverageSimilarity,
  sortDuplicateGroups,
} from "./scorer.js";
import { calculateStructuralSimilarity } from "./structural-scorer.js";
import {
  getConfidenceLevel,
  type ConfidenceLevel,
} from "./confidence.js";

export interface DuplicateMember {
  /** Chunk ID */
  id: string;
  /** Chunk metadata */
  metadata: StoredChunkMetadata;
  /** Similarity score to the group centroid/first member (semantic only) */
  score: number;
  /** Combined score (semantic + structural) */
  combinedScore?: number;
  /** Structural similarity score */
  structuralScore?: number;
  /** Confidence level for this match */
  confidence?: ConfidenceLevel;
}

export interface DuplicateGroup {
  /** Members of the duplicate group */
  members: DuplicateMember[];
  /** Average similarity between all group members */
  avgSimilarity: number;
  /** The kind of code in this group (component, hook, function) */
  kind: ChunkKind;
  /** Overall confidence level for the group */
  confidence: ConfidenceLevel;
}

export interface FindDuplicatesOptions {
  /** Minimum cosine similarity threshold (0-1). Default: 0.75 (lowered from 0.85) */
  threshold?: number;
  /** Minimum group size. Default: 2 */
  minGroupSize?: number;
  /** Filter by chunk kind */
  kind?: ChunkKind;
  /** Exclude specific file paths */
  excludePaths?: string[];
  /** Include duplicates within the same file. Default: true */
  includeSameFile?: boolean;
  /** Use structural similarity to boost scores. Default: true */
  useStructuralBoost?: boolean;
  /** Filter results by minimum confidence level */
  confidenceFilter?: ConfidenceLevel;
}

/**
 * Calculate combined score from semantic and structural similarity.
 * Weights: 60% semantic, 40% structural.
 */
function calculateCombinedSimilarity(
  semanticScore: number,
  metadataA: StoredChunkMetadata,
  metadataB: StoredChunkMetadata
): { combined: number; structural: number } {
  const structuralResult = calculateStructuralSimilarity(metadataA, metadataB);
  const structural = structuralResult.combined;

  // Weighted combination: 60% semantic, 40% structural
  const combined = semanticScore * 0.6 + structural * 0.4;

  return { combined, structural };
}

/**
 * Get minimum threshold for confidence level filter.
 */
function getConfidenceThreshold(level: ConfidenceLevel): number {
  switch (level) {
    case "high":
      return 0.9;
    case "medium":
      return 0.75;
    case "low":
      return 0.6;
  }
}

/**
 * Find groups of semantically similar code.
 *
 * Algorithm:
 * 1. Iterate through all chunks
 * 2. For each unprocessed chunk, find similar chunks above threshold
 * 3. Calculate combined score (semantic + structural)
 * 4. Group similar chunks together
 * 5. Assign confidence levels
 * 6. Sort groups by size and similarity
 */
export function findDuplicateGroups(
  vectorStore: VectorStore,
  metadataStore: MetadataStore,
  options: FindDuplicatesOptions = {}
): DuplicateGroup[] {
  const {
    threshold = 0.75, // Lowered from 0.85
    minGroupSize = 2,
    kind,
    excludePaths = [],
    includeSameFile = true,
    useStructuralBoost = true,
    confidenceFilter,
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

    // Find similar chunks - use lower threshold for initial search
    // to catch candidates that might be boosted by structural similarity
    const searchThreshold = useStructuralBoost ? threshold * 0.8 : threshold;
    const similar = vectorStore.findSimilar(vector, 50, searchThreshold);

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

      // Optionally exclude same-file matches
      if (!includeSameFile && candidateMeta.filePath === metadata.filePath)
        return false;

      return true;
    });

    // Calculate combined scores if structural boost is enabled
    if (useStructuralBoost) {
      candidates = candidates
        .map((c) => {
          const candidateMeta = metadataStore.get(c.id);
          if (!candidateMeta) return { ...c, combinedScore: c.score };

          const { combined, structural } = calculateCombinedSimilarity(
            c.score,
            metadata,
            candidateMeta
          );
          return { ...c, combinedScore: combined, structuralScore: structural };
        })
        .filter((c) => (c.combinedScore ?? c.score) >= threshold)
        .sort((a, b) => (b.combinedScore ?? b.score) - (a.combinedScore ?? a.score));
    }

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
        {
          id,
          metadata,
          score: 1.0,
          combinedScore: 1.0,
          confidence: "high",
        },
      ];

      const similarities: number[] = [];

      for (const candidate of candidates) {
        const candidateMeta = metadataStore.get(candidate.id);
        if (candidateMeta) {
          const combinedScore =
            (candidate as { combinedScore?: number }).combinedScore ?? candidate.score;
          const structuralScore =
            (candidate as { structuralScore?: number }).structuralScore;
          const confidence = getConfidenceLevel(combinedScore);

          members.push({
            id: candidate.id,
            metadata: candidateMeta,
            score: candidate.score,
            combinedScore,
            structuralScore,
            confidence,
          });
          similarities.push(combinedScore);
          processed.add(candidate.id);
        }
      }

      // Mark the original chunk as processed
      processed.add(id);

      const avgSimilarity = calculateGroupAverageSimilarity(similarities);
      const groupConfidence = getConfidenceLevel(avgSimilarity);

      groups.push({
        members,
        avgSimilarity,
        kind: metadata.kind,
        confidence: groupConfidence,
      });
    }
  }

  // Filter by confidence level if specified
  let result = groups;
  if (confidenceFilter) {
    const minThreshold = getConfidenceThreshold(confidenceFilter);
    result = groups.filter((g) => g.avgSimilarity >= minThreshold);
  }

  // Sort groups by relevance
  return sortDuplicateGroups(result);
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
