/**
 * Heatmap color utilities for issue density visualization
 *
 * Uses a single warm color (amber/orange) with varying opacity
 * to create a beautiful, minimal heatmap effect.
 */

/** Base heatmap color in OKLCH for consistency with theme */
const HEATMAP_BASE = {
  l: 0.75, // Lightness
  c: 0.183, // Chroma
  h: 55.934, // Hue (amber)
};

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
 */
export function getHeatmapColor(opacity: number): string {
  const { l, c, h } = HEATMAP_BASE;
  return `oklch(${l} ${c} ${h} / ${opacity.toFixed(3)})`;
}

/**
 * Get border color for heatmap (slightly more saturated and darker)
 */
export function getHeatmapBorderColor(opacity: number): string {
  const { l, c, h } = HEATMAP_BASE;
  // Increase chroma and decrease lightness for border visibility
  const borderOpacity = Math.min(opacity + 0.2, 0.8);
  return `oklch(${l - 0.1} ${c + 0.05} ${h} / ${borderOpacity.toFixed(3)})`;
}
