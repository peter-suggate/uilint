/**
 * Combined Scorer
 *
 * Combines multiple similarity signals into a final score:
 * - Semantic similarity (from embeddings)
 * - Structural similarity (from metadata: props, JSX, hooks)
 * - Normalized similarity (from AST normalization - optional, expensive)
 *
 * The combined approach catches more duplicates than embedding alone:
 * - Structural catches same-structure/different-names cases
 * - Normalization catches copy-paste with renamed variables
 * - Semantic catches conceptually similar but differently structured code
 */

import type { StoredChunkMetadata } from "../index/types.js";
import {
  calculateStructuralSimilarity,
  type StructuralScore,
} from "./structural-scorer.js";
import { calculateNormalizedSimilarity } from "./normalizer.js";
import {
  getConfidenceLevel,
  getConfidenceResult,
  type ConfidenceLevel,
  type ConfidenceResult,
} from "./confidence.js";

export interface CombinedScore {
  /** Final combined score (0-1) */
  final: number;
  /** Semantic embedding similarity (0-1) */
  semantic: number;
  /** Structural metadata similarity (0-1) */
  structural: number;
  /** Detailed structural breakdown */
  structuralDetails: StructuralScore;
  /** Normalized code similarity (0-1, only if computed) */
  normalized?: number;
  /** Confidence level based on final score */
  confidence: ConfidenceLevel;
  /** Detailed confidence result */
  confidenceDetails: ConfidenceResult;
}

export interface CombinedScorerOptions {
  /** Weight for semantic similarity (default: 0.5) */
  semanticWeight?: number;
  /** Weight for structural similarity (default: 0.3) */
  structuralWeight?: number;
  /** Weight for normalized similarity (default: 0.2) */
  normalizedWeight?: number;
  /** Whether to compute normalized similarity (expensive) */
  includeNormalized?: boolean;
}

export const DEFAULT_COMBINED_SCORER_OPTIONS: Required<CombinedScorerOptions> = {
  semanticWeight: 0.5,
  structuralWeight: 0.3,
  normalizedWeight: 0.2,
  includeNormalized: false,
};

/**
 * Calculate combined similarity score using multiple signals.
 *
 * @param semanticScore Embedding-based similarity score (0-1)
 * @param metadataA Metadata for first chunk
 * @param metadataB Metadata for second chunk
 * @param codeA Source code of first chunk (optional, needed for normalization)
 * @param codeB Source code of second chunk (optional, needed for normalization)
 * @param options Scoring options
 * @returns Combined score with all components
 */
export function calculateCombinedScore(
  semanticScore: number,
  metadataA: StoredChunkMetadata,
  metadataB: StoredChunkMetadata,
  codeA?: string,
  codeB?: string,
  options: CombinedScorerOptions = {}
): CombinedScore {
  const opts = { ...DEFAULT_COMBINED_SCORER_OPTIONS, ...options };

  // Calculate structural similarity
  const structuralDetails = calculateStructuralSimilarity(metadataA, metadataB);
  const structural = structuralDetails.combined;

  // Calculate normalized similarity if requested and code is available
  let normalized: number | undefined;
  if (opts.includeNormalized && codeA && codeB) {
    normalized = calculateNormalizedSimilarity(codeA, codeB);
  }

  // Calculate final score based on available signals
  let final: number;

  if (normalized !== undefined) {
    // All three signals available
    final =
      semanticScore * opts.semanticWeight +
      structural * opts.structuralWeight +
      normalized * opts.normalizedWeight;
  } else {
    // Only semantic and structural available
    // Redistribute normalized weight proportionally
    const totalWeight = opts.semanticWeight + opts.structuralWeight;
    const adjustedSemanticWeight = opts.semanticWeight / totalWeight;
    const adjustedStructuralWeight = opts.structuralWeight / totalWeight;

    final =
      semanticScore * adjustedSemanticWeight + structural * adjustedStructuralWeight;
  }

  // Boost score if any single signal is very high (catch obvious duplicates)
  final = applyBoostForHighSignals(final, semanticScore, structural, normalized);

  // Ensure final is clamped to [0, 1]
  final = Math.max(0, Math.min(1, final));

  const confidence = getConfidenceLevel(final);
  const confidenceDetails = getConfidenceResult(final);

  return {
    final,
    semantic: semanticScore,
    structural,
    structuralDetails,
    normalized,
    confidence,
    confidenceDetails,
  };
}

/**
 * Apply boost to final score if any individual signal is very high.
 * This ensures that obvious duplicates (e.g., 98% normalized similarity)
 * are not penalized by lower scores in other dimensions.
 */
function applyBoostForHighSignals(
  baseScore: number,
  semantic: number,
  structural: number,
  normalized?: number
): number {
  const HIGH_SIGNAL_THRESHOLD = 0.95;
  const BOOST_FACTOR = 0.1;

  let boost = 0;

  // If normalized similarity is very high, this is almost certainly a duplicate
  if (normalized !== undefined && normalized >= HIGH_SIGNAL_THRESHOLD) {
    boost = Math.max(boost, (normalized - HIGH_SIGNAL_THRESHOLD) * 2);
  }

  // If semantic similarity is very high
  if (semantic >= HIGH_SIGNAL_THRESHOLD) {
    boost = Math.max(boost, (semantic - HIGH_SIGNAL_THRESHOLD) * 1.5);
  }

  // If structural similarity is very high
  if (structural >= HIGH_SIGNAL_THRESHOLD) {
    boost = Math.max(boost, (structural - HIGH_SIGNAL_THRESHOLD) * 1.5);
  }

  return baseScore + boost * BOOST_FACTOR;
}

/**
 * Quick pre-filter check using only structural similarity.
 * Use this to avoid expensive embedding comparisons for obviously dissimilar code.
 *
 * @param metadataA First chunk metadata
 * @param metadataB Second chunk metadata
 * @param threshold Minimum structural similarity to consider (default: 0.3)
 * @returns True if chunks are potentially similar enough to warrant full comparison
 */
export function isPotentialDuplicate(
  metadataA: StoredChunkMetadata,
  metadataB: StoredChunkMetadata,
  threshold: number = 0.3
): boolean {
  const structural = calculateStructuralSimilarity(metadataA, metadataB);
  return structural.combined >= threshold;
}

/**
 * Calculate quick similarity using only structural features.
 * Useful when embedding scores are not available.
 */
export function calculateQuickScore(
  metadataA: StoredChunkMetadata,
  metadataB: StoredChunkMetadata
): { score: number; confidence: ConfidenceLevel } {
  const structural = calculateStructuralSimilarity(metadataA, metadataB);
  const confidence = getConfidenceLevel(structural.combined);
  return { score: structural.combined, confidence };
}

/**
 * Determine the best action based on combined score.
 */
export function getRecommendedAction(score: CombinedScore): string {
  if (score.normalized !== undefined && score.normalized >= 0.95) {
    return "These appear to be near-identical. Consolidate into a single implementation.";
  }

  if (score.final >= 0.9) {
    return "High similarity detected. Strongly consider consolidating into a shared component/function.";
  }

  if (score.final >= 0.75) {
    return "Moderate similarity. Review for potential abstraction into a shared utility.";
  }

  if (score.structural >= 0.8 && score.semantic < 0.7) {
    return "Similar structure but different semantics. May be intentionally different implementations.";
  }

  if (score.semantic >= 0.8 && score.structural < 0.5) {
    return "Similar purpose but different structure. Consider if a common abstraction makes sense.";
  }

  return "Low similarity. Likely different implementations that happen to share some patterns.";
}

/**
 * Format combined score for display.
 */
export function formatCombinedScore(score: CombinedScore, verbose: boolean = false): string {
  const percent = Math.round(score.final * 100);
  const lines: string[] = [];

  lines.push(`${percent}% similar (${score.confidence} confidence)`);

  if (verbose) {
    lines.push(`  Semantic:   ${Math.round(score.semantic * 100)}%`);
    lines.push(`  Structural: ${Math.round(score.structural * 100)}%`);
    if (score.normalized !== undefined) {
      lines.push(`  Normalized: ${Math.round(score.normalized * 100)}%`);
    }
    lines.push(`  → ${getRecommendedAction(score)}`);
  }

  return lines.join("\n");
}
