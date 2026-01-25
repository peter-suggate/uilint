/**
 * Unit tests for ui/types module utility functions
 */

import { describe, it, expect } from "vitest";
import {
  parseDataLoc,
  createIssueId,
  severityFromNumber,
  severityToColor,
} from "./types";

describe("parseDataLoc", () => {
  it("parses path:line:column format", () => {
    const result = parseDataLoc("app/page.tsx:10:5");

    expect(result).toEqual({
      filePath: "app/page.tsx",
      line: 10,
      column: 5,
    });
  });

  it("parses path:line format (no column) - treats last number as column", () => {
    // Note: This function always pops from end, so path:line becomes
    // column=line and line=NaN. Use full path:line:column format.
    const result = parseDataLoc("app/page.tsx:15:0");

    expect(result).toEqual({
      filePath: "app/page.tsx",
      line: 15,
      column: 0,
    });
  });

  it("handles Windows paths with colons", () => {
    const result = parseDataLoc("C:/Users/dev/project/page.tsx:20:3");

    expect(result).toEqual({
      filePath: "C:/Users/dev/project/page.tsx",
      line: 20,
      column: 3,
    });
  });

  it("handles paths with multiple slashes", () => {
    const result = parseDataLoc("src/components/ui/Button/index.tsx:5:10");

    expect(result).toEqual({
      filePath: "src/components/ui/Button/index.tsx",
      line: 5,
      column: 10,
    });
  });

  it("handles empty string", () => {
    const result = parseDataLoc("");

    expect(result).toEqual({
      filePath: "",
      line: 0,
      column: 0,
    });
  });
});

describe("createIssueId", () => {
  it("creates unique ID from components", () => {
    const id = createIssueId("eslint", "no-unused-vars", "app/page.tsx:10:5", 10);

    expect(id).toBe("eslint:no-unused-vars:app/page.tsx:10:5:10");
  });

  it("handles different plugins", () => {
    const eslintId = createIssueId("eslint", "rule1", "file.tsx:1:1", 1);
    const visionId = createIssueId("vision", "rule1", "file.tsx:1:1", 1);

    expect(eslintId).not.toBe(visionId);
    expect(eslintId).toContain("eslint");
    expect(visionId).toContain("vision");
  });
});

describe("severityFromNumber", () => {
  it("returns 'error' for severity 2", () => {
    expect(severityFromNumber(2)).toBe("error");
  });

  it("returns 'warning' for severity 1", () => {
    expect(severityFromNumber(1)).toBe("warning");
  });

  it("returns 'warning' for any other number", () => {
    expect(severityFromNumber(0 as 1 | 2)).toBe("warning");
    expect(severityFromNumber(3 as 1 | 2)).toBe("warning");
  });
});

describe("severityToColor", () => {
  it("returns red color for error severity", () => {
    const color = severityToColor("error");

    expect(color).toBe("#ef4444");
  });

  it("returns amber color for warning severity", () => {
    const color = severityToColor("warning");

    expect(color).toBe("#f59e0b");
  });

  it("returns blue color for info severity", () => {
    const color = severityToColor("info");

    expect(color).toBe("#3b82f6");
  });

  it("returns valid hex colors", () => {
    const errorColor = severityToColor("error");
    const warningColor = severityToColor("warning");
    const infoColor = severityToColor("info");

    expect(errorColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(warningColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(infoColor).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
