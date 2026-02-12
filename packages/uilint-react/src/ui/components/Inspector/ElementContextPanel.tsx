/**
 * ElementContextPanel - Shows context for a selected heatmap element.
 *
 * Appears when the user clicks a heatmap badge. Shows the element's identity
 * and all its issues grouped by rule, with "Jump to rule" links.
 *
 * Creates the bottom-up narrative: element → its issues → the broader rule pattern.
 * Flat styling matching the CommandPalette list aesthetic.
 */
import React, { useCallback } from "react";
import { motion } from "motion/react";
import { X, ArrowRight, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "../../../lib/utils";
import { useComposedStore, selectIssuesMap } from "../../../core/store";
import { parseDataLoc } from "../../types";
import type { Issue, IssueSeverity } from "../../types";
import { crispEase } from "../HierarchicalTiles";

// ============================================================================
// Helpers
// ============================================================================

function SeverityIcon({ severity }: { severity: IssueSeverity }) {
  switch (severity) {
    case "error":
      return <AlertCircle size={12} className="text-error shrink-0" />;
    case "warning":
      return <AlertTriangle size={12} className="text-warning shrink-0" />;
    case "info":
      return <Info size={12} className="text-info shrink-0" />;
  }
}

// ============================================================================
// Types
// ============================================================================

export interface ElementContextPanelProps {
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ElementContextPanel({ className }: ElementContextPanelProps) {
  const dataLoc = useComposedStore((s) => s.inspector.selectedElementDataLoc);
  const issuesMap = useComposedStore(selectIssuesMap);
  const selectElement = useComposedStore((s) => s.selectElement);
  const jumpToRule = useComposedStore((s) => s.jumpToRule);

  // Parse the dataLoc
  const location = dataLoc ? parseDataLoc(dataLoc) : null;

  // Get issues for this element, grouped by rule
  const groupedIssues = (() => {
    if (!dataLoc) return new Map<string, Issue[]>();

    const locIssues = issuesMap.get(dataLoc);
    if (!locIssues || locIssues.length === 0) return new Map<string, Issue[]>();

    const grouped = new Map<string, Issue[]>();
    for (const issue of locIssues) {
      const existing = grouped.get(issue.ruleId);
      if (existing) {
        existing.push(issue);
      } else {
        grouped.set(issue.ruleId, [issue]);
      }
    }
    return grouped;
  })();

  const handleClose = useCallback(() => {
    selectElement(null);
  }, [selectElement]);

  const handleJumpToRule = useCallback(
    (ruleId: string, issueId?: string) => {
      jumpToRule(ruleId, issueId);
    },
    [jumpToRule]
  );

  if (!dataLoc || !location || groupedIssues.size === 0) return null;

  const totalIssues = Array.from(groupedIssues.values()).reduce(
    (sum, issues) => sum + issues.length,
    0
  );
  const ruleCount = groupedIssues.size;

  // Extract file name from path
  const parts = location.filePath.split("/");
  const fileName = parts[parts.length - 1] || location.filePath;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: crispEase }}
      className={cn(
        "border-b border-foreground/6",
        "overflow-hidden",
        className
      )}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">
              Element context
            </div>
            <div className="text-xs text-foreground/90 truncate">
              {fileName}:{location.line}
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Deselect element"
            title="Deselect element"
            className={cn(
              "p-1 rounded-md",
              "text-muted-foreground/40 hover:text-foreground/80",
              "hover:bg-foreground/4",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/25 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              "transition-colors duration-75"
            )}
          >
            <X size={14} />
          </button>
        </div>

        {/* Summary */}
        <div className="px-3 pb-1.5">
          <span className="text-[11px] text-muted-foreground/60">
            {totalIssues} issue{totalIssues !== 1 ? "s" : ""} from {ruleCount}{" "}
            rule{ruleCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Issues grouped by rule — flat list */}
        <div className="pb-0.5">
          {Array.from(groupedIssues.entries()).map(([ruleId, issues]) => {
            const shortName = ruleId.includes("/")
              ? ruleId.split("/").pop() || ruleId
              : ruleId;
            return (
              <div key={ruleId} className="border-t border-foreground/3">
                {issues.map((issue) => (
                  <button
                    key={issue.id}
                    onClick={() => handleJumpToRule(ruleId, issue.id)}
                    className={cn(
                      "w-full text-left",
                      "flex items-center gap-2 px-3 py-2",
                      "transition-colors duration-75",
                      "hover:bg-foreground/4",
                      "group"
                    )}
                  >
                    <SeverityIcon severity={issue.severity} />
                    <span className="text-[11px] text-muted-foreground/55 shrink-0">
                      {shortName}
                    </span>
                    <span className="flex-1 min-w-0 text-xs text-foreground/85 truncate">
                      {issue.message}
                    </span>
                    <ArrowRight
                      size={10}
                      className="shrink-0 text-muted-foreground/45 opacity-70 group-hover:opacity-100 transition-opacity"
                    />
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
