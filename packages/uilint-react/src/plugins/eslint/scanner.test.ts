/**
 * ESLint Plugin Scanner Tests
 *
 * Tests for the scanner utility functions that extract file paths
 * from dataLoc attributes and manage lint request deduplication.
 */

import { describe, expect, it } from "vitest";
import {
  parseFilePathFromDataLoc,
  extractUniqueFilePaths,
} from "./scanner";

describe("parseFilePathFromDataLoc", () => {
  it("extracts file path from standard dataLoc format", () => {
    expect(parseFilePathFromDataLoc("app/page.tsx:10:5")).toBe("app/page.tsx");
  });

  it("handles single-digit line and column numbers", () => {
    expect(parseFilePathFromDataLoc("src/Button.tsx:1:0")).toBe("src/Button.tsx");
  });

  it("handles large line and column numbers", () => {
    expect(parseFilePathFromDataLoc("components/Header.tsx:1234:567")).toBe(
      "components/Header.tsx"
    );
  });

  it("handles paths with multiple directories", () => {
    expect(
      parseFilePathFromDataLoc("src/components/ui/Button/index.tsx:42:8")
    ).toBe("src/components/ui/Button/index.tsx");
  });

  it("handles .ts files", () => {
    expect(parseFilePathFromDataLoc("utils/helpers.ts:5:0")).toBe(
      "utils/helpers.ts"
    );
  });

  it("handles .jsx files", () => {
    expect(parseFilePathFromDataLoc("legacy/Component.jsx:100:12")).toBe(
      "legacy/Component.jsx"
    );
  });

  it("handles .js files", () => {
    expect(parseFilePathFromDataLoc("config/setup.js:1:0")).toBe(
      "config/setup.js"
    );
  });

  it("handles absolute paths", () => {
    expect(
      parseFilePathFromDataLoc("/home/user/project/src/App.tsx:10:5")
    ).toBe("/home/user/project/src/App.tsx");
  });

  it("handles Windows-style paths", () => {
    expect(parseFilePathFromDataLoc("C:\\Users\\dev\\src\\App.tsx:10:5")).toBe(
      "C:\\Users\\dev\\src\\App.tsx"
    );
  });

  it("returns null for empty string", () => {
    expect(parseFilePathFromDataLoc("")).toBeNull();
  });

  it("returns null for invalid format without line number", () => {
    expect(parseFilePathFromDataLoc("app/page.tsx")).toBeNull();
  });

  it("returns null for invalid format with only one colon", () => {
    expect(parseFilePathFromDataLoc("app/page.tsx:10")).toBeNull();
  });

  it("handles files with dots in the name", () => {
    expect(parseFilePathFromDataLoc("src/component.test.tsx:15:3")).toBe(
      "src/component.test.tsx"
    );
  });

  it("handles paths with hyphens and underscores", () => {
    expect(
      parseFilePathFromDataLoc("src/my-component_v2/index.tsx:1:0")
    ).toBe("src/my-component_v2/index.tsx");
  });
});

describe("extractUniqueFilePaths", () => {
  it("extracts unique file paths from array of dataLocs", () => {
    const dataLocs = [
      "app/page.tsx:10:5",
      "app/page.tsx:20:3",
      "components/Button.tsx:5:0",
    ];

    const result = extractUniqueFilePaths(dataLocs);

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(2);
    expect(result.has("app/page.tsx")).toBe(true);
    expect(result.has("components/Button.tsx")).toBe(true);
  });

  it("returns empty set for empty array", () => {
    const result = extractUniqueFilePaths([]);
    expect(result.size).toBe(0);
  });

  it("handles single dataLoc", () => {
    const result = extractUniqueFilePaths(["app/page.tsx:10:5"]);
    expect(result.size).toBe(1);
    expect(result.has("app/page.tsx")).toBe(true);
  });

  it("deduplicates multiple elements from same file", () => {
    const dataLocs = [
      "app/page.tsx:10:5",
      "app/page.tsx:15:8",
      "app/page.tsx:20:3",
      "app/page.tsx:25:12",
    ];

    const result = extractUniqueFilePaths(dataLocs);
    expect(result.size).toBe(1);
    expect(result.has("app/page.tsx")).toBe(true);
  });

  it("filters out invalid dataLocs", () => {
    const dataLocs = [
      "app/page.tsx:10:5",
      "", // invalid
      "invalid-format", // invalid
      "components/Button.tsx:5:0",
    ];

    const result = extractUniqueFilePaths(dataLocs);
    expect(result.size).toBe(2);
    expect(result.has("app/page.tsx")).toBe(true);
    expect(result.has("components/Button.tsx")).toBe(true);
  });

  it("handles mix of different file types", () => {
    const dataLocs = [
      "src/App.tsx:1:0",
      "src/utils.ts:10:5",
      "src/legacy.jsx:20:3",
      "src/config.js:5:0",
    ];

    const result = extractUniqueFilePaths(dataLocs);
    expect(result.size).toBe(4);
  });

  it("preserves path structure in extracted paths", () => {
    const dataLocs = [
      "src/components/ui/Button/index.tsx:10:5",
      "src/components/ui/Input/index.tsx:15:3",
    ];

    const result = extractUniqueFilePaths(dataLocs);
    expect(result.has("src/components/ui/Button/index.tsx")).toBe(true);
    expect(result.has("src/components/ui/Input/index.tsx")).toBe(true);
  });
});
