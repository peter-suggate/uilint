/**
 * Unit tests for components/ui-lint/types module utility functions
 */

import { describe, it, expect } from "vitest";
import {
  getDataLocFromSource,
  DATA_UILINT_ID,
  DEFAULT_AUTO_SCAN_STATE,
  type SourceLocation,
} from "./types";

describe("getDataLocFromSource", () => {
  it("constructs dataLoc string from source with all fields", () => {
    const source: SourceLocation = {
      fileName: "app/page.tsx",
      lineNumber: 10,
      columnNumber: 5,
    };

    const result = getDataLocFromSource(source);

    expect(result).toBe("app/page.tsx:10:5");
  });

  it("defaults column to 0 when not provided", () => {
    const source: SourceLocation = {
      fileName: "app/page.tsx",
      lineNumber: 15,
    };

    const result = getDataLocFromSource(source);

    expect(result).toBe("app/page.tsx:15:0");
  });

  it("handles Windows paths", () => {
    const source: SourceLocation = {
      fileName: "C:/Users/dev/project/page.tsx",
      lineNumber: 20,
      columnNumber: 3,
    };

    const result = getDataLocFromSource(source);

    expect(result).toBe("C:/Users/dev/project/page.tsx:20:3");
  });

  it("handles nested paths", () => {
    const source: SourceLocation = {
      fileName: "src/components/ui/Button/index.tsx",
      lineNumber: 5,
      columnNumber: 10,
    };

    const result = getDataLocFromSource(source);

    expect(result).toBe("src/components/ui/Button/index.tsx:5:10");
  });

  it("handles zero line and column", () => {
    const source: SourceLocation = {
      fileName: "file.tsx",
      lineNumber: 0,
      columnNumber: 0,
    };

    const result = getDataLocFromSource(source);

    expect(result).toBe("file.tsx:0:0");
  });
});

describe("DATA_UILINT_ID constant", () => {
  it("has the expected value", () => {
    expect(DATA_UILINT_ID).toBe("data-loc");
  });
});

describe("DEFAULT_AUTO_SCAN_STATE constant", () => {
  it("has idle status", () => {
    expect(DEFAULT_AUTO_SCAN_STATE.status).toBe("idle");
  });

  it("has zero currentIndex", () => {
    expect(DEFAULT_AUTO_SCAN_STATE.currentIndex).toBe(0);
  });

  it("has zero totalElements", () => {
    expect(DEFAULT_AUTO_SCAN_STATE.totalElements).toBe(0);
  });

  it("has empty elements array", () => {
    expect(DEFAULT_AUTO_SCAN_STATE.elements).toEqual([]);
  });
});
