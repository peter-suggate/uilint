import { describe, it, expect } from "vitest";
import { formatCurrency, truncateText } from "./formatters";

describe("formatters", () => {
  describe("formatCurrency", () => {
    it("formats USD by default", () => {
      expect(formatCurrency(100)).toBe("$100.00");
    });

    it("formats decimal amounts", () => {
      expect(formatCurrency(99.99)).toBe("$99.99");
    });
  });

  describe("truncateText", () => {
    it("returns original text if shorter than max", () => {
      expect(truncateText("hello", 10)).toBe("hello");
    });

    it("truncates with ellipsis", () => {
      expect(truncateText("hello world", 8)).toBe("hello...");
    });
  });
});
