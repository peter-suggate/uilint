/**
 * Duplicate Scorer
 *
 * Provides scoring functions for ranking duplicate code groups.
 */

import type { StoredChunkMetadata } from "../index/types.js";

export interface DuplicateScore {
  /** Embedding cosine similarity (0-1) */
  similarity: number;
  /** Ratio of code size similarity (0-1) */
  sizeRatio: number;
  /** Weighted combined score */
  combinedScore: number;
}

/**
 * Calculate the size ratio between two code chunks.
 * Returns a value between 0 and 1 where 1 means identical size.
 */
export function calculateSizeRatio(
  chunk1: StoredChunkMetadata,
  chunk2: StoredChunkMetadata
): number {
  const lines1 = chunk1.endLine - chunk1.startLine + 1;
  const lines2 = chunk2.endLine - chunk2.startLine + 1;

  const minLines = Math.min(lines1, lines2);
  const maxLines = Math.max(lines1, lines2);

  return maxLines > 0 ? minLines / maxLines : 1;
}

/**
 * Calculate a combined duplicate score.
 */
export function calculateDuplicateScore(
  similarity: number,
  chunk1: StoredChunkMetadata,
  chunk2: StoredChunkMetadata
): DuplicateScore {
  const sizeRatio = calculateSizeRatio(chunk1, chunk2);

  // Weighted score: 85% similarity, 15% size ratio
  const combinedScore = similarity * 0.85 + sizeRatio * 0.15;

  return {
    similarity,
    sizeRatio,
    combinedScore,
  };
}

/**
 * Calculate the average similarity of a duplicate group.
 */
export function calculateGroupAverageSimilarity(
  similarities: number[]
): number {
  if (similarities.length === 0) return 0;
  return similarities.reduce((sum, s) => sum + s, 0) / similarities.length;
}

/**
 * Sort duplicate groups by relevance.
 * Groups are sorted by: member count (desc), then average similarity (desc).
 */
export function sortDuplicateGroups<T extends { avgSimilarity: number; members: unknown[] }>(
  groups: T[]
): T[] {
  return [...groups].sort((a, b) => {
    // First by member count (more members = more important)
    const countDiff = b.members.length - a.members.length;
    if (countDiff !== 0) return countDiff;

    // Then by average similarity
    return b.avgSimilarity - a.avgSimilarity;
  });
}
