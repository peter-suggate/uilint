/**
 * RuleBadge - Clickable rule tag for the inspector
 *
 * Displays a rule with:
 * - Severity indicator (dot)
 * - Rule name
 * - Issue count
 *
 * Clicking adds a rule filter to the command palette
 *
 * Glassmorphic styling with minimal color (severity dots only)
 */
import React from "react";
import { motion } from "motion/react";
import { cn } from "../../../lib/utils";
import type { IssueSeverity } from "../../types";

// ============================================================================
// Types
// ============================================================================

export interface RuleBadgeProps {
  /** Rule ID (e.g., "no-unused-vars" or "@typescript-eslint/no-unused-vars") */
  ruleId: string;
  /** Human-readable rule name (optional, defaults to short form of ruleId) */
  ruleName?: string;
  /** Number of issues for this rule */
  count: number;
  /** Highest severity among issues for this rule */
  severity: IssueSeverity;
  /** Called when the badge is clicked */
  onClick: () => void;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get CSS class for severity dot
 */
function getSeverityDotClass(severity: IssueSeverity): string {
  switch (severity) {
    case "error":
      return "bg-error/70";
    case "warning":
      return "bg-warning/70";
    case "info":
      return "bg-info/70";
  }
}

/**
 * Get short rule name from potentially namespaced rule ID
 */
function getShortRuleName(ruleId: string): string {
  if (ruleId.includes("/")) {
    return ruleId.split("/").pop()!;
  }
  return ruleId;
}

// ============================================================================
// Component
// ============================================================================

export function RuleBadge({
  ruleId,
  ruleName,
  count,
  severity,
  onClick,
  className,
}: RuleBadgeProps) {
  const displayName = ruleName || getShortRuleName(ruleId);

  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "inline-flex items-center gap-1.5",
        "px-2.5 py-1 rounded-full",
        "bg-foreground/[0.04] hover:bg-foreground/[0.08]",
        "border border-foreground/[0.06]",
        "text-xs font-normal text-foreground/70",
        "transition-colors duration-100",
        "cursor-pointer",
        className
      )}
    >
      {/* Severity dot */}
      <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", getSeverityDotClass(severity))} />

      {/* Rule name */}
      <span className="truncate max-w-[120px]">{displayName}</span>

      {/* Count */}
      <span className="text-muted-foreground/60">×{count}</span>
    </motion.button>
  );
}

export default RuleBadge;
