/**
 * IssueSummaryView - Intermediate view between file tile and full source view
 *
 * Shows a compact list of issues for a file with:
 * - Severity indicator
 * - Line number
 * - Issue message
 * - Click to select an issue
 * - "Show full source" button at the bottom
 */
import React, { useCallback } from "react";
import { motion } from "motion/react";
import { AlertCircle, AlertTriangle, Info, Code2, ChevronRight } from "lucide-react";
import { cn } from "../../../lib/utils";
import { TileHeader } from "../HierarchicalTiles/TileHeader";
import type { Issue } from "../../types";
import { crispEase, DURATIONS } from "../HierarchicalTiles/animations/expansion-animations";

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
 * Individual issue row component
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: DURATIONS.standard,
        ease: crispEase,
        delay: Math.min(index * 0.03, 0.3),
      }}
      onClick={onClick}
      className={cn(
        "w-full text-left",
        "flex items-start gap-3 px-4 py-3",
        "border-b border-foreground/[0.04]",
        "transition-colors duration-150",
        "hover:bg-foreground/[0.03]",
        "group",
        isSelected && "bg-foreground/[0.05]"
      )}
    >
      {/* Severity icon */}
      <div className="mt-0.5">
        <SeverityIcon severity={issue.severity} />
      </div>

      {/* Line number */}
      <div className="flex-shrink-0 w-12">
        <span className="text-xs font-mono text-muted-foreground/70 tabular-nums">
          L{issue.line}
        </span>
      </div>

      {/* Message */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm text-foreground/80 leading-snug",
            "line-clamp-2"
          )}
        >
          {issue.message}
        </p>
      </div>

      {/* Chevron indicator */}
      <div className="flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight size={14} className="text-muted-foreground/50" />
      </div>
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

  // Count severities for summary
  const severityCounts = React.useMemo(() => {
    const counts = { error: 0, warning: 0, info: 0 };
    for (const issue of issues) {
      counts[issue.severity]++;
    }
    return counts;
  }, [issues]);

  const handleIssueClick = useCallback(
    (issue: Issue) => {
      onIssueClick(issue);
    },
    [onIssueClick]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: DURATIONS.standard, ease: crispEase }}
      className={cn(
        "flex flex-col h-full",
        "rounded-2xl",
        "border border-foreground/[0.08]",
        "bg-background/60 backdrop-blur-md",
        "overflow-hidden",
        "shadow-lg",
        className
      )}
    >
      {/* Header with back button */}
      <TileHeader
        label={fileName}
        subtitle={directory}
        count={issues.length}
        onBack={onBack}
      />

      {/* Severity summary bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-foreground/[0.04] bg-foreground/[0.02]">
        {severityCounts.error > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertCircle size={12} className="text-error" />
            <span className="text-xs text-muted-foreground">{severityCounts.error}</span>
          </div>
        )}
        {severityCounts.warning > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-warning" />
            <span className="text-xs text-muted-foreground">{severityCounts.warning}</span>
          </div>
        )}
        {severityCounts.info > 0 && (
          <div className="flex items-center gap-1.5">
            <Info size={12} className="text-info" />
            <span className="text-xs text-muted-foreground">{severityCounts.info}</span>
          </div>
        )}
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground/60">
          {issues.length} issue{issues.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Scrollable issue list */}
      <div className="flex-1 overflow-y-auto">
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

      {/* Show full source button - always visible at bottom */}
      <div className="flex-shrink-0 p-3 border-t border-foreground/[0.06]">
        <motion.button
          onClick={onShowFullSource}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className={cn(
            "w-full flex items-center justify-center gap-2",
            "px-4 py-2.5 rounded-xl",
            "bg-foreground/[0.04] hover:bg-foreground/[0.07]",
            "border border-foreground/[0.06]",
            "text-sm font-medium text-foreground/70 hover:text-foreground/90",
            "transition-colors duration-150"
          )}
        >
          <Code2 size={16} />
          <span>Show full source</span>
        </motion.button>
      </div>
    </motion.div>
  );
}

export default IssueSummaryView;
