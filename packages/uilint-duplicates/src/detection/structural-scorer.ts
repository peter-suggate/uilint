/**
 * Structural Similarity Scorer
 *
 * Calculates similarity based on code structure (props, hooks, JSX elements)
 * independent of semantic embeddings. This complements embedding-based
 * similarity by catching cases where code structure is similar but
 * variable/prop names differ.
 */

import type { StoredChunkMetadata } from "../index/types.js";

export interface StructuralScore {
  /** Jaccard similarity of prop names (0-1) */
  propsOverlap: number;
  /** Jaccard similarity of JSX elements (0-1) */
  jsxOverlap: number;
  /** Jaccard similarity of hooks used (0-1) */
  hooksOverlap: number;
  /** Line count ratio (0-1, 1 = same size) */
  sizeRatio: number;
  /** Combined weighted score (0-1) */
  combined: number;
}

export interface StructuralScorerWeights {
  /** Weight for props overlap (default: 0.25) */
  props: number;
  /** Weight for JSX elements overlap (default: 0.35) */
  jsx: number;
  /** Weight for hooks overlap (default: 0.25) */
  hooks: number;
  /** Weight for size similarity (default: 0.15) */
  size: number;
}

export const DEFAULT_STRUCTURAL_WEIGHTS: StructuralScorerWeights = {
  props: 0.25,
  jsx: 0.35,
  hooks: 0.25,
  size: 0.15,
};

/**
 * Calculate Jaccard similarity between two sets of strings.
 * Returns 1 if both sets are empty (vacuously similar).
 */
export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Normalize to lowercase for comparison
  const setA = new Set(a.map((s) => s.toLowerCase()));
  const setB = new Set(b.map((s) => s.toLowerCase()));

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

/**
 * Calculate size ratio between two code chunks.
 * Returns a value between 0 and 1, where 1 means identical size.
 */
export function calculateSizeRatio(linesA: number, linesB: number): number {
  if (linesA === 0 && linesB === 0) return 1;
  if (linesA === 0 || linesB === 0) return 0;

  const min = Math.min(linesA, linesB);
  const max = Math.max(linesA, linesB);

  return min / max;
}

/**
 * Extract structural features from chunk metadata.
 * Handles cases where metadata fields may be missing.
 * Note: StoredChunkMetadata has a nested `metadata` field containing props, hooks, etc.
 */
function extractFeatures(storedMeta: StoredChunkMetadata): {
  props: string[];
  jsxElements: string[];
  hooks: string[];
  lines: number;
} {
  const meta = storedMeta.metadata ?? {};
  return {
    props: meta.props ?? [],
    jsxElements: meta.jsxElements ?? [],
    hooks: meta.hooks ?? [],
    lines: (storedMeta.endLine ?? 0) - (storedMeta.startLine ?? 0) + 1,
  };
}

/**
 * Calculate structural similarity between two chunks.
 *
 * This function compares the structural features of two code chunks:
 * - Props/parameters they accept
 * - JSX elements they render
 * - Hooks they use
 * - Relative size
 *
 * @param a First chunk metadata
 * @param b Second chunk metadata
 * @param weights Optional custom weights for each feature
 * @returns Structural similarity score with component breakdowns
 */
export function calculateStructuralSimilarity(
  a: StoredChunkMetadata,
  b: StoredChunkMetadata,
  weights: StructuralScorerWeights = DEFAULT_STRUCTURAL_WEIGHTS
): StructuralScore {
  const featuresA = extractFeatures(a);
  const featuresB = extractFeatures(b);

  const propsOverlap = jaccard(featuresA.props, featuresB.props);
  const jsxOverlap = jaccard(featuresA.jsxElements, featuresB.jsxElements);
  const hooksOverlap = jaccard(featuresA.hooks, featuresB.hooks);
  const sizeRatio = calculateSizeRatio(featuresA.lines, featuresB.lines);

  // Calculate weighted combined score
  const combined =
    propsOverlap * weights.props +
    jsxOverlap * weights.jsx +
    hooksOverlap * weights.hooks +
    sizeRatio * weights.size;

  return {
    propsOverlap,
    jsxOverlap,
    hooksOverlap,
    sizeRatio,
    combined,
  };
}

/**
 * Quick check if two chunks have high structural similarity.
 * Useful for fast pre-filtering before expensive embedding comparison.
 *
 * @param a First chunk metadata
 * @param b Second chunk metadata
 * @param threshold Minimum combined score to consider similar (default: 0.5)
 */
export function hasHighStructuralSimilarity(
  a: StoredChunkMetadata,
  b: StoredChunkMetadata,
  threshold: number = 0.5
): boolean {
  const score = calculateStructuralSimilarity(a, b);
  return score.combined >= threshold;
}

/**
 * Find structurally similar chunks from a list.
 * Returns chunks sorted by structural similarity (highest first).
 *
 * @param target The chunk to compare against
 * @param candidates List of candidate chunks to compare
 * @param threshold Minimum similarity threshold
 * @param limit Maximum number of results to return
 */
export function findStructurallySimilar(
  target: StoredChunkMetadata,
  candidates: StoredChunkMetadata[],
  threshold: number = 0.5,
  limit: number = 10
): Array<{ metadata: StoredChunkMetadata; score: StructuralScore }> {
  const results: Array<{ metadata: StoredChunkMetadata; score: StructuralScore }> = [];

  for (const candidate of candidates) {
    // Skip self-comparison
    if (candidate.filePath === target.filePath && candidate.startLine === target.startLine) {
      continue;
    }

    const score = calculateStructuralSimilarity(target, candidate);
    if (score.combined >= threshold) {
      results.push({ metadata: candidate, score });
    }
  }

  // Sort by combined score descending
  results.sort((a, b) => b.score.combined - a.score.combined);

  return results.slice(0, limit);
}
