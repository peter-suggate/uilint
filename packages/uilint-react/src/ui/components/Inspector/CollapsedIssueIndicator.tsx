/* eslint-disable uilint/consistent-dark-mode -- uses semantic classes that handle dark mode via CSS variables */
/**
 * CollapsedIssueIndicator - Minimal collapsed view for issues
 *
 * When another issue is selected, non-selected issues collapse to this
 * minimal indicator showing:
 * - Small severity dot (error/warning/info color)
 * - Line number badge
 * - Tooltip with issue message on hover
 * - Click to select and expand that issue
 *
 * Helps users focus on the selected issue while maintaining
 * awareness of other issues in the file.
 */
import React, { useState, useRef, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../../lib/utils";
import type { Issue } from "../../types";

// ============================================================================
// Types
// ============================================================================

export interface CollapsedIssueIndicatorProps {
  /** The issue to display */
  issue: Issue;
  /** Called when clicked to select this issue */
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
 * Get severity dot color class
 */
function getSeverityDotClass(severity: Issue["severity"]): string {
  switch (severity) {
    case "error":
      return "bg-error/80";
    case "warning":
      return "bg-warning/80";
    case "info":
      return "bg-info/80";
  }
}

/**
 * Get severity background class for hover state
 */
function getSeverityHoverBgClass(severity: Issue["severity"]): string {
  switch (severity) {
    case "error":
      return "hover:bg-error/10";
    case "warning":
      return "hover:bg-warning/10";
    case "info":
      return "hover:bg-info/10";
  }
}

/**
 * Get severity border class for the badge
 */
function getSeverityBorderClass(severity: Issue["severity"]): string {
  switch (severity) {
    case "error":
      return "border-error/30";
    case "warning":
      return "border-warning/30";
    case "info":
      return "border-info/30";
  }
}

// ============================================================================
// Component
// ============================================================================

export function CollapsedIssueIndicator({
  issue,
  onSelect,
  gutterWidth = 40,
  className,
}: CollapsedIssueIndicatorProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-scroll into view when this indicator is focused (keyboard nav)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleFocus = () => {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };

    el.addEventListener("focus", handleFocus);
    return () => el.removeEventListener("focus", handleFocus);
  }, []);

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      layout
      layoutId={`issue-collapsed-${issue.id}`}
      initial={{ opacity: 0, scale: 0.8, x: -8 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.8, x: -8 }}
      transition={{
        duration: 0.2,
        ease: [0.32, 0.72, 0, 1],
        layout: { duration: 0.25 }
      }}
      className={cn(
        "relative flex items-center gap-1.5",
        "mx-2 my-0.5",
        "py-1 px-2",
        "rounded-full",
        "border",
        "bg-foreground/[0.02]",
        getSeverityBorderClass(issue.severity),
        getSeverityHoverBgClass(issue.severity),
        "cursor-pointer",
        "transition-colors duration-100",
        "focus:outline-none focus:ring-1 focus:ring-foreground/20",
        className
      )}
      style={{ marginLeft: gutterWidth + 8 }}
      aria-label={`Issue on line ${issue.line}: ${issue.message}`}
    >
      {/* Severity dot */}
      <div
        className={cn(
          "w-1.5 h-1.5 rounded-full flex-shrink-0",
          getSeverityDotClass(issue.severity)
        )}
      />

      {/* Line number badge */}
      <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums">
        L{issue.line}
      </span>

      {/* Tooltip on hover */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute left-0 top-full mt-1 z-50",
              "max-w-xs",
              "py-1.5 px-2.5",
              "rounded-lg",
              "bg-popover",
              "border border-foreground/10",
              "shadow-lg shadow-black/10",
              "pointer-events-none"
            )}
          >
            <p className="text-[11px] text-foreground/80 leading-relaxed line-clamp-3">
              {issue.message}
            </p>
            <p className="text-[9px] text-muted-foreground/50 mt-1 font-mono">
              {issue.ruleId}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export default CollapsedIssueIndicator;
