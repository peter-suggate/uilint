import { describe, it, expect, afterAll } from "vitest";
import {
  getRuleMetadata,
  getExternalRules,
  clearExternalRules,
  getCategoryMeta,
} from "uilint-eslint";

describe("vision ESLint rule registration", () => {
  // Import once — the side-effect registers rules on first import.
  // Module caching means subsequent imports are no-ops, so we don't
  // clear between tests (only clean up after all tests).
  afterAll(() => {
    clearExternalRules();
  });

  it("registers rule meta on import", async () => {
    await import("../../src/eslint-rules/register.js");

    const meta = getRuleMetadata("semantic-vision");
    expect(meta).toBeDefined();
    expect(meta!.plugin).toBe("vision");
    expect(meta!.category).toBe("semantic");
  });

  it("registers rule implementation on import", async () => {
    const rules = getExternalRules();
    expect(rules.has("semantic-vision")).toBe(true);
  });

  it("registers vision category", async () => {
    const cat = getCategoryMeta("vision");
    expect(cat).toBeDefined();
    expect(cat!.name).toBe("Vision Rules");
  });
});
