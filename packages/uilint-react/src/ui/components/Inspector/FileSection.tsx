/**
 * FileSection - Clean card-based file section in the inspector
 *
 * Tile-inspired design with:
 * - Clean rounded card appearance
 * - File name and directory
 * - Large, light-weight issue count
 * - Minimal severity indicators
 * - Expandable source code view
 *
 * Focus on simplicity and clean lines
 */
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../../lib/utils";
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

/**
 * Minimal severity indicators - just dots, no counts
 * Clean and unobtrusive
 */
function SeverityDots({ severityCounts }: SeverityDotsProps) {
  const dots: Array<{ type: "error" | "warning" | "info"; count: number }> = [];

  if (severityCounts.error > 0) dots.push({ type: "error", count: severityCounts.error });
  if (severityCounts.warning > 0) dots.push({ type: "warning", count: severityCounts.warning });
  if (severityCounts.info > 0) dots.push({ type: "info", count: severityCounts.info });

  if (dots.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {dots.map(({ type, count }) => (
        <div key={type} className="flex items-center gap-1">
          <div className={cn("w-1.5 h-1.5 rounded-full", getSeverityDotsClass(type))} />
          <span className="text-[11px] text-muted-foreground/50 tabular-nums">
            {count}
          </span>
        </div>
      ))}
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
  onRuleClick: _onRuleClick,
  onIssueSelect,
  selectedIssueId,
  contextLines = 2,
  className,
}: FileSectionProps) {
  return (
    <motion.div
      className={cn(
        // Card styling - Tile-inspired
        "rounded-2xl",
        "border border-foreground/[0.06]",
        "bg-foreground/[0.02]",
        "overflow-hidden",
        "transition-colors duration-150",
        isExpanded && "bg-foreground/[0.03]",
        className
      )}
      whileHover={{ backgroundColor: "rgba(var(--foreground-rgb), 0.04)" }}
    >
      {/* Header - clickable card header */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-start justify-between gap-4 p-4",
          "cursor-pointer text-left",
          "transition-colors duration-100"
        )}
      >
        {/* Left side: File info */}
        <div className="flex-1 min-w-0">
          {/* File name - prominent */}
          <div className="font-light text-[17px] text-foreground truncate leading-tight">
            {file.fileName}
          </div>
          {/* Directory and severity - secondary line */}
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-muted-foreground/50 truncate">
              {file.directory}
            </span>
          </div>
        </div>

        {/* Right side: Count and severity */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {/* Large count number */}
          <span className="text-2xl font-extralight text-foreground/70 leading-none tabular-nums">
            {file.totalCount}
          </span>
          {/* Severity breakdown */}
          <SeverityDots severityCounts={file.severityCounts} />
        </div>
      </button>

      {/* Expanded source code view */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            {/* Subtle divider */}
            <div className="mx-4 border-t border-foreground/[0.06]" />

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
    </motion.div>
  );
}

export default FileSection;
