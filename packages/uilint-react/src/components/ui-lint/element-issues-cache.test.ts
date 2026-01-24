/**
 * Unit tests for element issues cache functionality
 * Tests the dataLoc-keyed cache system for ESLint issues
 */

import { describe, it, expect } from "vitest";
import {
  getDataLocFromSource,
  type SourceLocation,
  type ElementIssue,
  type ESLintIssue,
  type ScannedElement,
} from "./types";

describe("getDataLocFromSource", () => {
  it("constructs dataLoc from source with all fields", () => {
    const source: SourceLocation = {
      fileName: "src/app/page.tsx",
      lineNumber: 42,
      columnNumber: 8,
    };

    const result = getDataLocFromSource(source);

    expect(result).toBe("src/app/page.tsx:42:8");
  });

  it("uses 0 for missing column number", () => {
    const source: SourceLocation = {
      fileName: "src/components/Button.tsx",
      lineNumber: 15,
    };

    const result = getDataLocFromSource(source);

    expect(result).toBe("src/components/Button.tsx:15:0");
  });

  it("handles paths with colons (Windows-style)", () => {
    const source: SourceLocation = {
      fileName: "C:/projects/app/src/page.tsx",
      lineNumber: 10,
      columnNumber: 5,
    };

    const result = getDataLocFromSource(source);

    expect(result).toBe("C:/projects/app/src/page.tsx:10:5");
  });

  it("produces same dataLoc for elements from same source location", () => {
    const source1: SourceLocation = {
      fileName: "app/list.tsx",
      lineNumber: 20,
      columnNumber: 4,
    };
    const source2: SourceLocation = {
      fileName: "app/list.tsx",
      lineNumber: 20,
      columnNumber: 4,
    };

    expect(getDataLocFromSource(source1)).toBe(getDataLocFromSource(source2));
  });

  it("produces different dataLoc for elements from different lines", () => {
    const source1: SourceLocation = {
      fileName: "app/page.tsx",
      lineNumber: 10,
      columnNumber: 4,
    };
    const source2: SourceLocation = {
      fileName: "app/page.tsx",
      lineNumber: 11,
      columnNumber: 4,
    };

    expect(getDataLocFromSource(source1)).not.toBe(
      getDataLocFromSource(source2)
    );
  });
});

describe("ElementIssue type", () => {
  it("has dataLoc as the identifier field", () => {
    const elementIssue: ElementIssue = {
      dataLoc: "src/app/page.tsx:10:5",
      issues: [],
      status: "complete",
    };

    expect(elementIssue.dataLoc).toBe("src/app/page.tsx:10:5");
  });

  it("stores multiple issues for a single dataLoc", () => {
    const issues: ESLintIssue[] = [
      {
        line: 10,
        column: 5,
        message: "First issue",
        ruleId: "uilint/semantic",
        dataLoc: "src/app/page.tsx:10:5",
      },
      {
        line: 10,
        column: 5,
        message: "Second issue",
        ruleId: "uilint/no-arbitrary-tailwind",
        dataLoc: "src/app/page.tsx:10:5",
      },
    ];

    const elementIssue: ElementIssue = {
      dataLoc: "src/app/page.tsx:10:5",
      issues,
      status: "complete",
    };

    expect(elementIssue.issues).toHaveLength(2);
  });
});

describe("elementIssuesCache behavior", () => {
  // Helper to create a mock ScannedElement
  function createMockElement(
    id: string,
    source: SourceLocation
  ): ScannedElement {
    return {
      id,
      element: {} as Element,
      tagName: "div",
      className: "",
      source,
      rect: { x: 0, y: 0, width: 100, height: 50 } as DOMRect,
    };
  }

  it("multiple elements with same source share one cache entry", () => {
    const cache = new Map<string, ElementIssue>();
    const source: SourceLocation = {
      fileName: "app/list.tsx",
      lineNumber: 15,
      columnNumber: 6,
    };

    // Three list items from same source location (different occurrence numbers)
    const elements = [
      createMockElement("loc:app/list.tsx:15:6#1", source),
      createMockElement("loc:app/list.tsx:15:6#2", source),
      createMockElement("loc:app/list.tsx:15:6#3", source),
    ];

    // All three elements share the same dataLoc
    const dataLoc = getDataLocFromSource(source);
    expect(dataLoc).toBe("app/list.tsx:15:6");

    // Only one cache entry is created
    const seenDataLocs = new Set<string>();
    for (const el of elements) {
      const elDataLoc = getDataLocFromSource(el.source);
      if (!seenDataLocs.has(elDataLoc)) {
        seenDataLocs.add(elDataLoc);
        cache.set(elDataLoc, {
          dataLoc: elDataLoc,
          issues: [
            {
              line: 15,
              column: 6,
              message: "Test issue",
              ruleId: "uilint/test",
              dataLoc: elDataLoc,
            },
          ],
          status: "complete",
        });
      }
    }

    expect(cache.size).toBe(1);

    // All elements can look up their issues via their source's dataLoc
    for (const el of elements) {
      const elDataLoc = getDataLocFromSource(el.source);
      const entry = cache.get(elDataLoc);
      expect(entry).toBeDefined();
      expect(entry?.issues).toHaveLength(1);
    }
  });

  it("elements from different sources have separate cache entries", () => {
    const cache = new Map<string, ElementIssue>();

    const elements = [
      createMockElement("loc:app/page.tsx:10:5#1", {
        fileName: "app/page.tsx",
        lineNumber: 10,
        columnNumber: 5,
      }),
      createMockElement("loc:app/page.tsx:20:8#1", {
        fileName: "app/page.tsx",
        lineNumber: 20,
        columnNumber: 8,
      }),
      createMockElement("loc:app/other.tsx:5:2#1", {
        fileName: "app/other.tsx",
        lineNumber: 5,
        columnNumber: 2,
      }),
    ];

    // Each element has a unique dataLoc
    for (const el of elements) {
      const dataLoc = getDataLocFromSource(el.source);
      cache.set(dataLoc, {
        dataLoc,
        issues: [],
        status: "complete",
      });
    }

    expect(cache.size).toBe(3);
    expect(cache.has("app/page.tsx:10:5")).toBe(true);
    expect(cache.has("app/page.tsx:20:8")).toBe(true);
    expect(cache.has("app/other.tsx:5:2")).toBe(true);
  });

  it("issue dataLoc matches element source dataLoc for proper lookup", () => {
    const source: SourceLocation = {
      fileName: "app/button.tsx",
      lineNumber: 25,
      columnNumber: 4,
    };

    const element = createMockElement("loc:app/button.tsx:25:4#1", source);

    const issue: ESLintIssue = {
      line: 25,
      column: 4,
      message: "Button text may be unclear",
      ruleId: "uilint/semantic",
      dataLoc: "app/button.tsx:25:4", // Same format as getDataLocFromSource output
    };

    const elementDataLoc = getDataLocFromSource(element.source);
    expect(issue.dataLoc).toBe(elementDataLoc);
  });

  it("cache removal only happens when no elements remain for a dataLoc", () => {
    const cache = new Map<string, ElementIssue>();

    // Setup: two dataLocs, one with multiple elements
    cache.set("app/list.tsx:10:4", {
      dataLoc: "app/list.tsx:10:4",
      issues: [],
      status: "complete",
    });
    cache.set("app/page.tsx:5:2", {
      dataLoc: "app/page.tsx:5:2",
      issues: [],
      status: "complete",
    });

    // Simulate elements
    const elements = [
      createMockElement("loc:app/list.tsx:10:4#1", {
        fileName: "app/list.tsx",
        lineNumber: 10,
        columnNumber: 4,
      }),
      createMockElement("loc:app/list.tsx:10:4#2", {
        fileName: "app/list.tsx",
        lineNumber: 10,
        columnNumber: 4,
      }),
      createMockElement("loc:app/page.tsx:5:2#1", {
        fileName: "app/page.tsx",
        lineNumber: 5,
        columnNumber: 2,
      }),
    ];

    // Remove one list element (but another remains)
    const removedIds = new Set(["loc:app/list.tsx:10:4#1"]);
    const remainingElements = elements.filter((el) => !removedIds.has(el.id));

    // Compute which dataLocs still have elements
    const remainingDataLocs = new Set<string>();
    for (const el of remainingElements) {
      remainingDataLocs.add(getDataLocFromSource(el.source));
    }

    // Only remove cache entries for dataLocs with no remaining elements
    for (const dataLoc of cache.keys()) {
      if (!remainingDataLocs.has(dataLoc)) {
        cache.delete(dataLoc);
      }
    }

    // Both dataLocs should still exist (both have at least one element)
    expect(cache.size).toBe(2);
    expect(cache.has("app/list.tsx:10:4")).toBe(true);
    expect(cache.has("app/page.tsx:5:2")).toBe(true);

    // Now remove the second list element
    const remainingElements2 = remainingElements.filter(
      (el) => el.id !== "loc:app/list.tsx:10:4#2"
    );
    const remainingDataLocs2 = new Set<string>();
    for (const el of remainingElements2) {
      remainingDataLocs2.add(getDataLocFromSource(el.source));
    }

    for (const dataLoc of cache.keys()) {
      if (!remainingDataLocs2.has(dataLoc)) {
        cache.delete(dataLoc);
      }
    }

    // Now only app/page.tsx:5:2 should remain
    expect(cache.size).toBe(1);
    expect(cache.has("app/list.tsx:10:4")).toBe(false);
    expect(cache.has("app/page.tsx:5:2")).toBe(true);
  });
});
