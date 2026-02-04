/**
 * CodeRegion - Renders a contiguous block of source code lines
 *
 * Displays line numbers in a gutter and code content, with
 * issue annotations inline below lines that have issues.
 */
import React from "react";
import { AnimatePresence } from "motion/react";
import { cn } from "../../../lib/utils";
import { IssueAnnotation } from "./IssueAnnotation";
import { IssueReference } from "./IssueReference";
import { CollapsedIssueIndicator } from "./CollapsedIssueIndicator";
import { getIssuesForLine, getLineSeverity } from "./source-regions";
import type { Issue } from "../../types";
import type { FirstOccurrenceMap } from "./FileSourceView";

// ============================================================================
// Types
// ============================================================================

export interface CodeRegionProps {
  /** Source code lines to display */
  lines: string[];
  /** Starting line number (1-indexed) */
  startLine: number;
  /** All issues in this region */
  issues: Issue[];
  /** Currently selected issue ID */
  selectedIssueId: string | null;
  /** Called when an issue is selected */
  onIssueSelect: (issueId: string) => void;
  /** Width of the line number gutter */
  gutterWidth?: number;
  /** Map of message -> first line number for deduplication */
  firstOccurrenceMap?: FirstOccurrenceMap;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get background class for a line based on its issues
 * Reduced intensity for cleaner appearance
 */
function getLineBackgroundClass(
  severity: Issue["severity"] | null,
  hasIssues: boolean
): string {
  if (!hasIssues) return "";

  switch (severity) {
    case "error":
      return "bg-error/[0.04]";
    case "warning":
      return "bg-warning/[0.04]";
    case "info":
      return "bg-info/[0.04]";
    default:
      return "";
  }
}

/**
 * Get border class for a line with issues
 * Subtle indicator without overwhelming the code
 */
function getLineBorderClass(
  severity: Issue["severity"] | null,
  hasIssues: boolean
): string {
  if (!hasIssues) return "border-l border-l-transparent";

  switch (severity) {
    case "error":
      return "border-l border-l-error/50";
    case "warning":
      return "border-l border-l-warning/50";
    case "info":
      return "border-l border-l-info/50";
    default:
      return "border-l border-l-transparent";
  }
}

// ============================================================================
// Component
// ============================================================================

export function CodeRegion({
  lines,
  startLine,
  issues,
  selectedIssueId,
  onIssueSelect,
  gutterWidth = 40,
  firstOccurrenceMap,
  className,
}: CodeRegionProps) {
  return (
    <div
      className={cn(
        "font-mono text-xs leading-relaxed",
        "overflow-x-auto",
        className
      )}
    >
      {lines.map((lineContent, index) => {
        const lineNumber = startLine + index;
        const lineIssues = getIssuesForLine(issues, lineNumber);
        const hasIssues = lineIssues.length > 0;
        const severity = getLineSeverity(lineIssues);

        return (
          <div key={lineNumber} className="group">
            {/* Code line */}
            <div
              className={cn(
                "flex",
                getLineBackgroundClass(severity, hasIssues),
                getLineBorderClass(severity, hasIssues)
              )}
            >
              {/* Line number gutter */}
              <span
                className={cn(
                  "flex-shrink-0 select-none text-right pr-3 py-0.5",
                  "text-muted-foreground/40",
                  "bg-foreground/[0.02]",
                  "border-r border-foreground/[0.06]",
                  hasIssues && "text-muted-foreground/60"
                )}
                style={{ width: gutterWidth }}
              >
                {lineNumber}
              </span>

              {/* Code content */}
              <code
                className={cn(
                  "flex-1 pl-3 pr-4 py-0.5",
                  "text-foreground/80",
                  "whitespace-pre",
                  hasIssues && "text-foreground/90"
                )}
              >
                {lineContent || " "}
              </code>
            </div>

            {/* Issue annotations below the line */}
            <AnimatePresence mode="sync">
              {lineIssues.map((issue) => {
                const isSelected = selectedIssueId === issue.id;
                const hasSelection = selectedIssueId !== null;

                // When another issue is selected, collapse non-selected issues
                // to minimal indicators to help user focus
                if (hasSelection && !isSelected) {
                  return (
                    <CollapsedIssueIndicator
                      key={issue.id}
                      issue={issue}
                      onSelect={() => onIssueSelect(issue.id)}
                      gutterWidth={gutterWidth}
                    />
                  );
                }

                // Check if this is the first occurrence of this message
                const firstLine = firstOccurrenceMap?.get(issue.message);
                const isFirstOccurrence = !firstLine || firstLine === lineNumber;

                if (isFirstOccurrence) {
                  return (
                    <IssueAnnotation
                      key={issue.id}
                      issue={issue}
                      isSelected={isSelected}
                      onSelect={() => onIssueSelect(issue.id)}
                      gutterWidth={gutterWidth}
                    />
                  );
                }

                // Render compact reference for repeated issues
                return (
                  <IssueReference
                    key={issue.id}
                    issue={issue}
                    firstLine={firstLine}
                    isSelected={isSelected}
                    onSelect={() => onIssueSelect(issue.id)}
                    gutterWidth={gutterWidth}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export default CodeRegion;
