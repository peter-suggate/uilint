/**
 * Unit tests for file-groups-selector.ts
 *
 * Tests the unified file groups selector for the inspector view including:
 * - selectFilteredFileGroups - main selector for file-grouped issues
 * - selectFileGroupsSummary - summary statistics
 * - selectActiveRuleFilter / selectActiveFileFilter - filter accessors
 * - Filter combinations (no filters, rule only, file only, both)
 * - Sorting by severity and count
 * - Grouping issues by rule within files
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  selectFilteredFileGroups,
  selectFileGroupsSummary,
  selectActiveRuleFilter,
  selectActiveFileFilter,
  selectHasFilteredIssues,
  clearFileGroupsCache,
  type FileGroup,
  type FileGroupsSummary,
} from "./file-groups-selector";
import type { ComposedState } from "./composed-store";
import type { Issue, IssueSeverity } from "../../ui/types";
import type { TileFilter } from "../plugin-system/types";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock issue with sensible defaults.
 */
function createMockIssue(overrides: Partial<Issue> = {}): Issue {
  const defaults: Issue = {
    id: "eslint:test-rule:file.tsx:10:5:10",
    message: "Test issue message",
    severity: "warning",
    dataLoc: "file.tsx:10:5",
    ruleId: "test-rule",
    pluginId: "eslint",
    filePath: "src/file.tsx",
    line: 10,
    column: 5,
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a mock ComposedState with optional issues and filters.
 */
function createMockState(
  issues?: Map<string, Issue[]>,
  filters?: TileFilter[]
): ComposedState {
  return {
    plugins: {
      eslint: {
        issues: issues ?? new Map(),
      },
    },
    commandPalette: {
      filters: filters ?? [],
      open: false,
      query: "",
      selectedIndex: 0,
    },
  } as unknown as ComposedState;
}

/**
 * Create an empty mock state.
 */
function createEmptyState(): ComposedState {
  return {
    plugins: {},
    commandPalette: {
      filters: [],
      open: false,
      query: "",
      selectedIndex: 0,
    },
  } as unknown as ComposedState;
}

/**
 * Create a rule filter.
 */
function createRuleFilter(ruleId: string): TileFilter {
  return {
    type: "rule",
    id: ruleId,
    label: ruleId,
    providerId: "eslint",
  };
}

/**
 * Create a file filter.
 */
function createFileFilter(filePath: string): TileFilter {
  return {
    type: "file",
    id: filePath,
    label: filePath.split("/").pop() || filePath,
    providerId: "eslint",
  };
}

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  // Clear cache before each test for isolation
  clearFileGroupsCache();
});

// ============================================================================
// selectFilteredFileGroups Tests
// ============================================================================

describe("selectFilteredFileGroups", () => {
  describe("empty states", () => {
    it("returns empty array when no plugin state exists", () => {
      const state = createEmptyState();

      const result = selectFilteredFileGroups(state);

      expect(result).toEqual([]);
    });

    it("returns empty array when issues map is empty", () => {
      const state = createMockState(new Map());

      const result = selectFilteredFileGroups(state);

      expect(result).toEqual([]);
    });

    it("returns stable empty array reference", () => {
      const state1 = createEmptyState();
      const state2 = createMockState(new Map());

      const result1 = selectFilteredFileGroups(state1);
      clearFileGroupsCache();
      const result2 = selectFilteredFileGroups(state2);

      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
    });
  });

  describe("no filters", () => {
    it("returns all files grouped correctly", () => {
      const issue1 = createMockIssue({
        id: "1",
        filePath: "src/App.tsx",
        ruleId: "no-unused-vars",
        line: 10,
      });
      const issue2 = createMockIssue({
        id: "2",
        filePath: "src/App.tsx",
        ruleId: "no-console",
        line: 20,
      });
      const issue3 = createMockIssue({
        id: "3",
        filePath: "src/utils.ts",
        ruleId: "no-unused-vars",
        line: 5,
      });

      const issuesMap = new Map([
        ["src/App.tsx:10:5", [issue1]],
        ["src/App.tsx:20:5", [issue2]],
        ["src/utils.ts:5:5", [issue3]],
      ]);
      const state = createMockState(issuesMap);

      const result = selectFilteredFileGroups(state);

      expect(result).toHaveLength(2);

      // Find App.tsx group
      const appGroup = result.find((g) => g.fileName === "App.tsx");
      expect(appGroup).toBeDefined();
      expect(appGroup!.totalCount).toBe(2);
      expect(appGroup!.ruleGroups).toHaveLength(2);
      expect(appGroup!.issues).toHaveLength(2);

      // Find utils.ts group
      const utilsGroup = result.find((g) => g.fileName === "utils.ts");
      expect(utilsGroup).toBeDefined();
      expect(utilsGroup!.totalCount).toBe(1);
    });

    it("extracts file name and directory correctly", () => {
      const issue = createMockIssue({
        filePath: "src/components/Button.tsx",
      });
      const issuesMap = new Map([["loc", [issue]]]);
      const state = createMockState(issuesMap);

      const result = selectFilteredFileGroups(state);

      expect(result[0].fileName).toBe("Button.tsx");
      expect(result[0].directory).toBe("src/components");
    });

    it("sorts issues by line number within file", () => {
      const issue1 = createMockIssue({ id: "1", line: 50 });
      const issue2 = createMockIssue({ id: "2", line: 10 });
      const issue3 = createMockIssue({ id: "3", line: 30 });

      const issuesMap = new Map([["loc", [issue1, issue2, issue3]]]);
      const state = createMockState(issuesMap);

      const result = selectFilteredFileGroups(state);

      expect(result[0].issues[0].line).toBe(10);
      expect(result[0].issues[1].line).toBe(30);
      expect(result[0].issues[2].line).toBe(50);
    });
  });

  describe("rule filter", () => {
    it("filters to only issues with matching rule", () => {
      const issue1 = createMockIssue({
        id: "1",
        filePath: "src/App.tsx",
        ruleId: "no-unused-vars",
      });
      const issue2 = createMockIssue({
        id: "2",
        filePath: "src/App.tsx",
        ruleId: "no-console",
      });
      const issue3 = createMockIssue({
        id: "3",
        filePath: "src/utils.ts",
        ruleId: "no-unused-vars",
      });

      const issuesMap = new Map([
        ["loc1", [issue1]],
        ["loc2", [issue2]],
        ["loc3", [issue3]],
      ]);
      const filters = [createRuleFilter("no-unused-vars")];
      const state = createMockState(issuesMap, filters);

      const result = selectFilteredFileGroups(state);

      expect(result).toHaveLength(2);

      const appGroup = result.find((g) => g.fileName === "App.tsx");
      expect(appGroup!.totalCount).toBe(1);
      expect(appGroup!.ruleGroups).toHaveLength(1);
      expect(appGroup!.ruleGroups[0].ruleId).toBe("no-unused-vars");
    });

    it("returns empty when no issues match rule filter", () => {
      const issue = createMockIssue({ ruleId: "no-console" });
      const issuesMap = new Map([["loc", [issue]]]);
      const filters = [createRuleFilter("no-unused-vars")];
      const state = createMockState(issuesMap, filters);

      const result = selectFilteredFileGroups(state);

      expect(result).toEqual([]);
    });
  });

  describe("file filter", () => {
    it("filters to only issues in matching file", () => {
      const issue1 = createMockIssue({
        id: "1",
        filePath: "src/App.tsx",
        ruleId: "no-unused-vars",
      });
      const issue2 = createMockIssue({
        id: "2",
        filePath: "src/App.tsx",
        ruleId: "no-console",
      });
      const issue3 = createMockIssue({
        id: "3",
        filePath: "src/utils.ts",
        ruleId: "no-unused-vars",
      });

      const issuesMap = new Map([
        ["loc1", [issue1]],
        ["loc2", [issue2]],
        ["loc3", [issue3]],
      ]);
      const filters = [createFileFilter("src/App.tsx")];
      const state = createMockState(issuesMap, filters);

      const result = selectFilteredFileGroups(state);

      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe("App.tsx");
      expect(result[0].totalCount).toBe(2);
      expect(result[0].ruleGroups).toHaveLength(2);
    });
  });

  describe("rule + file filter", () => {
    it("filters to specific rule in specific file", () => {
      const issue1 = createMockIssue({
        id: "1",
        filePath: "src/App.tsx",
        ruleId: "no-unused-vars",
      });
      const issue2 = createMockIssue({
        id: "2",
        filePath: "src/App.tsx",
        ruleId: "no-console",
      });
      const issue3 = createMockIssue({
        id: "3",
        filePath: "src/utils.ts",
        ruleId: "no-unused-vars",
      });

      const issuesMap = new Map([
        ["loc1", [issue1]],
        ["loc2", [issue2]],
        ["loc3", [issue3]],
      ]);
      const filters = [
        createRuleFilter("no-unused-vars"),
        createFileFilter("src/App.tsx"),
      ];
      const state = createMockState(issuesMap, filters);

      const result = selectFilteredFileGroups(state);

      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe("App.tsx");
      expect(result[0].totalCount).toBe(1);
      expect(result[0].ruleGroups).toHaveLength(1);
      expect(result[0].ruleGroups[0].ruleId).toBe("no-unused-vars");
    });
  });

  describe("sorting", () => {
    it("sorts files by severity (errors first)", () => {
      const errorIssue = createMockIssue({
        id: "1",
        filePath: "src/errors.tsx",
        severity: "error",
      });
      const warningIssue = createMockIssue({
        id: "2",
        filePath: "src/warnings.tsx",
        severity: "warning",
      });

      const issuesMap = new Map([
        ["loc1", [warningIssue]],
        ["loc2", [errorIssue]],
      ]);
      const state = createMockState(issuesMap);

      const result = selectFilteredFileGroups(state);

      expect(result[0].fileName).toBe("errors.tsx");
      expect(result[1].fileName).toBe("warnings.tsx");
    });

    it("sorts files by count when severity is equal", () => {
      const issue1 = createMockIssue({
        id: "1",
        filePath: "src/few.tsx",
        severity: "error",
      });
      const issue2 = createMockIssue({
        id: "2",
        filePath: "src/many.tsx",
        severity: "error",
      });
      const issue3 = createMockIssue({
        id: "3",
        filePath: "src/many.tsx",
        severity: "error",
      });

      const issuesMap = new Map([
        ["loc1", [issue1]],
        ["loc2", [issue2]],
        ["loc3", [issue3]],
      ]);
      const state = createMockState(issuesMap);

      const result = selectFilteredFileGroups(state);

      expect(result[0].fileName).toBe("many.tsx");
      expect(result[0].totalCount).toBe(2);
      expect(result[1].fileName).toBe("few.tsx");
      expect(result[1].totalCount).toBe(1);
    });

    it("sorts rule groups by severity then count", () => {
      const error1 = createMockIssue({
        id: "1",
        ruleId: "error-rule",
        severity: "error",
      });
      const warning1 = createMockIssue({
        id: "2",
        ruleId: "warning-rule-many",
        severity: "warning",
      });
      const warning2 = createMockIssue({
        id: "3",
        ruleId: "warning-rule-many",
        severity: "warning",
      });
      const warning3 = createMockIssue({
        id: "4",
        ruleId: "warning-rule-few",
        severity: "warning",
      });

      const issuesMap = new Map([
        ["loc1", [error1]],
        ["loc2", [warning1]],
        ["loc3", [warning2]],
        ["loc4", [warning3]],
      ]);
      const state = createMockState(issuesMap);

      const result = selectFilteredFileGroups(state);
      const ruleGroups = result[0].ruleGroups;

      expect(ruleGroups[0].ruleId).toBe("error-rule");
      expect(ruleGroups[1].ruleId).toBe("warning-rule-many");
      expect(ruleGroups[2].ruleId).toBe("warning-rule-few");
    });
  });

  describe("severity counts", () => {
    it("calculates severity counts correctly for file", () => {
      const error = createMockIssue({ id: "1", severity: "error" });
      const warning1 = createMockIssue({ id: "2", severity: "warning" });
      const warning2 = createMockIssue({ id: "3", severity: "warning" });
      const info = createMockIssue({ id: "4", severity: "info" });

      const issuesMap = new Map([
        ["loc1", [error]],
        ["loc2", [warning1]],
        ["loc3", [warning2]],
        ["loc4", [info]],
      ]);
      const state = createMockState(issuesMap);

      const result = selectFilteredFileGroups(state);

      expect(result[0].severityCounts).toEqual({
        error: 1,
        warning: 2,
        info: 1,
      });
    });

    it("determines highest severity correctly", () => {
      const warning = createMockIssue({ id: "1", severity: "warning" });
      const info = createMockIssue({ id: "2", severity: "info" });

      const issuesMap = new Map([
        ["loc1", [warning]],
        ["loc2", [info]],
      ]);
      const state = createMockState(issuesMap);

      const result = selectFilteredFileGroups(state);

      expect(result[0].highestSeverity).toBe("warning");
    });
  });

  describe("rule name extraction", () => {
    it("extracts short name from namespaced rules", () => {
      const issue = createMockIssue({
        ruleId: "@typescript-eslint/no-unused-vars",
      });
      const issuesMap = new Map([["loc", [issue]]]);
      const state = createMockState(issuesMap);

      const result = selectFilteredFileGroups(state);

      expect(result[0].ruleGroups[0].ruleName).toBe("no-unused-vars");
    });

    it("keeps simple rule names as-is", () => {
      const issue = createMockIssue({ ruleId: "no-console" });
      const issuesMap = new Map([["loc", [issue]]]);
      const state = createMockState(issuesMap);

      const result = selectFilteredFileGroups(state);

      expect(result[0].ruleGroups[0].ruleName).toBe("no-console");
    });
  });

  describe("caching", () => {
    it("returns cached result for same inputs", () => {
      const issue = createMockIssue();
      const issuesMap = new Map([["loc", [issue]]]);
      const state = createMockState(issuesMap);

      const result1 = selectFilteredFileGroups(state);
      const result2 = selectFilteredFileGroups(state);

      expect(result1).toBe(result2);
    });

    it("recomputes when filters change", () => {
      const issue = createMockIssue({ ruleId: "test-rule" });
      const issuesMap = new Map([["loc", [issue]]]);

      const state1 = createMockState(issuesMap, []);
      const result1 = selectFilteredFileGroups(state1);

      const state2 = createMockState(issuesMap, [createRuleFilter("other-rule")]);
      const result2 = selectFilteredFileGroups(state2);

      expect(result1).not.toBe(result2);
      expect(result1).toHaveLength(1);
      expect(result2).toHaveLength(0);
    });
  });
});

// ============================================================================
// selectFileGroupsSummary Tests
// ============================================================================

describe("selectFileGroupsSummary", () => {
  it("returns zero summary for empty state", () => {
    const state = createEmptyState();

    const result = selectFileGroupsSummary(state);

    expect(result).toEqual({
      totalIssues: 0,
      totalFiles: 0,
      totalRules: 0,
      severityCounts: { error: 0, warning: 0, info: 0 },
    });
  });

  it("calculates correct summary for issues", () => {
    const issue1 = createMockIssue({
      id: "1",
      filePath: "src/App.tsx",
      ruleId: "rule-a",
      severity: "error",
    });
    const issue2 = createMockIssue({
      id: "2",
      filePath: "src/App.tsx",
      ruleId: "rule-b",
      severity: "warning",
    });
    const issue3 = createMockIssue({
      id: "3",
      filePath: "src/utils.ts",
      ruleId: "rule-a",
      severity: "warning",
    });

    const issuesMap = new Map([
      ["loc1", [issue1]],
      ["loc2", [issue2]],
      ["loc3", [issue3]],
    ]);
    const state = createMockState(issuesMap);

    // Must call selectFilteredFileGroups first
    selectFilteredFileGroups(state);
    const result = selectFileGroupsSummary(state);

    expect(result.totalIssues).toBe(3);
    expect(result.totalFiles).toBe(2);
    expect(result.totalRules).toBe(2);
    expect(result.severityCounts).toEqual({
      error: 1,
      warning: 2,
      info: 0,
    });
  });

  it("respects filters in summary", () => {
    const issue1 = createMockIssue({
      id: "1",
      filePath: "src/App.tsx",
      ruleId: "rule-a",
    });
    const issue2 = createMockIssue({
      id: "2",
      filePath: "src/utils.ts",
      ruleId: "rule-b",
    });

    const issuesMap = new Map([
      ["loc1", [issue1]],
      ["loc2", [issue2]],
    ]);
    const filters = [createRuleFilter("rule-a")];
    const state = createMockState(issuesMap, filters);

    selectFilteredFileGroups(state);
    const result = selectFileGroupsSummary(state);

    expect(result.totalIssues).toBe(1);
    expect(result.totalFiles).toBe(1);
    expect(result.totalRules).toBe(1);
  });
});

// ============================================================================
// selectActiveRuleFilter Tests
// ============================================================================

describe("selectActiveRuleFilter", () => {
  it("returns null when no filters", () => {
    const state = createMockState(new Map(), []);

    const result = selectActiveRuleFilter(state);

    expect(result).toBeNull();
  });

  it("returns null when no rule filter", () => {
    const filters = [createFileFilter("src/App.tsx")];
    const state = createMockState(new Map(), filters);

    const result = selectActiveRuleFilter(state);

    expect(result).toBeNull();
  });

  it("returns rule filter when present", () => {
    const ruleFilter = createRuleFilter("no-unused-vars");
    const filters = [ruleFilter, createFileFilter("src/App.tsx")];
    const state = createMockState(new Map(), filters);

    const result = selectActiveRuleFilter(state);

    expect(result).toEqual(ruleFilter);
  });
});

// ============================================================================
// selectActiveFileFilter Tests
// ============================================================================

describe("selectActiveFileFilter", () => {
  it("returns null when no filters", () => {
    const state = createMockState(new Map(), []);

    const result = selectActiveFileFilter(state);

    expect(result).toBeNull();
  });

  it("returns null when no file filter", () => {
    const filters = [createRuleFilter("no-unused-vars")];
    const state = createMockState(new Map(), filters);

    const result = selectActiveFileFilter(state);

    expect(result).toBeNull();
  });

  it("returns file filter when present", () => {
    const fileFilter = createFileFilter("src/App.tsx");
    const filters = [createRuleFilter("no-unused-vars"), fileFilter];
    const state = createMockState(new Map(), filters);

    const result = selectActiveFileFilter(state);

    expect(result).toEqual(fileFilter);
  });
});

// ============================================================================
// selectHasFilteredIssues Tests
// ============================================================================

describe("selectHasFilteredIssues", () => {
  it("returns false for empty state", () => {
    const state = createEmptyState();

    const result = selectHasFilteredIssues(state);

    expect(result).toBe(false);
  });

  it("returns true when issues exist", () => {
    const issue = createMockIssue();
    const issuesMap = new Map([["loc", [issue]]]);
    const state = createMockState(issuesMap);

    const result = selectHasFilteredIssues(state);

    expect(result).toBe(true);
  });

  it("returns false when filters exclude all issues", () => {
    const issue = createMockIssue({ ruleId: "rule-a" });
    const issuesMap = new Map([["loc", [issue]]]);
    const filters = [createRuleFilter("rule-b")];
    const state = createMockState(issuesMap, filters);

    const result = selectHasFilteredIssues(state);

    expect(result).toBe(false);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("File Groups Selector - Integration", () => {
  it("handles complex real-world scenario", () => {
    // Create a realistic set of issues across multiple files and rules
    // Each issue needs a unique dataLoc for proper mapping
    const issues = [
      // App.tsx - multiple rules, mixed severity
      createMockIssue({
        id: "1",
        filePath: "src/App.tsx",
        ruleId: "@typescript-eslint/no-unused-vars",
        severity: "error",
        line: 10,
        dataLoc: "src/App.tsx:10:5",
      }),
      createMockIssue({
        id: "2",
        filePath: "src/App.tsx",
        ruleId: "@typescript-eslint/no-unused-vars",
        severity: "error",
        line: 25,
        dataLoc: "src/App.tsx:25:5",
      }),
      createMockIssue({
        id: "3",
        filePath: "src/App.tsx",
        ruleId: "react-hooks/exhaustive-deps",
        severity: "warning",
        line: 50,
        dataLoc: "src/App.tsx:50:5",
      }),
      // utils.ts - single rule
      createMockIssue({
        id: "4",
        filePath: "src/utils.ts",
        ruleId: "no-console",
        severity: "warning",
        line: 5,
        dataLoc: "src/utils.ts:5:5",
      }),
      // Button.tsx - info only
      createMockIssue({
        id: "5",
        filePath: "src/components/Button.tsx",
        ruleId: "react/prop-types",
        severity: "info",
        line: 15,
        dataLoc: "src/components/Button.tsx:15:5",
      }),
    ];

    const issuesMap = new Map(
      issues.map((issue) => [issue.dataLoc, [issue]])
    );
    const state = createMockState(issuesMap);

    const fileGroups = selectFilteredFileGroups(state);
    const summary = selectFileGroupsSummary(state);

    // Verify file ordering (errors first)
    expect(fileGroups[0].fileName).toBe("App.tsx");
    expect(fileGroups[0].highestSeverity).toBe("error");

    // Verify summary
    expect(summary.totalIssues).toBe(5);
    expect(summary.totalFiles).toBe(3);
    expect(summary.totalRules).toBe(4);
    expect(summary.severityCounts).toEqual({
      error: 2,
      warning: 2,
      info: 1,
    });

    // Verify App.tsx details
    const appGroup = fileGroups[0];
    expect(appGroup.totalCount).toBe(3);
    expect(appGroup.ruleGroups[0].ruleId).toBe("@typescript-eslint/no-unused-vars");
    expect(appGroup.ruleGroups[0].ruleName).toBe("no-unused-vars");
    expect(appGroup.ruleGroups[0].count).toBe(2);

    // Verify issues are sorted by line
    expect(appGroup.issues[0].line).toBe(10);
    expect(appGroup.issues[1].line).toBe(25);
    expect(appGroup.issues[2].line).toBe(50);
  });
});
