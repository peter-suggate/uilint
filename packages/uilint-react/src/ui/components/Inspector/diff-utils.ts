/**
 * Line-level diff utilities for duplicate code comparison.
 *
 * Uses LCS (Longest Common Subsequence) to identify matching, modified,
 * and unique lines between two code snippets.
 */

export type DiffLineType = "common" | "modified" | "added" | "removed";

export interface DiffLine {
  type: DiffLineType;
  content: string;
  lineNumber: number;
}

export interface DiffResult {
  sourceLines: DiffLine[];
  targetLines: DiffLine[];
}

/**
 * Compute the LCS table for two arrays of strings.
 */
function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1].trim() === b[j - 1].trim()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

/**
 * Backtrack through LCS table to produce a diff.
 */
function backtrack(
  dp: number[][],
  a: string[],
  b: string[],
  sourceStart: number,
  targetStart: number
): DiffResult {
  const sourceLines: DiffLine[] = [];
  const targetLines: DiffLine[] = [];

  let i = a.length;
  let j = b.length;

  // Collect operations in reverse, then reverse at end
  const ops: Array<{ type: "common" | "remove" | "add"; ai: number; bj: number }> = [];

  while (i > 0 && j > 0) {
    if (a[i - 1].trim() === b[j - 1].trim()) {
      ops.push({ type: "common", ai: i - 1, bj: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.push({ type: "remove", ai: i - 1, bj: -1 });
      i--;
    } else {
      ops.push({ type: "add", ai: -1, bj: j - 1 });
      j--;
    }
  }

  while (i > 0) {
    ops.push({ type: "remove", ai: i - 1, bj: -1 });
    i--;
  }

  while (j > 0) {
    ops.push({ type: "add", ai: -1, bj: j - 1 });
    j--;
  }

  ops.reverse();

  for (const op of ops) {
    if (op.type === "common") {
      sourceLines.push({
        type: "common",
        content: a[op.ai],
        lineNumber: sourceStart + op.ai,
      });
      targetLines.push({
        type: "common",
        content: b[op.bj],
        lineNumber: targetStart + op.bj,
      });
    } else if (op.type === "remove") {
      sourceLines.push({
        type: "removed",
        content: a[op.ai],
        lineNumber: sourceStart + op.ai,
      });
    } else {
      targetLines.push({
        type: "added",
        content: b[op.bj],
        lineNumber: targetStart + op.bj,
      });
    }
  }

  return { sourceLines, targetLines };
}

/**
 * Compute a line-level diff between two code strings.
 *
 * @param sourceCode - The "this code" snippet
 * @param targetCode - The "similar code" snippet
 * @param sourceStartLine - Starting line number for source (1-indexed)
 * @param targetStartLine - Starting line number for target (1-indexed)
 * @returns Diff result with classified lines for both snippets
 */
export function computeLineDiff(
  sourceCode: string,
  targetCode: string,
  sourceStartLine: number = 1,
  targetStartLine: number = 1
): DiffResult {
  const sourceRaw = sourceCode === "" ? [] : sourceCode.split("\n");
  const targetRaw = targetCode === "" ? [] : targetCode.split("\n");

  const dp = lcsTable(sourceRaw, targetRaw);
  return backtrack(dp, sourceRaw, targetRaw, sourceStartLine, targetStartLine);
}

/**
 * Get a summary of how similar two code blocks are based on the diff.
 */
export function getDiffStats(result: DiffResult): {
  commonLines: number;
  sourceOnlyLines: number;
  targetOnlyLines: number;
  totalLines: number;
} {
  const commonLines = result.sourceLines.filter((l) => l.type === "common").length;
  const sourceOnlyLines = result.sourceLines.filter((l) => l.type === "removed").length;
  const targetOnlyLines = result.targetLines.filter((l) => l.type === "added").length;

  return {
    commonLines,
    sourceOnlyLines,
    targetOnlyLines,
    totalLines: commonLines + sourceOnlyLines + targetOnlyLines,
  };
}
