/**
 * Confidence Level System
 *
 * Provides confidence levels for duplicate detection results
 * to help users prioritize which duplicates to address.
 *
 * Confidence levels:
 * - HIGH: Likely copy-paste or near-identical implementation. Should consolidate.
 * - MEDIUM: Semantically similar code. Worth reviewing for potential abstraction.
 * - LOW: Possibly related patterns. Optional to review.
 */

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ConfidenceConfig {
  /** Threshold for high confidence (default: 0.90) */
  highThreshold: number;
  /** Threshold for medium confidence (default: 0.75) */
  mediumThreshold: number;
  /** Threshold for low confidence / minimum reporting (default: 0.60) */
  lowThreshold: number;
}

export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceConfig = {
  highThreshold: 0.9,
  mediumThreshold: 0.75,
  lowThreshold: 0.6,
};

export interface ConfidenceResult {
  /** The confidence level */
  level: ConfidenceLevel;
  /** The raw similarity score (0-1) */
  score: number;
  /** Human-readable description of what this confidence level means */
  description: string;
  /** Recommended action for the user */
  action: string;
  /** Color for CLI/UI display */
  color: "red" | "yellow" | "green";
}

/**
 * Determine confidence level from a similarity score.
 *
 * @param score Similarity score between 0 and 1
 * @param config Optional custom threshold configuration
 * @returns The confidence level
 */
export function getConfidenceLevel(
  score: number,
  config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG
): ConfidenceLevel {
  if (score >= config.highThreshold) return "high";
  if (score >= config.mediumThreshold) return "medium";
  return "low";
}

/**
 * Check if a score meets the minimum threshold for reporting.
 *
 * @param score Similarity score
 * @param config Optional custom threshold configuration
 * @returns True if the score should be reported
 */
export function meetsMinimumThreshold(
  score: number,
  config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG
): boolean {
  return score >= config.lowThreshold;
}

/**
 * Get detailed confidence result with actionable guidance.
 *
 * @param score Similarity score between 0 and 1
 * @param config Optional custom threshold configuration
 * @returns Full confidence result with guidance
 */
export function getConfidenceResult(
  score: number,
  config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG
): ConfidenceResult {
  const level = getConfidenceLevel(score, config);

  switch (level) {
    case "high":
      return {
        level,
        score,
        description:
          "High confidence duplicate - likely copy-paste or near-identical implementation",
        action: "Strongly recommend consolidating into a single reusable component/function",
        color: "red",
      };
    case "medium":
      return {
        level,
        score,
        description:
          "Medium confidence - semantically similar code with different implementation details",
        action: "Review for potential consolidation or shared abstraction",
        color: "yellow",
      };
    case "low":
      return {
        level,
        score,
        description: "Low confidence - possibly related patterns or partial structural overlap",
        action: "Optional review - differences may be intentional",
        color: "green",
      };
  }
}

/**
 * Get emoji indicator for confidence level (for CLI output).
 */
export function getConfidenceEmoji(level: ConfidenceLevel): string {
  switch (level) {
    case "high":
      return "🔴";
    case "medium":
      return "🟡";
    case "low":
      return "🟢";
  }
}

/**
 * Get ANSI color code for confidence level (for CLI output).
 */
export function getConfidenceAnsiColor(level: ConfidenceLevel): string {
  switch (level) {
    case "high":
      return "\x1b[31m"; // Red
    case "medium":
      return "\x1b[33m"; // Yellow
    case "low":
      return "\x1b[32m"; // Green
  }
}

/**
 * Format confidence for display in CLI.
 *
 * @param result Confidence result to format
 * @param useEmoji Whether to include emoji (default: true)
 * @param useColor Whether to include ANSI colors (default: false)
 * @returns Formatted string
 */
export function formatConfidence(
  result: ConfidenceResult,
  useEmoji: boolean = true,
  useColor: boolean = false
): string {
  const percent = Math.round(result.score * 100);
  const emoji = useEmoji ? getConfidenceEmoji(result.level) + " " : "";
  const colorStart = useColor ? getConfidenceAnsiColor(result.level) : "";
  const colorEnd = useColor ? "\x1b[0m" : "";

  return `${emoji}${colorStart}${percent}% similarity (${result.level} confidence)${colorEnd}`;
}

/**
 * Format confidence with full details for verbose output.
 */
export function formatConfidenceVerbose(result: ConfidenceResult): string {
  const lines = [
    formatConfidence(result),
    `  ${result.description}`,
    `  → ${result.action}`,
  ];
  return lines.join("\n");
}

/**
 * Compare two confidence levels.
 * Returns: -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareConfidenceLevels(a: ConfidenceLevel, b: ConfidenceLevel): number {
  const order: Record<ConfidenceLevel, number> = { high: 3, medium: 2, low: 1 };
  return order[a] - order[b];
}

/**
 * Filter results by minimum confidence level.
 */
export function filterByConfidence<T extends { score: number }>(
  results: T[],
  minLevel: ConfidenceLevel,
  config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG
): T[] {
  const minThreshold =
    minLevel === "high"
      ? config.highThreshold
      : minLevel === "medium"
        ? config.mediumThreshold
        : config.lowThreshold;

  return results.filter((r) => r.score >= minThreshold);
}
