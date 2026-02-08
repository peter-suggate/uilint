/**
 * Tests for useFuzzySearch hook
 *
 * Tests fuzzy search over SearchItem arrays with Fuse.js,
 * section grouping, ordering, and flat item output.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFuzzySearch } from "./useFuzzySearch";
import type { SearchItem } from "../../core/plugin-system/types";

// ============================================================================
// Test Helpers
// ============================================================================

function createSearchItem(overrides: Partial<SearchItem> = {}): SearchItem {
  return {
    id: `item-${Math.random().toString(36).slice(2)}`,
    section: "rules",
    label: "Test Item",
    searchFields: { label: "Test Item" },
    ...overrides,
  };
}

// ============================================================================
// Fixtures
// ============================================================================

const fixtureItems: SearchItem[] = [
  createSearchItem({
    id: "rule:no-unused-vars",
    section: "rules",
    label: "no-unused-vars",
    subtitle: "Disallow unused variables",
    searchFields: {
      label: "no-unused-vars",
      subtitle: "Disallow unused variables",
      keywords: ["no-unused-vars", "unused"],
    },
  }),
  createSearchItem({
    id: "rule:prefer-const",
    section: "rules",
    label: "prefer-const",
    subtitle: "Require const for never-reassigned variables",
    searchFields: {
      label: "prefer-const",
      subtitle: "Require const for never-reassigned variables",
      keywords: ["prefer-const", "const"],
    },
  }),
  createSearchItem({
    id: "file:src/App.tsx",
    section: "files",
    label: "App.tsx",
    subtitle: "src/App.tsx",
    searchFields: {
      label: "App.tsx",
      subtitle: "src/App.tsx",
      keywords: ["no-unused-vars"],
    },
  }),
  createSearchItem({
    id: "file:src/Button.tsx",
    section: "files",
    label: "Button.tsx",
    subtitle: "src/Button.tsx",
    searchFields: {
      label: "Button.tsx",
      subtitle: "src/Button.tsx",
      keywords: ["prefer-const"],
    },
  }),
  createSearchItem({
    id: "cmd:scan",
    section: "commands",
    label: "Re-scan All Files",
    searchFields: {
      label: "Re-scan All Files",
      keywords: ["scan", "rescan", "lint"],
    },
  }),
];

// ============================================================================
// Tests
// ============================================================================

describe("useFuzzySearch", () => {
  it("empty query returns all items", () => {
    const { result } = renderHook(() => useFuzzySearch(fixtureItems, ""));

    expect(result.current.results).toHaveLength(fixtureItems.length);
    expect(result.current.flatItems).toHaveLength(fixtureItems.length);
  });

  it("exact label match ranks first", () => {
    const { result } = renderHook(() =>
      useFuzzySearch(fixtureItems, "prefer-const")
    );

    expect(result.current.results.length).toBeGreaterThan(0);
    expect(result.current.results[0].id).toBe("rule:prefer-const");
  });

  it("fuzzy match works (e.g., 'unused' matches 'no-unused-vars')", () => {
    const { result } = renderHook(() =>
      useFuzzySearch(fixtureItems, "unused")
    );

    const matchedIds = result.current.results.map((r) => r.id);
    expect(matchedIds).toContain("rule:no-unused-vars");
  });

  it("results are grouped by section", () => {
    const { result } = renderHook(() => useFuzzySearch(fixtureItems, ""));

    const { grouped } = result.current;
    expect(grouped.has("rules")).toBe(true);
    expect(grouped.has("files")).toBe(true);
    expect(grouped.has("commands")).toBe(true);

    expect(grouped.get("rules")!.every((i) => i.section === "rules")).toBe(true);
    expect(grouped.get("files")!.every((i) => i.section === "files")).toBe(true);
    expect(grouped.get("commands")!.every((i) => i.section === "commands")).toBe(true);
  });

  it("section order is rules, files, commands", () => {
    const { result } = renderHook(() => useFuzzySearch(fixtureItems, ""));

    const sectionKeys = Array.from(result.current.grouped.keys());
    const rulesIdx = sectionKeys.indexOf("rules");
    const filesIdx = sectionKeys.indexOf("files");
    const commandsIdx = sectionKeys.indexOf("commands");

    expect(rulesIdx).toBeLessThan(filesIdx);
    expect(filesIdx).toBeLessThan(commandsIdx);
  });

  it("empty sections are removed from grouped map", () => {
    // Items only in rules section
    const rulesOnly = [
      createSearchItem({
        id: "rule:test",
        section: "rules",
        label: "Test Rule",
        searchFields: { label: "Test Rule" },
      }),
    ];

    const { result } = renderHook(() => useFuzzySearch(rulesOnly, ""));

    expect(result.current.grouped.has("rules")).toBe(true);
    expect(result.current.grouped.has("files")).toBe(false);
    expect(result.current.grouped.has("commands")).toBe(false);
  });

  it("flatItems respects section ordering", () => {
    const { result } = renderHook(() => useFuzzySearch(fixtureItems, ""));

    const { flatItems } = result.current;

    // Find the indices of the first item from each section
    const firstRuleIdx = flatItems.findIndex((i) => i.section === "rules");
    const firstFileIdx = flatItems.findIndex((i) => i.section === "files");
    const firstCmdIdx = flatItems.findIndex((i) => i.section === "commands");

    expect(firstRuleIdx).toBeLessThan(firstFileIdx);
    expect(firstFileIdx).toBeLessThan(firstCmdIdx);
  });

  it("returns no results for completely unrelated query", () => {
    const { result } = renderHook(() =>
      useFuzzySearch(fixtureItems, "xyzzyplugh")
    );

    expect(result.current.results).toHaveLength(0);
    expect(result.current.flatItems).toHaveLength(0);
    expect(result.current.grouped.size).toBe(0);
  });

  it("whitespace-only query returns all items", () => {
    const { result } = renderHook(() =>
      useFuzzySearch(fixtureItems, "   ")
    );

    expect(result.current.results).toHaveLength(fixtureItems.length);
  });
});
