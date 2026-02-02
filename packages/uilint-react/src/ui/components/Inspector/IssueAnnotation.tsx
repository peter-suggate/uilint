/**
 * IssueAnnotation - Clean inline issue indicator below a code line
 *
 * Simplified design with:
 * - Subtle severity indicator
 * - Issue message only (no rule badge - context from parent)
 * - Reduced visual intensity
 *
 * Focus on clarity without visual noise
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
 * Get CSS classes for severity styling - reduced intensity
 */
function getSeverityClasses(severity: Issue["severity"]): {
  border: string;
  bg: string;
  dot: string;
} {
  switch (severity) {
    case "error":
      return {
        border: "border-error/20",
        bg: "bg-error/[0.06]",
        dot: "bg-error/70",
      };
    case "warning":
      return {
        border: "border-warning/20",
        bg: "bg-warning/[0.06]",
        dot: "bg-warning/70",
      };
    case "info":
      return {
        border: "border-info/20",
        bg: "bg-info/[0.06]",
        dot: "bg-info/70",
      };
  }
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
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "flex items-start gap-2 cursor-pointer",
        "mx-2 my-1",
        "py-2 px-3",
        "rounded-lg",
        "border",
        severityClasses.border,
        severityClasses.bg,
        isSelected && "ring-1 ring-foreground/20",
        "hover:brightness-[0.97]",
        "transition-all duration-100",
        className
      )}
      style={{ marginLeft: gutterWidth + 8 }}
    >
      {/* Severity dot - minimal indicator */}
      <div
        className={cn(
          "flex-shrink-0 mt-1",
          "w-1.5 h-1.5 rounded-full",
          severityClasses.dot
        )}
      />

      {/* Message content - clean and simple */}
      <p
        className={cn(
          "flex-1 min-w-0",
          "text-[11px] leading-relaxed",
          "text-foreground/80",
          "font-sans",
          isSelected ? "line-clamp-none" : "line-clamp-2"
        )}
      >
        {issue.message}
      </p>
    </motion.div>
  );
}

export default IssueAnnotation;
