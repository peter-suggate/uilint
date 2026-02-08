import { describe, it, expect, afterAll } from "vitest";
import {
  getRuleMetadata,
  getExternalRules,
  clearExternalRules,
  getCategoryMeta,
} from "uilint-eslint";

describe("styleguide ESLint rule registration", () => {
  // Import once — the side-effect registers rules on first import.
  // Module caching means subsequent imports are no-ops, so we don't
  // clear between tests (only clean up after all tests).
  afterAll(() => {
    clearExternalRules();
  });

  it("registers semantic rule meta on import", async () => {
    await import("../../src/eslint-rules/register.js");

    const meta = getRuleMetadata("semantic");
    expect(meta).toBeDefined();
    expect(meta!.plugin).toBe("styleguide");
    expect(meta!.category).toBe("styleguide");
  });

  it("registers only the semantic rule implementation", async () => {
    const rules = getExternalRules();
    expect(rules.has("semantic")).toBe(true);
    // no-semantic-duplicates has been moved to uilint-duplicates
    expect(rules.has("no-semantic-duplicates")).toBe(false);
  });

  it("registers styleguide category", async () => {
    const cat = getCategoryMeta("styleguide");
    expect(cat).toBeDefined();
    expect(cat!.name).toBe("Styleguide Rules");
  });
});
