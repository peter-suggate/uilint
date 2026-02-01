/**
 * IssuesSummary - Summary bar showing issue statistics
 *
 * Displays:
 * - Total issue count
 * - Total file count
 * - Severity breakdown (dots with counts)
 *
 * Glassmorphic styling with minimal color (severity dots only)
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
  /** Number of unique rules with issues (optional) */
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

interface SeverityCountProps {
  type: "error" | "warning" | "info";
  count: number;
}

function SeverityCount({ type, count }: SeverityCountProps) {
  if (count === 0) return null;

  const dotClass = {
    error: "bg-error/70",
    warning: "bg-warning/70",
    info: "bg-info/70",
  }[type];

  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("w-1.5 h-1.5 rounded-full", dotClass)} />
      <span>{count}</span>
    </span>
  );
}

// ============================================================================
// Component
// ============================================================================

export function IssuesSummary({
  totalIssues,
  totalFiles,
  totalRules,
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
        "flex items-center justify-between",
        "px-4 py-2.5",
        "text-sm text-muted-foreground/70",
        "border-b border-foreground/[0.04]",
        className
      )}
    >
      {/* Left: Counts */}
      <div className="flex items-center gap-1">
        <span className="font-medium text-foreground/80">{totalIssues}</span>
        <span>{totalIssues === 1 ? "issue" : "issues"}</span>
        <span className="text-muted-foreground/40 mx-1">·</span>
        <span>{totalFiles}</span>
        <span>{totalFiles === 1 ? "file" : "files"}</span>
        {totalRules !== undefined && (
          <>
            <span className="text-muted-foreground/40 mx-1">·</span>
            <span>{totalRules}</span>
            <span>{totalRules === 1 ? "rule" : "rules"}</span>
          </>
        )}
      </div>

      {/* Right: Severity breakdown */}
      {hasAnySeverity && (
        <div className="flex items-center gap-3 text-xs">
          <SeverityCount type="error" count={severityCounts.error} />
          <SeverityCount type="warning" count={severityCounts.warning} />
          <SeverityCount type="info" count={severityCounts.info} />
        </div>
      )}
    </div>
  );
}

export default IssuesSummary;
