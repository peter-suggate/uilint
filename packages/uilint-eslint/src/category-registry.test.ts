/**
 * Tests for Category Registry
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { categoryRegistry, getCategoryMeta, registerCategory, type CategoryMeta } from "./category-registry.js";

describe("categoryRegistry", () => {
  it("should have at least the two built-in categories", () => {
    expect(categoryRegistry.length).toBeGreaterThanOrEqual(2);
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

describe("registerCategory", () => {
  afterEach(() => {
    // Remove any test categories added during tests
    const testIndex = categoryRegistry.findIndex((c) => c.id === "test-cat");
    if (testIndex !== -1) categoryRegistry.splice(testIndex, 1);
    const visionIndex = categoryRegistry.findIndex((c) => c.id === "vision");
    if (visionIndex !== -1) categoryRegistry.splice(visionIndex, 1);
  });

  it("registers a new category", () => {
    registerCategory({
      id: "vision",
      name: "Vision Rules",
      description: "AI-powered visual analysis",
      icon: "👁️",
      defaultEnabled: false,
    });

    const cat = getCategoryMeta("vision");
    expect(cat).toBeDefined();
    expect(cat?.name).toBe("Vision Rules");
  });

  it("is idempotent for duplicate registrations", () => {
    const before = categoryRegistry.length;

    registerCategory({
      id: "static",
      name: "Different Name",
      description: "Different",
      icon: "🔧",
      defaultEnabled: true,
    });

    expect(categoryRegistry.length).toBe(before);
    // Original metadata preserved
    expect(getCategoryMeta("static")?.name).toBe("Static Rules");
  });

  it("makes category findable via getCategoryMeta", () => {
    registerCategory({
      id: "test-cat",
      name: "Test Category",
      description: "For testing",
      icon: "🧪",
      defaultEnabled: false,
    });

    expect(getCategoryMeta("test-cat")?.id).toBe("test-cat");
  });
});
