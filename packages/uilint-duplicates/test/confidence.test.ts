import { describe, it, expect } from "vitest";
import {
  getConfidenceLevel,
  getConfidenceResult,
  formatConfidence,
  formatConfidenceVerbose,
  getConfidenceEmoji,
  getConfidenceAnsiColor,
  meetsMinimumThreshold,
  compareConfidenceLevels,
  filterByConfidence,
  DEFAULT_CONFIDENCE_CONFIG,
} from "../src/detection/confidence.js";

describe("Confidence System", () => {
  describe("getConfidenceLevel", () => {
    it("should return high for scores >= 0.90", () => {
      expect(getConfidenceLevel(0.95)).toBe("high");
      expect(getConfidenceLevel(0.9)).toBe("high");
      expect(getConfidenceLevel(1.0)).toBe("high");
    });

    it("should return medium for scores 0.75-0.89", () => {
      expect(getConfidenceLevel(0.89)).toBe("medium");
      expect(getConfidenceLevel(0.75)).toBe("medium");
      expect(getConfidenceLevel(0.8)).toBe("medium");
    });

    it("should return low for scores below 0.75", () => {
      expect(getConfidenceLevel(0.74)).toBe("low");
      expect(getConfidenceLevel(0.6)).toBe("low");
      expect(getConfidenceLevel(0.5)).toBe("low");
      expect(getConfidenceLevel(0)).toBe("low");
    });

    it("should respect custom config", () => {
      const config = {
        highThreshold: 0.95,
        mediumThreshold: 0.8,
        lowThreshold: 0.65,
      };

      expect(getConfidenceLevel(0.92, config)).toBe("medium");
      expect(getConfidenceLevel(0.95, config)).toBe("high");
      expect(getConfidenceLevel(0.79, config)).toBe("low");
    });
  });

  describe("meetsMinimumThreshold", () => {
    it("should return true for scores at or above low threshold", () => {
      expect(meetsMinimumThreshold(0.6)).toBe(true);
      expect(meetsMinimumThreshold(0.75)).toBe(true);
      expect(meetsMinimumThreshold(0.9)).toBe(true);
    });

    it("should return false for scores below low threshold", () => {
      expect(meetsMinimumThreshold(0.59)).toBe(false);
      expect(meetsMinimumThreshold(0.5)).toBe(false);
      expect(meetsMinimumThreshold(0)).toBe(false);
    });
  });

  describe("getConfidenceResult", () => {
    it("should provide actionable guidance for high confidence", () => {
      const result = getConfidenceResult(0.95);

      expect(result.level).toBe("high");
      expect(result.score).toBe(0.95);
      expect(result.description).toContain("near-identical");
      expect(result.action).toContain("consolidat");
      expect(result.color).toBe("red");
    });

    it("should provide review guidance for medium confidence", () => {
      const result = getConfidenceResult(0.8);

      expect(result.level).toBe("medium");
      expect(result.description).toContain("similar");
      expect(result.action).toContain("Review");
      expect(result.color).toBe("yellow");
    });

    it("should provide optional review for low confidence", () => {
      const result = getConfidenceResult(0.65);

      expect(result.level).toBe("low");
      expect(result.action).toContain("Optional");
      expect(result.color).toBe("green");
    });
  });

  describe("getConfidenceEmoji", () => {
    it("should return red circle for high", () => {
      expect(getConfidenceEmoji("high")).toBe("🔴");
    });

    it("should return yellow circle for medium", () => {
      expect(getConfidenceEmoji("medium")).toBe("🟡");
    });

    it("should return green circle for low", () => {
      expect(getConfidenceEmoji("low")).toBe("🟢");
    });
  });

  describe("getConfidenceAnsiColor", () => {
    it("should return red ANSI code for high", () => {
      expect(getConfidenceAnsiColor("high")).toBe("\x1b[31m");
    });

    it("should return yellow ANSI code for medium", () => {
      expect(getConfidenceAnsiColor("medium")).toBe("\x1b[33m");
    });

    it("should return green ANSI code for low", () => {
      expect(getConfidenceAnsiColor("low")).toBe("\x1b[32m");
    });
  });

  describe("formatConfidence", () => {
    it("should format with emoji and percentage", () => {
      const result = getConfidenceResult(0.85);
      const formatted = formatConfidence(result);

      expect(formatted).toContain("85%");
      expect(formatted).toContain("medium");
      expect(formatted).toContain("🟡");
    });

    it("should exclude emoji when disabled", () => {
      const result = getConfidenceResult(0.95);
      const formatted = formatConfidence(result, false);

      expect(formatted).not.toContain("🔴");
      expect(formatted).toContain("95%");
    });

    it("should include ANSI colors when enabled", () => {
      const result = getConfidenceResult(0.7);
      const formatted = formatConfidence(result, true, true);

      expect(formatted).toContain("\x1b[32m"); // Green
      expect(formatted).toContain("\x1b[0m"); // Reset
    });

    it("should round percentages correctly", () => {
      const result = getConfidenceResult(0.856);
      const formatted = formatConfidence(result);

      expect(formatted).toContain("86%");
    });
  });

  describe("formatConfidenceVerbose", () => {
    it("should include description and action", () => {
      const result = getConfidenceResult(0.92);
      const formatted = formatConfidenceVerbose(result);

      expect(formatted).toContain("92%");
      expect(formatted).toContain(result.description);
      expect(formatted).toContain(result.action);
    });
  });

  describe("compareConfidenceLevels", () => {
    it("should return positive when first is higher", () => {
      expect(compareConfidenceLevels("high", "medium")).toBeGreaterThan(0);
      expect(compareConfidenceLevels("high", "low")).toBeGreaterThan(0);
      expect(compareConfidenceLevels("medium", "low")).toBeGreaterThan(0);
    });

    it("should return negative when first is lower", () => {
      expect(compareConfidenceLevels("low", "high")).toBeLessThan(0);
      expect(compareConfidenceLevels("low", "medium")).toBeLessThan(0);
      expect(compareConfidenceLevels("medium", "high")).toBeLessThan(0);
    });

    it("should return 0 for equal levels", () => {
      expect(compareConfidenceLevels("high", "high")).toBe(0);
      expect(compareConfidenceLevels("medium", "medium")).toBe(0);
      expect(compareConfidenceLevels("low", "low")).toBe(0);
    });
  });

  describe("filterByConfidence", () => {
    const items = [
      { id: 1, score: 0.95 },
      { id: 2, score: 0.85 },
      { id: 3, score: 0.75 },
      { id: 4, score: 0.65 },
      { id: 5, score: 0.55 },
    ];

    it("should filter for high confidence only", () => {
      const filtered = filterByConfidence(items, "high");

      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe(1);
    });

    it("should filter for medium and above", () => {
      const filtered = filterByConfidence(items, "medium");

      expect(filtered.length).toBe(3);
      expect(filtered.map((i) => i.id)).toEqual([1, 2, 3]);
    });

    it("should filter for low and above", () => {
      const filtered = filterByConfidence(items, "low");

      expect(filtered.length).toBe(4);
      expect(filtered.map((i) => i.id)).toEqual([1, 2, 3, 4]);
    });
  });

  describe("DEFAULT_CONFIDENCE_CONFIG", () => {
    it("should have expected default values", () => {
      expect(DEFAULT_CONFIDENCE_CONFIG.highThreshold).toBe(0.9);
      expect(DEFAULT_CONFIDENCE_CONFIG.mediumThreshold).toBe(0.75);
      expect(DEFAULT_CONFIDENCE_CONFIG.lowThreshold).toBe(0.6);
    });
  });
});
