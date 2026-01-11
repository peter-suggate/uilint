import { BADGE_COLORS } from "../Badge";

/**
 * Design tokens for toolbar components
 */
export const TOKENS = {
  // Colors
  bgBase: "rgba(15, 15, 15, 0.92)",
  bgElevated: "rgba(25, 25, 25, 0.95)",
  bgHover: "rgba(255, 255, 255, 0.08)",
  bgActive: "rgba(255, 255, 255, 0.12)",

  border: "rgba(255, 255, 255, 0.1)",
  borderFocus: "rgba(99, 179, 237, 0.6)",

  textPrimary: "rgba(255, 255, 255, 0.95)",
  textSecondary: "rgba(255, 255, 255, 0.7)",
  textMuted: "rgba(255, 255, 255, 0.4)",
  textDisabled: "rgba(255, 255, 255, 0.25)",

  accent: "#63b3ed",
  success: BADGE_COLORS.success,
  warning: BADGE_COLORS.warning,
  error: "#f56565",

  fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,
  fontMono: `"SF Mono", Monaco, "Cascadia Code", monospace`,

  pillHeight: "40px",
  pillRadius: "20px",
  buttonMinWidth: "40px",

  blur: "blur(16px)",
  shadowMd: "0 4px 20px rgba(0, 0, 0, 0.4)",
  shadowGlow: (color: string) => `0 0 16px ${color}`,

  transitionFast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
  transitionBase: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
  transitionSlow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
} as const;
