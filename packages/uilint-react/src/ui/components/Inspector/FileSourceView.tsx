/**
 * FileSourceView - Source code view with inline issue annotations
 *
 * Main container that replaces the flat issue list in FileSection.
 * Shows source code with collapsed sections between issue regions,
 * similar to GitHub's diff view.
 *
 * Features:
 * - Shows context lines around each issue
 * - Collapses large gaps between issues
 * - Click to expand collapsed sections
 * - Inline issue annotations with severity colors
 */
import React, { useState, useMemo, useCallback } from "react";
import { AnimatePresence } from "motion/react";
import { cn } from "../../../lib/utils";
import { useFullSourceCode } from "../../hooks/useFullSourceCode";
import { CodeRegion } from "./CodeRegion";
import { CollapsedLines } from "./CollapsedLines";
import {
  calculateRegions,
  expandGap,
  type RegionCalculationResult,
} from "./source-regions";
import type { Issue } from "../../types";

// ============================================================================
// Types
// ============================================================================

export interface FileSourceViewProps {
  /** Full file path */
  filePath: string;
  /** Issues in this file */
  issues: Issue[];
  /** Number of context lines above/below each issue */
  contextLines?: number;
  /** Currently selected issue ID */
  selectedIssueId: string | null;
  /** Called when an issue is selected */
  onIssueSelect: (issueId: string) => void;
  /** Whether to fetch source (default: true) */
  enabled?: boolean;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONTEXT_LINES = 2;
const MIN_GUTTER_WIDTH = 32;
const CHAR_WIDTH = 8;
const GUTTER_PADDING = 16;

// ============================================================================
// Component
// ============================================================================

export function FileSourceView({
  filePath,
  issues,
  contextLines = DEFAULT_CONTEXT_LINES,
  selectedIssueId,
  onIssueSelect,
  enabled = true,
  className,
}: FileSourceViewProps) {
  // Fetch full source code
  const { lines, totalLines, isLoading, error } = useFullSourceCode({
    filePath,
    enabled,
  });

  // Track expanded gaps (by gap ID)
  const [expandedGapIds, setExpandedGapIds] = useState<Set<number>>(new Set());

  // Calculate regions and gaps
  const baseResult = useMemo(() => {
    if (totalLines === 0) {
      return { regions: [], gaps: [] };
    }
    return calculateRegions(issues, totalLines, contextLines);
  }, [issues, totalLines, contextLines]);

  // Apply expanded gaps to get final result
  const result = useMemo(() => {
    let current: RegionCalculationResult = baseResult;

    // Expand each gap that's been clicked
    for (const gapId of expandedGapIds) {
      current = expandGap(current, gapId, totalLines);
    }

    return current;
  }, [baseResult, expandedGapIds, totalLines]);

  // Handle gap expansion
  const handleExpandGap = useCallback((gapId: number) => {
    setExpandedGapIds((prev) => new Set([...prev, gapId]));
  }, []);

  // Calculate gutter width based on max line number
  const gutterWidth = useMemo(() => {
    const maxLineDigits = Math.max(3, String(totalLines).length);
    return Math.max(MIN_GUTTER_WIDTH, maxLineDigits * CHAR_WIDTH + GUTTER_PADDING);
  }, [totalLines]);

  // Extract lines for a region
  const getRegionLines = useCallback(
    (startLine: number, endLine: number): string[] => {
      // Lines array is 0-indexed, line numbers are 1-indexed
      return lines.slice(startLine - 1, endLine);
    },
    [lines]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("py-6 text-center", className)}>
        <div className="text-xs text-muted-foreground/60">Loading source...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn("py-6 text-center", className)}>
        <div className="text-xs text-muted-foreground/60">
          Could not load source: {error}
        </div>
      </div>
    );
  }

  // No source available
  if (totalLines === 0) {
    return (
      <div className={cn("py-6 text-center", className)}>
        <div className="text-xs text-muted-foreground/60">
          Source not available
        </div>
      </div>
    );
  }

  // Build interleaved list of regions and gaps
  const elements: React.ReactNode[] = [];
  let gapIndex = 0;
  let regionIndex = 0;

  // Sort gaps by start line
  const sortedGaps = [...result.gaps].sort((a, b) => a.startLine - b.startLine);

  // Interleave regions and gaps in order
  while (gapIndex < sortedGaps.length || regionIndex < result.regions.length) {
    const nextGap = sortedGaps[gapIndex];
    const nextRegion = result.regions[regionIndex];

    // Determine which comes first
    const gapFirst =
      nextGap &&
      (!nextRegion || nextGap.startLine < nextRegion.startLine);

    if (gapFirst && nextGap) {
      elements.push(
        <CollapsedLines
          key={`gap-${nextGap.id}`}
          startLine={nextGap.startLine}
          endLine={nextGap.endLine}
          lineCount={nextGap.lineCount}
          onExpand={() => handleExpandGap(nextGap.id)}
          gutterWidth={gutterWidth}
        />
      );
      gapIndex++;
    } else if (nextRegion) {
      const regionLines = getRegionLines(
        nextRegion.startLine,
        nextRegion.endLine
      );

      elements.push(
        <CodeRegion
          key={`region-${nextRegion.startLine}-${nextRegion.endLine}`}
          lines={regionLines}
          startLine={nextRegion.startLine}
          issues={nextRegion.issues}
          selectedIssueId={selectedIssueId}
          onIssueSelect={onIssueSelect}
          gutterWidth={gutterWidth}
        />
      );
      regionIndex++;
    }
  }

  return (
    <div
      className={cn(
        "border-t border-foreground/[0.06]",
        "bg-background/50",
        className
      )}
    >
      <AnimatePresence mode="sync">{elements}</AnimatePresence>
    </div>
  );
}

export default FileSourceView;
