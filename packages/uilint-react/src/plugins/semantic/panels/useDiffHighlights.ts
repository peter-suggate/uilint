/**
 * useDiffHighlights - Hook for computing word-level diff between two code blocks
 *
 * Uses the 'diff' package to compute word-level differences between source and target code.
 * Returns segments that can be rendered with opacity styling to highlight similarities.
 *
 * Design philosophy: Always on, never distracting
 * - Matching text: full opacity
 * - Different text: reduced opacity (0.4)
 */
import { useMemo } from "react";
import { diffWords } from "diff";

/**
 * A segment of text with its diff type
 */
export interface DiffSegment {
  /** The text content */
  text: string;
  /** Type of segment: match (in both), source-only, or target-only */
  type: "match" | "source-only" | "target-only";
}

/**
 * Line with diff segments for rendering
 */
export interface DiffLine {
  /** Line number (1-indexed) */
  lineNumber: number;
  /** Segments within this line */
  segments: DiffSegment[];
  /** Whether this line has any differences */
  hasDiff: boolean;
}

/**
 * Result of diff computation
 */
export interface DiffHighlightsResult {
  /** Lines for the source code with diff segments */
  sourceLines: DiffLine[];
  /** Lines for the target code with diff segments */
  targetLines: DiffLine[];
  /** Whether diff was computed (false if code too large) */
  computed: boolean;
}

/** Maximum lines to compute diff for (performance) */
const MAX_LINES_FOR_DIFF = 500;

/**
 * Split text into lines preserving line structure
 */
function splitIntoLines(text: string): string[] {
  return text.split("\n");
}

/**
 * Compute diff segments for a single line pair
 */
function computeLineDiff(
  sourceLine: string,
  targetLine: string
): { sourceSegments: DiffSegment[]; targetSegments: DiffSegment[] } {
  const sourceSegments: DiffSegment[] = [];
  const targetSegments: DiffSegment[] = [];

  // If lines are identical, return as match
  if (sourceLine === targetLine) {
    if (sourceLine) {
      sourceSegments.push({ text: sourceLine, type: "match" });
      targetSegments.push({ text: targetLine, type: "match" });
    }
    return { sourceSegments, targetSegments };
  }

  // Compute word-level diff
  const changes = diffWords(sourceLine, targetLine);

  for (const change of changes) {
    if (change.added) {
      // In target only
      targetSegments.push({ text: change.value, type: "target-only" });
    } else if (change.removed) {
      // In source only
      sourceSegments.push({ text: change.value, type: "source-only" });
    } else {
      // In both
      sourceSegments.push({ text: change.value, type: "match" });
      targetSegments.push({ text: change.value, type: "match" });
    }
  }

  return { sourceSegments, targetSegments };
}

/**
 * Hook to compute diff highlights between source and target code
 *
 * @param sourceCode - The source code string
 * @param targetCode - The target code string
 * @returns Diff highlights for both source and target
 */
export function useDiffHighlights(
  sourceCode: string,
  targetCode: string
): DiffHighlightsResult {
  return useMemo(() => {
    // Skip diff for empty inputs
    if (!sourceCode || !targetCode) {
      return {
        sourceLines: [],
        targetLines: [],
        computed: false,
      };
    }

    const sourceTextLines = splitIntoLines(sourceCode);
    const targetTextLines = splitIntoLines(targetCode);

    // Skip diff for large files (performance)
    if (sourceTextLines.length > MAX_LINES_FOR_DIFF || targetTextLines.length > MAX_LINES_FOR_DIFF) {
      // Return plain lines without diff highlighting
      return {
        sourceLines: sourceTextLines.map((text, i) => ({
          lineNumber: i + 1,
          segments: [{ text, type: "match" as const }],
          hasDiff: false,
        })),
        targetLines: targetTextLines.map((text, i) => ({
          lineNumber: i + 1,
          segments: [{ text, type: "match" as const }],
          hasDiff: false,
        })),
        computed: false,
      };
    }

    // Compute line-by-line diff
    const sourceLines: DiffLine[] = [];
    const targetLines: DiffLine[] = [];

    // Process each line pair
    const maxLines = Math.max(sourceTextLines.length, targetTextLines.length);

    for (let i = 0; i < maxLines; i++) {
      const sourceLine = sourceTextLines[i] ?? "";
      const targetLine = targetTextLines[i] ?? "";

      const { sourceSegments, targetSegments } = computeLineDiff(sourceLine, targetLine);

      if (i < sourceTextLines.length) {
        const hasDiff = sourceSegments.some((s) => s.type !== "match");
        sourceLines.push({
          lineNumber: i + 1,
          segments: sourceSegments.length > 0 ? sourceSegments : [{ text: "", type: "match" }],
          hasDiff,
        });
      }

      if (i < targetTextLines.length) {
        const hasDiff = targetSegments.some((s) => s.type !== "match");
        targetLines.push({
          lineNumber: i + 1,
          segments: targetSegments.length > 0 ? targetSegments : [{ text: "", type: "match" }],
          hasDiff,
        });
      }
    }

    return {
      sourceLines,
      targetLines,
      computed: true,
    };
  }, [sourceCode, targetCode]);
}

/**
 * Get opacity for a diff segment type
 */
export function getSegmentOpacity(type: DiffSegment["type"]): number {
  return type === "match" ? 1 : 0.4;
}

export default useDiffHighlights;
