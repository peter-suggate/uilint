import { describe, it, expect } from "vitest";
import {
  jaccard,
  calculateSizeRatio,
  calculateStructuralSimilarity,
  hasHighStructuralSimilarity,
  findStructurallySimilar,
  DEFAULT_STRUCTURAL_WEIGHTS,
} from "../src/detection/structural-scorer.js";
import type { StoredChunkMetadata } from "../src/index/types.js";

// Helper to create mock metadata
function createMockMetadata(
  overrides: Partial<StoredChunkMetadata> & {
    props?: string[];
    hooks?: string[];
    jsxElements?: string[];
  }
): StoredChunkMetadata {
  const { props, hooks, jsxElements, ...rest } = overrides;
  return {
    filePath: "/test/file.tsx",
    startLine: 1,
    endLine: 20,
    startColumn: 0,
    endColumn: 1,
    kind: "component",
    name: "TestComponent",
    contentHash: "abc123",
    metadata: {
      props: props ?? [],
      hooks: hooks ?? [],
      jsxElements: jsxElements ?? [],
    },
    ...rest,
  };
}

describe("Structural Scorer", () => {
  describe("jaccard", () => {
    it("should return 1 for identical arrays", () => {
      expect(jaccard(["a", "b", "c"], ["a", "b", "c"])).toBe(1);
    });

    it("should return 1 for empty arrays", () => {
      expect(jaccard([], [])).toBe(1);
    });

    it("should return 0 for disjoint arrays", () => {
      expect(jaccard(["a", "b"], ["c", "d"])).toBe(0);
    });

    it("should return 0 when one array is empty", () => {
      expect(jaccard(["a", "b"], [])).toBe(0);
      expect(jaccard([], ["a", "b"])).toBe(0);
    });

    it("should calculate correct overlap for partial matches", () => {
      // {a, b} ∩ {b, c} = {b}, |{b}| / |{a, b, c}| = 1/3
      expect(jaccard(["a", "b"], ["b", "c"])).toBeCloseTo(1 / 3, 5);
    });

    it("should be case-insensitive", () => {
      expect(jaccard(["Button", "DIV"], ["button", "div"])).toBe(1);
    });

    it("should handle duplicates in arrays", () => {
      expect(jaccard(["a", "a", "b"], ["a", "b", "b"])).toBe(1);
    });
  });

  describe("calculateSizeRatio", () => {
    it("should return 1 for identical sizes", () => {
      expect(calculateSizeRatio(10, 10)).toBe(1);
    });

    it("should return 0.5 for double size", () => {
      expect(calculateSizeRatio(10, 20)).toBe(0.5);
    });

    it("should be symmetric", () => {
      expect(calculateSizeRatio(10, 20)).toBe(calculateSizeRatio(20, 10));
    });

    it("should return 0 when one size is 0", () => {
      expect(calculateSizeRatio(0, 10)).toBe(0);
      expect(calculateSizeRatio(10, 0)).toBe(0);
    });

    it("should return 1 for both zero", () => {
      expect(calculateSizeRatio(0, 0)).toBe(1);
    });
  });

  describe("calculateStructuralSimilarity", () => {
    it("should return all 1s for identical metadata", () => {
      const meta = createMockMetadata({
        props: ["title", "description"],
        jsxElements: ["div", "span"],
        hooks: ["useState"],
        startLine: 1,
        endLine: 20,
      });

      const score = calculateStructuralSimilarity(meta, meta);

      expect(score.propsOverlap).toBe(1);
      expect(score.jsxOverlap).toBe(1);
      expect(score.hooksOverlap).toBe(1);
      expect(score.sizeRatio).toBe(1);
      expect(score.combined).toBe(1);
    });

    it("should return 0s for completely different metadata", () => {
      const metaA = createMockMetadata({
        props: ["a"],
        jsxElements: ["div"],
        hooks: ["useState"],
        startLine: 1,
        endLine: 10,
      });

      const metaB = createMockMetadata({
        props: ["b"],
        jsxElements: ["span"],
        hooks: ["useEffect"],
        startLine: 1,
        endLine: 100,
      });

      const score = calculateStructuralSimilarity(metaA, metaB);

      expect(score.propsOverlap).toBe(0);
      expect(score.jsxOverlap).toBe(0);
      expect(score.hooksOverlap).toBe(0);
      expect(score.sizeRatio).toBe(0.1);
    });

    it("should detect Badge vs Tag as structurally similar", () => {
      const badge = createMockMetadata({
        name: "Badge",
        props: ["children", "variant", "size"],
        jsxElements: ["span"],
        hooks: [],
        startLine: 1,
        endLine: 15,
      });

      const tag = createMockMetadata({
        name: "Tag",
        props: ["children", "type", "dimension"],
        jsxElements: ["span"],
        hooks: [],
        startLine: 1,
        endLine: 15,
      });

      const score = calculateStructuralSimilarity(badge, tag);

      // Same JSX (span)
      expect(score.jsxOverlap).toBe(1);
      // Only 'children' overlaps out of 5 total unique props
      expect(score.propsOverlap).toBeCloseTo(0.2, 1);
      // Same size
      expect(score.sizeRatio).toBe(1);
      // No hooks
      expect(score.hooksOverlap).toBe(1);
      // Combined should be moderate
      expect(score.combined).toBeGreaterThan(0.5);
    });

    it("should detect MetricCard vs StatCard as similar", () => {
      const metricCard = createMockMetadata({
        name: "MetricCard",
        props: ["title", "current", "baseline", "displayMode"],
        jsxElements: ["div", "p", "span"],
        hooks: ["useMemo"],
        startLine: 1,
        endLine: 50,
      });

      const statCard = createMockMetadata({
        name: "StatCard",
        props: ["label", "value", "previousValue", "format"],
        jsxElements: ["div", "p", "span"],
        hooks: [],
        startLine: 1,
        endLine: 45,
      });

      const score = calculateStructuralSimilarity(metricCard, statCard);

      // Same basic JSX elements
      expect(score.jsxOverlap).toBe(1);
      // Different prop names
      expect(score.propsOverlap).toBe(0);
      // Similar size
      expect(score.sizeRatio).toBeGreaterThan(0.8);
    });

    it("should use custom weights", () => {
      const metaA = createMockMetadata({
        props: ["a", "b"],
        jsxElements: ["div"],
        hooks: [],
      });

      const metaB = createMockMetadata({
        props: ["a", "b"],
        jsxElements: ["span"],
        hooks: [],
      });

      // With default weights (jsx has higher weight)
      const defaultScore = calculateStructuralSimilarity(metaA, metaB);

      // With custom weights (props has higher weight)
      const customScore = calculateStructuralSimilarity(metaA, metaB, {
        props: 0.8,
        jsx: 0.1,
        hooks: 0.05,
        size: 0.05,
      });

      // Props match perfectly but JSX doesn't
      expect(customScore.combined).toBeGreaterThan(defaultScore.combined);
    });

    it("should handle missing metadata fields gracefully", () => {
      const metaA = createMockMetadata({
        startLine: 1,
        endLine: 10,
      });

      const metaB = createMockMetadata({
        props: ["a"],
        startLine: 1,
        endLine: 10,
      });

      // Should not throw
      const score = calculateStructuralSimilarity(metaA, metaB);
      expect(score.propsOverlap).toBe(0); // Empty vs non-empty
      expect(score.combined).toBeDefined();
    });
  });

  describe("hasHighStructuralSimilarity", () => {
    it("should return true for similar components", () => {
      const a = createMockMetadata({
        props: ["a", "b"],
        jsxElements: ["div", "span"],
        hooks: ["useState"],
      });

      const b = createMockMetadata({
        props: ["a", "b"],
        jsxElements: ["div", "span"],
        hooks: ["useState"],
      });

      expect(hasHighStructuralSimilarity(a, b, 0.8)).toBe(true);
    });

    it("should return false for different components", () => {
      const a = createMockMetadata({
        props: ["a"],
        jsxElements: ["div"],
        hooks: [],
      });

      const b = createMockMetadata({
        props: ["x"],
        jsxElements: ["table"],
        hooks: ["useEffect"],
      });

      expect(hasHighStructuralSimilarity(a, b, 0.5)).toBe(false);
    });

    it("should respect custom threshold", () => {
      const a = createMockMetadata({
        props: ["a", "b"],
        jsxElements: ["div"],
        hooks: [],
      });

      const b = createMockMetadata({
        props: ["a", "c"],
        jsxElements: ["div"],
        hooks: [],
      });

      // Moderate similarity
      expect(hasHighStructuralSimilarity(a, b, 0.3)).toBe(true);
      expect(hasHighStructuralSimilarity(a, b, 0.9)).toBe(false);
    });
  });

  describe("findStructurallySimilar", () => {
    it("should find similar chunks sorted by score", () => {
      const target = createMockMetadata({
        filePath: "/target.tsx",
        props: ["a", "b"],
        jsxElements: ["div", "span"],
        hooks: ["useState"],
        startLine: 1,
        endLine: 20,
      });

      const identical = createMockMetadata({
        filePath: "/identical.tsx",
        props: ["a", "b"],
        jsxElements: ["div", "span"],
        hooks: ["useState"],
        startLine: 1,
        endLine: 20,
      });

      const similar = createMockMetadata({
        filePath: "/similar.tsx",
        props: ["a", "c"],
        jsxElements: ["div", "span"],
        hooks: ["useState"],
        startLine: 1,
        endLine: 25,
      });

      const different = createMockMetadata({
        filePath: "/different.tsx",
        props: ["x", "y"],
        jsxElements: ["table"],
        hooks: ["useEffect"],
        startLine: 1,
        endLine: 100,
      });

      const results = findStructurallySimilar(
        target,
        [identical, similar, different],
        0.5
      );

      expect(results.length).toBe(2);
      expect(results[0].metadata.filePath).toBe("/identical.tsx");
      expect(results[0].score.combined).toBe(1);
      expect(results[1].metadata.filePath).toBe("/similar.tsx");
    });

    it("should exclude self from results", () => {
      const target = createMockMetadata({
        filePath: "/test.tsx",
        startLine: 10,
        props: ["a"],
        jsxElements: ["div"],
      });

      const results = findStructurallySimilar(target, [target], 0);

      expect(results.length).toBe(0);
    });

    it("should respect limit parameter", () => {
      const target = createMockMetadata({
        filePath: "/target.tsx",
        props: ["a"],
        jsxElements: ["div"],
      });

      const candidates = Array.from({ length: 20 }, (_, i) =>
        createMockMetadata({
          filePath: `/file${i}.tsx`,
          props: ["a"],
          jsxElements: ["div"],
        })
      );

      const results = findStructurallySimilar(target, candidates, 0, 5);

      expect(results.length).toBe(5);
    });
  });
});
