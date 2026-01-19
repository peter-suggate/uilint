/**
 * Coverage heatmap color utilities
 *
 * Maps coverage percentages to colors using OKLCH color space.
 * Color scheme: Green (100%) → Yellow (50%) → Red (0%)
 *
 * Inverse of issue heatmap - lower coverage = more visible overlay
 */

/** Coverage color hues in OKLCH */
const COVERAGE_HUES = {
  low: 27, // Red
  medium: 86, // Yellow
  high: 142, // Green
};

/** Base color properties in OKLCH */
const BASE_COLOR = {
  l: 0.7, // Lightness
  c: 0.15, // Chroma
};

/** Opacity range for coverage overlay */
const MIN_OPACITY = 0.15;
const MAX_OPACITY = 0.5;

/**
 * Get CSS color string for coverage percentage.
 * Interpolates hue from red (0%) through yellow (50%) to green (100%).
 *
 * @param percentage - Coverage percentage (0-100)
 * @returns OKLCH color string
 */
export function getCoverageColor(percentage: number): string {
  // Clamp percentage to 0-100
  const clamped = Math.max(0, Math.min(100, percentage));

  // Interpolate hue: 0% = red (27), 100% = green (142)
  const hue =
    COVERAGE_HUES.low +
    (clamped / 100) * (COVERAGE_HUES.high - COVERAGE_HUES.low);

  return `oklch(${BASE_COLOR.l} ${BASE_COLOR.c} ${hue})`;
}

/**
 * Calculate opacity for coverage overlay.
 * Lower coverage = more visible (inverse of issue heatmap).
 *
 * @param percentage - Coverage percentage (0-100)
 * @returns Opacity value between MIN_OPACITY and MAX_OPACITY
 */
export function getCoverageOpacity(percentage: number): number {
  // Clamp percentage to 0-100
  const clamped = Math.max(0, Math.min(100, percentage));

  // Inverse: lower coverage = higher opacity
  const normalized = 1 - clamped / 100;

  return MIN_OPACITY + normalized * (MAX_OPACITY - MIN_OPACITY);
}

/**
 * Get border color for coverage overlay.
 * Slightly more saturated and darker for visibility.
 *
 * @param percentage - Coverage percentage (0-100)
 * @returns OKLCH color string for border
 */
export function getCoverageBorderColor(percentage: number): string {
  const clamped = Math.max(0, Math.min(100, percentage));
  const hue =
    COVERAGE_HUES.low +
    (clamped / 100) * (COVERAGE_HUES.high - COVERAGE_HUES.low);

  // Darker and more saturated for border
  const l = BASE_COLOR.l - 0.1;
  const c = BASE_COLOR.c + 0.05;
  const opacity = getCoverageOpacity(percentage) + 0.2;

  return `oklch(${l} ${c} ${hue} / ${Math.min(opacity, 0.8).toFixed(3)})`;
}
