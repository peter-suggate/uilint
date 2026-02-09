import { describe, it, expect } from "vitest";
import { computeLineDiff, getDiffStats } from "./diff-utils";

describe("computeLineDiff", () => {
  it("returns all common lines for identical code", () => {
    const code = "const a = 1;\nconst b = 2;\nreturn a + b;";
    const result = computeLineDiff(code, code, 1, 1);

    expect(result.sourceLines.every((l) => l.type === "common")).toBe(true);
    expect(result.targetLines.every((l) => l.type === "common")).toBe(true);
    expect(result.sourceLines).toHaveLength(3);
    expect(result.targetLines).toHaveLength(3);
  });

  it("detects removed lines in source that are not in target", () => {
    const source = "line1\nline2\nline3";
    const target = "line1\nline3";
    const result = computeLineDiff(source, target, 1, 1);

    const removedLines = result.sourceLines.filter((l) => l.type === "removed");
    expect(removedLines).toHaveLength(1);
    expect(removedLines[0].content).toBe("line2");
  });

  it("detects added lines in target that are not in source", () => {
    const source = "line1\nline3";
    const target = "line1\nline2\nline3";
    const result = computeLineDiff(source, target, 1, 1);

    const addedLines = result.targetLines.filter((l) => l.type === "added");
    expect(addedLines).toHaveLength(1);
    expect(addedLines[0].content).toBe("line2");
  });

  it("preserves correct line numbers with custom start lines", () => {
    const source = "a\nb\nc";
    const target = "a\nc";
    const result = computeLineDiff(source, target, 10, 20);

    const sourceCommon = result.sourceLines.filter((l) => l.type === "common");
    expect(sourceCommon[0].lineNumber).toBe(10); // "a" at line 10
    expect(sourceCommon[1].lineNumber).toBe(12); // "c" at line 12

    const targetCommon = result.targetLines.filter((l) => l.type === "common");
    expect(targetCommon[0].lineNumber).toBe(20); // "a" at line 20
    expect(targetCommon[1].lineNumber).toBe(21); // "c" at line 21
  });

  it("handles empty source", () => {
    const result = computeLineDiff("", "line1\nline2", 1, 1);
    expect(result.sourceLines).toHaveLength(0);
    expect(result.targetLines.every((l) => l.type === "added")).toBe(true);
  });

  it("handles empty target", () => {
    const result = computeLineDiff("line1\nline2", "", 1, 1);
    expect(result.sourceLines.every((l) => l.type === "removed")).toBe(true);
    expect(result.targetLines).toHaveLength(0);
  });

  it("matches lines ignoring leading/trailing whitespace", () => {
    const source = "  const x = 1;";
    const target = "const x = 1;  ";
    const result = computeLineDiff(source, target, 1, 1);

    // Should match as common since trim() is used for comparison
    expect(result.sourceLines[0].type).toBe("common");
    expect(result.targetLines[0].type).toBe("common");
    // But content preserves original whitespace
    expect(result.sourceLines[0].content).toBe("  const x = 1;");
    expect(result.targetLines[0].content).toBe("const x = 1;  ");
  });
});

describe("getDiffStats", () => {
  it("returns correct counts for a mixed diff", () => {
    const source = "shared\nonly-source\nshared2";
    const target = "shared\nonly-target\nshared2";
    const result = computeLineDiff(source, target, 1, 1);
    const stats = getDiffStats(result);

    expect(stats.commonLines).toBe(2);
    expect(stats.sourceOnlyLines).toBe(1);
    expect(stats.targetOnlyLines).toBe(1);
    expect(stats.totalLines).toBe(4);
  });

  it("returns all common for identical code", () => {
    const code = "a\nb\nc";
    const result = computeLineDiff(code, code, 1, 1);
    const stats = getDiffStats(result);

    expect(stats.commonLines).toBe(3);
    expect(stats.sourceOnlyLines).toBe(0);
    expect(stats.targetOnlyLines).toBe(0);
  });
});
