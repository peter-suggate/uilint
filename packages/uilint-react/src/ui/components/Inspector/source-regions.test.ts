/**
 * Unit tests for source-regions.ts
 *
 * Tests the region calculation algorithm for the source code view:
 * - calculateRegions - main algorithm for visible regions and gaps
 * - expandGap - expanding collapsed sections
 * - getIssuesForLine, lineHasIssues, getLineSeverity - line utilities
 */

import { describe, it, expect } from "vitest";
import {
  calculateRegions,
  expandGap,
  getIssuesForLine,
  lineHasIssues,
  getLineSeverity,
} from "./source-regions";
import type { Issue } from "../../types";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock issue with minimal required fields.
 */
function createIssue(
  line: number,
  overrides: Partial<Issue> = {}
): Issue {
  return {
    id: `issue-${line}-${Math.random().toString(36).slice(2, 7)}`,
    message: `Issue at line ${line}`,
    severity: "warning",
    dataLoc: `file.tsx:${line}:1`,
    ruleId: "test-rule",
    pluginId: "eslint",
    filePath: "src/file.tsx",
    line,
    column: 1,
    ...overrides,
  };
}

// ============================================================================
// calculateRegions Tests
// ============================================================================

describe("calculateRegions", () => {
  describe("empty and edge cases", () => {
    it("returns empty regions and single gap for empty issues with lines", () => {
      const result = calculateRegions([], 100, 2);

      expect(result.regions).toEqual([]);
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]).toEqual({
        id: 0,
        startLine: 1,
        endLine: 100,
        lineCount: 100,
        position: "start",
      });
    });

    it("returns empty everything for empty file", () => {
      const result = calculateRegions([], 0, 2);

      expect(result.regions).toEqual([]);
      expect(result.gaps).toEqual([]);
    });

    it("handles single issue in the middle of file", () => {
      const issues = [createIssue(50)];
      const result = calculateRegions(issues, 100, 2);

      expect(result.regions).toHaveLength(1);
      expect(result.regions[0]).toEqual({
        startLine: 48,
        endLine: 52,
        issues,
      });

      // Should have gaps before and after
      expect(result.gaps).toHaveLength(2);
      expect(result.gaps[0].position).toBe("start");
      expect(result.gaps[0].startLine).toBe(1);
      expect(result.gaps[0].endLine).toBe(47);
      expect(result.gaps[1].position).toBe("end");
      expect(result.gaps[1].startLine).toBe(53);
      expect(result.gaps[1].endLine).toBe(100);
    });

    it("handles issue at line 1", () => {
      const issues = [createIssue(1)];
      const result = calculateRegions(issues, 100, 2);

      expect(result.regions).toHaveLength(1);
      expect(result.regions[0].startLine).toBe(1);
      expect(result.regions[0].endLine).toBe(3);

      // No gap at start, only at end
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0].position).toBe("end");
    });

    it("handles issue at last line", () => {
      const issues = [createIssue(100)];
      const result = calculateRegions(issues, 100, 2);

      expect(result.regions).toHaveLength(1);
      expect(result.regions[0].startLine).toBe(98);
      expect(result.regions[0].endLine).toBe(100);

      // Only gap at start, none at end
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0].position).toBe("start");
    });

    it("handles issue spanning entire small file", () => {
      const issues = [createIssue(3)];
      const result = calculateRegions(issues, 5, 3);

      expect(result.regions).toHaveLength(1);
      expect(result.regions[0].startLine).toBe(1);
      expect(result.regions[0].endLine).toBe(5);

      // No gaps - region covers entire file
      expect(result.gaps).toHaveLength(0);
    });
  });

  describe("context lines", () => {
    it("respects contextLines parameter", () => {
      const issues = [createIssue(50)];

      const result2 = calculateRegions(issues, 100, 2);
      expect(result2.regions[0].startLine).toBe(48);
      expect(result2.regions[0].endLine).toBe(52);

      const result5 = calculateRegions(issues, 100, 5);
      expect(result5.regions[0].startLine).toBe(45);
      expect(result5.regions[0].endLine).toBe(55);

      const result0 = calculateRegions(issues, 100, 0);
      expect(result0.regions[0].startLine).toBe(50);
      expect(result0.regions[0].endLine).toBe(50);
    });

    it("clamps context to file boundaries", () => {
      const issues = [createIssue(2)];
      const result = calculateRegions(issues, 100, 5);

      // Can't go below line 1
      expect(result.regions[0].startLine).toBe(1);
      expect(result.regions[0].endLine).toBe(7);
    });
  });

  describe("multiple issues - merging", () => {
    it("merges overlapping regions", () => {
      // Issues at lines 10 and 12 with context of 2 should merge
      // Line 10: region [8, 12]
      // Line 12: region [10, 14]
      // Merged: [8, 14]
      const issues = [createIssue(10), createIssue(12)];
      const result = calculateRegions(issues, 100, 2);

      expect(result.regions).toHaveLength(1);
      expect(result.regions[0].startLine).toBe(8);
      expect(result.regions[0].endLine).toBe(14);
      expect(result.regions[0].issues).toHaveLength(2);
    });

    it("merges adjacent regions (touching)", () => {
      // Issues at lines 10 and 15 with context of 2
      // Line 10: region [8, 12]
      // Line 15: region [13, 17]
      // These are adjacent (12 and 13 touch), should merge
      const issues = [createIssue(10), createIssue(15)];
      const result = calculateRegions(issues, 100, 2);

      expect(result.regions).toHaveLength(1);
      expect(result.regions[0].startLine).toBe(8);
      expect(result.regions[0].endLine).toBe(17);
    });

    it("keeps separate regions when not adjacent", () => {
      // Issues at lines 10 and 20 with context of 2
      // Line 10: region [8, 12]
      // Line 20: region [18, 22]
      // Gap between 12 and 18, should not merge
      const issues = [createIssue(10), createIssue(20)];
      const result = calculateRegions(issues, 100, 2);

      expect(result.regions).toHaveLength(2);
      expect(result.regions[0].startLine).toBe(8);
      expect(result.regions[0].endLine).toBe(12);
      expect(result.regions[1].startLine).toBe(18);
      expect(result.regions[1].endLine).toBe(22);

      // Should have a middle gap
      const middleGap = result.gaps.find((g) => g.position === "middle");
      expect(middleGap).toBeDefined();
      expect(middleGap!.startLine).toBe(13);
      expect(middleGap!.endLine).toBe(17);
      expect(middleGap!.lineCount).toBe(5);
    });

    it("handles multiple separate regions", () => {
      const issues = [
        createIssue(10),
        createIssue(30),
        createIssue(50),
        createIssue(70),
      ];
      const result = calculateRegions(issues, 100, 2);

      expect(result.regions).toHaveLength(4);
      expect(result.gaps).toHaveLength(5); // start + 3 middle + end
    });

    it("handles issues on the same line", () => {
      const issue1 = createIssue(50, { ruleId: "rule-a" });
      const issue2 = createIssue(50, { ruleId: "rule-b" });
      const result = calculateRegions([issue1, issue2], 100, 2);

      expect(result.regions).toHaveLength(1);
      expect(result.regions[0].issues).toHaveLength(2);
    });

    it("sorts issues by line number regardless of input order", () => {
      const issues = [createIssue(50), createIssue(10), createIssue(30)];
      const result = calculateRegions(issues, 100, 2);

      expect(result.regions).toHaveLength(3);
      expect(result.regions[0].issues[0].line).toBe(10);
      expect(result.regions[1].issues[0].line).toBe(30);
      expect(result.regions[2].issues[0].line).toBe(50);
    });
  });

  describe("gap calculation", () => {
    it("calculates gap line counts correctly", () => {
      const issues = [createIssue(10), createIssue(50)];
      const result = calculateRegions(issues, 100, 2);

      const startGap = result.gaps.find((g) => g.position === "start");
      expect(startGap!.lineCount).toBe(7); // lines 1-7

      const middleGap = result.gaps.find((g) => g.position === "middle");
      expect(middleGap!.lineCount).toBe(35); // lines 13-47

      const endGap = result.gaps.find((g) => g.position === "end");
      expect(endGap!.lineCount).toBe(48); // lines 53-100
    });

    it("assigns unique IDs to gaps", () => {
      const issues = [createIssue(10), createIssue(50), createIssue(90)];
      const result = calculateRegions(issues, 100, 2);

      const ids = result.gaps.map((g) => g.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("realistic scenarios", () => {
    it("handles typical file with clustered issues", () => {
      // Simulate issues in a component: imports (1-5), hooks (20-25), render (50-60)
      const issues = [
        createIssue(3), // unused import
        createIssue(5), // unused import
        createIssue(22), // hook dependency
        createIssue(23), // hook dependency
        createIssue(55), // jsx issue
      ];
      const result = calculateRegions(issues, 100, 2);

      // Should have 3 regions (imports cluster, hooks cluster, render)
      expect(result.regions).toHaveLength(3);

      // First region: lines 1-7 (issues at 3,5 with context merge)
      expect(result.regions[0].startLine).toBe(1);
      expect(result.regions[0].endLine).toBe(7);
      expect(result.regions[0].issues).toHaveLength(2);

      // Second region: lines 20-25 (issues at 22,23 merge)
      expect(result.regions[1].startLine).toBe(20);
      expect(result.regions[1].endLine).toBe(25);
      expect(result.regions[1].issues).toHaveLength(2);

      // Third region: lines 53-57
      expect(result.regions[2].startLine).toBe(53);
      expect(result.regions[2].endLine).toBe(57);
      expect(result.regions[2].issues).toHaveLength(1);
    });
  });
});

// ============================================================================
// expandGap Tests
// ============================================================================

describe("expandGap", () => {
  it("returns unchanged result for non-existent gap", () => {
    const issues = [createIssue(50)];
    const result = calculateRegions(issues, 100, 2);
    const expanded = expandGap(result, 999, 100);

    expect(expanded).toEqual(result);
  });

  it("expands start gap into first region", () => {
    const issues = [createIssue(50)];
    const result = calculateRegions(issues, 100, 2);

    const startGap = result.gaps.find((g) => g.position === "start")!;
    const expanded = expandGap(result, startGap.id, 100);

    expect(expanded.regions).toHaveLength(1);
    expect(expanded.regions[0].startLine).toBe(1);
    expect(expanded.regions[0].endLine).toBe(52);

    // Start gap should be removed
    expect(expanded.gaps.find((g) => g.position === "start")).toBeUndefined();
  });

  it("expands end gap from last region", () => {
    const issues = [createIssue(50)];
    const result = calculateRegions(issues, 100, 2);

    const endGap = result.gaps.find((g) => g.position === "end")!;
    const expanded = expandGap(result, endGap.id, 100);

    expect(expanded.regions).toHaveLength(1);
    expect(expanded.regions[0].startLine).toBe(48);
    expect(expanded.regions[0].endLine).toBe(100);

    // End gap should be removed
    expect(expanded.gaps.find((g) => g.position === "end")).toBeUndefined();
  });

  it("expands middle gap by merging adjacent regions", () => {
    const issues = [createIssue(10), createIssue(50)];
    const result = calculateRegions(issues, 100, 2);

    expect(result.regions).toHaveLength(2);

    const middleGap = result.gaps.find((g) => g.position === "middle")!;
    const expanded = expandGap(result, middleGap.id, 100);

    // Should merge into single region
    expect(expanded.regions).toHaveLength(1);
    expect(expanded.regions[0].startLine).toBe(8);
    expect(expanded.regions[0].endLine).toBe(52);
    expect(expanded.regions[0].issues).toHaveLength(2);

    // Middle gap should be removed
    expect(expanded.gaps.find((g) => g.position === "middle")).toBeUndefined();
  });

  it("preserves issues when merging regions", () => {
    const issue1 = createIssue(10, { message: "First" });
    const issue2 = createIssue(50, { message: "Second" });
    const result = calculateRegions([issue1, issue2], 100, 2);

    const middleGap = result.gaps.find((g) => g.position === "middle")!;
    const expanded = expandGap(result, middleGap.id, 100);

    expect(expanded.regions[0].issues).toHaveLength(2);
    expect(expanded.regions[0].issues[0].message).toBe("First");
    expect(expanded.regions[0].issues[1].message).toBe("Second");
  });
});

// ============================================================================
// Line Utility Tests
// ============================================================================

describe("getIssuesForLine", () => {
  it("returns empty array when no issues on line", () => {
    const issues = [createIssue(10), createIssue(20)];
    const result = getIssuesForLine(issues, 15);

    expect(result).toEqual([]);
  });

  it("returns issues on the specified line", () => {
    const issue1 = createIssue(10, { ruleId: "rule-a" });
    const issue2 = createIssue(10, { ruleId: "rule-b" });
    const issue3 = createIssue(20);
    const result = getIssuesForLine([issue1, issue2, issue3], 10);

    expect(result).toHaveLength(2);
    expect(result).toContain(issue1);
    expect(result).toContain(issue2);
  });
});

describe("lineHasIssues", () => {
  it("returns false when no issues on line", () => {
    const issues = [createIssue(10)];
    expect(lineHasIssues(issues, 15)).toBe(false);
  });

  it("returns true when line has issues", () => {
    const issues = [createIssue(10)];
    expect(lineHasIssues(issues, 10)).toBe(true);
  });
});

describe("getLineSeverity", () => {
  it("returns null for empty issues", () => {
    expect(getLineSeverity([])).toBeNull();
  });

  it("returns the single issue severity", () => {
    const issues = [createIssue(10, { severity: "warning" })];
    expect(getLineSeverity(issues)).toBe("warning");
  });

  it("returns highest severity (error > warning > info)", () => {
    const issues = [
      createIssue(10, { severity: "info" }),
      createIssue(10, { severity: "error" }),
      createIssue(10, { severity: "warning" }),
    ];
    expect(getLineSeverity(issues)).toBe("error");
  });

  it("returns warning when no errors", () => {
    const issues = [
      createIssue(10, { severity: "info" }),
      createIssue(10, { severity: "warning" }),
    ];
    expect(getLineSeverity(issues)).toBe("warning");
  });
});
