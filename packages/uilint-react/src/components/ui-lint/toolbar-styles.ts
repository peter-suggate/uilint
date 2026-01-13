/**
 * Design tokens for UILint toolbar components
 * Refined for the segmented pill toolbar design
 *
 * Uses CSS variables for theme support (light/dark modes).
 */
export const STYLES = {
  // Backgrounds - using CSS variables for theming
  bg: "var(--uilint-backdrop)",
  bgHover: "var(--uilint-hover)",
  bgSegment: "var(--uilint-surface-elevated)",
  bgSegmentHover: "var(--uilint-active)",
  bgPopover: "var(--uilint-backdrop)",

  // Borders
  border: "var(--uilint-border)",
  borderLight: "var(--uilint-border)",
  divider: "var(--uilint-border)",

  // Text
  text: "var(--uilint-text-primary)",
  textMuted: "var(--uilint-text-secondary)",
  textDim: "var(--uilint-text-muted)",

  // Accent colors
  accent: "var(--uilint-accent)",
  accentHover: "var(--uilint-accent)",
  accentLight: "var(--uilint-accent)",

  // Status colors
  success: "var(--uilint-success)",
  successLight: "var(--uilint-success-bg)",
  warning: "var(--uilint-warning)",
  warningLight: "var(--uilint-warning-bg)",
  error: "var(--uilint-error)",
  errorLight: "var(--uilint-error-bg)",

  // Badge colors
  badgeBg: "var(--uilint-accent)",
  badgeText: "var(--uilint-accent-foreground)",

  // Effects
  shadow: "var(--uilint-shadow)",
  shadowLg: "var(--uilint-shadow)",
  blur: "blur(12px)",

  // Typography
  font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',

  // Sizing
  pillHeight: "40px",
  pillRadius: "20px",
  popoverRadius: "12px",
  buttonRadius: "8px",

  // Transitions
  transition: "all 0.15s ease-out",
  transitionFast: "all 0.1s ease-out",
} as const;

/**
 * Get status color based on issue count
 */
export function getStatusColor(issueCount: number): string {
  if (issueCount === 0) return STYLES.success;
  return STYLES.warning; // Amber for all issues
}

/**
 * Get status background color based on issue count
 */
export function getStatusBgColor(issueCount: number): string {
  if (issueCount === 0) return STYLES.successLight;
  return STYLES.warningLight; // Amber for all issues
}
