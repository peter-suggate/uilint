/**
 * FileSection - Collapsible file section in the inspector
 *
 * Displays a file with:
 * - Expand/collapse chevron
 * - File name and directory
 * - Issue count with severity indicator
 * - Rule badges
 * - Expandable list of issues
 *
 * Glassmorphic styling with minimal color (severity dots only)
 */
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../../lib/utils";
import { ChevronIcon } from "../../icons";
import { RuleBadge } from "./RuleBadge";
import { IssueRow } from "./IssueRow";
import type { FileGroup } from "../../../core/store/file-groups-selector";

// ============================================================================
// Types
// ============================================================================

export interface FileSectionProps {
  /** File group data */
  file: FileGroup;
  /** Whether this file section is expanded */
  isExpanded: boolean;
  /** Called when the header is clicked to toggle expansion */
  onToggle: () => void;
  /** Called when a rule badge is clicked */
  onRuleClick: (ruleId: string) => void;
  /** Called when an issue is selected */
  onIssueSelect: (issueId: string) => void;
  /** Currently selected issue ID */
  selectedIssueId: string | null;
  /** Maximum number of issues to show before "show more" */
  maxVisibleIssues?: number;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get CSS class for severity dots in header
 */
function getSeverityDotsClass(severity: "error" | "warning" | "info"): string {
  switch (severity) {
    case "error":
      return "bg-error/70";
    case "warning":
      return "bg-warning/70";
    case "info":
      return "bg-info/70";
  }
}

// ============================================================================
// Sub-components
// ============================================================================

interface SeverityDotsProps {
  severityCounts: { error: number; warning: number; info: number };
}

function SeverityDots({ severityCounts }: SeverityDotsProps) {
  const hasAny =
    severityCounts.error > 0 ||
    severityCounts.warning > 0 ||
    severityCounts.info > 0;

  if (!hasAny) return null;

  return (
    <div className="flex items-center gap-1.5">
      {severityCounts.error > 0 && (
        <div className={cn("w-1.5 h-1.5 rounded-full", getSeverityDotsClass("error"))} />
      )}
      {severityCounts.warning > 0 && (
        <div className={cn("w-1.5 h-1.5 rounded-full", getSeverityDotsClass("warning"))} />
      )}
      {severityCounts.info > 0 && (
        <div className={cn("w-1.5 h-1.5 rounded-full", getSeverityDotsClass("info"))} />
      )}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function FileSection({
  file,
  isExpanded,
  onToggle,
  onRuleClick,
  onIssueSelect,
  selectedIssueId,
  maxVisibleIssues = 5,
  className,
}: FileSectionProps) {
  const [showAllIssues, setShowAllIssues] = React.useState(false);
  const hasMoreIssues = file.issues.length > maxVisibleIssues;
  const visibleIssues = showAllIssues ? file.issues : file.issues.slice(0, maxVisibleIssues);
  const hiddenCount = file.issues.length - maxVisibleIssues;

  // Reset showAllIssues when collapsed
  React.useEffect(() => {
    if (!isExpanded) {
      setShowAllIssues(false);
    }
  }, [isExpanded]);

  return (
    <div className={cn("border-b border-foreground/[0.04]", className)}>
      {/* Header - always visible */}
      <motion.button
        type="button"
        onClick={onToggle}
        whileHover={{ backgroundColor: "rgba(var(--foreground-rgb), 0.02)" }}
        className={cn(
          "w-full flex items-start gap-3 px-4 py-3",
          "cursor-pointer text-left",
          "transition-colors duration-100"
        )}
      >
        {/* Chevron */}
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.15 }}
          className="flex-shrink-0 pt-0.5 text-muted-foreground/50"
        >
          <ChevronIcon size={14} />
        </motion.div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground truncate">
              {file.fileName}
            </span>
            <SeverityDots severityCounts={file.severityCounts} />
          </div>
          <div className="text-xs text-muted-foreground/60 truncate mt-0.5">
            {file.directory}
          </div>
        </div>

        {/* Count */}
        <span className="text-lg font-extralight text-foreground/70 flex-shrink-0">
          {file.totalCount}
        </span>
      </motion.button>

      {/* Rule badges - always visible below header */}
      {file.ruleGroups.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3 -mt-1">
          {file.ruleGroups.map((rg) => (
            <RuleBadge
              key={rg.ruleId}
              ruleId={rg.ruleId}
              ruleName={rg.ruleName}
              count={rg.count}
              severity={rg.highestSeverity}
              onClick={() => onRuleClick(rg.ruleId)}
            />
          ))}
        </div>
      )}

      {/* Expanded issues list */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-l border-foreground/[0.06] ml-4 mb-3">
              {visibleIssues.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  isSelected={selectedIssueId === issue.id}
                  onSelect={() => onIssueSelect(issue.id)}
                  compact={file.ruleGroups.length === 1}
                />
              ))}

              {/* Show more button */}
              {hasMoreIssues && !showAllIssues && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllIssues(true);
                  }}
                  className={cn(
                    "w-full px-4 py-2 text-left",
                    "text-xs text-muted-foreground/60 hover:text-muted-foreground/80",
                    "hover:bg-foreground/[0.02]",
                    "transition-colors duration-100"
                  )}
                >
                  + {hiddenCount} more {hiddenCount === 1 ? "issue" : "issues"}
                </button>
              )}

              {/* Show less button */}
              {hasMoreIssues && showAllIssues && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllIssues(false);
                  }}
                  className={cn(
                    "w-full px-4 py-2 text-left",
                    "text-xs text-muted-foreground/60 hover:text-muted-foreground/80",
                    "hover:bg-foreground/[0.02]",
                    "transition-colors duration-100"
                  )}
                >
                  Show less
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FileSection;
