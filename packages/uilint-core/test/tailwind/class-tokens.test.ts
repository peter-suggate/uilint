import { describe, it, expect } from "vitest";
import {
  extractClassTokensFromHtml,
  topEntries,
} from "../../src/tailwind/class-tokens.js";

describe("extractClassTokensFromHtml", () => {
  it("extracts utilities from class attributes", () => {
    const html = '<div class="bg-gray-50 text-sm p-4">Hello</div>';
    const result = extractClassTokensFromHtml(html);

    expect(result.utilities.get("bg-gray-50")).toBe(1);
    expect(result.utilities.get("text-sm")).toBe(1);
    expect(result.utilities.get("p-4")).toBe(1);
  });

  it("extracts utilities from className attributes", () => {
    const html = '<button className="bg-blue-500 text-white">Click</button>';
    const result = extractClassTokensFromHtml(html);

    expect(result.utilities.get("bg-blue-500")).toBe(1);
    expect(result.utilities.get("text-white")).toBe(1);
  });

  it("counts duplicate utilities", () => {
    const html = `
      <div class="p-4 text-sm">One</div>
      <div class="p-4 text-lg">Two</div>
      <span class="p-4">Three</span>
    `;
    const result = extractClassTokensFromHtml(html);

    expect(result.utilities.get("p-4")).toBe(3);
    expect(result.utilities.get("text-sm")).toBe(1);
    expect(result.utilities.get("text-lg")).toBe(1);
  });

  it("separates variants from base utilities", () => {
    const html = '<div class="sm:hover:bg-gray-50 lg:text-xl">test</div>';
    const result = extractClassTokensFromHtml(html);

    expect(result.utilities.get("bg-gray-50")).toBe(1);
    expect(result.utilities.get("text-xl")).toBe(1);
    expect(result.variants.get("sm")).toBe(1);
    expect(result.variants.get("hover")).toBe(1);
    expect(result.variants.get("lg")).toBe(1);
  });

  it("handles bracket-aware arbitrary values without splitting on colon", () => {
    const html = '<div class="bg-[color:var(--primary)]">test</div>';
    const result = extractClassTokensFromHtml(html);

    // Should NOT split on the colon inside brackets
    expect(result.utilities.get("bg-[color:var(--primary)]")).toBe(1);
    expect(result.variants.size).toBe(0);
  });

  it("handles variants with bracket arbitrary values", () => {
    const html = '<div class="sm:bg-[color:var(--x)]">test</div>';
    const result = extractClassTokensFromHtml(html);

    expect(result.utilities.get("bg-[color:var(--x)]")).toBe(1);
    expect(result.variants.get("sm")).toBe(1);
  });

  it("strips important modifier (!)", () => {
    const html = '<div class="!bg-red-500 !font-bold">test</div>';
    const result = extractClassTokensFromHtml(html);

    expect(result.utilities.get("bg-red-500")).toBe(1);
    expect(result.utilities.get("font-bold")).toBe(1);
    expect(result.utilities.has("!bg-red-500")).toBe(false);
  });

  it("returns empty maps for empty/falsy html", () => {
    expect(extractClassTokensFromHtml("").utilities.size).toBe(0);
    expect(extractClassTokensFromHtml("").variants.size).toBe(0);
  });

  it("ignores tokens that are just braces", () => {
    // Edge case: if somehow { or } appear as a class token
    const html = '<div class="{ }">test</div>';
    const result = extractClassTokensFromHtml(html);

    expect(result.utilities.size).toBe(0);
  });

  it("respects maxTokens limit", () => {
    const classes = Array.from({ length: 100 }, (_, i) => `cls-${i}`).join(" ");
    const html = `<div class="${classes}">test</div>`;
    const result = extractClassTokensFromHtml(html, { maxTokens: 5 });

    expect(result.utilities.size).toBe(5);
  });

  it("handles mixed class and className in same HTML", () => {
    const html = `
      <div class="p-4 m-2">test</div>
      <Component className="flex items-center">test</Component>
    `;
    const result = extractClassTokensFromHtml(html);

    expect(result.utilities.get("p-4")).toBe(1);
    expect(result.utilities.get("m-2")).toBe(1);
    expect(result.utilities.get("flex")).toBe(1);
    expect(result.utilities.get("items-center")).toBe(1);
  });
});

describe("topEntries", () => {
  it("returns top N entries sorted by count descending", () => {
    const map = new Map([
      ["p-4", 10],
      ["m-2", 5],
      ["flex", 20],
      ["text-sm", 1],
    ]);

    const result = topEntries(map, 2);

    expect(result).toEqual([
      { token: "flex", count: 20 },
      { token: "p-4", count: 10 },
    ]);
  });

  it("returns all entries when limit exceeds map size", () => {
    const map = new Map([["p-4", 3]]);
    const result = topEntries(map, 10);

    expect(result).toEqual([{ token: "p-4", count: 3 }]);
  });

  it("handles empty map", () => {
    expect(topEntries(new Map(), 5)).toEqual([]);
  });
});
