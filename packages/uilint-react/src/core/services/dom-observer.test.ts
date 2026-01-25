/**
 * Unit tests for dom-observer module utility functions
 */

import { describe, it, expect } from "vitest";
import {
  generateElementId,
  parseDataLoc,
  shouldFilterPath,
} from "./dom-observer";

describe("generateElementId", () => {
  it("generates ID with data-loc and occurrence number", () => {
    const id = generateElementId("app/page.tsx:10:5", 1);
    expect(id).toBe("loc:app/page.tsx:10:5#1");
  });

  it("increments occurrence number for duplicates", () => {
    const id1 = generateElementId("app/list.tsx:15:8", 1);
    const id2 = generateElementId("app/list.tsx:15:8", 2);
    const id3 = generateElementId("app/list.tsx:15:8", 3);

    expect(id1).toBe("loc:app/list.tsx:15:8#1");
    expect(id2).toBe("loc:app/list.tsx:15:8#2");
    expect(id3).toBe("loc:app/list.tsx:15:8#3");
  });

  it("handles paths with special characters", () => {
    const id = generateElementId("src/components/[slug]/page.tsx:20:3", 1);
    expect(id).toBe("loc:src/components/[slug]/page.tsx:20:3#1");
  });

  it("handles Windows-style paths", () => {
    const id = generateElementId("C:/Users/dev/project/page.tsx:5:2", 1);
    expect(id).toBe("loc:C:/Users/dev/project/page.tsx:5:2#1");
  });
});

describe("parseDataLoc", () => {
  it("returns data-loc string unchanged when not runtime ID format", () => {
    const result = parseDataLoc("app/page.tsx:10:5");
    expect(result).toBe("app/page.tsx:10:5");
  });

  it("strips runtime ID prefix (loc:)", () => {
    const result = parseDataLoc("loc:app/page.tsx:10:5#1");
    expect(result).toBe("app/page.tsx:10:5");
  });

  it("strips occurrence suffix (#N)", () => {
    const result = parseDataLoc("loc:app/page.tsx:10:5#42");
    expect(result).toBe("app/page.tsx:10:5");
  });

  it("returns null for empty string", () => {
    const result = parseDataLoc("");
    expect(result).toBeNull();
  });

  it("handles loc: prefix without occurrence suffix", () => {
    const result = parseDataLoc("loc:app/page.tsx:10:5");
    expect(result).toBe("app/page.tsx:10:5");
  });

  it("handles paths with multiple hash symbols", () => {
    // Only the last hash should be treated as occurrence separator
    const result = parseDataLoc("loc:app/#dashboard/page.tsx:10:5#1");
    expect(result).toBe("app/#dashboard/page.tsx:10:5");
  });

  it("handles legacy format without column", () => {
    const result = parseDataLoc("app/page.tsx:10");
    expect(result).toBe("app/page.tsx:10");
  });
});

describe("shouldFilterPath", () => {
  it("returns true when path contains node_modules and hideNodeModules is true", () => {
    expect(shouldFilterPath("node_modules/react/index.js", true)).toBe(true);
    expect(shouldFilterPath("./node_modules/@scope/pkg/index.ts", true)).toBe(true);
    expect(shouldFilterPath("/app/node_modules/lodash/index.js", true)).toBe(true);
  });

  it("returns false when path contains node_modules but hideNodeModules is false", () => {
    expect(shouldFilterPath("node_modules/react/index.js", false)).toBe(false);
    expect(shouldFilterPath("./node_modules/@scope/pkg/index.ts", false)).toBe(false);
  });

  it("returns false when path does not contain node_modules", () => {
    expect(shouldFilterPath("app/page.tsx", true)).toBe(false);
    expect(shouldFilterPath("src/components/Button.tsx", true)).toBe(false);
    expect(shouldFilterPath("./lib/utils.ts", false)).toBe(false);
  });

  it("returns false for empty path", () => {
    expect(shouldFilterPath("", true)).toBe(false);
    expect(shouldFilterPath("", false)).toBe(false);
  });
});
