/**
 * Unit tests for heatmap-selectors.ts
 *
 * Tests the Zustand selectors for computing heatmap filter state including:
 * - selectHeatmapFilter - raw heatmap filter state
 * - selectHeatmapFilterLabel - filter label string
 * - selectIsHeatmapFiltered - boolean check for active filter
 * - selectHighlightedLocs - highlighted location array
 * - selectHighlightedLocsCount - count of highlighted locations
 * - selectHeatmapDataLocs - derived dataLocs from tile filters
 * - selectHasActiveTileFilters - boolean check for active tile filters
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  selectHeatmapFilter,
  selectHeatmapFilterLabel,
  selectIsHeatmapFiltered,
  selectHighlightedLocs,
  selectHighlightedLocsCount,
  selectHeatmapDataLocs,
  selectHasActiveTileFilters,
  clearHeatmapDataLocsCache,
} from "./heatmap-selectors";
import type { ComposedState } from "./composed-store";
import type { Issue } from "../../ui/types";
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
    filePath: "file.tsx",
    line: 10,
    column: 5,
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a mock tile filter.
 */
function createMockFilter(overrides: Partial<TileFilter> = {}): TileFilter {
  return {
    type: "rule",
    id: "test-rule",
    label: "Test Rule",
    providerId: "eslint",
    ...overrides,
  };
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
  filters?: TileFilter[];
  issues?: Map<string, Issue[]>;
} = {}): ComposedState {
  return {
    heatmapFilter: {
      mode: options.heatmapFilter?.mode ?? "all",
      highlightedLocs: options.heatmapFilter?.highlightedLocs ?? [],
      filterLabel: options.heatmapFilter?.filterLabel ?? null,
    },
    commandPalette: {
      filters: options.filters ?? [],
      open: false,
      query: "",
      selectedIndex: 0,
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
// selectHeatmapDataLocs Tests
// ============================================================================

describe("selectHeatmapDataLocs", () => {
  beforeEach(() => {
    clearHeatmapDataLocsCache();
  });

  it("returns empty array when no filters are active", () => {
    const issues = new Map([
      ["file.tsx:10:5", [createMockIssue({ dataLoc: "file.tsx:10:5" })]],
    ]);
    const state = createMockState({ issues, filters: [] });

    const result = selectHeatmapDataLocs(state);

    expect(result).toEqual([]);
  });

  it("returns empty array when no issues exist", () => {
    const state = createMockState({
      filters: [createMockFilter({ type: "rule", id: "no-unused-vars" })],
      issues: new Map(),
    });

    const result = selectHeatmapDataLocs(state);

    expect(result).toEqual([]);
  });

  it("returns dataLocs matching rule filter", () => {
    const issues = new Map([
      ["file1.tsx:10:5", [createMockIssue({ dataLoc: "file1.tsx:10:5", ruleId: "no-unused-vars" })]],
      ["file2.tsx:20:10", [createMockIssue({ dataLoc: "file2.tsx:20:10", ruleId: "no-console" })]],
      ["file3.tsx:30:15", [createMockIssue({ dataLoc: "file3.tsx:30:15", ruleId: "no-unused-vars" })]],
    ]);
    const state = createMockState({
      issues,
      filters: [createMockFilter({ type: "rule", id: "no-unused-vars" })],
    });

    const result = selectHeatmapDataLocs(state);

    expect(result).toHaveLength(2);
    expect(result).toContain("file1.tsx:10:5");
    expect(result).toContain("file3.tsx:30:15");
    expect(result).not.toContain("file2.tsx:20:10");
  });

  it("returns dataLocs matching rule + file filter", () => {
    const issues = new Map([
      ["src/app.tsx:10:5", [createMockIssue({ dataLoc: "src/app.tsx:10:5", ruleId: "no-unused-vars", filePath: "src/app.tsx" })]],
      ["src/utils.ts:20:10", [createMockIssue({ dataLoc: "src/utils.ts:20:10", ruleId: "no-unused-vars", filePath: "src/utils.ts" })]],
      ["src/app.tsx:30:15", [createMockIssue({ dataLoc: "src/app.tsx:30:15", ruleId: "no-console", filePath: "src/app.tsx" })]],
    ]);
    const state = createMockState({
      issues,
      filters: [
        createMockFilter({ type: "rule", id: "no-unused-vars" }),
        createMockFilter({ type: "file", id: "src/app.tsx", label: "app.tsx" }),
      ],
    });

    const result = selectHeatmapDataLocs(state);

    expect(result).toHaveLength(1);
    expect(result).toContain("src/app.tsx:10:5");
  });

  it("returns empty when no issues match filters", () => {
    const issues = new Map([
      ["file.tsx:10:5", [createMockIssue({ dataLoc: "file.tsx:10:5", ruleId: "no-console" })]],
    ]);
    const state = createMockState({
      issues,
      filters: [createMockFilter({ type: "rule", id: "no-unused-vars" })],
    });

    const result = selectHeatmapDataLocs(state);

    expect(result).toEqual([]);
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
      filters: [createMockFilter({ type: "rule", id: "no-unused-vars" })],
    });

    const result = selectHeatmapDataLocs(state);

    // Should only include the dataLoc once
    expect(result).toEqual(["file.tsx:10:5"]);
  });

  it("returns stable reference on repeated calls with same input", () => {
    const issues = new Map([
      ["file.tsx:10:5", [createMockIssue({ ruleId: "test-rule" })]],
    ]);
    const filters = [createMockFilter({ type: "rule", id: "test-rule" })];
    const state = createMockState({ issues, filters });

    const result1 = selectHeatmapDataLocs(state);
    const result2 = selectHeatmapDataLocs(state);

    expect(result1).toBe(result2);
  });

  it("returns new reference when filters change", () => {
    const issues = new Map([
      ["file.tsx:10:5", [createMockIssue({ ruleId: "rule1" })]],
      ["file.tsx:20:10", [createMockIssue({ ruleId: "rule2", dataLoc: "file.tsx:20:10" })]],
    ]);

    const state1 = createMockState({
      issues,
      filters: [createMockFilter({ type: "rule", id: "rule1" })],
    });
    const result1 = selectHeatmapDataLocs(state1);

    clearHeatmapDataLocsCache();

    const state2 = createMockState({
      issues,
      filters: [createMockFilter({ type: "rule", id: "rule2" })],
    });
    const result2 = selectHeatmapDataLocs(state2);

    expect(result1).not.toBe(result2);
    expect(result1).toContain("file.tsx:10:5");
    expect(result2).toContain("file.tsx:20:10");
  });
});

// ============================================================================
// selectHasActiveTileFilters Tests
// ============================================================================

describe("selectHasActiveTileFilters", () => {
  it("returns false when no filters are active", () => {
    const state = createMockState({ filters: [] });

    expect(selectHasActiveTileFilters(state)).toBe(false);
  });

  it("returns true when filters are active", () => {
    const state = createMockState({
      filters: [createMockFilter()],
    });

    expect(selectHasActiveTileFilters(state)).toBe(true);
  });

  it("returns true with multiple filters", () => {
    const state = createMockState({
      filters: [
        createMockFilter({ type: "rule", id: "rule1" }),
        createMockFilter({ type: "file", id: "file1", label: "file1" }),
      ],
    });

    expect(selectHasActiveTileFilters(state)).toBe(true);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Heatmap Selectors - Integration", () => {
  beforeEach(() => {
    clearHeatmapDataLocsCache();
  });

  it("tile filters and heatmap data locs work together", () => {
    const issues = new Map([
      ["src/a.tsx:10:5", [createMockIssue({ dataLoc: "src/a.tsx:10:5", ruleId: "no-unused-vars", filePath: "src/a.tsx" })]],
      ["src/b.tsx:20:10", [createMockIssue({ dataLoc: "src/b.tsx:20:10", ruleId: "no-unused-vars", filePath: "src/b.tsx" })]],
      ["src/a.tsx:30:15", [createMockIssue({ dataLoc: "src/a.tsx:30:15", ruleId: "no-console", filePath: "src/a.tsx" })]],
    ]);

    // No filters - should return empty (show all)
    const stateNoFilters = createMockState({ issues, filters: [] });
    expect(selectHasActiveTileFilters(stateNoFilters)).toBe(false);
    expect(selectHeatmapDataLocs(stateNoFilters)).toEqual([]);

    clearHeatmapDataLocsCache();

    // Rule filter - should return dataLocs for that rule
    const stateRuleFilter = createMockState({
      issues,
      filters: [createMockFilter({ type: "rule", id: "no-unused-vars" })],
    });
    expect(selectHasActiveTileFilters(stateRuleFilter)).toBe(true);
    const ruleDataLocs = selectHeatmapDataLocs(stateRuleFilter);
    expect(ruleDataLocs).toHaveLength(2);
    expect(ruleDataLocs).toContain("src/a.tsx:10:5");
    expect(ruleDataLocs).toContain("src/b.tsx:20:10");

    clearHeatmapDataLocsCache();

    // Rule + File filter - should return dataLocs for that rule in that file
    const stateRuleFileFilter = createMockState({
      issues,
      filters: [
        createMockFilter({ type: "rule", id: "no-unused-vars" }),
        createMockFilter({ type: "file", id: "src/a.tsx", label: "a.tsx" }),
      ],
    });
    expect(selectHasActiveTileFilters(stateRuleFileFilter)).toBe(true);
    const ruleFileDataLocs = selectHeatmapDataLocs(stateRuleFileFilter);
    expect(ruleFileDataLocs).toHaveLength(1);
    expect(ruleFileDataLocs).toContain("src/a.tsx:10:5");
  });
});
