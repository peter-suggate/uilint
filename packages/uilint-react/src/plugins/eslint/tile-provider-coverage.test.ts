/**
 * Tests for tile-provider functions that exercise the aggregation and
 * sorting behavior with real data, no mocks.
 */
import { describe, it, expect } from "vitest";
import {
  countSeverities,
  aggregateByRule,
  aggregateByFile,
  aggregateByFileGlobal,
  getAllTilesFlat,
  createFilter,
  isTerminal,
  getInspectorData,
  canExpand,
  aggregateIssuesForFile,
} from "./tile-provider";
import type { Issue } from "../../ui/types";

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "issue-1",
    message: "Test issue",
    severity: "warning",
    dataLoc: "src/App.tsx:10:5",
    ruleId: "no-unused-vars",
    pluginId: "eslint",
    filePath: "src/App.tsx",
    line: 10,
    ...overrides,
  };
}

describe("countSeverities", () => {
  it("returns zeros for empty array", () => {
    expect(countSeverities([])).toEqual({ error: 0, warning: 0, info: 0 });
  });

  it("counts each severity type", () => {
    const issues = [
      makeIssue({ severity: "error" }),
      makeIssue({ severity: "error" }),
      makeIssue({ severity: "warning" }),
      makeIssue({ severity: "info" }),
    ];
    expect(countSeverities(issues)).toEqual({ error: 2, warning: 1, info: 1 });
  });
});

describe("aggregateByRule", () => {
  it("returns empty array for no issues", () => {
    expect(aggregateByRule([])).toEqual([]);
  });

  it("groups issues by ruleId", () => {
    const issues = [
      makeIssue({ ruleId: "no-unused-vars" }),
      makeIssue({ ruleId: "no-unused-vars", id: "i2" }),
      makeIssue({ ruleId: "prefer-const", id: "i3" }),
    ];

    const tiles = aggregateByRule(issues);

    expect(tiles).toHaveLength(2);
    const noUnused = tiles.find((t) => t.metadata?.ruleId === "no-unused-vars");
    expect(noUnused!.count).toBe(2);
  });

  it("uses rule metadata for label and description when available", () => {
    const issues = [makeIssue({ ruleId: "my-rule" })];
    const rules = [{ id: "my-rule", name: "My Rule", description: "Desc" }];

    const tiles = aggregateByRule(issues, rules);

    expect(tiles[0].label).toBe("My Rule");
    expect(tiles[0].subtitle).toBe("Desc");
  });

  it("extracts short name from scoped rules", () => {
    const issues = [makeIssue({ ruleId: "@typescript-eslint/no-unused-vars" })];
    const tiles = aggregateByRule(issues);

    expect(tiles[0].label).toBe("no-unused-vars");
  });

  it("sorts by error count descending, then by total count", () => {
    const issues = [
      makeIssue({ ruleId: "rule-a", severity: "warning" }),
      makeIssue({ ruleId: "rule-a", severity: "warning", id: "i2" }),
      makeIssue({ ruleId: "rule-a", severity: "warning", id: "i3" }),
      makeIssue({ ruleId: "rule-b", severity: "error", id: "i4" }),
    ];

    const tiles = aggregateByRule(issues);

    // rule-b has 1 error, rule-a has 0 errors but 3 total
    expect(tiles[0].metadata?.ruleId).toBe("rule-b");
    expect(tiles[1].metadata?.ruleId).toBe("rule-a");
  });
});

describe("aggregateByFile", () => {
  it("groups issues by filePath for a given rule", () => {
    const issues = [
      makeIssue({ ruleId: "r1", filePath: "a.ts" }),
      makeIssue({ ruleId: "r1", filePath: "a.ts", id: "i2" }),
      makeIssue({ ruleId: "r1", filePath: "b.ts", id: "i3" }),
      makeIssue({ ruleId: "r2", filePath: "a.ts", id: "i4" }), // different rule
    ];

    const tiles = aggregateByFile(issues, "r1");

    expect(tiles).toHaveLength(2);
    const aFile = tiles.find((t) => t.metadata?.filePath === "a.ts");
    expect(aFile!.count).toBe(2);
  });

  it("extracts filename for label", () => {
    const issues = [makeIssue({ ruleId: "r1", filePath: "src/components/Button.tsx" })];
    const tiles = aggregateByFile(issues, "r1");

    expect(tiles[0].label).toBe("Button.tsx");
  });
});

describe("aggregateByFileGlobal", () => {
  it("groups all issues by file across all rules", () => {
    const issues = [
      makeIssue({ ruleId: "r1", filePath: "a.ts" }),
      makeIssue({ ruleId: "r2", filePath: "a.ts", id: "i2" }),
      makeIssue({ ruleId: "r1", filePath: "b.ts", id: "i3" }),
    ];

    const tiles = aggregateByFileGlobal(issues);

    expect(tiles).toHaveLength(2);
    const aFile = tiles.find((t) => t.metadata?.filePath === "a.ts");
    expect(aFile!.count).toBe(2);
    expect(aFile!.metadata?.ruleCount).toBe(2);
  });
});

describe("getAllTilesFlat", () => {
  it("returns empty array for no issues", () => {
    expect(getAllTilesFlat([])).toEqual([]);
  });

  it("combines rule tiles and file tiles", () => {
    const issues = [
      makeIssue({ ruleId: "r1", filePath: "a.ts" }),
      makeIssue({ ruleId: "r1", filePath: "b.ts", id: "i2" }),
    ];

    const tiles = getAllTilesFlat(issues);

    const ruleTiles = tiles.filter((t) => t.metadata?.isRule);
    const fileTiles = tiles.filter((t) => t.metadata?.isFile);

    expect(ruleTiles.length).toBeGreaterThanOrEqual(1);
    expect(fileTiles.length).toBeGreaterThanOrEqual(1);
  });

  it("sorts all tiles by error count then total count", () => {
    const issues = [
      makeIssue({ ruleId: "r1", filePath: "a.ts", severity: "error" }),
      makeIssue({ ruleId: "r2", filePath: "b.ts", severity: "warning", id: "i2" }),
      makeIssue({ ruleId: "r2", filePath: "b.ts", severity: "warning", id: "i3" }),
    ];

    const tiles = getAllTilesFlat(issues);

    // Tiles with errors should come first
    const firstTile = tiles[0];
    expect(firstTile.severityCounts?.error).toBeGreaterThanOrEqual(1);
  });
});

describe("createFilter", () => {
  it("creates a rule filter for rule tiles", () => {
    const filter = createFilter({
      id: "rule:no-unused-vars",
      label: "no-unused-vars",
      subtitle: "",
      count: 5,
      metadata: { isRule: true, ruleId: "no-unused-vars" },
    });

    expect(filter.type).toBe("rule");
    expect(filter.id).toBe("no-unused-vars");
    expect(filter.providerId).toBe("eslint");
  });

  it("creates a file filter for file tiles", () => {
    const filter = createFilter({
      id: "file:src/App.tsx",
      label: "App.tsx",
      subtitle: "src/App.tsx",
      count: 3,
      metadata: { isFile: true, filePath: "src/App.tsx" },
    });

    expect(filter.type).toBe("file");
    expect(filter.id).toBe("src/App.tsx");
  });

  it("creates a scope filter for unknown tile types", () => {
    const filter = createFilter({
      id: "unknown:x",
      label: "Unknown",
      subtitle: "",
      count: 1,
      metadata: {},
    });

    expect(filter.type).toBe("scope");
  });
});

describe("isTerminal", () => {
  it("returns true when both rule and file filters are present", () => {
    expect(
      isTerminal([
        { type: "rule", id: "r1", label: "R1", providerId: "eslint" },
        { type: "file", id: "f1", label: "F1", providerId: "eslint" },
      ])
    ).toBe(true);
  });

  it("returns false with only rule filter", () => {
    expect(
      isTerminal([{ type: "rule", id: "r1", label: "R1", providerId: "eslint" }])
    ).toBe(false);
  });

  it("returns false with empty filters", () => {
    expect(isTerminal([])).toBe(false);
  });
});

describe("getInspectorData", () => {
  it("returns rule panel data for rule tiles", () => {
    const result = getInspectorData({
      id: "rule:r1",
      label: "R1",
      subtitle: "",
      count: 1,
      metadata: { isRule: true, ruleId: "no-unused-vars" },
    });

    expect(result.panelId).toBe("eslint-rule");
    expect(result.data.ruleId).toBe("no-unused-vars");
  });

  it("returns file data for file tiles", () => {
    const result = getInspectorData({
      id: "file:a.ts:r1",
      label: "a.ts",
      subtitle: "",
      count: 1,
      metadata: { isFile: true, filePath: "a.ts", ruleId: "r1" },
    });

    expect(result.data.filePath).toBe("a.ts");
    expect(result.data.ruleId).toBe("r1");
  });

  it("returns issue data for issue tiles", () => {
    const result = getInspectorData({
      id: "issue:i1",
      label: "msg",
      subtitle: "",
      count: 1,
      metadata: { isIssue: true, ruleId: "r1", filePath: "a.ts", issueId: "i1", line: 10 },
    });

    expect(result.data.issueId).toBe("i1");
    expect(result.data.line).toBe(10);
  });

  it("returns empty data for unknown types", () => {
    const result = getInspectorData({
      id: "x",
      label: "X",
      subtitle: "",
      count: 1,
      metadata: {},
    });

    expect(result.panelId).toBe("eslint-rule");
    expect(result.data).toEqual({});
  });
});

describe("canExpand", () => {
  it("returns true for rule tiles", () => {
    expect(canExpand({ id: "r", label: "", subtitle: "", count: 0, metadata: { isRule: true } })).toBe(true);
  });

  it("returns true for file tiles", () => {
    expect(canExpand({ id: "f", label: "", subtitle: "", count: 0, metadata: { isFile: true } })).toBe(true);
  });

  it("returns false for issue tiles", () => {
    expect(canExpand({ id: "i", label: "", subtitle: "", count: 0, metadata: { isIssue: true } })).toBe(false);
  });

  it("returns false for unknown types", () => {
    expect(canExpand({ id: "x", label: "", subtitle: "", count: 0, metadata: {} })).toBe(false);
  });
});

describe("aggregateIssuesForFile", () => {
  it("returns issue tiles for a specific file", () => {
    const issues = [
      makeIssue({ filePath: "a.ts", line: 5, id: "i1" }),
      makeIssue({ filePath: "a.ts", line: 10, id: "i2" }),
      makeIssue({ filePath: "b.ts", line: 1, id: "i3" }),
    ];

    const tiles = aggregateIssuesForFile(issues, "a.ts");

    expect(tiles).toHaveLength(2);
    expect(tiles[0].metadata?.line).toBe(5); // sorted by line
    expect(tiles[1].metadata?.line).toBe(10);
  });

  it("filters by ruleId when provided", () => {
    const issues = [
      makeIssue({ filePath: "a.ts", ruleId: "r1", id: "i1" }),
      makeIssue({ filePath: "a.ts", ruleId: "r2", id: "i2" }),
    ];

    const tiles = aggregateIssuesForFile(issues, "a.ts", "r1");

    expect(tiles).toHaveLength(1);
    expect(tiles[0].metadata?.ruleId).toBe("r1");
  });

  it("sets severity counts per issue", () => {
    const issues = [makeIssue({ filePath: "a.ts", severity: "error" })];
    const tiles = aggregateIssuesForFile(issues, "a.ts");

    expect(tiles[0].severityCounts).toEqual({ error: 1, warning: 0, info: 0 });
  });

  it("includes column in subtitle when available", () => {
    const issues = [makeIssue({ filePath: "a.ts", line: 5, column: 12 })];
    const tiles = aggregateIssuesForFile(issues, "a.ts");

    expect(tiles[0].subtitle).toBe("Line 5:12");
  });

  it("omits column from subtitle when not available", () => {
    const issues = [makeIssue({ filePath: "a.ts", line: 5, column: undefined })];
    const tiles = aggregateIssuesForFile(issues, "a.ts");

    expect(tiles[0].subtitle).toBe("Line 5");
  });
});
