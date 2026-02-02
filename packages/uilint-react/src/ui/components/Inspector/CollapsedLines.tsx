/**
 * CollapsedLines - Expandable section representing hidden lines
 *
 * Displays a clickable row that shows "Show N hidden lines"
 * Similar to GitHub's diff view collapsed sections.
 */
import React from "react";
import { motion } from "motion/react";
import { cn } from "../../../lib/utils";
import { ChevronDownIcon } from "../../icons";

// ============================================================================
// Types
// ============================================================================

export interface CollapsedLinesProps {
  /** Start line number of the collapsed section (1-indexed) */
  startLine: number;
  /** End line number of the collapsed section (1-indexed) */
  endLine: number;
  /** Number of hidden lines */
  lineCount: number;
  /** Called when the user clicks to expand */
  onExpand: () => void;
  /** Width of the line number gutter */
  gutterWidth?: number;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function CollapsedLines({
  startLine,
  endLine,
  lineCount,
  onExpand,
  gutterWidth = 40,
  className,
}: CollapsedLinesProps) {
  return (
    <motion.button
      type="button"
      onClick={onExpand}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      whileHover={{ backgroundColor: "rgba(var(--foreground-rgb), 0.04)" }}
      className={cn(
        "w-full flex items-center",
        "text-xs text-muted-foreground/60 hover:text-muted-foreground/80",
        "bg-foreground/[0.01]",
        "border-y border-dashed border-foreground/[0.06]",
        "cursor-pointer",
        "transition-colors duration-100",
        "group",
        className
      )}
    >
      {/* Gutter spacer */}
      <span
        className="flex-shrink-0 py-1.5 bg-foreground/[0.02] border-r border-foreground/[0.06]"
        style={{ width: gutterWidth }}
      />

      {/* Content */}
      <span className="flex items-center gap-2 px-3 py-1.5">
        <ChevronDownIcon
          size={12}
          className="text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors"
        />
        <span>
          Show {lineCount} hidden {lineCount === 1 ? "line" : "lines"}
        </span>
        <span className="text-muted-foreground/40">
          ({startLine}–{endLine})
        </span>
      </span>
    </motion.button>
  );
}

export default CollapsedLines;
