/**
 * Unit tests for issues-selectors.ts
 *
 * Tests the Zustand selectors for computing derived issue state including:
 * - selectIssuesMap - raw issues Map access
 * - selectAllIssues - flat array of all issues
 * - selectIssuesByFile - issues grouped by file path
 * - selectTotalIssueCount - total issue count
 * - selectSeverityCounts - issues grouped by severity
 * - selectHasIssues - boolean check for any issues
 * - selectHasErrors - boolean check for error-severity issues
 */

import { describe, it, expect } from "vitest";
import {
  selectIssuesMap,
  selectAllIssues,
  selectIssuesByFile,
  selectTotalIssueCount,
  selectSeverityCounts,
  selectHasIssues,
  selectHasErrors,
  type SeverityCounts,
} from "./issues-selectors";
import type { ComposedState } from "./composed-store";
import type { Issue, IssueSeverity } from "../../ui/types";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock issue with sensible defaults.
 * Overrides can be provided to customize specific fields.
 */
function createMockIssue(overrides: Partial<Issue> = {}): Issue {
  const defaults: Issue = {
    id: "eslint:test-rule:file.tsx:10:5:10",
    message: "Test issue message",
    severity: "warning",
    dataLoc: "file.tsx:10:5",
    ruleId: "test-rule",
    pluginId: "eslint",
    filePath: "file.tsx",
    line: 10,
    column: 5,
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a mock ComposedState with optional issues Map.
 * Provides a minimal state shape needed for selector testing.
 */
function createMockState(issues?: Map<string, Issue[]>): ComposedState {
  return {
    plugins: {
      eslint: {
        issues: issues ?? new Map(),
      },
    },
  } as unknown as ComposedState;
}

/**
 * Create an empty mock state with no plugin state.
 */
function createEmptyState(): ComposedState {
  return {} as unknown as ComposedState;
}

/**
 * Create a mock state with no eslint plugin registered.
 */
function createStateWithoutEslint(): ComposedState {
  return {
    plugins: {},
  } as unknown as ComposedState;
}

// ============================================================================
// selectIssuesMap Tests
// ============================================================================

describe("selectIssuesMap", () => {
  it("returns empty Map when no plugin state exists", () => {
    const state = createEmptyState();

    const result = selectIssuesMap(state);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it("returns empty Map when eslint plugin is not registered", () => {
    const state = createStateWithoutEslint();

    const result = selectIssuesMap(state);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it("returns empty Map when issues map is undefined", () => {
    const state = {
      plugins: {
        eslint: {},
      },
    } as unknown as ComposedState;

    const result = selectIssuesMap(state);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it("returns empty Map when issues map is empty", () => {
    const state = createMockState(new Map());

    const result = selectIssuesMap(state);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it("returns the issues Map with single entry", () => {
    const issue = createMockIssue();
    const issuesMap = new Map([["file.tsx:10:5", [issue]]]);
    const state = createMockState(issuesMap);

    const result = selectIssuesMap(state);

    expect(result.size).toBe(1);
    expect(result.get("file.tsx:10:5")).toEqual([issue]);
  });

  it("returns the issues Map with multiple entries", () => {
    const issue1 = createMockIssue({ dataLoc: "file1.tsx:10:5" });
    const issue2 = createMockIssue({ dataLoc: "file2.tsx:20:10" });
    const issuesMap = new Map([
      ["file1.tsx:10:5", [issue1]],
      ["file2.tsx:20:10", [issue2]],
    ]);
    const state = createMockState(issuesMap);

    const result = selectIssuesMap(state);

    expect(result.size).toBe(2);
    expect(result.get("file1.tsx:10:5")).toEqual([issue1]);
    expect(result.get("file2.tsx:20:10")).toEqual([issue2]);
  });

  it("returns stable empty Map reference for performance", () => {
    const state1 = createEmptyState();
    const state2 = createStateWithoutEslint();

    const result1 = selectIssuesMap(state1);
    const result2 = selectIssuesMap(state2);

    // Both should return the same stable empty Map reference
    expect(result1).toBe(result2);
  });
});

// ============================================================================
// selectAllIssues Tests
// ============================================================================

describe("selectAllIssues", () => {
  it("returns empty array when no plugin state exists", () => {
    const state = createEmptyState();

    const result = selectAllIssues(state);

    expect(result).toEqual([]);
  });

  it("returns empty array when eslint plugin is not registered", () => {
    const state = createStateWithoutEslint();

    const result = selectAllIssues(state);

    expect(result).toEqual([]);
  });

  it("returns empty array when issues map is empty", () => {
    const state = createMockState(new Map());

    const result = selectAllIssues(state);

    expect(result).toEqual([]);
  });

  it("flattens issues from single dataLoc", () => {
    const issue1 = createMockIssue({ id: "issue-1", message: "Issue 1" });
    const issue2 = createMockIssue({ id: "issue-2", message: "Issue 2" });
    const issuesMap = new Map([["file.tsx:10:5", [issue1, issue2]]]);
    const state = createMockState(issuesMap);

    const result = selectAllIssues(state);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual(issue1);
    expect(result).toContainEqual(issue2);
  });

  it("flattens issues from multiple dataLocs", () => {
    const issue1 = createMockIssue({
      id: "issue-1",
      dataLoc: "file1.tsx:10:5",
    });
    const issue2 = createMockIssue({
      id: "issue-2",
      dataLoc: "file1.tsx:20:10",
    });
    const issue3 = createMockIssue({
      id: "issue-3",
      dataLoc: "file2.tsx:5:1",
    });
    const issuesMap = new Map([
      ["file1.tsx:10:5", [issue1]],
      ["file1.tsx:20:10", [issue2]],
      ["file2.tsx:5:1", [issue3]],
    ]);
    const state = createMockState(issuesMap);

    const result = selectAllIssues(state);

    expect(result).toHaveLength(3);
    expect(result).toContainEqual(issue1);
    expect(result).toContainEqual(issue2);
    expect(result).toContainEqual(issue3);
  });

  it("handles mixed empty and non-empty dataLoc entries", () => {
    const issue = createMockIssue();
    const issuesMap = new Map<string, Issue[]>([
      ["file1.tsx:10:5", []],
      ["file2.tsx:20:10", [issue]],
      ["file3.tsx:30:15", []],
    ]);
    const state = createMockState(issuesMap);

    const result = selectAllIssues(state);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(issue);
  });

  it("returns stable empty array reference for performance", () => {
    const state1 = createEmptyState();
    const state2 = createMockState(new Map());

    const result1 = selectAllIssues(state1);
    const result2 = selectAllIssues(state2);

    // Both should return the same stable empty array reference
    expect(result1).toBe(result2);
  });

  it("preserves issue order within dataLocs", () => {
    const issue1 = createMockIssue({ id: "issue-1", line: 10 });
    const issue2 = createMockIssue({ id: "issue-2", line: 20 });
    const issue3 = createMockIssue({ id: "issue-3", line: 30 });
    const issuesMap = new Map([["file.tsx:10:5", [issue1, issue2, issue3]]]);
    const state = createMockState(issuesMap);

    const result = selectAllIssues(state);

    expect(result[0]).toEqual(issue1);
    expect(result[1]).toEqual(issue2);
    expect(result[2]).toEqual(issue3);
  });
});

// ============================================================================
// selectIssuesByFile Tests
// ============================================================================

describe("selectIssuesByFile", () => {
  it("returns empty Map when no issues exist", () => {
    const state = createMockState(new Map());

    const result = selectIssuesByFile(state);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it("returns empty Map when no plugin state exists", () => {
    const state = createEmptyState();

    const result = selectIssuesByFile(state);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it("groups issues by file path correctly", () => {
    const issue1 = createMockIssue({
      id: "issue-1",
      filePath: "src/app.tsx",
      dataLoc: "src/app.tsx:10:5",
    });
    const issue2 = createMockIssue({
      id: "issue-2",
      filePath: "src/utils.ts",
      dataLoc: "src/utils.ts:20:10",
    });
    const issuesMap = new Map([
      ["src/app.tsx:10:5", [issue1]],
      ["src/utils.ts:20:10", [issue2]],
    ]);
    const state = createMockState(issuesMap);

    const result = selectIssuesByFile(state);

    expect(result.size).toBe(2);
    expect(result.get("src/app.tsx")).toEqual([issue1]);
    expect(result.get("src/utils.ts")).toEqual([issue2]);
  });

  it("handles multiple issues in same file from different dataLocs", () => {
    const issue1 = createMockIssue({
      id: "issue-1",
      filePath: "src/app.tsx",
      dataLoc: "src/app.tsx:10:5",
      line: 10,
    });
    const issue2 = createMockIssue({
      id: "issue-2",
      filePath: "src/app.tsx",
      dataLoc: "src/app.tsx:25:10",
      line: 25,
    });
    const issue3 = createMockIssue({
      id: "issue-3",
      filePath: "src/app.tsx",
      dataLoc: "src/app.tsx:50:1",
      line: 50,
    });
    const issuesMap = new Map([
      ["src/app.tsx:10:5", [issue1]],
      ["src/app.tsx:25:10", [issue2]],
      ["src/app.tsx:50:1", [issue3]],
    ]);
    const state = createMockState(issuesMap);

    const result = selectIssuesByFile(state);

    expect(result.size).toBe(1);
    const appIssues = result.get("src/app.tsx");
    expect(appIssues).toHaveLength(3);
    expect(appIssues).toContainEqual(issue1);
    expect(appIssues).toContainEqual(issue2);
    expect(appIssues).toContainEqual(issue3);
  });

  it("handles multiple issues at same dataLoc in same file", () => {
    const issue1 = createMockIssue({
      id: "issue-1",
      filePath: "src/app.tsx",
      ruleId: "rule-1",
    });
    const issue2 = createMockIssue({
      id: "issue-2",
      filePath: "src/app.tsx",
      ruleId: "rule-2",
    });
    const issuesMap = new Map([["src/app.tsx:10:5", [issue1, issue2]]]);
    const state = createMockState(issuesMap);

    const result = selectIssuesByFile(state);

    expect(result.size).toBe(1);
    const appIssues = result.get("src/app.tsx");
    expect(appIssues).toHaveLength(2);
  });

  it("returns stable empty Map reference for performance", () => {
    const state1 = createEmptyState();
    const state2 = createMockState(new Map());

    const result1 = selectIssuesByFile(state1);
    const result2 = selectIssuesByFile(state2);

    // Both should return the same stable empty Map reference
    expect(result1).toBe(result2);
  });
});

// ============================================================================
// selectTotalIssueCount Tests
// ============================================================================

describe("selectTotalIssueCount", () => {
  it("returns 0 when no plugin state exists", () => {
    const state = createEmptyState();

    const result = selectTotalIssueCount(state);

    expect(result).toBe(0);
  });

  it("returns 0 when issues map is empty", () => {
    const state = createMockState(new Map());

    const result = selectTotalIssueCount(state);

    expect(result).toBe(0);
  });

  it("returns correct count for single issue", () => {
    const issue = createMockIssue();
    const issuesMap = new Map([["file.tsx:10:5", [issue]]]);
    const state = createMockState(issuesMap);

    const result = selectTotalIssueCount(state);

    expect(result).toBe(1);
  });

  it("returns correct count for multiple issues at single dataLoc", () => {
    const issue1 = createMockIssue({ id: "issue-1" });
    const issue2 = createMockIssue({ id: "issue-2" });
    const issue3 = createMockIssue({ id: "issue-3" });
    const issuesMap = new Map([["file.tsx:10:5", [issue1, issue2, issue3]]]);
    const state = createMockState(issuesMap);

    const result = selectTotalIssueCount(state);

    expect(result).toBe(3);
  });

  it("returns correct count for issues across multiple dataLocs", () => {
    const issue1 = createMockIssue({ id: "issue-1", dataLoc: "file1.tsx:10:5" });
    const issue2 = createMockIssue({ id: "issue-2", dataLoc: "file2.tsx:20:10" });
    const issue3 = createMockIssue({ id: "issue-3", dataLoc: "file2.tsx:20:10" });
    const issuesMap = new Map([
      ["file1.tsx:10:5", [issue1]],
      ["file2.tsx:20:10", [issue2, issue3]],
    ]);
    const state = createMockState(issuesMap);

    const result = selectTotalIssueCount(state);

    expect(result).toBe(3);
  });

  it("handles empty arrays in the issues map", () => {
    const issue = createMockIssue();
    const issuesMap = new Map<string, Issue[]>([
      ["file1.tsx:10:5", []],
      ["file2.tsx:20:10", [issue]],
      ["file3.tsx:30:15", []],
    ]);
    const state = createMockState(issuesMap);

    const result = selectTotalIssueCount(state);

    expect(result).toBe(1);
  });

  it("handles large number of issues", () => {
    const issues: Issue[] = [];
    for (let i = 0; i < 100; i++) {
      issues.push(createMockIssue({ id: `issue-${i}`, line: i }));
    }
    const issuesMap = new Map([["file.tsx:1:1", issues]]);
    const state = createMockState(issuesMap);

    const result = selectTotalIssueCount(state);

    expect(result).toBe(100);
  });
});

// ============================================================================
// selectSeverityCounts Tests
// ============================================================================

describe("selectSeverityCounts", () => {
  it("returns zero counts when no issues exist", () => {
    const state = createMockState(new Map());

    const result = selectSeverityCounts(state);

    expect(result).toEqual({ error: 0, warning: 0, info: 0 });
  });

  it("returns zero counts when no plugin state exists", () => {
    const state = createEmptyState();

    const result = selectSeverityCounts(state);

    expect(result).toEqual({ error: 0, warning: 0, info: 0 });
  });

  it("counts errors correctly", () => {
    const issue1 = createMockIssue({ id: "issue-1", severity: "error" });
    const issue2 = createMockIssue({ id: "issue-2", severity: "error" });
    const issuesMap = new Map([["file.tsx:10:5", [issue1, issue2]]]);
    const state = createMockState(issuesMap);

    const result = selectSeverityCounts(state);

    expect(result.error).toBe(2);
    expect(result.warning).toBe(0);
    expect(result.info).toBe(0);
  });

  it("counts warnings correctly", () => {
    const issue1 = createMockIssue({ id: "issue-1", severity: "warning" });
    const issue2 = createMockIssue({ id: "issue-2", severity: "warning" });
    const issue3 = createMockIssue({ id: "issue-3", severity: "warning" });
    const issuesMap = new Map([["file.tsx:10:5", [issue1, issue2, issue3]]]);
    const state = createMockState(issuesMap);

    const result = selectSeverityCounts(state);

    expect(result.error).toBe(0);
    expect(result.warning).toBe(3);
    expect(result.info).toBe(0);
  });

  it("counts info correctly", () => {
    const issue = createMockIssue({ severity: "info" });
    const issuesMap = new Map([["file.tsx:10:5", [issue]]]);
    const state = createMockState(issuesMap);

    const result = selectSeverityCounts(state);

    expect(result.error).toBe(0);
    expect(result.warning).toBe(0);
    expect(result.info).toBe(1);
  });

  it("counts mixed severities correctly", () => {
    const errorIssue1 = createMockIssue({ id: "error-1", severity: "error" });
    const errorIssue2 = createMockIssue({ id: "error-2", severity: "error" });
    const warningIssue1 = createMockIssue({ id: "warning-1", severity: "warning" });
    const warningIssue2 = createMockIssue({ id: "warning-2", severity: "warning" });
    const warningIssue3 = createMockIssue({ id: "warning-3", severity: "warning" });
    const infoIssue = createMockIssue({ id: "info-1", severity: "info" });
    const issuesMap = new Map([
      ["file1.tsx:10:5", [errorIssue1, warningIssue1]],
      ["file2.tsx:20:10", [errorIssue2, warningIssue2, infoIssue]],
      ["file3.tsx:30:15", [warningIssue3]],
    ]);
    const state = createMockState(issuesMap);

    const result = selectSeverityCounts(state);

    expect(result.error).toBe(2);
    expect(result.warning).toBe(3);
    expect(result.info).toBe(1);
  });

  it("returns stable zero counts reference for performance", () => {
    const state1 = createEmptyState();
    const state2 = createMockState(new Map());

    const result1 = selectSeverityCounts(state1);
    const result2 = selectSeverityCounts(state2);

    // Both should return the same stable zero counts reference
    expect(result1).toBe(result2);
  });
});

// ============================================================================
// selectHasIssues Tests
// ============================================================================

describe("selectHasIssues", () => {
  it("returns false when no plugin state exists", () => {
    const state = createEmptyState();

    const result = selectHasIssues(state);

    expect(result).toBe(false);
  });

  it("returns false when issues map is empty", () => {
    const state = createMockState(new Map());

    const result = selectHasIssues(state);

    expect(result).toBe(false);
  });

  it("returns false when issues map contains only empty arrays", () => {
    const issuesMap = new Map<string, Issue[]>([
      ["file1.tsx:10:5", []],
      ["file2.tsx:20:10", []],
    ]);
    const state = createMockState(issuesMap);

    const result = selectHasIssues(state);

    expect(result).toBe(false);
  });

  it("returns true when any issues exist", () => {
    const issue = createMockIssue();
    const issuesMap = new Map([["file.tsx:10:5", [issue]]]);
    const state = createMockState(issuesMap);

    const result = selectHasIssues(state);

    expect(result).toBe(true);
  });

  it("returns true regardless of severity", () => {
    const severities: IssueSeverity[] = ["error", "warning", "info"];

    for (const severity of severities) {
      const issue = createMockIssue({ severity });
      const issuesMap = new Map([["file.tsx:10:5", [issue]]]);
      const state = createMockState(issuesMap);

      const result = selectHasIssues(state);

      expect(result).toBe(true);
    }
  });

  it("returns true even if issue is in later dataLoc entries", () => {
    const issue = createMockIssue();
    const issuesMap = new Map<string, Issue[]>([
      ["file1.tsx:10:5", []],
      ["file2.tsx:20:10", []],
      ["file3.tsx:30:15", [issue]],
    ]);
    const state = createMockState(issuesMap);

    const result = selectHasIssues(state);

    expect(result).toBe(true);
  });
});

// ============================================================================
// selectHasErrors Tests
// ============================================================================

describe("selectHasErrors", () => {
  it("returns false when no plugin state exists", () => {
    const state = createEmptyState();

    const result = selectHasErrors(state);

    expect(result).toBe(false);
  });

  it("returns false when issues map is empty", () => {
    const state = createMockState(new Map());

    const result = selectHasErrors(state);

    expect(result).toBe(false);
  });

  it("returns false when only warnings exist", () => {
    const warning = createMockIssue({ severity: "warning" });
    const issuesMap = new Map([["file.tsx:10:5", [warning]]]);
    const state = createMockState(issuesMap);

    const result = selectHasErrors(state);

    expect(result).toBe(false);
  });

  it("returns false when only info issues exist", () => {
    const info = createMockIssue({ severity: "info" });
    const issuesMap = new Map([["file.tsx:10:5", [info]]]);
    const state = createMockState(issuesMap);

    const result = selectHasErrors(state);

    expect(result).toBe(false);
  });

  it("returns false when only warnings and info exist", () => {
    const warning = createMockIssue({ id: "warning-1", severity: "warning" });
    const info = createMockIssue({ id: "info-1", severity: "info" });
    const issuesMap = new Map([["file.tsx:10:5", [warning, info]]]);
    const state = createMockState(issuesMap);

    const result = selectHasErrors(state);

    expect(result).toBe(false);
  });

  it("returns true when any error exists", () => {
    const error = createMockIssue({ severity: "error" });
    const issuesMap = new Map([["file.tsx:10:5", [error]]]);
    const state = createMockState(issuesMap);

    const result = selectHasErrors(state);

    expect(result).toBe(true);
  });

  it("returns true when errors exist among other severities", () => {
    const error = createMockIssue({ id: "error-1", severity: "error" });
    const warning = createMockIssue({ id: "warning-1", severity: "warning" });
    const info = createMockIssue({ id: "info-1", severity: "info" });
    const issuesMap = new Map([["file.tsx:10:5", [warning, error, info]]]);
    const state = createMockState(issuesMap);

    const result = selectHasErrors(state);

    expect(result).toBe(true);
  });

  it("returns true even if error is in later dataLoc entries", () => {
    const warning = createMockIssue({ id: "warning-1", severity: "warning" });
    const error = createMockIssue({ id: "error-1", severity: "error" });
    const issuesMap = new Map([
      ["file1.tsx:10:5", [warning]],
      ["file2.tsx:20:10", []],
      ["file3.tsx:30:15", [error]],
    ]);
    const state = createMockState(issuesMap);

    const result = selectHasErrors(state);

    expect(result).toBe(true);
  });

  it("returns true for first error found (short-circuit)", () => {
    // This test verifies the selector exits early when it finds an error
    const issues: Issue[] = [];
    for (let i = 0; i < 100; i++) {
      issues.push(createMockIssue({ id: `warning-${i}`, severity: "warning" }));
    }
    // Add one error in the middle
    issues[50] = createMockIssue({ id: "error-50", severity: "error" });

    const issuesMap = new Map([["file.tsx:1:1", issues]]);
    const state = createMockState(issuesMap);

    const result = selectHasErrors(state);

    expect(result).toBe(true);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Issues Selectors - Integration", () => {
  it("all selectors handle the same state consistently", () => {
    const error = createMockIssue({ id: "error-1", severity: "error", ruleId: "no-console" });
    const warning = createMockIssue({ id: "warning-1", severity: "warning", ruleId: "no-unused-vars" });
    const issuesMap = new Map([["file.tsx:10:5", [error, warning]]]);
    const state = createMockState(issuesMap);

    // Verify all selectors work with the same state
    expect(selectIssuesMap(state).size).toBe(1);
    expect(selectAllIssues(state)).toHaveLength(2);
    expect(selectIssuesByFile(state).size).toBe(1);
    expect(selectTotalIssueCount(state)).toBe(2);
    expect(selectSeverityCounts(state)).toEqual({ error: 1, warning: 1, info: 0 });
    expect(selectHasIssues(state)).toBe(true);
    expect(selectHasErrors(state)).toBe(true);
  });

  it("all selectors handle empty state consistently", () => {
    const state = createEmptyState();

    expect(selectIssuesMap(state).size).toBe(0);
    expect(selectAllIssues(state)).toEqual([]);
    expect(selectIssuesByFile(state).size).toBe(0);
    expect(selectTotalIssueCount(state)).toBe(0);
    expect(selectSeverityCounts(state)).toEqual({ error: 0, warning: 0, info: 0 });
    expect(selectHasIssues(state)).toBe(false);
    expect(selectHasErrors(state)).toBe(false);
  });

  it("selectTotalIssueCount matches selectAllIssues length", () => {
    const issues = [
      createMockIssue({ id: "1", dataLoc: "a.tsx:1:1" }),
      createMockIssue({ id: "2", dataLoc: "a.tsx:2:1" }),
      createMockIssue({ id: "3", dataLoc: "b.tsx:1:1" }),
      createMockIssue({ id: "4", dataLoc: "b.tsx:1:1" }),
      createMockIssue({ id: "5", dataLoc: "c.tsx:1:1" }),
    ];
    const issuesMap = new Map([
      ["a.tsx:1:1", [issues[0]]],
      ["a.tsx:2:1", [issues[1]]],
      ["b.tsx:1:1", [issues[2], issues[3]]],
      ["c.tsx:1:1", [issues[4]]],
    ]);
    const state = createMockState(issuesMap);

    expect(selectTotalIssueCount(state)).toBe(selectAllIssues(state).length);
    expect(selectTotalIssueCount(state)).toBe(5);
  });

  it("selectSeverityCounts totals match selectTotalIssueCount", () => {
    const issues = [
      createMockIssue({ id: "1", severity: "error" }),
      createMockIssue({ id: "2", severity: "error" }),
      createMockIssue({ id: "3", severity: "warning" }),
      createMockIssue({ id: "4", severity: "warning" }),
      createMockIssue({ id: "5", severity: "warning" }),
      createMockIssue({ id: "6", severity: "info" }),
    ];
    const issuesMap = new Map([["file.tsx:1:1", issues]]);
    const state = createMockState(issuesMap);

    const counts = selectSeverityCounts(state);
    const total = counts.error + counts.warning + counts.info;

    expect(total).toBe(selectTotalIssueCount(state));
    expect(total).toBe(6);
  });
});
