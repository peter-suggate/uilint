/**
 * IssuesSummary - Clean summary card showing issue statistics
 *
 * Tile-inspired design with:
 * - Large, prominent issue count
 * - Minimal supporting text
 * - Simple severity indicators
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
  /** Severity counts */
  severityCounts: {
    error: number;
    warning: number;
    info: number;
  };
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

interface SeverityDotProps {
  type: "error" | "warning" | "info";
  count: number;
}

function SeverityDot({ type, count }: SeverityDotProps) {
  if (count === 0) return null;

  const dotClass = {
    error: "bg-error/70",
    warning: "bg-warning/70",
    info: "bg-info/70",
  }[type];

  return <div className={cn("w-2 h-2 rounded-full", dotClass)} />;
}

// ============================================================================
// Component
// ============================================================================

export function IssuesSummary({
  totalIssues,
  totalFiles,
  severityCounts,
  className,
}: IssuesSummaryProps) {
  const hasAnySeverity =
    severityCounts.error > 0 ||
    severityCounts.warning > 0 ||
    severityCounts.info > 0;

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

      {/* Right: Severity dots only - clean and minimal */}
      {hasAnySeverity && (
        <div className="flex items-center gap-1.5 pb-1">
          <SeverityDot type="error" count={severityCounts.error} />
          <SeverityDot type="warning" count={severityCounts.warning} />
          <SeverityDot type="info" count={severityCounts.info} />
        </div>
      )}
    </div>
  );
}

export default IssuesSummary;
