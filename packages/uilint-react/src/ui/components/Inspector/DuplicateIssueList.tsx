/**
 * DuplicateIssueList - Custom issue list for no-duplicates rule.
 *
 * Replaces the generic IssueSummaryView when viewing duplicate code issues.
 * Shows expandable cards per duplicate pair with similarity scores,
 * and expands into a DuplicateComparison view.
 */
import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Link2, EyeOff } from "lucide-react";
import { cn } from "../../../lib/utils";
import { Badge } from "../primitives";
import { DuplicateComparison } from "./DuplicateComparison";
import type { Issue } from "../../types";

// ============================================================================
// Types
// ============================================================================

export interface DuplicateIssueListProps {
  issues: Issue[];
  selectedIssueId: string | null;
  onIssueClick: (issue: Issue) => void;
  ignoredIssueIds?: Set<string>;
  onIgnore?: (issueId: string) => void;
  showIgnored?: boolean;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getSimilarity(issue: Issue): number {
  return parseInt((issue.metadata?.similarity as string) || "0", 10);
}

function getTargetName(issue: Issue): string {
  return (issue.metadata?.targetName as string) || "(anonymous)";
}

function getSourceName(issue: Issue): string {
  return (issue.metadata?.sourceName as string) || "(anonymous)";
}

function getTargetFile(issue: Issue): string | null {
  try {
    const loc = JSON.parse((issue.metadata?.targetLocation as string) || "{}");
    const filePath = loc.filePath as string | undefined;
    if (!filePath) return null;
    const parts = filePath.split("/");
    return `${parts[parts.length - 1]}:${loc.startLine}`;
  } catch {
    return null;
  }
}

function getSimilarityColor(score: number): string {
  if (score >= 90) return "text-error";
  if (score >= 80) return "text-warning";
  return "text-info";
}

// ============================================================================
// DuplicatePairCard
// ============================================================================

function DuplicatePairCard({
  issue,
  isExpanded,
  isIgnored,
  onClick,
  onIgnore,
  index,
}: {
  issue: Issue;
  isExpanded: boolean;
  isIgnored: boolean;
  onClick: () => void;
  onIgnore?: (issueId: string) => void;
  index: number;
}) {
  const similarity = getSimilarity(issue);
  const sourceName = getSourceName(issue);
  const targetName = getTargetName(issue);
  const targetFile = getTargetFile(issue);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isIgnored ? 0.4 : 1 }}
      transition={{ duration: 0.1, delay: Math.min(index * 0.03, 0.2) }}
      className={cn(
        "border border-foreground/[0.06] rounded-lg overflow-hidden",
        "transition-colors duration-100",
        isExpanded
          ? "bg-foreground/[0.02] border-foreground/[0.1]"
          : "hover:bg-foreground/[0.02]"
      )}
    >
      {/* Card header - always visible */}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full text-left flex items-center gap-2 px-3 py-2.5",
          "transition-colors duration-100",
          "group"
        )}
      >
        {/* Expand indicator */}
        <ChevronRight
          size={14}
          className={cn(
            "text-muted-foreground/40 transition-transform duration-150 shrink-0",
            isExpanded && "rotate-90"
          )}
        />

        {/* Similarity badge */}
        <span
          className={cn(
            "text-xs font-semibold tabular-nums shrink-0",
            getSimilarityColor(similarity)
          )}
        >
          {similarity}%
        </span>

        {/* Names */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-xs text-foreground/80 truncate">
            {sourceName}
          </span>
          <Link2 size={10} className="text-muted-foreground/40 shrink-0" />
          <span className="text-xs text-foreground/80 truncate">
            {targetName}
          </span>
        </div>

        {/* Target file */}
        {targetFile && (
          <span className="text-[10px] text-muted-foreground/50 font-mono shrink-0 hidden sm:inline">
            {targetFile}
          </span>
        )}

        {/* Ignored indicator */}
        {isIgnored && (
          <EyeOff size={12} className="text-muted-foreground/40 shrink-0" />
        )}
      </button>

      {/* Expanded comparison view */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-foreground/[0.04]">
              <DuplicateComparison
                issue={issue}
                onIgnore={onIgnore}
                isIgnored={isIgnored}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// DuplicateIssueList
// ============================================================================

export function DuplicateIssueList({
  issues,
  selectedIssueId,
  onIssueClick,
  ignoredIssueIds,
  onIgnore,
  showIgnored = false,
  className,
}: DuplicateIssueListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(selectedIssueId);

  // Sort by similarity descending
  const sortedIssues = useMemo(
    () => [...issues].sort((a, b) => getSimilarity(b) - getSimilarity(a)),
    [issues]
  );

  // Filter out ignored unless showing
  const visibleIssues = useMemo(() => {
    if (!ignoredIssueIds || ignoredIssueIds.size === 0 || showIgnored)
      return sortedIssues;
    return sortedIssues.filter((i) => !ignoredIssueIds.has(i.id));
  }, [sortedIssues, ignoredIssueIds, showIgnored]);

  const ignoredCount = useMemo(() => {
    if (!ignoredIssueIds) return 0;
    return sortedIssues.filter((i) => ignoredIssueIds.has(i.id)).length;
  }, [sortedIssues, ignoredIssueIds]);

  const handleCardClick = useCallback(
    (issue: Issue) => {
      const isExpanding = expandedId !== issue.id;
      setExpandedId(isExpanding ? issue.id : null);
      onIssueClick(issue);
    },
    [expandedId, onIssueClick]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      className={cn("flex flex-col gap-2 p-3", className)}
    >
      {/* Summary line */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs text-muted-foreground">
          {visibleIssues.length} duplicate{visibleIssues.length !== 1 ? "s" : ""} found
        </span>
        {ignoredCount > 0 && (
          <Badge variant="outline" size="sm" disableAnimation>
            {ignoredCount} ignored
          </Badge>
        )}
      </div>

      {/* Pair cards */}
      {visibleIssues.map((issue, index) => (
        <DuplicatePairCard
          key={issue.id}
          issue={issue}
          isExpanded={expandedId === issue.id}
          isIgnored={ignoredIssueIds?.has(issue.id) ?? false}
          onClick={() => handleCardClick(issue)}
          onIgnore={onIgnore}
          index={index}
        />
      ))}

      {visibleIssues.length === 0 && (
        <div className="py-8 text-center text-xs text-muted-foreground/60">
          {ignoredCount > 0
            ? "All duplicates in this file are ignored."
            : "No duplicates found."}
        </div>
      )}
    </motion.div>
  );
}

export default DuplicateIssueList;
