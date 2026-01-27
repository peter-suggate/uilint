/**
 * Tests for Rule Registry and Rule Metadata
 *
 * These tests ensure all rules have proper metadata for CLI integration.
 */

import { describe, it, expect } from "vitest";
import {
  ruleRegistry,
  getRuleMetadata,
  getRulesByCategory,
  getAllRuleIds,
  getCategoryMeta,
  type RuleMeta,
} from "./rule-registry.js";

describe("ruleRegistry", () => {
  it("should contain rules", () => {
    expect(ruleRegistry.length).toBeGreaterThan(0);
  });

  it("should have unique rule IDs", () => {
    const ids = ruleRegistry.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  describe("rule metadata fields", () => {
    it("all rules should have required fields", () => {
      for (const rule of ruleRegistry) {
        // Required fields
        expect(rule.id, `${rule.id}: missing id`).toBeDefined();
        expect(rule.name, `${rule.id}: missing name`).toBeDefined();
        expect(rule.description, `${rule.id}: missing description`).toBeDefined();
        expect(rule.category, `${rule.id}: missing category`).toMatch(/^(static|semantic)$/);
        expect(rule.defaultSeverity, `${rule.id}: missing defaultSeverity`).toMatch(
          /^(error|warn|off)$/
        );
      }
    });

    it("all rules should have icon metadata", () => {
      for (const rule of ruleRegistry) {
        expect(rule.icon, `${rule.id}: missing icon`).toBeDefined();
        expect(rule.icon?.length, `${rule.id}: icon should be non-empty`).toBeGreaterThan(0);
      }
    });

    it("all rules should have hint metadata", () => {
      for (const rule of ruleRegistry) {
        expect(rule.hint, `${rule.id}: missing hint`).toBeDefined();
        expect(rule.hint?.length, `${rule.id}: hint should be non-empty`).toBeGreaterThan(0);
      }
    });

    it("all rules should have defaultEnabled defined or use category default", () => {
      for (const rule of ruleRegistry) {
        // Either rule has defaultEnabled, or it falls back to category
        const category = getCategoryMeta(rule.category);
        const isEnabled = rule.defaultEnabled ?? category?.defaultEnabled ?? false;
        // Just verify this doesn't throw
        expect(typeof isEnabled).toBe("boolean");
      }
    });

    it("all rules should have docs string", () => {
      for (const rule of ruleRegistry) {
        expect(rule.docs, `${rule.id}: missing docs`).toBeDefined();
        expect(rule.docs?.length, `${rule.id}: docs should be non-empty`).toBeGreaterThan(10);
      }
    });
  });

  describe("static rules", () => {
    it("should have static rules", () => {
      const staticRules = getRulesByCategory("static");
      expect(staticRules.length).toBeGreaterThan(0);
    });

    it("static rules should be enabled by default", () => {
      const staticRules = getRulesByCategory("static");
      const category = getCategoryMeta("static");

      for (const rule of staticRules) {
        const isEnabled = rule.defaultEnabled ?? category?.defaultEnabled ?? false;
        // Most static rules should be enabled
        if (rule.defaultEnabled !== false) {
          expect(isEnabled, `${rule.id}: should be enabled by default`).toBe(true);
        }
      }
    });
  });

  describe("semantic rules", () => {
    it("should have semantic rules", () => {
      const semanticRules = getRulesByCategory("semantic");
      expect(semanticRules.length).toBeGreaterThan(0);
    });

    it("semantic rules should have requirements or postInstallInstructions", () => {
      const semanticRules = getRulesByCategory("semantic");

      for (const rule of semanticRules) {
        // Semantic rules typically need Ollama or other external tools
        // At minimum they should have requirements or postInstallInstructions
        const hasRequirements = rule.requirements && rule.requirements.length > 0;
        const hasPostInstall = Boolean(rule.postInstallInstructions);

        expect(
          hasRequirements || hasPostInstall,
          `${rule.id}: semantic rule should have requirements or postInstallInstructions`
        ).toBe(true);
      }
    });
  });

  describe("rules with requirements", () => {
    const rulesWithRequirements = ruleRegistry.filter(
      (r) => r.requirements && r.requirements.length > 0
    );

    it("should have some rules with requirements", () => {
      expect(rulesWithRequirements.length).toBeGreaterThan(0);
    });

    it("requirements should have valid structure", () => {
      for (const rule of rulesWithRequirements) {
        for (const req of rule.requirements!) {
          expect(req.type, `${rule.id}: requirement missing type`).toBeDefined();
          expect(req.description, `${rule.id}: requirement missing description`).toBeDefined();
          expect(req.description.length).toBeGreaterThan(0);
        }
      }
    });

    it("requirement types should be valid", () => {
      const validTypes = ["ollama", "git", "coverage", "semantic-index", "styleguide"];

      for (const rule of rulesWithRequirements) {
        for (const req of rule.requirements!) {
          expect(validTypes, `${rule.id}: invalid requirement type ${req.type}`).toContain(
            req.type
          );
        }
      }
    });
  });

  describe("rules with option schemas", () => {
    const rulesWithOptions = ruleRegistry.filter(
      (r) => r.optionSchema && r.optionSchema.fields.length > 0
    );

    it("should have some rules with option schemas", () => {
      expect(rulesWithOptions.length).toBeGreaterThan(0);
    });

    it("option fields should have valid structure", () => {
      for (const rule of rulesWithOptions) {
        for (const field of rule.optionSchema!.fields) {
          expect(field.key, `${rule.id}: field missing key`).toBeDefined();
          expect(field.label, `${rule.id}: field missing label`).toBeDefined();
          expect(field.type, `${rule.id}: field missing type`).toBeDefined();
          expect(["boolean", "number", "text", "select", "multiselect"]).toContain(field.type);
        }
      }
    });

    it("select fields should have options", () => {
      for (const rule of rulesWithOptions) {
        for (const field of rule.optionSchema!.fields) {
          if (field.type === "select" || field.type === "multiselect") {
            expect(field.options, `${rule.id}.${field.key}: select field missing options`).toBeDefined();
            expect(field.options!.length).toBeGreaterThan(0);
          }
        }
      }
    });
  });
});

describe("getRuleMetadata", () => {
  it("should return rule by id", () => {
    const rule = getRuleMetadata("consistent-dark-mode");
    expect(rule).toBeDefined();
    expect(rule?.id).toBe("consistent-dark-mode");
  });

  it("should return undefined for unknown rule", () => {
    const rule = getRuleMetadata("unknown-rule");
    expect(rule).toBeUndefined();
  });
});

describe("getAllRuleIds", () => {
  it("should return all rule IDs", () => {
    const ids = getAllRuleIds();
    expect(ids.length).toBe(ruleRegistry.length);
    expect(ids).toContain("consistent-dark-mode");
    expect(ids).toContain("prefer-tailwind");
  });
});

describe("getRulesByCategory", () => {
  it("should return static rules", () => {
    const rules = getRulesByCategory("static");
    expect(rules.every((r) => r.category === "static")).toBe(true);
  });

  it("should return semantic rules", () => {
    const rules = getRulesByCategory("semantic");
    expect(rules.every((r) => r.category === "semantic")).toBe(true);
  });
});
