import { describe, it, expect } from "vitest";
import {
  calculateCombinedScore,
  isPotentialDuplicate,
  calculateQuickScore,
  getRecommendedAction,
  formatCombinedScore,
  DEFAULT_COMBINED_SCORER_OPTIONS,
} from "../src/detection/combined-scorer.js";
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

describe("Combined Scorer", () => {
  describe("calculateCombinedScore", () => {
    it("should combine semantic and structural scores", () => {
      const metaA = createMockMetadata({
        props: ["title", "description"],
        jsxElements: ["div", "span"],
        hooks: ["useState"],
      });

      const metaB = createMockMetadata({
        props: ["title", "description"],
        jsxElements: ["div", "span"],
        hooks: ["useState"],
      });

      const result = calculateCombinedScore(0.9, metaA, metaB);

      expect(result.semantic).toBe(0.9);
      expect(result.structural).toBe(1); // Identical structure
      expect(result.final).toBeGreaterThan(0.9);
      expect(result.confidence).toBe("high");
    });

    it("should boost score for high semantic similarity", () => {
      const metaA = createMockMetadata({
        props: ["a"],
        jsxElements: ["div"],
      });

      const metaB = createMockMetadata({
        props: ["b"],
        jsxElements: ["span"],
      });

      // High semantic score but low structural
      const result = calculateCombinedScore(0.96, metaA, metaB);

      // Should still have high confidence due to boost
      expect(result.final).toBeGreaterThan(0.6);
    });

    it("should include normalized similarity when enabled", () => {
      const metaA = createMockMetadata({ props: ["a"] });
      const metaB = createMockMetadata({ props: ["a"] });

      const codeA = "function add(x, y) { return x + y; }";
      const codeB = "function sum(a, b) { return a + b; }";

      const result = calculateCombinedScore(0.8, metaA, metaB, codeA, codeB, {
        includeNormalized: true,
      });

      expect(result.normalized).toBeDefined();
      expect(result.normalized).toBeGreaterThan(0.8);
    });

    it("should not include normalized when disabled", () => {
      const metaA = createMockMetadata({ props: ["a"] });
      const metaB = createMockMetadata({ props: ["a"] });

      const result = calculateCombinedScore(0.8, metaA, metaB, "code1", "code2", {
        includeNormalized: false,
      });

      expect(result.normalized).toBeUndefined();
    });

    it("should clamp final score to [0, 1]", () => {
      const metaA = createMockMetadata({
        props: ["a", "b"],
        jsxElements: ["div"],
        hooks: ["useState"],
      });

      // Perfect scores everywhere
      const result = calculateCombinedScore(1.0, metaA, metaA);

      expect(result.final).toBeLessThanOrEqual(1);
      expect(result.final).toBeGreaterThanOrEqual(0);
    });

    it("should provide confidence details", () => {
      const meta = createMockMetadata({ props: ["a"] });
      const result = calculateCombinedScore(0.85, meta, meta);

      expect(result.confidenceDetails).toBeDefined();
      expect(result.confidenceDetails.level).toBe(result.confidence);
      expect(result.confidenceDetails.description).toBeDefined();
      expect(result.confidenceDetails.action).toBeDefined();
    });

    it("should use custom weights", () => {
      const metaA = createMockMetadata({
        props: ["a", "b"],
        jsxElements: ["div"],
      });

      const metaB = createMockMetadata({
        props: ["a", "b"],
        jsxElements: ["span"], // Different JSX
      });

      // Default: semantic 0.5, structural 0.3
      const defaultResult = calculateCombinedScore(0.5, metaA, metaB);

      // Custom: heavily weight structural
      const customResult = calculateCombinedScore(0.5, metaA, metaB, undefined, undefined, {
        semanticWeight: 0.2,
        structuralWeight: 0.8,
      });

      // With low semantic but moderate structural, custom weights should differ
      expect(customResult.final).not.toBeCloseTo(defaultResult.final, 1);
    });
  });

  describe("isPotentialDuplicate", () => {
    it("should return true for structurally similar components", () => {
      const metaA = createMockMetadata({
        props: ["title"],
        jsxElements: ["div", "span"],
        hooks: ["useState"],
      });

      const metaB = createMockMetadata({
        props: ["title"],
        jsxElements: ["div", "span"],
        hooks: ["useState"],
      });

      expect(isPotentialDuplicate(metaA, metaB)).toBe(true);
    });

    it("should return false for structurally different components", () => {
      const metaA = createMockMetadata({
        props: ["a"],
        jsxElements: ["div"],
        hooks: [],
      });

      const metaB = createMockMetadata({
        props: ["x", "y", "z"],
        jsxElements: ["table", "tr", "td"],
        hooks: ["useEffect", "useCallback"],
      });

      expect(isPotentialDuplicate(metaA, metaB)).toBe(false);
    });

    it("should respect custom threshold", () => {
      const metaA = createMockMetadata({
        props: ["a", "b"],
        jsxElements: ["div"],
      });

      const metaB = createMockMetadata({
        props: ["a", "c"],
        jsxElements: ["div"],
      });

      expect(isPotentialDuplicate(metaA, metaB, 0.2)).toBe(true);
      expect(isPotentialDuplicate(metaA, metaB, 0.9)).toBe(false);
    });
  });

  describe("calculateQuickScore", () => {
    it("should return structural score and confidence", () => {
      const metaA = createMockMetadata({
        props: ["title"],
        jsxElements: ["div"],
        hooks: ["useState"],
      });

      const metaB = createMockMetadata({
        props: ["title"],
        jsxElements: ["div"],
        hooks: ["useState"],
      });

      const result = calculateQuickScore(metaA, metaB);

      expect(result.score).toBe(1);
      expect(result.confidence).toBe("high");
    });

    it("should calculate confidence correctly for moderate similarity", () => {
      const metaA = createMockMetadata({
        props: ["a", "b"],
        jsxElements: ["div"],
      });

      const metaB = createMockMetadata({
        props: ["a", "c"],
        jsxElements: ["span"],
      });

      const result = calculateQuickScore(metaA, metaB);

      expect(result.score).toBeLessThan(1);
      expect(result.confidence).toBeDefined();
    });
  });

  describe("getRecommendedAction", () => {
    it("should recommend consolidation for near-identical code", () => {
      const score = {
        final: 0.95,
        semantic: 0.9,
        structural: 0.9,
        normalized: 0.98,
        structuralDetails: { propsOverlap: 1, jsxOverlap: 1, hooksOverlap: 1, sizeRatio: 1, combined: 1 },
        confidence: "high" as const,
        confidenceDetails: {
          level: "high" as const,
          score: 0.95,
          description: "",
          action: "",
          color: "red" as const,
        },
      };

      const action = getRecommendedAction(score);
      expect(action).toContain("near-identical");
    });

    it("should recommend review for moderate similarity", () => {
      const score = {
        final: 0.8,
        semantic: 0.8,
        structural: 0.7,
        structuralDetails: { propsOverlap: 0.7, jsxOverlap: 0.8, hooksOverlap: 0.6, sizeRatio: 0.9, combined: 0.7 },
        confidence: "medium" as const,
        confidenceDetails: {
          level: "medium" as const,
          score: 0.8,
          description: "",
          action: "",
          color: "yellow" as const,
        },
      };

      const action = getRecommendedAction(score);
      expect(action.toLowerCase()).toContain("review");
    });

    it("should note structural vs semantic mismatch", () => {
      const score = {
        final: 0.7,
        semantic: 0.5,
        structural: 0.9,
        structuralDetails: { propsOverlap: 0.9, jsxOverlap: 0.9, hooksOverlap: 0.9, sizeRatio: 0.9, combined: 0.9 },
        confidence: "low" as const,
        confidenceDetails: {
          level: "low" as const,
          score: 0.7,
          description: "",
          action: "",
          color: "green" as const,
        },
      };

      const action = getRecommendedAction(score);
      expect(action).toContain("structure");
    });
  });

  describe("formatCombinedScore", () => {
    it("should format basic score", () => {
      const score = {
        final: 0.85,
        semantic: 0.9,
        structural: 0.8,
        structuralDetails: { propsOverlap: 0.8, jsxOverlap: 0.8, hooksOverlap: 0.8, sizeRatio: 0.8, combined: 0.8 },
        confidence: "medium" as const,
        confidenceDetails: {
          level: "medium" as const,
          score: 0.85,
          description: "test",
          action: "test action",
          color: "yellow" as const,
        },
      };

      const formatted = formatCombinedScore(score);

      expect(formatted).toContain("85%");
      expect(formatted).toContain("medium");
    });

    it("should include details in verbose mode", () => {
      const score = {
        final: 0.85,
        semantic: 0.9,
        structural: 0.8,
        normalized: 0.95,
        structuralDetails: { propsOverlap: 0.8, jsxOverlap: 0.8, hooksOverlap: 0.8, sizeRatio: 0.8, combined: 0.8 },
        confidence: "medium" as const,
        confidenceDetails: {
          level: "medium" as const,
          score: 0.85,
          description: "test",
          action: "test action",
          color: "yellow" as const,
        },
      };

      const formatted = formatCombinedScore(score, true);

      expect(formatted).toContain("Semantic");
      expect(formatted).toContain("90%");
      expect(formatted).toContain("Structural");
      expect(formatted).toContain("80%");
      expect(formatted).toContain("Normalized");
      expect(formatted).toContain("95%");
    });

    it("should not include normalized when not available", () => {
      const score = {
        final: 0.85,
        semantic: 0.9,
        structural: 0.8,
        structuralDetails: { propsOverlap: 0.8, jsxOverlap: 0.8, hooksOverlap: 0.8, sizeRatio: 0.8, combined: 0.8 },
        confidence: "medium" as const,
        confidenceDetails: {
          level: "medium" as const,
          score: 0.85,
          description: "test",
          action: "test action",
          color: "yellow" as const,
        },
      };

      const formatted = formatCombinedScore(score, true);

      expect(formatted).not.toContain("Normalized");
    });
  });

  describe("DEFAULT_COMBINED_SCORER_OPTIONS", () => {
    it("should have expected default values", () => {
      expect(DEFAULT_COMBINED_SCORER_OPTIONS.semanticWeight).toBe(0.5);
      expect(DEFAULT_COMBINED_SCORER_OPTIONS.structuralWeight).toBe(0.3);
      expect(DEFAULT_COMBINED_SCORER_OPTIONS.normalizedWeight).toBe(0.2);
      expect(DEFAULT_COMBINED_SCORER_OPTIONS.includeNormalized).toBe(false);
    });
  });
});
