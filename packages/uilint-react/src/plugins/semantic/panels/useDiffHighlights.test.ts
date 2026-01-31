/**
 * Tests for useDiffHighlights hook
 * @vitest-environment jsdom
 *
 * Tests word-level diff computation between source and target code strings.
 */

import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDiffHighlights, getSegmentOpacity } from "./useDiffHighlights";

// ============================================================================
// useDiffHighlights Tests
// ============================================================================

describe("useDiffHighlights", () => {
  describe("empty inputs", () => {
    it("returns empty arrays for empty strings", () => {
      const { result } = renderHook(() => useDiffHighlights("", ""));

      expect(result.current.sourceLines).toEqual([]);
      expect(result.current.targetLines).toEqual([]);
      expect(result.current.computed).toBe(false);
    });

    it("returns empty arrays when source is empty", () => {
      const { result } = renderHook(() => useDiffHighlights("", "const x = 1;"));

      expect(result.current.sourceLines).toEqual([]);
      expect(result.current.targetLines).toEqual([]);
      expect(result.current.computed).toBe(false);
    });

    it("returns empty arrays when target is empty", () => {
      const { result } = renderHook(() => useDiffHighlights("const x = 1;", ""));

      expect(result.current.sourceLines).toEqual([]);
      expect(result.current.targetLines).toEqual([]);
      expect(result.current.computed).toBe(false);
    });
  });

  describe("identical code", () => {
    it("returns matching segments for identical single-line code", () => {
      const code = "const x = 1;";
      const { result } = renderHook(() => useDiffHighlights(code, code));

      expect(result.current.computed).toBe(true);
      expect(result.current.sourceLines).toHaveLength(1);
      expect(result.current.targetLines).toHaveLength(1);

      // All segments should be 'match' type
      const sourceSegments = result.current.sourceLines[0].segments;
      for (const segment of sourceSegments) {
        expect(segment.type).toBe("match");
      }
    });

    it("returns matching segments for identical multi-line code", () => {
      const code = `function foo() {
  return 42;
}`;
      const { result } = renderHook(() => useDiffHighlights(code, code));

      expect(result.current.computed).toBe(true);
      expect(result.current.sourceLines).toHaveLength(3);
      expect(result.current.targetLines).toHaveLength(3);
    });
  });

  describe("different code", () => {
    it("detects single word change", () => {
      const source = "const x = 1;";
      const target = "const y = 1;";
      const { result } = renderHook(() => useDiffHighlights(source, target));

      expect(result.current.computed).toBe(true);

      // Source should have 'source-only' for 'x'
      const sourceSegments = result.current.sourceLines[0].segments;
      const hasSourceOnly = sourceSegments.some((s) => s.type === "source-only");
      expect(hasSourceOnly).toBe(true);

      // Target should have 'target-only' for 'y'
      const targetSegments = result.current.targetLines[0].segments;
      const hasTargetOnly = targetSegments.some((s) => s.type === "target-only");
      expect(hasTargetOnly).toBe(true);
    });

    it("handles completely different code", () => {
      const source = "const foo = 'hello';";
      const target = "let bar = 42;";
      const { result } = renderHook(() => useDiffHighlights(source, target));

      expect(result.current.computed).toBe(true);
      expect(result.current.sourceLines).toHaveLength(1);
      expect(result.current.targetLines).toHaveLength(1);
    });

    it("handles different line counts", () => {
      const source = `line1
line2`;
      const target = `line1
line2
line3`;
      const { result } = renderHook(() => useDiffHighlights(source, target));

      expect(result.current.computed).toBe(true);
      expect(result.current.sourceLines).toHaveLength(2);
      expect(result.current.targetLines).toHaveLength(3);
    });
  });

  describe("line numbers", () => {
    it("assigns correct line numbers starting from 1", () => {
      const code = `line1
line2
line3`;
      const { result } = renderHook(() => useDiffHighlights(code, code));

      expect(result.current.sourceLines[0].lineNumber).toBe(1);
      expect(result.current.sourceLines[1].lineNumber).toBe(2);
      expect(result.current.sourceLines[2].lineNumber).toBe(3);
    });
  });

  describe("memoization", () => {
    it("returns same result for same inputs", () => {
      const source = "const x = 1;";
      const target = "const y = 1;";

      const { result, rerender } = renderHook(
        ({ s, t }) => useDiffHighlights(s, t),
        { initialProps: { s: source, t: target } }
      );

      const firstResult = result.current;

      // Rerender with same props
      rerender({ s: source, t: target });

      // Should be same reference (memoized)
      expect(result.current.sourceLines).toBe(firstResult.sourceLines);
      expect(result.current.targetLines).toBe(firstResult.targetLines);
    });

    it("returns new result for different inputs", () => {
      const source1 = "const x = 1;";
      const source2 = "const z = 3;";
      const target = "const y = 2;";

      const { result, rerender } = renderHook(
        ({ s, t }) => useDiffHighlights(s, t),
        { initialProps: { s: source1, t: target } }
      );

      const firstResult = result.current;

      // Rerender with different source
      rerender({ s: source2, t: target });

      // Should be different reference
      expect(result.current.sourceLines).not.toBe(firstResult.sourceLines);
    });
  });

  describe("skips large files", () => {
    it("skips diff computation for very large files but returns lines", () => {
      // Create a source with more than 500 lines
      const largeSource = Array(600).fill("const x = 1;").join("\n");
      const largeTarget = Array(600).fill("const y = 2;").join("\n");

      const { result } = renderHook(() =>
        useDiffHighlights(largeSource, largeTarget)
      );

      // Should mark computed as false for large files
      expect(result.current.computed).toBe(false);
      // But should still return lines (without diff highlighting)
      expect(result.current.sourceLines).toHaveLength(600);
      expect(result.current.targetLines).toHaveLength(600);
      // All segments should be 'match' type (no diff computed)
      expect(result.current.sourceLines[0].segments[0].type).toBe("match");
    });
  });
});

// ============================================================================
// getSegmentOpacity Tests
// ============================================================================

describe("getSegmentOpacity", () => {
  it("returns 1 for match segments", () => {
    expect(getSegmentOpacity("match")).toBe(1);
  });

  it("returns 0.4 for source-only segments", () => {
    expect(getSegmentOpacity("source-only")).toBe(0.4);
  });

  it("returns 0.4 for target-only segments", () => {
    expect(getSegmentOpacity("target-only")).toBe(0.4);
  });
});
