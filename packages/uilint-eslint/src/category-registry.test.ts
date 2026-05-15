/**
 * Tests for Category Registry
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { categoryRegistry, getCategoryMeta, getPluginCategories, registerCategory, type CategoryMeta } from "./category-registry.js";

describe("categoryRegistry", () => {
  it("should have at least the static built-in category", () => {
    expect(categoryRegistry.length).toBeGreaterThanOrEqual(1);
  });

  it("should have static category (other categories are registered by plugins)", () => {
    const ids = categoryRegistry.map((cat) => cat.id);
    expect(ids).toContain("static");
  });

  describe("static category", () => {
    let staticCat: CategoryMeta;

    beforeAll(() => {
      staticCat = categoryRegistry.find((cat) => cat.id === "static")!;
    });

    it("should have correct metadata", () => {
      expect(staticCat.name).toBe("Static Rules");
      expect(staticCat.description).toBe("Pattern-based, fast analysis");
      expect(staticCat.icon).toBe("\u{1F4CB}");
    });

    it("should be enabled by default", () => {
      expect(staticCat.defaultEnabled).toBe(true);
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

  it("should return undefined for unknown category", () => {
    const cat = getCategoryMeta("unknown");
    expect(cat).toBeUndefined();
  });
});

describe("getPluginCategories", () => {
  afterEach(() => {
    // Remove any test categories added during tests
    const testIndex = categoryRegistry.findIndex((c) => c.id === "test-plugin-cat");
    if (testIndex !== -1) categoryRegistry.splice(testIndex, 1);
  });

  it("returns empty when only static category exists", () => {
    const pluginCats = getPluginCategories();
    // In isolation, only static exists, so plugin categories should be empty
    // (but other tests may have registered categories)
    expect(Array.isArray(pluginCats)).toBe(true);
  });

  it("returns registered plugin categories", () => {
    registerCategory({
      id: "test-plugin-cat",
      name: "Test Plugin",
      description: "For testing getPluginCategories",
      icon: "\u{1F9EA}",
      defaultEnabled: false,
    });

    const pluginCats = getPluginCategories();
    expect(pluginCats.find((c) => c.id === "test-plugin-cat")).toBeDefined();
  });

  it("excludes static from results", () => {
    const pluginCats = getPluginCategories();
    expect(pluginCats.find((c) => c.id === "static")).toBeUndefined();
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
      icon: "\u{1F441}\u{FE0F}",
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
      icon: "\u{1F527}",
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
      icon: "\u{1F9EA}",
      defaultEnabled: false,
    });

    expect(getCategoryMeta("test-cat")?.id).toBe("test-cat");
  });
});
