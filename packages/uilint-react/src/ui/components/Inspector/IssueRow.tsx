/**
 * IssueRow - Single issue row component for the inspector list
 *
 * Displays a single issue with:
 * - Line number
 * - Severity indicator (dot)
 * - Message (truncated)
 * - Rule ID (optional, when not in rule context)
 *
 * Glassmorphic styling with minimal color (severity dots only)
 */
import React from "react";
import { motion } from "motion/react";
import { cn } from "../../../lib/utils";
import type { Issue } from "../../types";

// ============================================================================
// Types
// ============================================================================

export interface IssueRowProps {
  /** The issue to display */
  issue: Issue;
  /** Whether this issue is currently selected */
  isSelected: boolean;
  /** Called when the issue is clicked */
  onSelect: () => void;
  /** Hide rule badge (when parent already shows rule context) */
  compact?: boolean;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get CSS class for severity dot
 */
function getSeverityDotClass(severity: Issue["severity"]): string {
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
 * Truncate rule ID for display
 */
function truncateRuleId(ruleId: string, maxLength: number = 20): string {
  // Extract short name from namespaced rules
  const shortName = ruleId.includes("/") ? ruleId.split("/").pop()! : ruleId;
  if (shortName.length <= maxLength) return shortName;
  return shortName.slice(0, maxLength - 1) + "…";
}

// ============================================================================
// Component
// ============================================================================

export function IssueRow({
  issue,
  isSelected,
  onSelect,
  compact = false,
  className,
}: IssueRowProps) {
  return (
    <motion.div
      onClick={onSelect}
      whileHover={{ backgroundColor: "rgba(var(--foreground-rgb), 0.02)" }}
      whileTap={{ scale: 0.995 }}
      className={cn(
        "flex items-start gap-3 px-4 py-2.5 cursor-pointer",
        "border-b border-foreground/[0.04]",
        "transition-colors duration-100",
        isSelected && "bg-foreground/[0.04] border-l-2 border-l-foreground/20",
        className
      )}
    >
      {/* Line number */}
      <span className="text-muted-foreground/50 font-mono text-xs w-8 flex-shrink-0 text-right pt-0.5">
        :{issue.line}
      </span>

      {/* Severity dot */}
      <div className="pt-1.5 flex-shrink-0">
        <div className={cn("w-1.5 h-1.5 rounded-full", getSeverityDotClass(issue.severity))} />
      </div>

      {/* Message */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground/80 leading-snug line-clamp-2">
          {issue.message}
        </p>
      </div>

      {/* Rule ID (when not compact) */}
      {!compact && (
        <span className="text-xs text-muted-foreground/50 flex-shrink-0 pt-0.5">
          {truncateRuleId(issue.ruleId)}
        </span>
      )}
    </motion.div>
  );
}

export default IssueRow;
