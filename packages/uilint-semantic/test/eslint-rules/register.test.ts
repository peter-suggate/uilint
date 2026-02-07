import { describe, it, expect, afterAll } from "vitest";
import {
  getRuleMetadata,
  getExternalRules,
  clearExternalRules,
  getCategoryMeta,
} from "uilint-eslint";

describe("semantic ESLint rule registration", () => {
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
    expect(meta!.plugin).toBe("semantic");
    expect(meta!.category).toBe("semantic");
  });

  it("registers no-semantic-duplicates rule meta on import", async () => {
    const meta = getRuleMetadata("no-semantic-duplicates");
    expect(meta).toBeDefined();
    expect(meta!.plugin).toBe("semantic");
  });

  it("registers both rule implementations on import", async () => {
    const rules = getExternalRules();
    expect(rules.has("semantic")).toBe(true);
    expect(rules.has("no-semantic-duplicates")).toBe(true);
  });

  it("registers semantic category", async () => {
    // "semantic" category already exists as built-in, registerCategory is idempotent
    const cat = getCategoryMeta("semantic");
    expect(cat).toBeDefined();
  });
});
