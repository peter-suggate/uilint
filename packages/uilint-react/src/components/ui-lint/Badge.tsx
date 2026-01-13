/**
 * Badge component - Consistent badge styling across UILint components
 * Matches the toolbar badge style (.uilint-badge class)
 *
 * Uses CSS variables for theme support (light/dark modes).
 */

import React from "react";

// Font family matching TOKENS.fontMono from toolbar
const FONT_MONO = `"SF Mono", Monaco, "Cascadia Code", monospace`;

// ============================================================================
// Shared Design Tokens - Using CSS Variables
// ============================================================================
export const BADGE_COLORS = {
  success: "var(--uilint-success)",
  successBg: "var(--uilint-success-bg)",
  warning: "var(--uilint-warning)",
  warningBg: "var(--uilint-warning-bg)",
  error: "var(--uilint-error)",
  errorBg: "var(--uilint-error-bg)",
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get badge text color based on issue count
 */
function getBadgeTextColor(issueCount: number): string {
  if (issueCount === 0) return BADGE_COLORS.success;
  return BADGE_COLORS.warning;
}

/**
 * Get badge background color based on issue count
 */
function getBadgeBackgroundColor(issueCount: number): string {
  if (issueCount === 0) return BADGE_COLORS.successBg;
  return BADGE_COLORS.warningBg;
}

// ============================================================================
// Badge Component
// ============================================================================

interface BadgeProps {
  count: number;
  /** Size variant - 'default' (20px matching .uilint-badge), 'medium' (22x18px for file rows), or 'small' (18px) */
  size?: "default" | "medium" | "small";
  /** Custom background color (defaults to status color with opacity based on count) */
  backgroundColor?: string;
  /** Custom text color (defaults to status color based on count) */
  color?: string;
}

const BADGE_STYLES = {
  default: {
    minWidth: "20px",
    height: "20px",
    padding: "0 6px",
    borderRadius: "10px",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "-0.02em",
  },
  small: {
    minWidth: "18px",
    height: "18px",
    padding: "0 5px",
    borderRadius: "9px",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0",
  },
  // For file row badges (slightly larger than small)
  medium: {
    minWidth: "22px",
    height: "18px",
    padding: "0 6px",
    borderRadius: "9px",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0",
  },
} as const;

export function Badge({
  count,
  size = "default",
  backgroundColor,
  color,
}: BadgeProps) {
  const sizeStyles = BADGE_STYLES[size];
  // Default to themed styling if not explicitly provided
  const bgColor = backgroundColor ?? getBadgeBackgroundColor(count);
  const textColor = color ?? getBadgeTextColor(count);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        ...sizeStyles,
        backgroundColor: bgColor,
        color: textColor,
        fontFamily: FONT_MONO,
      }}
    >
      {count}
    </span>
  );
}
