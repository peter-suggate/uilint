/**
 * Tests for Category Registry
 */

import { describe, it, expect, beforeAll } from "vitest";
import { categoryRegistry, getCategoryMeta, type CategoryMeta } from "./category-registry.js";

describe("categoryRegistry", () => {
  it("should have exactly two categories", () => {
    expect(categoryRegistry).toHaveLength(2);
  });

  it("should have static and semantic categories", () => {
    const ids = categoryRegistry.map((cat) => cat.id);
    expect(ids).toContain("static");
    expect(ids).toContain("semantic");
  });

  describe("static category", () => {
    let staticCat: CategoryMeta;

    beforeAll(() => {
      staticCat = categoryRegistry.find((cat) => cat.id === "static")!;
    });

    it("should have correct metadata", () => {
      expect(staticCat.name).toBe("Static Rules");
      expect(staticCat.description).toBe("Pattern-based, fast analysis");
      expect(staticCat.icon).toBe("📋");
    });

    it("should be enabled by default", () => {
      expect(staticCat.defaultEnabled).toBe(true);
    });
  });

  describe("semantic category", () => {
    let semanticCat: CategoryMeta;

    beforeAll(() => {
      semanticCat = categoryRegistry.find((cat) => cat.id === "semantic")!;
    });

    it("should have correct metadata", () => {
      expect(semanticCat.name).toBe("Semantic Rules");
      expect(semanticCat.description).toBe("LLM-powered analysis");
      expect(semanticCat.icon).toBe("🧠");
    });

    it("should be disabled by default", () => {
      expect(semanticCat.defaultEnabled).toBe(false);
    });
  });
});

describe("getCategoryMeta", () => {
  it("should return static category metadata", () => {
    const cat = getCategoryMeta("static");
    expect(cat).toBeDefined();
    expect(cat?.id).toBe("static");
    expect(cat?.name).toBe("Static Rules");
  });

  it("should return semantic category metadata", () => {
    const cat = getCategoryMeta("semantic");
    expect(cat).toBeDefined();
    expect(cat?.id).toBe("semantic");
    expect(cat?.name).toBe("Semantic Rules");
  });

  it("should return undefined for unknown category", () => {
    const cat = getCategoryMeta("unknown");
    expect(cat).toBeUndefined();
  });
});
