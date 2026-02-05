/**
 * TileHeader - Generalized header for hierarchical tiles
 *
 * Shows:
 * - Back button (arrow) to navigate up
 * - Label and issue summary ("X issues in Y files")
 * - Optional icon
 *
 * Reusable across different tile-based UIs.
 */
import React from "react";
import { motion } from "motion/react";
import { ChevronLeft } from "lucide-react";
import { cn } from "../../../lib/utils";
import {
  headerVariants,
  headerTransition,
  backButtonVariants,
  backButtonTransition,
} from "./animations/expansion-animations";

// ============================================================================
// Types
// ============================================================================

export interface TileHeaderProps {
  /** Main label text */
  label: string;
  /** Optional subtitle (e.g., file path) */
  subtitle?: string;
  /** Tile type for visual differentiation */
  tileType?: "rule" | "file";
  /** Issue count */
  count?: number;
  /** Number of files (for "X issues in Y files" display) */
  fileCount?: number;
  /** Callback when back button is clicked */
  onBack: () => void;
  /** Optional additional class names */
  className?: string;
  /** Depth level (for visual indication) */
  level?: number;
}

/**
 * Format the issue summary line (e.g., "72 issues in 4 files" or "12 issues")
 */
function formatIssueSummary(count: number, fileCount?: number): string {
  const issueWord = count === 1 ? "issue" : "issues";
  if (fileCount !== undefined && fileCount > 0) {
    const fileWord = fileCount === 1 ? "file" : "files";
    return `${count} ${issueWord} in ${fileCount} ${fileWord}`;
  }
  return `${count} ${issueWord}`;
}

// ============================================================================
// Component
// ============================================================================

export function TileHeader({
  label,
  subtitle,
  tileType,
  count,
  fileCount,
  onBack,
  className,
}: TileHeaderProps) {
  const summary = count !== undefined ? formatIssueSummary(count, fileCount) : undefined;

  return (
    <motion.div
      variants={headerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={headerTransition}
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2",
        "border-b border-foreground/[0.04]",
        className
      )}
    >
      {/* Left side: Back button + icon + label */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {/* Back button */}
        <motion.button
          onClick={onBack}
          variants={backButtonVariants}
          initial="rest"
          whileHover="hover"
          whileTap="tap"
          transition={backButtonTransition}
          className={cn(
            "flex items-center justify-center",
            "w-6 h-6 rounded-md",
            "text-muted-foreground/70 hover:text-foreground",
            "hover:bg-foreground/[0.05]",
            "transition-colors duration-100",
            "flex-shrink-0"
          )}
          aria-label="Go back"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </motion.button>

        {/* Label, subtitle, and issue summary - inline */}
        <div className="min-w-0 flex-1 flex flex-col">
          <div className="flex items-baseline gap-2">
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.1 }}
              className="text-sm font-medium text-foreground truncate"
            >
              {label}
            </motion.h3>
            {summary && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.1, delay: 0.05 }}
                className="text-[11px] text-muted-foreground/50 truncate hidden sm:inline"
              >
                {summary}
              </motion.span>
            )}
          </div>
          {subtitle && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.1 }}
              className={cn(
                "text-[10px] text-muted-foreground/50 truncate",
                tileType === "file" && "font-mono"
              )}
            >
              {subtitle}
            </motion.p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
