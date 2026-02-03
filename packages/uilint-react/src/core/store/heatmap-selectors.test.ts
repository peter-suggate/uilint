/**
 * Unit tests for heatmap-selectors.ts
 *
 * Tests the Zustand selectors for computing heatmap state including:
 * - selectHeatmapFilter - raw heatmap filter state
 * - selectHeatmapFilterLabel - filter label string
 * - selectIsHeatmapFiltered - boolean check for active filter
 * - selectHighlightedLocs - highlighted location array
 * - selectHighlightedLocsCount - count of highlighted locations
 * - selectSelectedDataLocs - derived dataLocs from expansion state (additive model)
 * - selectHasActiveSelection - boolean check for active selection
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  selectHeatmapFilter,
  selectHeatmapFilterLabel,
  selectIsHeatmapFiltered,
  selectHighlightedLocs,
  selectHighlightedLocsCount,
  selectSelectedDataLocs,
  selectHasActiveSelection,
  clearSelectedDataLocsCache,
} from "./heatmap-selectors";
import type { ComposedState } from "./composed-store";
import type { Issue } from "../../ui/types";

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
    filePath: "file.tsx",
    line: 10,
    column: 5,
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a mock ComposedState with optional heatmap and issues state.
 */
function createMockState(options: {
  heatmapFilter?: {
    mode?: "all" | "related-only";
    highlightedLocs?: string[];
    filterLabel?: string | null;
  };
  expandedRuleId?: string | null;
  expandedFilePath?: string | null;
  issues?: Map<string, Issue[]>;
} = {}): ComposedState {
  return {
    heatmapFilter: {
      mode: options.heatmapFilter?.mode ?? "all",
      highlightedLocs: options.heatmapFilter?.highlightedLocs ?? [],
      filterLabel: options.heatmapFilter?.filterLabel ?? null,
    },
    inspector: {
      expandedRuleId: options.expandedRuleId ?? null,
      expandedFilePath: options.expandedFilePath ?? null,
    },
    plugins: {
      eslint: {
        issues: options.issues ?? new Map(),
      },
    },
  } as unknown as ComposedState;
}

// ============================================================================
// selectHeatmapFilter Tests
// ============================================================================

describe("selectHeatmapFilter", () => {
  it("returns the heatmap filter state", () => {
    const state = createMockState({
      heatmapFilter: {
        mode: "related-only",
        highlightedLocs: ["file.tsx:10:5"],
        filterLabel: "Test Label",
      },
    });

    const result = selectHeatmapFilter(state);

    expect(result.mode).toBe("related-only");
    expect(result.highlightedLocs).toEqual(["file.tsx:10:5"]);
    expect(result.filterLabel).toBe("Test Label");
  });

  it("returns default values", () => {
    const state = createMockState();

    const result = selectHeatmapFilter(state);

    expect(result.mode).toBe("all");
    expect(result.highlightedLocs).toEqual([]);
    expect(result.filterLabel).toBeNull();
  });
});

// ============================================================================
// selectHeatmapFilterLabel Tests
// ============================================================================

describe("selectHeatmapFilterLabel", () => {
  it("returns the filter label when set", () => {
    const state = createMockState({
      heatmapFilter: { filterLabel: "Duplicate Pair" },
    });

    expect(selectHeatmapFilterLabel(state)).toBe("Duplicate Pair");
  });

  it("returns null when no label is set", () => {
    const state = createMockState();

    expect(selectHeatmapFilterLabel(state)).toBeNull();
  });
});

// ============================================================================
// selectIsHeatmapFiltered Tests
// ============================================================================

describe("selectIsHeatmapFiltered", () => {
  it("returns false when mode is 'all'", () => {
    const state = createMockState({
      heatmapFilter: {
        mode: "all",
        highlightedLocs: ["file.tsx:10:5"],
      },
    });

    expect(selectIsHeatmapFiltered(state)).toBe(false);
  });

  it("returns false when highlightedLocs is empty", () => {
    const state = createMockState({
      heatmapFilter: {
        mode: "related-only",
        highlightedLocs: [],
      },
    });

    expect(selectIsHeatmapFiltered(state)).toBe(false);
  });

  it("returns true when mode is 'related-only' and has highlighted locs", () => {
    const state = createMockState({
      heatmapFilter: {
        mode: "related-only",
        highlightedLocs: ["file.tsx:10:5"],
      },
    });

    expect(selectIsHeatmapFiltered(state)).toBe(true);
  });
});

// ============================================================================
// selectHighlightedLocs Tests
// ============================================================================

describe("selectHighlightedLocs", () => {
  it("returns the highlighted locations array", () => {
    const locs = ["file1.tsx:10:5", "file2.tsx:20:10"];
    const state = createMockState({
      heatmapFilter: { highlightedLocs: locs },
    });

    expect(selectHighlightedLocs(state)).toEqual(locs);
  });

  it("returns empty array when no locs are highlighted", () => {
    const state = createMockState();

    expect(selectHighlightedLocs(state)).toEqual([]);
  });
});

// ============================================================================
// selectHighlightedLocsCount Tests
// ============================================================================

describe("selectHighlightedLocsCount", () => {
  it("returns the count of highlighted locations", () => {
    const state = createMockState({
      heatmapFilter: {
        highlightedLocs: ["a:1:1", "b:2:2", "c:3:3"],
      },
    });

    expect(selectHighlightedLocsCount(state)).toBe(3);
  });

  it("returns 0 when no locs are highlighted", () => {
    const state = createMockState();

    expect(selectHighlightedLocsCount(state)).toBe(0);
  });
});

// ============================================================================
// selectSelectedDataLocs Tests (Additive Selection Model)
// ============================================================================

describe("selectSelectedDataLocs", () => {
  beforeEach(() => {
    clearSelectedDataLocsCache();
  });

  it("returns empty set when no rule is expanded", () => {
    const issues = new Map([
      ["file.tsx:10:5", [createMockIssue({ dataLoc: "file.tsx:10:5" })]],
    ]);
    const state = createMockState({ issues, expandedRuleId: null });

    const result = selectSelectedDataLocs(state);

    expect(result.size).toBe(0);
  });

  it("returns empty set when no issues exist", () => {
    const state = createMockState({
      expandedRuleId: "no-unused-vars",
      issues: new Map(),
    });

    const result = selectSelectedDataLocs(state);

    expect(result.size).toBe(0);
  });

  it("returns dataLocs matching expanded rule", () => {
    const issues = new Map([
      ["file1.tsx:10:5", [createMockIssue({ dataLoc: "file1.tsx:10:5", ruleId: "no-unused-vars" })]],
      ["file2.tsx:20:10", [createMockIssue({ dataLoc: "file2.tsx:20:10", ruleId: "no-console" })]],
      ["file3.tsx:30:15", [createMockIssue({ dataLoc: "file3.tsx:30:15", ruleId: "no-unused-vars" })]],
    ]);
    const state = createMockState({
      issues,
      expandedRuleId: "no-unused-vars",
    });

    const result = selectSelectedDataLocs(state);

    expect(result.size).toBe(2);
    expect(result.has("file1.tsx:10:5")).toBe(true);
    expect(result.has("file3.tsx:30:15")).toBe(true);
    expect(result.has("file2.tsx:20:10")).toBe(false);
  });

  it("returns dataLocs matching expanded rule + file", () => {
    const issues = new Map([
      ["src/app.tsx:10:5", [createMockIssue({ dataLoc: "src/app.tsx:10:5", ruleId: "no-unused-vars", filePath: "src/app.tsx" })]],
      ["src/utils.ts:20:10", [createMockIssue({ dataLoc: "src/utils.ts:20:10", ruleId: "no-unused-vars", filePath: "src/utils.ts" })]],
      ["src/app.tsx:30:15", [createMockIssue({ dataLoc: "src/app.tsx:30:15", ruleId: "no-console", filePath: "src/app.tsx" })]],
    ]);
    const state = createMockState({
      issues,
      expandedRuleId: "no-unused-vars",
      expandedFilePath: "src/app.tsx",
    });

    const result = selectSelectedDataLocs(state);

    expect(result.size).toBe(1);
    expect(result.has("src/app.tsx:10:5")).toBe(true);
  });

  it("returns empty set when no issues match expanded rule", () => {
    const issues = new Map([
      ["file.tsx:10:5", [createMockIssue({ dataLoc: "file.tsx:10:5", ruleId: "no-console" })]],
    ]);
    const state = createMockState({
      issues,
      expandedRuleId: "no-unused-vars",
    });

    const result = selectSelectedDataLocs(state);

    expect(result.size).toBe(0);
  });

  it("handles multiple issues at same dataLoc", () => {
    const issues = new Map([
      ["file.tsx:10:5", [
        createMockIssue({ id: "1", dataLoc: "file.tsx:10:5", ruleId: "no-unused-vars" }),
        createMockIssue({ id: "2", dataLoc: "file.tsx:10:5", ruleId: "no-console" }),
      ]],
    ]);
    const state = createMockState({
      issues,
      expandedRuleId: "no-unused-vars",
    });

    const result = selectSelectedDataLocs(state);

    // Should only include the dataLoc once
    expect(result.size).toBe(1);
    expect(result.has("file.tsx:10:5")).toBe(true);
  });

  it("returns stable reference on repeated calls with same input", () => {
    const issues = new Map([
      ["file.tsx:10:5", [createMockIssue({ ruleId: "test-rule" })]],
    ]);
    const state = createMockState({ issues, expandedRuleId: "test-rule" });

    const result1 = selectSelectedDataLocs(state);
    const result2 = selectSelectedDataLocs(state);

    expect(result1).toBe(result2);
  });

  it("returns new reference when expanded rule changes", () => {
    const issues = new Map([
      ["file.tsx:10:5", [createMockIssue({ ruleId: "rule1" })]],
      ["file.tsx:20:10", [createMockIssue({ ruleId: "rule2", dataLoc: "file.tsx:20:10" })]],
    ]);

    const state1 = createMockState({
      issues,
      expandedRuleId: "rule1",
    });
    const result1 = selectSelectedDataLocs(state1);

    clearSelectedDataLocsCache();

    const state2 = createMockState({
      issues,
      expandedRuleId: "rule2",
    });
    const result2 = selectSelectedDataLocs(state2);

    expect(result1).not.toBe(result2);
    expect(result1.has("file.tsx:10:5")).toBe(true);
    expect(result2.has("file.tsx:20:10")).toBe(true);
  });
});

// ============================================================================
// selectHasActiveSelection Tests
// ============================================================================

describe("selectHasActiveSelection", () => {
  it("returns false when no rule is expanded", () => {
    const state = createMockState({ expandedRuleId: null });

    expect(selectHasActiveSelection(state)).toBe(false);
  });

  it("returns true when a rule is expanded", () => {
    const state = createMockState({
      expandedRuleId: "no-unused-vars",
    });

    expect(selectHasActiveSelection(state)).toBe(true);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Heatmap Selectors - Additive Selection Integration", () => {
  beforeEach(() => {
    clearSelectedDataLocsCache();
  });

  it("selection state and selected data locs work together", () => {
    const issues = new Map([
      ["src/a.tsx:10:5", [createMockIssue({ dataLoc: "src/a.tsx:10:5", ruleId: "no-unused-vars", filePath: "src/a.tsx" })]],
      ["src/b.tsx:20:10", [createMockIssue({ dataLoc: "src/b.tsx:20:10", ruleId: "no-unused-vars", filePath: "src/b.tsx" })]],
      ["src/a.tsx:30:15", [createMockIssue({ dataLoc: "src/a.tsx:30:15", ruleId: "no-console", filePath: "src/a.tsx" })]],
    ]);

    // No expansion - should return empty (all elements equal emphasis)
    const stateNoExpansion = createMockState({ issues, expandedRuleId: null });
    expect(selectHasActiveSelection(stateNoExpansion)).toBe(false);
    expect(selectSelectedDataLocs(stateNoExpansion).size).toBe(0);

    clearSelectedDataLocsCache();

    // Rule expanded - should return dataLocs for that rule
    const stateRuleExpanded = createMockState({
      issues,
      expandedRuleId: "no-unused-vars",
    });
    expect(selectHasActiveSelection(stateRuleExpanded)).toBe(true);
    const ruleDataLocs = selectSelectedDataLocs(stateRuleExpanded);
    expect(ruleDataLocs.size).toBe(2);
    expect(ruleDataLocs.has("src/a.tsx:10:5")).toBe(true);
    expect(ruleDataLocs.has("src/b.tsx:20:10")).toBe(true);

    clearSelectedDataLocsCache();

    // Rule + File expanded - should return dataLocs for that rule in that file
    const stateRuleFileExpanded = createMockState({
      issues,
      expandedRuleId: "no-unused-vars",
      expandedFilePath: "src/a.tsx",
    });
    expect(selectHasActiveSelection(stateRuleFileExpanded)).toBe(true);
    const ruleFileDataLocs = selectSelectedDataLocs(stateRuleFileExpanded);
    expect(ruleFileDataLocs.size).toBe(1);
    expect(ruleFileDataLocs.has("src/a.tsx:10:5")).toBe(true);
  });

  it("drill-down flow: rule → file progressively narrows emphasis", () => {
    const issues = new Map([
      ["src/a.tsx:10:5", [createMockIssue({ dataLoc: "src/a.tsx:10:5", ruleId: "no-unused-vars", filePath: "src/a.tsx" })]],
      ["src/a.tsx:20:10", [createMockIssue({ dataLoc: "src/a.tsx:20:10", ruleId: "no-unused-vars", filePath: "src/a.tsx" })]],
      ["src/b.tsx:30:15", [createMockIssue({ dataLoc: "src/b.tsx:30:15", ruleId: "no-unused-vars", filePath: "src/b.tsx" })]],
    ]);

    // Step 1: Rule expanded only - emphasizes all 3 locations
    const stateRuleOnly = createMockState({
      issues,
      expandedRuleId: "no-unused-vars",
    });
    const ruleOnlyLocs = selectSelectedDataLocs(stateRuleOnly);
    expect(ruleOnlyLocs.size).toBe(3);

    clearSelectedDataLocsCache();

    // Step 2: Rule + File expanded - narrows to 2 locations in src/a.tsx
    const stateRuleFile = createMockState({
      issues,
      expandedRuleId: "no-unused-vars",
      expandedFilePath: "src/a.tsx",
    });
    const ruleFileLocs = selectSelectedDataLocs(stateRuleFile);
    expect(ruleFileLocs.size).toBe(2);
    expect(ruleFileLocs.has("src/a.tsx:10:5")).toBe(true);
    expect(ruleFileLocs.has("src/a.tsx:20:10")).toBe(true);
    expect(ruleFileLocs.has("src/b.tsx:30:15")).toBe(false);
  });
});
