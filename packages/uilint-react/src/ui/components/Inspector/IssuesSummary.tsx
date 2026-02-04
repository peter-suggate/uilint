/**
 * IssuesSummary - Clean summary card showing issue statistics
 *
 * Tile-inspired design with:
 * - Large, prominent issue count
 * - Minimal supporting text
 *
 * Focus on simplicity and clean lines
 */
import React from "react";
import { cn } from "../../../lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface IssuesSummaryProps {
  /** Total number of issues */
  totalIssues: number;
  /** Number of files with issues */
  totalFiles: number;
  /** Number of unique rules with issues (optional, not displayed) */
  totalRules?: number;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function IssuesSummary({
  totalIssues,
  totalFiles,
  className,
}: IssuesSummaryProps) {
  return (
    <div
      className={cn(
        "flex items-end justify-between",
        "px-4 py-4",
        className
      )}
    >
      {/* Left: Large count with subtitle */}
      <div>
        <span className="text-4xl font-extralight text-foreground/80 leading-none tabular-nums">
          {totalIssues}
        </span>
        <div className="text-sm text-muted-foreground/50 mt-1">
          {totalIssues === 1 ? "issue" : "issues"} in {totalFiles}{" "}
          {totalFiles === 1 ? "file" : "files"}
        </div>
      </div>
    </div>
  );
}

export default IssuesSummary;
