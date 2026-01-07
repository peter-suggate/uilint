/**
 * Design tokens for UILint toolbar components
 * Refined for the segmented pill toolbar design
 */
export const STYLES = {
  // Backgrounds
  bg: "rgba(17, 24, 39, 0.92)",
  bgHover: "rgba(31, 41, 55, 0.95)",
  bgSegment: "rgba(31, 41, 55, 0.6)",
  bgSegmentHover: "rgba(55, 65, 81, 0.8)",
  bgPopover: "rgba(17, 24, 39, 0.96)",

  // Borders
  border: "rgba(75, 85, 99, 0.5)",
  borderLight: "rgba(107, 114, 128, 0.3)",
  divider: "rgba(75, 85, 99, 0.4)",

  // Text
  text: "#F9FAFB",
  textMuted: "#9CA3AF",
  textDim: "#6B7280",

  // Accent colors
  accent: "#3B82F6",
  accentHover: "#2563EB",
  accentLight: "rgba(59, 130, 246, 0.15)",

  // Status colors
  success: "#10B981",
  successLight: "rgba(16, 185, 129, 0.15)",
  warning: "#F59E0B",
  warningLight: "rgba(245, 158, 11, 0.15)",
  error: "#EF4444",
  errorLight: "rgba(239, 68, 68, 0.15)",

  // Badge colors
  badgeBg: "#3B82F6",
  badgeText: "#FFFFFF",

  // Effects
  shadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
  shadowLg: "0 12px 48px rgba(0, 0, 0, 0.5)",
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
  if (issueCount <= 2) return STYLES.warning;
  return STYLES.error;
}

/**
 * Get status background color based on issue count
 */
export function getStatusBgColor(issueCount: number): string {
  if (issueCount === 0) return STYLES.successLight;
  if (issueCount <= 2) return STYLES.warningLight;
  return STYLES.errorLight;
}
