/**
 * FileSection - Collapsible file section in the inspector
 *
 * Displays a file with:
 * - Expand/collapse chevron
 * - File name and directory
 * - Issue count with severity indicator
 * - Rule badges
 * - Expandable source code view with inline issue annotations
 *
 * Glassmorphic styling with minimal color (severity dots only)
 */
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../../lib/utils";
import { ChevronIcon } from "../../icons";
import { RuleBadge } from "./RuleBadge";
import { FileSourceView } from "./FileSourceView";
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
  /** Number of context lines around each issue in source view */
  contextLines?: number;
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
  contextLines = 2,
  className,
}: FileSectionProps) {
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

      {/* Expanded source code view */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <FileSourceView
              filePath={file.filePath}
              issues={file.issues}
              contextLines={contextLines}
              selectedIssueId={selectedIssueId}
              onIssueSelect={onIssueSelect}
              enabled={isExpanded}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FileSection;
