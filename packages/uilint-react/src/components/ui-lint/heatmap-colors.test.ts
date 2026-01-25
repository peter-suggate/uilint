/**
 * Unit tests for heatmap-colors module
 */

import { describe, it, expect } from "vitest";
import {
  calculateHeatmapOpacity,
  getSeverityColor,
  getSeverityBorderColor,
} from "./heatmap-colors";

describe("calculateHeatmapOpacity", () => {
  it("returns 0 for zero issue count", () => {
    expect(calculateHeatmapOpacity(0, 10)).toBe(0);
  });

  it("returns 0 when max issues is 0", () => {
    expect(calculateHeatmapOpacity(5, 0)).toBe(0);
  });

  it("returns minimum opacity for 1 issue", () => {
    const opacity = calculateHeatmapOpacity(1, 10);

    // Should be at or near minimum (0.15)
    expect(opacity).toBeGreaterThanOrEqual(0.15);
    expect(opacity).toBeLessThan(0.3);
  });

  it("returns maximum opacity when issue count equals max", () => {
    const opacity = calculateHeatmapOpacity(10, 10);

    // Should be at maximum (0.55)
    expect(opacity).toBeCloseTo(0.55, 2);
  });

  it("uses logarithmic scale - early counts make bigger relative jumps", () => {
    // Logarithmic scaling means doubling from 1->2 has more visual impact
    // than doubling from 50->100
    const opacity1 = calculateHeatmapOpacity(1, 100);
    const opacity2 = calculateHeatmapOpacity(2, 100);
    const opacity50 = calculateHeatmapOpacity(50, 100);
    const opacity100 = calculateHeatmapOpacity(100, 100);

    // Relative increase from 1 to 2 (doubling) should be larger than 50 to 100
    const relativeIncrease1to2 = (opacity2 - opacity1) / opacity1;
    const relativeIncrease50to100 = (opacity100 - opacity50) / opacity50;

    expect(relativeIncrease1to2).toBeGreaterThan(relativeIncrease50to100);
  });

  it("returns value within valid opacity range", () => {
    // Test various combinations
    const cases = [
      [1, 1],
      [1, 100],
      [50, 100],
      [100, 100],
      [1000, 10000],
    ];

    for (const [count, max] of cases) {
      const opacity = calculateHeatmapOpacity(count, max);
      expect(opacity).toBeGreaterThanOrEqual(0.15);
      expect(opacity).toBeLessThanOrEqual(0.55);
    }
  });

  it("handles edge case of single issue being max", () => {
    const opacity = calculateHeatmapOpacity(1, 1);

    expect(opacity).toBeCloseTo(0.55, 2);
  });
});

describe("getSeverityColor", () => {
  it("returns OKLCH color string for warn severity", () => {
    const color = getSeverityColor(0.3, "warn");

    expect(color).toMatch(/^oklch\(/);
    expect(color).toContain("0.75"); // Lightness
    expect(color).toContain("0.183"); // Chroma
    expect(color).toContain("55.934"); // Hue (amber)
    expect(color).toContain("0.300"); // Opacity
  });

  it("returns OKLCH color string for error severity", () => {
    const color = getSeverityColor(0.4, "error");

    expect(color).toMatch(/^oklch\(/);
    expect(color).toContain("0.65"); // Lightness (darker)
    expect(color).toContain("0.22"); // Chroma (more saturated)
    expect(color).toContain("25"); // Hue (red)
    expect(color).toContain("0.400"); // Opacity
  });

  it("formats opacity with 3 decimal places", () => {
    const color = getSeverityColor(0.12345, "warn");

    expect(color).toContain("0.123");
  });

  it("handles zero opacity", () => {
    const color = getSeverityColor(0, "warn");

    expect(color).toContain("0.000");
  });

  it("handles max opacity", () => {
    const color = getSeverityColor(1, "error");

    expect(color).toContain("1.000");
  });
});

describe("getSeverityBorderColor", () => {
  it("returns OKLCH color string with adjusted values for visibility", () => {
    const color = getSeverityBorderColor(0.3, "warn");

    expect(color).toMatch(/^oklch\(/);
    // Border should have higher opacity than base
    expect(color).toContain("0.500"); // 0.3 + 0.2
  });

  it("increases chroma for better border visibility", () => {
    const borderColor = getSeverityBorderColor(0.3, "warn");

    // Border should have higher chroma (more saturated)
    // warn base chroma is 0.183, border should be 0.183 + 0.05 = 0.233
    // Note: Due to floating point, it may be 0.23299999999999998
    expect(borderColor).toMatch(/0\.232?9{0,15}/);
  });

  it("decreases lightness for darker border", () => {
    const borderColor = getSeverityBorderColor(0.3, "warn");

    // warn base lightness is 0.75, border should be 0.75 - 0.1 = 0.65
    expect(borderColor).toContain("0.65");
  });

  it("caps opacity at 0.8", () => {
    const color = getSeverityBorderColor(0.7, "error");

    // 0.7 + 0.2 = 0.9, but should cap at 0.8
    expect(color).toContain("0.800");
  });

  it("handles zero opacity correctly", () => {
    const color = getSeverityBorderColor(0, "warn");

    // 0 + 0.2 = 0.2
    expect(color).toContain("0.200");
  });

  it("returns different colors for error vs warn", () => {
    const warnColor = getSeverityBorderColor(0.3, "warn");
    const errorColor = getSeverityBorderColor(0.3, "error");

    expect(warnColor).not.toBe(errorColor);
    expect(warnColor).toContain("55.934"); // Amber hue
    expect(errorColor).toContain("25"); // Red hue
  });
});
