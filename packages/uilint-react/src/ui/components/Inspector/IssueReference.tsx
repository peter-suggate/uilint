/**
 * IssueReference - Compact reference to a repeated issue
 *
 * When the same issue message appears multiple times in a file,
 * we show the full annotation for the first occurrence and this
 * compact reference for subsequent occurrences.
 *
 * Shows: "↳ line X"
 * Auto-scrolls into view when selected (e.g., from heatmap click)
 */
import React, { useRef, useLayoutEffect } from "react";
import { motion } from "motion/react";
import { cn } from "../../../lib/utils";
import type { Issue } from "../../types";

// ============================================================================
// Types
// ============================================================================

export interface IssueReferenceProps {
  /** The issue being referenced */
  issue: Issue;
  /** Line number of the first occurrence */
  firstLine: number;
  /** Whether this reference is selected */
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

function getSeverityDotClass(severity: Issue["severity"]): string {
  switch (severity) {
    case "error":
      return "bg-error/60";
    case "warning":
      return "bg-warning/60";
    case "info":
      return "bg-info/60";
  }
}

// ============================================================================
// Component
// ============================================================================

export function IssueReference({
  issue,
  firstLine,
  isSelected,
  onSelect,
  gutterWidth = 40,
  className,
}: IssueReferenceProps) {
  const ref = useRef<HTMLButtonElement>(null);

  // Auto-scroll into view when selected (e.g., from heatmap click)
  useLayoutEffect(() => {
    if (isSelected && ref.current?.scrollIntoView) {
      ref.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isSelected]);

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      className={cn(
        "flex items-center gap-1.5 cursor-pointer",
        "mx-2 my-0.5",
        "py-1 px-2",
        "rounded",
        "text-[10px] text-muted-foreground/50",
        "hover:text-muted-foreground/70 hover:bg-foreground/[0.02]",
        isSelected && "text-muted-foreground/70 bg-foreground/[0.03]",
        "transition-colors duration-100",
        className
      )}
      style={{ marginLeft: gutterWidth + 8 }}
    >
      {/* Severity dot */}
      <div
        className={cn(
          "w-1 h-1 rounded-full flex-shrink-0",
          getSeverityDotClass(issue.severity)
        )}
      />

      {/* Reference text */}
      <span className="font-mono">
        ↳ line {firstLine}
      </span>
    </motion.button>
  );
}

export default IssueReference;
