/**
 * IssueSummaryView - Lightweight intermediate view between file tile and source
 *
 * Compact list of issues with minimal chrome:
 * - Severity indicator + line number + message
 * - Click to select and view in source
 * - No redundant containers or summary bars
 */
import React, { useCallback } from "react";
import { motion } from "motion/react";
import { AlertCircle, AlertTriangle, Info, Code2, ChevronRight } from "lucide-react";
import { cn } from "../../../lib/utils";
import { TileHeader } from "../HierarchicalTiles/TileHeader";
import type { Issue } from "../../types";

// ============================================================================
// Types
// ============================================================================

export interface IssueSummaryViewProps {
  /** File path being displayed */
  filePath: string;
  /** File name for display */
  fileName: string;
  /** Directory path for subtitle */
  directory?: string;
  /** Issues in this file */
  issues: Issue[];
  /** Currently selected issue ID */
  selectedIssueId: string | null;
  /** Callback when an issue is clicked */
  onIssueClick: (issue: Issue) => void;
  /** Callback when "Show full source" is clicked */
  onShowFullSource: () => void;
  /** Callback when back button is clicked */
  onBack: () => void;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Severity icon component
 */
function SeverityIcon({ severity }: { severity: Issue["severity"] }) {
  switch (severity) {
    case "error":
      return <AlertCircle size={14} className="text-error flex-shrink-0" />;
    case "warning":
      return <AlertTriangle size={14} className="text-warning flex-shrink-0" />;
    case "info":
      return <Info size={14} className="text-info flex-shrink-0" />;
  }
}

/**
 * Individual issue row - compact single-line format
 */
function IssueRow({
  issue,
  isSelected,
  onClick,
  index,
}: {
  issue: Issue;
  isSelected: boolean;
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.1,
        delay: Math.min(index * 0.02, 0.2),
      }}
      onClick={onClick}
      className={cn(
        "w-full text-left",
        "flex items-center gap-2 px-3 py-2",
        "border-b border-foreground/[0.03]",
        "transition-colors duration-100",
        "hover:bg-foreground/[0.03]",
        "group",
        isSelected && "bg-foreground/[0.05]"
      )}
    >
      {/* Severity icon */}
      <SeverityIcon severity={issue.severity} />

      {/* Line number */}
      <span className="flex-shrink-0 text-[11px] font-mono text-muted-foreground/60 tabular-nums w-8">
        {issue.line}
      </span>

      {/* Message - single line */}
      <span className="flex-1 min-w-0 text-xs text-foreground/70 truncate">
        {issue.message}
      </span>

      {/* Chevron indicator */}
      <ChevronRight size={12} className="flex-shrink-0 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function IssueSummaryView({
  filePath,
  fileName,
  directory,
  issues,
  selectedIssueId,
  onIssueClick,
  onShowFullSource,
  onBack,
  className,
}: IssueSummaryViewProps) {
  // Sort issues by line number
  const sortedIssues = React.useMemo(
    () => [...issues].sort((a, b) => a.line - b.line),
    [issues]
  );

  const handleIssueClick = useCallback(
    (issue: Issue) => {
      onIssueClick(issue);
    },
    [onIssueClick]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      className={cn(
        "flex flex-col",
        className
      )}
    >
      {/* Compact header with back button */}
      <TileHeader
        label={fileName}
        subtitle={directory}
        count={issues.length}
        onBack={onBack}
      />

      {/* Issue list - no scroll container, parent handles it */}
      <div className="flex-1">
        {sortedIssues.map((issue, index) => (
          <IssueRow
            key={issue.id}
            issue={issue}
            isSelected={selectedIssueId === issue.id}
            onClick={() => handleIssueClick(issue)}
            index={index}
          />
        ))}
      </div>

      {/* Show full source link - minimal styling */}
      <button
        onClick={onShowFullSource}
        className={cn(
          "flex items-center justify-center gap-1.5",
          "px-3 py-2 mt-1",
          "text-xs text-muted-foreground/60 hover:text-foreground/80",
          "hover:bg-foreground/[0.03]",
          "transition-colors duration-100",
          "border-t border-foreground/[0.03]"
        )}
      >
        <Code2 size={12} />
        <span>View source</span>
      </button>
    </motion.div>
  );
}

export default IssueSummaryView;
