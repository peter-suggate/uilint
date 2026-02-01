/**
 * Issues Selectors
 *
 * Zustand selectors for computing derived issue state.
 * Used by useIssues hook and components that display issues.
 */

import type { ComposedState } from "./composed-store";
import type { Issue } from "../../ui/types";

// ============================================================================
// Types
// ============================================================================

export interface SeverityCounts {
  error: number;
  warning: number;
  info: number;
}

// ============================================================================
// Stable Empty Values (prevent unnecessary re-renders)
// ============================================================================

const EMPTY_ISSUES: Issue[] = [];
const EMPTY_BY_FILE = new Map<string, Issue[]>();
const EMPTY_BY_DATALOC = new Map<string, Issue[]>();
const ZERO_SEVERITY_COUNTS: SeverityCounts = { error: 0, warning: 0, info: 0 };

// ============================================================================
// Selectors
// ============================================================================

/**
 * Selector to get the raw issues Map from the ESLint plugin state.
 * Returns the Map keyed by dataLoc, or an empty Map if not available.
 *
 * @param state - The composed store state
 * @returns Map of dataLoc to Issue[]
 */
export function selectIssuesMap(state: ComposedState): Map<string, Issue[]> {
  return state.plugins?.eslint?.issues ?? EMPTY_BY_DATALOC;
}

/**
 * Selector to get all issues as a flat array.
 * Flattens the Map values into a single Issue[].
 *
 * @param state - The composed store state
 * @returns All issues from all dataLocs
 */
export function selectAllIssues(state: ComposedState): Issue[] {
  const issuesMap = state.plugins?.eslint?.issues;
  if (!issuesMap || issuesMap.size === 0) {
    return EMPTY_ISSUES;
  }

  const allIssues: Issue[] = [];
  for (const issues of issuesMap.values()) {
    allIssues.push(...issues);
  }

  return allIssues;
}

/**
 * Selector to get issues grouped by file path.
 * Reorganizes issues from dataLoc-keyed to filePath-keyed Map.
 *
 * @param state - The composed store state
 * @returns Map of filePath to Issue[]
 */
export function selectIssuesByFile(state: ComposedState): Map<string, Issue[]> {
  const issuesMap = state.plugins?.eslint?.issues;
  if (!issuesMap || issuesMap.size === 0) {
    return EMPTY_BY_FILE;
  }

  const byFile = new Map<string, Issue[]>();

  for (const issues of issuesMap.values()) {
    for (const issue of issues) {
      const existing = byFile.get(issue.filePath);
      if (existing) {
        existing.push(issue);
      } else {
        byFile.set(issue.filePath, [issue]);
      }
    }
  }

  return byFile;
}

/**
 * Selector to get the total count of all issues.
 *
 * @param state - The composed store state
 * @returns Total number of issues across all dataLocs
 */
export function selectTotalIssueCount(state: ComposedState): number {
  const issuesMap = state.plugins?.eslint?.issues;
  if (!issuesMap || issuesMap.size === 0) {
    return 0;
  }

  let count = 0;
  for (const issues of issuesMap.values()) {
    count += issues.length;
  }

  return count;
}

/**
 * Selector to get issue counts grouped by severity.
 *
 * @param state - The composed store state
 * @returns Object with error, warning, and info counts
 */
export function selectSeverityCounts(state: ComposedState): SeverityCounts {
  const issuesMap = state.plugins?.eslint?.issues;
  if (!issuesMap || issuesMap.size === 0) {
    return ZERO_SEVERITY_COUNTS;
  }

  const counts: SeverityCounts = { error: 0, warning: 0, info: 0 };

  for (const issues of issuesMap.values()) {
    for (const issue of issues) {
      counts[issue.severity]++;
    }
  }

  return counts;
}

/**
 * Selector to check if there are any issues.
 *
 * @param state - The composed store state
 * @returns true if there are any issues
 */
export function selectHasIssues(state: ComposedState): boolean {
  const issuesMap = state.plugins?.eslint?.issues;
  if (!issuesMap || issuesMap.size === 0) {
    return false;
  }

  for (const issues of issuesMap.values()) {
    if (issues.length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Selector to check if there are any errors (highest severity).
 *
 * @param state - The composed store state
 * @returns true if there are any error-severity issues
 */
export function selectHasErrors(state: ComposedState): boolean {
  const issuesMap = state.plugins?.eslint?.issues;
  if (!issuesMap || issuesMap.size === 0) {
    return false;
  }

  for (const issues of issuesMap.values()) {
    for (const issue of issues) {
      if (issue.severity === "error") {
        return true;
      }
    }
  }

  return false;
}
