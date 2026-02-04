/**
 * Source Regions - Utility for calculating visible code regions
 *
 * Given a list of issues with line numbers, calculates which regions
 * of the source file to display (with context around each issue)
 * and which regions to collapse (gaps between issue regions).
 *
 * Similar to GitHub's diff view with expandable collapsed sections.
 */
import type { Issue } from "../../types";

// ============================================================================
// Types
// ============================================================================

/**
 * A contiguous region of source code to display.
 */
export interface CodeRegion {
  /** Start line number (1-indexed, inclusive) */
  startLine: number;
  /** End line number (1-indexed, inclusive) */
  endLine: number;
  /** Issues within this region, sorted by line */
  issues: Issue[];
}

/**
 * A collapsed section between visible regions.
 */
export interface CollapsedGap {
  /** Unique identifier for this gap (index-based) */
  id: number;
  /** Start line number (1-indexed, inclusive) */
  startLine: number;
  /** End line number (1-indexed, inclusive) */
  endLine: number;
  /** Number of hidden lines */
  lineCount: number;
  /** Position: 'start' = before first region, 'middle' = between regions, 'end' = after last region */
  position: "start" | "middle" | "end";
}

/**
 * Result of region calculation.
 */
export interface RegionCalculationResult {
  /** Visible code regions with their issues */
  regions: CodeRegion[];
  /** Collapsed gaps between regions */
  gaps: CollapsedGap[];
}

// ============================================================================
// Region Calculation
// ============================================================================

/**
 * Calculate visible regions and collapsed gaps for a file's issues.
 *
 * Algorithm:
 * 1. Sort issues by line number
 * 2. For each issue, create a region: [line - contextAbove, line + contextBelow]
 * 3. Merge overlapping or adjacent regions
 * 4. Identify gaps (collapsed sections) between regions
 * 5. Handle file start/end gaps
 *
 * @param issues - Issues in this file (will be sorted by line)
 * @param totalLines - Total number of lines in the file
 * @param contextLines - Number of context lines above and below each issue
 * @returns Regions to display and gaps to collapse
 */
export function calculateRegions(
  issues: Issue[],
  totalLines: number,
  contextLines: number = 2
): RegionCalculationResult {
  // Edge case: no issues means no regions
  if (issues.length === 0) {
    // Single gap covering entire file if there are lines
    if (totalLines > 0) {
      return {
        regions: [],
        gaps: [
          {
            id: 0,
            startLine: 1,
            endLine: totalLines,
            lineCount: totalLines,
            position: "start",
          },
        ],
      };
    }
    return { regions: [], gaps: [] };
  }

  // Sort issues by line number
  const sortedIssues = [...issues].sort((a, b) => a.line - b.line);

  // Create initial regions for each issue
  const rawRegions: Array<{ start: number; end: number; issues: Issue[] }> = [];

  for (const issue of sortedIssues) {
    const start = Math.max(1, issue.line - contextLines);
    const end = Math.min(totalLines, issue.line + contextLines);

    // Check if this overlaps or is adjacent to the last region
    const lastRegion = rawRegions[rawRegions.length - 1];
    if (lastRegion && start <= lastRegion.end + 1) {
      // Merge: extend the last region and add the issue
      lastRegion.end = Math.max(lastRegion.end, end);
      lastRegion.issues.push(issue);
    } else {
      // New region
      rawRegions.push({ start, end, issues: [issue] });
    }
  }

  // Convert to CodeRegion format
  const regions: CodeRegion[] = rawRegions.map((r) => ({
    startLine: r.start,
    endLine: r.end,
    issues: r.issues,
  }));

  // Calculate gaps between regions
  const gaps: CollapsedGap[] = [];
  let gapId = 0;

  // Gap before first region (if any)
  if (regions.length > 0 && regions[0].startLine > 1) {
    gaps.push({
      id: gapId++,
      startLine: 1,
      endLine: regions[0].startLine - 1,
      lineCount: regions[0].startLine - 1,
      position: "start",
    });
  }

  // Gaps between regions
  for (let i = 0; i < regions.length - 1; i++) {
    const currentEnd = regions[i].endLine;
    const nextStart = regions[i + 1].startLine;

    if (nextStart > currentEnd + 1) {
      gaps.push({
        id: gapId++,
        startLine: currentEnd + 1,
        endLine: nextStart - 1,
        lineCount: nextStart - currentEnd - 1,
        position: "middle",
      });
    }
  }

  // Gap after last region (if any)
  if (regions.length > 0) {
    const lastRegion = regions[regions.length - 1];
    if (lastRegion.endLine < totalLines) {
      gaps.push({
        id: gapId++,
        startLine: lastRegion.endLine + 1,
        endLine: totalLines,
        lineCount: totalLines - lastRegion.endLine,
        position: "end",
      });
    }
  }

  return { regions, gaps };
}

/**
 * Expand a gap by merging it into adjacent regions.
 *
 * When a user clicks "Show N hidden lines", we need to recalculate
 * the regions to include those lines.
 *
 * @param result - Current region calculation result
 * @param gapId - ID of the gap to expand
 * @param totalLines - Total lines in file (for validation)
 * @returns New result with the gap expanded
 */
export function expandGap(
  result: RegionCalculationResult,
  gapId: number
): RegionCalculationResult {
  const gapIndex = result.gaps.findIndex((g) => g.id === gapId);
  if (gapIndex === -1) {
    return result; // Gap not found, return unchanged
  }

  const gap = result.gaps[gapIndex];
  const newRegions = [...result.regions];
  const newGaps = result.gaps.filter((g) => g.id !== gapId);

  if (gap.position === "start") {
    // Expand into the first region
    if (newRegions.length > 0) {
      newRegions[0] = {
        ...newRegions[0],
        startLine: gap.startLine,
      };
    } else {
      // No regions exist, create one for the gap
      newRegions.push({
        startLine: gap.startLine,
        endLine: gap.endLine,
        issues: [],
      });
    }
  } else if (gap.position === "end") {
    // Expand from the last region
    if (newRegions.length > 0) {
      const lastIdx = newRegions.length - 1;
      newRegions[lastIdx] = {
        ...newRegions[lastIdx],
        endLine: gap.endLine,
      };
    } else {
      newRegions.push({
        startLine: gap.startLine,
        endLine: gap.endLine,
        issues: [],
      });
    }
  } else {
    // Middle gap - merge the two adjacent regions
    // Find the region before this gap
    const beforeRegionIdx = newRegions.findIndex(
      (r) => r.endLine === gap.startLine - 1
    );
    const afterRegionIdx = newRegions.findIndex(
      (r) => r.startLine === gap.endLine + 1
    );

    if (beforeRegionIdx !== -1 && afterRegionIdx !== -1) {
      // Merge before and after regions
      const mergedRegion: CodeRegion = {
        startLine: newRegions[beforeRegionIdx].startLine,
        endLine: newRegions[afterRegionIdx].endLine,
        issues: [
          ...newRegions[beforeRegionIdx].issues,
          ...newRegions[afterRegionIdx].issues,
        ],
      };

      // Remove after region first (higher index), then before
      if (afterRegionIdx > beforeRegionIdx) {
        newRegions.splice(afterRegionIdx, 1);
        newRegions.splice(beforeRegionIdx, 1, mergedRegion);
      } else {
        newRegions.splice(beforeRegionIdx, 1);
        newRegions.splice(afterRegionIdx, 1, mergedRegion);
      }
    }
  }

  return { regions: newRegions, gaps: newGaps };
}

/**
 * Get issues for a specific line number.
 *
 * @param issues - All issues in the file
 * @param lineNumber - Line number to check
 * @returns Issues on that line
 */
export function getIssuesForLine(issues: Issue[], lineNumber: number): Issue[] {
  return issues.filter((issue) => issue.line === lineNumber);
}

/**
 * Check if a line has any issues.
 *
 * @param issues - All issues in the file
 * @param lineNumber - Line number to check
 * @returns True if the line has issues
 */
export function lineHasIssues(issues: Issue[], lineNumber: number): boolean {
  return issues.some((issue) => issue.line === lineNumber);
}

/**
 * Get the highest severity for a line.
 *
 * @param issues - Issues on this line
 * @returns Highest severity or null if no issues
 */
export function getLineSeverity(
  issues: Issue[]
): Issue["severity"] | null {
  if (issues.length === 0) return null;

  const severityOrder: Record<Issue["severity"], number> = {
    error: 0,
    warning: 1,
    info: 2,
  };

  const sorted = [...issues].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  return sorted[0].severity;
}
