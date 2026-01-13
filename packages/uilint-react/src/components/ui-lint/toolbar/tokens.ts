/**
 * Design tokens for toolbar components
 *
 * Uses CSS custom properties for theming support.
 * Variables are defined in globals.css and support light/dark modes.
 */
export const TOKENS = {
  // Colors - using CSS variables for theme support
  bgBase: "var(--uilint-backdrop)",
  bgElevated: "var(--uilint-background-elevated)",
  bgHover: "var(--uilint-hover)",
  bgActive: "var(--uilint-active)",

  border: "var(--uilint-border)",
  borderFocus: "var(--uilint-border-focus)",

  textPrimary: "var(--uilint-text-primary)",
  textSecondary: "var(--uilint-text-secondary)",
  textMuted: "var(--uilint-text-muted)",
  textDisabled: "var(--uilint-text-disabled)",

  accent: "var(--uilint-accent)",
  success: "var(--uilint-success)",
  warning: "var(--uilint-warning)",
  error: "var(--uilint-error)",

  fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,
  fontMono: `"SF Mono", Monaco, "Cascadia Code", monospace`,

  pillHeight: "40px",
  pillRadius: "20px",
  buttonMinWidth: "40px",

  blur: "blur(16px)",
  shadowMd: "var(--uilint-shadow)",
  shadowGlow: (color: string) => `0 0 16px ${color}`,

  transitionFast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
  transitionBase: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
  transitionSlow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

/**
 * Status badge colors using CSS variables
 */
export const BADGE_COLORS = {
  success: "var(--uilint-success)",
  successBg: "var(--uilint-success-bg)",
  warning: "var(--uilint-warning)",
  warningBg: "var(--uilint-warning-bg)",
  error: "var(--uilint-error)",
  errorBg: "var(--uilint-error-bg)",
} as const;
