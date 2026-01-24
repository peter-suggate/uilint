/**
 * Heatmap color utilities for issue density visualization
 *
 * Uses different colors for warnings (amber) vs errors (red)
 * with varying opacity to create a beautiful, minimal heatmap effect.
 */

export type IssueSeverity = "error" | "warn";

/** Base heatmap colors in OKLCH for consistency with theme */
const HEATMAP_COLORS = {
  warn: {
    l: 0.75, // Lightness
    c: 0.183, // Chroma
    h: 55.934, // Hue (amber/yellow)
  },
  error: {
    l: 0.65, // Slightly darker
    c: 0.22, // More saturated
    h: 25, // Hue (red/orange)
  },
};

/** @deprecated Use HEATMAP_COLORS instead */
const HEATMAP_BASE = HEATMAP_COLORS.warn;

/** Minimum opacity for elements with issues */
const MIN_OPACITY = 0.15;

/** Maximum opacity for elements with most issues */
const MAX_OPACITY = 0.55;

/**
 * Calculate opacity based on issue count using logarithmic scale.
 * Logarithmic scaling prevents high-outlier counts from overwhelming the display.
 *
 * @param issueCount - Number of issues for this element
 * @param maxIssues - Maximum issues across all elements (for normalization)
 * @returns Opacity value between 0.15 and 0.55, or 0 if no issues
 */
export function calculateHeatmapOpacity(
  issueCount: number,
  maxIssues: number
): number {
  if (issueCount === 0) return 0;
  if (maxIssues === 0) return 0;

  // Use logarithmic scale for better distribution
  // log(1) = 0, so we add 1 to shift the scale
  const logCount = Math.log(issueCount + 1);
  const logMax = Math.log(maxIssues + 1);

  // Normalize to 0-1 range
  const normalized = logCount / logMax;

  // Scale to opacity range
  return MIN_OPACITY + normalized * (MAX_OPACITY - MIN_OPACITY);
}

/**
 * Get CSS color string for heatmap overlay background
 * @deprecated Use getSeverityColor instead
 */
export function getHeatmapColor(opacity: number): string {
  const { l, c, h } = HEATMAP_BASE;
  return `oklch(${l} ${c} ${h} / ${opacity.toFixed(3)})`;
}

/**
 * Get border color for heatmap (slightly more saturated and darker)
 * @deprecated Use getSeverityBorderColor instead
 */
export function getHeatmapBorderColor(opacity: number): string {
  const { l, c, h } = HEATMAP_BASE;
  // Increase chroma and decrease lightness for border visibility
  const borderOpacity = Math.min(opacity + 0.2, 0.8);
  return `oklch(${l - 0.1} ${c + 0.05} ${h} / ${borderOpacity.toFixed(3)})`;
}

/**
 * Get CSS color string for heatmap overlay based on severity
 */
export function getSeverityColor(
  opacity: number,
  severity: IssueSeverity
): string {
  const { l, c, h } = HEATMAP_COLORS[severity];
  return `oklch(${l} ${c} ${h} / ${opacity.toFixed(3)})`;
}

/**
 * Get border color for heatmap based on severity (slightly more saturated and darker)
 */
export function getSeverityBorderColor(
  opacity: number,
  severity: IssueSeverity
): string {
  const { l, c, h } = HEATMAP_COLORS[severity];
  // Increase chroma and decrease lightness for border visibility
  const borderOpacity = Math.min(opacity + 0.2, 0.8);
  return `oklch(${l - 0.1} ${c + 0.05} ${h} / ${borderOpacity.toFixed(3)})`;
}
