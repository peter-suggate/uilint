/**
 * IssueAnnotation - Inline issue decoration below a code line
 *
 * Shows the issue message with severity indicator, displayed
 * directly below the code line that has the issue.
 */
import React from "react";
import { motion } from "motion/react";
import { cn } from "../../../lib/utils";
import type { Issue } from "../../types";

// ============================================================================
// Types
// ============================================================================

export interface IssueAnnotationProps {
  /** The issue to display */
  issue: Issue;
  /** Whether this issue is selected */
  isSelected: boolean;
  /** Called when clicked */
  onSelect: () => void;
  /** Width of the line number gutter */
  gutterWidth?: number;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get CSS classes for severity styling
 */
function getSeverityClasses(severity: Issue["severity"]): {
  border: string;
  bg: string;
  dot: string;
} {
  switch (severity) {
    case "error":
      return {
        border: "border-l-error/70",
        bg: "bg-error/[0.06]",
        dot: "bg-error/70",
      };
    case "warning":
      return {
        border: "border-l-warning/70",
        bg: "bg-warning/[0.06]",
        dot: "bg-warning/70",
      };
    case "info":
      return {
        border: "border-l-info/70",
        bg: "bg-info/[0.06]",
        dot: "bg-info/70",
      };
  }
}

/**
 * Truncate rule ID for display
 */
function formatRuleId(ruleId: string): string {
  // Extract short name from namespaced rules like @typescript-eslint/no-unused-vars
  return ruleId.includes("/") ? ruleId.split("/").pop()! : ruleId;
}

// ============================================================================
// Component
// ============================================================================

export function IssueAnnotation({
  issue,
  isSelected,
  onSelect,
  gutterWidth = 40,
  className,
}: IssueAnnotationProps) {
  const severityClasses = getSeverityClasses(issue.severity);

  return (
    <motion.div
      onClick={onSelect}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      whileHover={{ backgroundColor: "rgba(var(--foreground-rgb), 0.02)" }}
      className={cn(
        "flex items-start cursor-pointer",
        "border-l-2",
        severityClasses.border,
        severityClasses.bg,
        isSelected && "ring-1 ring-inset ring-foreground/10",
        "transition-colors duration-100",
        className
      )}
    >
      {/* Gutter area - empty but maintains alignment */}
      <span
        className="flex-shrink-0 flex items-center justify-end pr-2 py-1"
        style={{ width: gutterWidth }}
      >
        {/* Severity dot */}
        <span
          className={cn("w-1.5 h-1.5 rounded-full", severityClasses.dot)}
        />
      </span>

      {/* Message content */}
      <div className="flex-1 min-w-0 py-1 pr-3">
        <p
          className={cn(
            "text-xs leading-relaxed",
            "text-foreground/80",
            isSelected ? "line-clamp-none" : "line-clamp-2"
          )}
        >
          {issue.message}
        </p>

        {/* Rule ID - shown when selected or on hover */}
        <span
          className={cn(
            "inline-block mt-0.5 text-[10px] text-muted-foreground/50",
            "font-mono",
            !isSelected && "opacity-0 group-hover:opacity-100",
            "transition-opacity duration-100"
          )}
        >
          {formatRuleId(issue.ruleId)}
        </span>
      </div>
    </motion.div>
  );
}

export default IssueAnnotation;
