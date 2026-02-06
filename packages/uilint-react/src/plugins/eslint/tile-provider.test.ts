/**
 * ESLint Tile Provider Tests
 */

import { describe, expect, it } from "vitest";
import {
  countSeverities,
  aggregateByRule,
  aggregateByFile,
  createFilter,
  isTerminal,
} from "./tile-provider";
import type { Issue } from "../../ui/types";
import type { TileItem, TileFilter } from "../../core/plugin-system/types";
import type { AvailableRule } from "./types";

// Create a mock Issue
function createMockIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "eslint:test-rule:test.tsx:10:5:10",
    message: "Test issue message",
    severity: "warning",
    dataLoc: "test.tsx:10:5",
    ruleId: "test-rule",
    pluginId: "eslint",
    filePath: "test.tsx",
    line: 10,
    column: 5,
    ...overrides,
  };
}

// Create a mock TileItem
function createMockTileItem(overrides: Partial<TileItem> = {}): TileItem {
  return {
    id: "rule:test-rule",
    label: "Test Rule",
    count: 1,
    ...overrides,
  };
}

// Create a mock TileFilter
function createMockTileFilter(overrides: Partial<TileFilter> = {}): TileFilter {
  return {
    type: "rule",
    id: "test-rule",
    label: "Test Rule",
    providerId: "eslint",
    ...overrides,
  };
}

describe("countSeverities", () => {
  it("counts errors, warnings, and info correctly", () => {
    const issues: Issue[] = [
      createMockIssue({ severity: "error" }),
      createMockIssue({ severity: "error" }),
      createMockIssue({ severity: "warning" }),
      createMockIssue({ severity: "warning" }),
      createMockIssue({ severity: "warning" }),
      createMockIssue({ severity: "info" }),
    ];

    const result = countSeverities(issues);

    expect(result.error).toBe(2);
    expect(result.warning).toBe(3);
    expect(result.info).toBe(1);
  });

  it("returns zeros for empty array", () => {
    const result = countSeverities([]);

    expect(result.error).toBe(0);
    expect(result.warning).toBe(0);
    expect(result.info).toBe(0);
  });

  it("handles single severity type", () => {
    const issues: Issue[] = [
      createMockIssue({ severity: "error" }),
      createMockIssue({ severity: "error" }),
    ];

    const result = countSeverities(issues);

    expect(result.error).toBe(2);
    expect(result.warning).toBe(0);
    expect(result.info).toBe(0);
  });
});

describe("aggregateByRule", () => {
  it("groups issues by ruleId", () => {
    const issues: Issue[] = [
      createMockIssue({ ruleId: "rule-a", severity: "error" }),
      createMockIssue({ ruleId: "rule-a", severity: "warning" }),
      createMockIssue({ ruleId: "rule-b", severity: "error" }),
    ];

    const result = aggregateByRule(issues);

    expect(result).toHaveLength(2);

    const ruleATile = result.find((t) => t.metadata?.ruleId === "rule-a");
    const ruleBTile = result.find((t) => t.metadata?.ruleId === "rule-b");

    expect(ruleATile).toBeDefined();
    expect(ruleBTile).toBeDefined();
  });

  it("returns correct count per rule", () => {
    const issues: Issue[] = [
      createMockIssue({ ruleId: "rule-a" }),
      createMockIssue({ ruleId: "rule-a" }),
      createMockIssue({ ruleId: "rule-a" }),
      createMockIssue({ ruleId: "rule-b" }),
    ];

    const result = aggregateByRule(issues);

    const ruleATile = result.find((t) => t.metadata?.ruleId === "rule-a");
    const ruleBTile = result.find((t) => t.metadata?.ruleId === "rule-b");

    expect(ruleATile?.count).toBe(3);
    expect(ruleBTile?.count).toBe(1);
  });

  it("includes severity breakdown", () => {
    const issues: Issue[] = [
      createMockIssue({ ruleId: "rule-a", severity: "error" }),
      createMockIssue({ ruleId: "rule-a", severity: "error" }),
      createMockIssue({ ruleId: "rule-a", severity: "warning" }),
      createMockIssue({ ruleId: "rule-a", severity: "info" }),
    ];

    const result = aggregateByRule(issues);

    expect(result).toHaveLength(1);
    expect(result[0].severityCounts).toEqual({
      error: 2,
      warning: 1,
      info: 1,
    });
  });

  it("sets metadata.isRule = true", () => {
    const issues: Issue[] = [createMockIssue({ ruleId: "rule-a" })];

    const result = aggregateByRule(issues);

    expect(result[0].metadata?.isRule).toBe(true);
    expect(result[0].metadata?.ruleId).toBe("rule-a");
  });

  it("handles empty issues array", () => {
    const result = aggregateByRule([]);

    expect(result).toEqual([]);
  });

  it("uses available rules metadata for label and subtitle", () => {
    const issues: Issue[] = [createMockIssue({ ruleId: "test-rule" })];
    const availableRules: AvailableRule[] = [
      {
        id: "test-rule",
        name: "Test Rule Name",
        description: "A description of the test rule",
        category: "static",
        defaultSeverity: "warn",
      },
    ];

    const result = aggregateByRule(issues, availableRules);

    expect(result[0].label).toBe("Test Rule Name");
    expect(result[0].subtitle).toBe("A description of the test rule");
  });

  it("extracts short name from scoped rule IDs", () => {
    const issues: Issue[] = [
      createMockIssue({ ruleId: "@typescript-eslint/no-unused-vars" }),
    ];

    const result = aggregateByRule(issues);

    expect(result[0].label).toBe("no-unused-vars");
  });

  it("sorts by error count then total count descending", () => {
    const issues: Issue[] = [
      createMockIssue({ ruleId: "rule-a", severity: "warning" }),
      createMockIssue({ ruleId: "rule-a", severity: "warning" }),
      createMockIssue({ ruleId: "rule-b", severity: "error" }),
      createMockIssue({ ruleId: "rule-c", severity: "warning" }),
      createMockIssue({ ruleId: "rule-c", severity: "warning" }),
      createMockIssue({ ruleId: "rule-c", severity: "warning" }),
    ];

    const result = aggregateByRule(issues);

    // rule-b has 1 error (highest priority)
    // rule-c has 3 warnings (most issues)
    // rule-a has 2 warnings
    expect(result[0].metadata?.ruleId).toBe("rule-b");
    expect(result[1].metadata?.ruleId).toBe("rule-c");
    expect(result[2].metadata?.ruleId).toBe("rule-a");
  });
});

describe("aggregateByFile", () => {
  it("filters to only the specified ruleId", () => {
    const issues: Issue[] = [
      createMockIssue({ ruleId: "rule-a", filePath: "file1.tsx" }),
      createMockIssue({ ruleId: "rule-b", filePath: "file2.tsx" }),
      createMockIssue({ ruleId: "rule-a", filePath: "file3.tsx" }),
    ];

    const result = aggregateByFile(issues, "rule-a");

    expect(result).toHaveLength(2);
    expect(result.every((t) => t.metadata?.ruleId === "rule-a")).toBe(true);
  });

  it("groups by filePath", () => {
    const issues: Issue[] = [
      createMockIssue({ ruleId: "rule-a", filePath: "src/file1.tsx" }),
      createMockIssue({ ruleId: "rule-a", filePath: "src/file1.tsx" }),
      createMockIssue({ ruleId: "rule-a", filePath: "src/file2.tsx" }),
    ];

    const result = aggregateByFile(issues, "rule-a");

    expect(result).toHaveLength(2);

    const file1Tile = result.find((t) => t.metadata?.filePath === "src/file1.tsx");
    const file2Tile = result.find((t) => t.metadata?.filePath === "src/file2.tsx");

    expect(file1Tile?.count).toBe(2);
    expect(file2Tile?.count).toBe(1);
  });

  it("returns filename as label, full path as subtitle", () => {
    const issues: Issue[] = [
      createMockIssue({ ruleId: "rule-a", filePath: "src/components/Button.tsx" }),
    ];

    const result = aggregateByFile(issues, "rule-a");

    expect(result[0].label).toBe("Button.tsx");
    expect(result[0].subtitle).toBe("src/components/Button.tsx");
  });

  it("sets metadata.isFile = true and metadata.ruleId", () => {
    const issues: Issue[] = [
      createMockIssue({ ruleId: "rule-a", filePath: "file.tsx" }),
    ];

    const result = aggregateByFile(issues, "rule-a");

    expect(result[0].metadata?.isFile).toBe(true);
    expect(result[0].metadata?.filePath).toBe("file.tsx");
    expect(result[0].metadata?.ruleId).toBe("rule-a");
  });

  it("handles empty issues array", () => {
    const result = aggregateByFile([], "rule-a");

    expect(result).toEqual([]);
  });

  it("handles no matching issues for ruleId", () => {
    const issues: Issue[] = [
      createMockIssue({ ruleId: "rule-b", filePath: "file.tsx" }),
    ];

    const result = aggregateByFile(issues, "rule-a");

    expect(result).toEqual([]);
  });

  it("handles file at root level", () => {
    const issues: Issue[] = [
      createMockIssue({ ruleId: "rule-a", filePath: "file.tsx" }),
    ];

    const result = aggregateByFile(issues, "rule-a");

    expect(result[0].label).toBe("file.tsx");
    expect(result[0].subtitle).toBe("file.tsx");
  });

  it("includes severity breakdown per file", () => {
    const issues: Issue[] = [
      createMockIssue({ ruleId: "rule-a", filePath: "file.tsx", severity: "error" }),
      createMockIssue({ ruleId: "rule-a", filePath: "file.tsx", severity: "warning" }),
      createMockIssue({ ruleId: "rule-a", filePath: "file.tsx", severity: "info" }),
    ];

    const result = aggregateByFile(issues, "rule-a");

    expect(result[0].severityCounts).toEqual({
      error: 1,
      warning: 1,
      info: 1,
    });
  });

  it("creates unique id with file and rule", () => {
    const issues: Issue[] = [
      createMockIssue({ ruleId: "rule-a", filePath: "src/file.tsx" }),
    ];

    const result = aggregateByFile(issues, "rule-a");

    expect(result[0].id).toBe("file:src/file.tsx:rule-a");
  });
});

describe("createFilter", () => {
  it("returns type='rule' for items with isRule metadata", () => {
    const item = createMockTileItem({
      id: "rule:no-unused-vars",
      label: "No Unused Vars",
      metadata: {
        isRule: true,
        ruleId: "no-unused-vars",
      },
    });

    const result = createFilter(item);

    expect(result.type).toBe("rule");
    expect(result.id).toBe("no-unused-vars");
    expect(result.label).toBe("No Unused Vars");
    expect(result.providerId).toBe("eslint");
  });

  it("returns type='file' for items with isFile metadata", () => {
    const item = createMockTileItem({
      id: "file:src/Button.tsx:rule-a",
      label: "Button.tsx",
      metadata: {
        isFile: true,
        filePath: "src/Button.tsx",
        ruleId: "rule-a",
      },
    });

    const result = createFilter(item);

    expect(result.type).toBe("file");
    expect(result.id).toBe("src/Button.tsx");
    expect(result.label).toBe("Button.tsx");
    expect(result.providerId).toBe("eslint");
  });

  it("sets correct id and label from item", () => {
    const item = createMockTileItem({
      id: "rule:@typescript-eslint/no-explicit-any",
      label: "No Explicit Any",
      metadata: {
        isRule: true,
        ruleId: "@typescript-eslint/no-explicit-any",
      },
    });

    const result = createFilter(item);

    expect(result.id).toBe("@typescript-eslint/no-explicit-any");
    expect(result.label).toBe("No Explicit Any");
  });

  it("returns fallback filter for unknown tile types", () => {
    const item = createMockTileItem({
      id: "unknown:something",
      label: "Unknown Item",
      metadata: {},
    });

    const result = createFilter(item);

    expect(result.type).toBe("scope");
    expect(result.id).toBe("unknown:something");
    expect(result.label).toBe("Unknown Item");
  });

  it("handles item with no metadata", () => {
    const item = createMockTileItem({
      id: "test-id",
      label: "Test Label",
      metadata: undefined,
    });

    const result = createFilter(item);

    expect(result.type).toBe("scope");
    expect(result.id).toBe("test-id");
    expect(result.label).toBe("Test Label");
  });
});

describe("isTerminal", () => {
  it("returns false with no filters", () => {
    const result = isTerminal([]);

    expect(result).toBe(false);
  });

  it("returns false with only rule filter", () => {
    const filters: TileFilter[] = [
      createMockTileFilter({ type: "rule", id: "rule-a" }),
    ];

    const result = isTerminal(filters);

    expect(result).toBe(false);
  });

  it("returns false with only file filter", () => {
    const filters: TileFilter[] = [
      createMockTileFilter({ type: "file", id: "file.tsx" }),
    ];

    const result = isTerminal(filters);

    expect(result).toBe(false);
  });

  it("returns true with both rule AND file filters", () => {
    const filters: TileFilter[] = [
      createMockTileFilter({ type: "rule", id: "rule-a" }),
      createMockTileFilter({ type: "file", id: "file.tsx" }),
    ];

    const result = isTerminal(filters);

    expect(result).toBe(true);
  });

  it("returns true regardless of filter order", () => {
    const filters: TileFilter[] = [
      createMockTileFilter({ type: "file", id: "file.tsx" }),
      createMockTileFilter({ type: "rule", id: "rule-a" }),
    ];

    const result = isTerminal(filters);

    expect(result).toBe(true);
  });

  it("returns false with other filter types", () => {
    const filters: TileFilter[] = [
      createMockTileFilter({ type: "scope", id: "scope-a" }),
      createMockTileFilter({ type: "severity", id: "error" }),
    ];

    const result = isTerminal(filters);

    expect(result).toBe(false);
  });

  it("returns true with rule and file among other filters", () => {
    const filters: TileFilter[] = [
      createMockTileFilter({ type: "scope", id: "scope-a" }),
      createMockTileFilter({ type: "rule", id: "rule-a" }),
      createMockTileFilter({ type: "file", id: "file.tsx" }),
    ];

    const result = isTerminal(filters);

    expect(result).toBe(true);
  });
});
