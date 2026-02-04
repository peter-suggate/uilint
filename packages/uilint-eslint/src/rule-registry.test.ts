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

// Import individual rules for ESLint schema validation
import consistentDarkMode from "./rules/consistent-dark-mode.js";
import noDirectStoreImport from "./rules/no-direct-store-import.js";
import preferZustandStateManagement from "./rules/prefer-zustand-state-management.js";
import noMixedComponentLibraries from "./rules/no-mixed-component-libraries/index.js";
import semantic from "./rules/semantic/index.js";
import semanticVision from "./rules/semantic-vision.js";
import enforceAbsoluteImports from "./rules/enforce-absolute-imports.js";
import noAnyInProps from "./rules/no-any-in-props.js";
import zustandUseSelectors from "./rules/zustand-use-selectors.js";
import noPropDrillingDepth from "./rules/no-prop-drilling-depth.js";
import noSecretsInCode from "./rules/no-secrets-in-code.js";
import requireInputValidation from "./rules/require-input-validation.js";
import noSemanticDuplicates from "./rules/no-semantic-duplicates.js";
import requireTestCoverage from "./rules/require-test-coverage/index.js";
import preferTailwind from "./rules/prefer-tailwind.js";
import noUnsafeTypeCasts from "./rules/no-unsafe-type-casts.js";
import preferStoreSelectors from "./rules/prefer-store-selectors.js";

// Map of rule IDs to their ESLint rule modules
const eslintRules: Record<string, { meta?: { schema?: unknown[] }; defaultOptions?: unknown[] }> = {
  "consistent-dark-mode": consistentDarkMode,
  "no-direct-store-import": noDirectStoreImport,
  "prefer-zustand-state-management": preferZustandStateManagement,
  "no-mixed-component-libraries": noMixedComponentLibraries,
  "semantic": semantic,
  "semantic-vision": semanticVision,
  "enforce-absolute-imports": enforceAbsoluteImports,
  "no-any-in-props": noAnyInProps,
  "zustand-use-selectors": zustandUseSelectors,
  "no-prop-drilling-depth": noPropDrillingDepth,
  "no-secrets-in-code": noSecretsInCode,
  "require-input-validation": requireInputValidation,
  "no-semantic-duplicates": noSemanticDuplicates,
  "require-test-coverage": requireTestCoverage,
  "prefer-tailwind": preferTailwind,
  "no-unsafe-type-casts": noUnsafeTypeCasts,
  "prefer-store-selectors": preferStoreSelectors,
};

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

describe("ESLint schema consistency", () => {
  /**
   * Extract property names from an ESLint JSON schema
   */
  function getSchemaProperties(schema: unknown[]): Set<string> {
    const properties = new Set<string>();
    if (!schema || schema.length === 0) return properties;

    const firstSchema = schema[0];
    if (
      firstSchema &&
      typeof firstSchema === "object" &&
      "properties" in firstSchema &&
      firstSchema.properties
    ) {
      const props = firstSchema.properties as Record<string, unknown>;
      for (const key of Object.keys(props)) {
        properties.add(key);
      }
    }

    return properties;
  }

  it("all optionSchema.fields should be present in ESLint schema", () => {
    const rulesWithOptions = ruleRegistry.filter(
      (r) => r.optionSchema && r.optionSchema.fields.length > 0
    );

    for (const ruleMeta of rulesWithOptions) {
      const eslintRule = eslintRules[ruleMeta.id];
      if (!eslintRule?.meta?.schema) {
        // Rule doesn't have ESLint schema - skip (may be intentional)
        continue;
      }

      const schemaProperties = getSchemaProperties(eslintRule.meta.schema);
      const optionFields = ruleMeta.optionSchema!.fields.map((f) => f.key);

      for (const field of optionFields) {
        expect(
          schemaProperties.has(field),
          `Rule "${ruleMeta.id}": optionSchema field "${field}" is not in ESLint schema. ` +
            `ESLint schema has: [${[...schemaProperties].join(", ")}]. ` +
            `This will cause ESLint config validation to fail when the option is used.`
        ).toBe(true);
      }
    }
  });

  it("all defaultOptions properties should be present in ESLint schema", () => {
    for (const ruleMeta of ruleRegistry) {
      const eslintRule = eslintRules[ruleMeta.id];
      if (!eslintRule?.meta?.schema) {
        continue;
      }

      const schemaProperties = getSchemaProperties(eslintRule.meta.schema);
      if (schemaProperties.size === 0) {
        continue;
      }

      // Get defaultOptions from the ESLint rule itself
      const ruleWithDefaults = eslintRule as {
        meta?: { schema?: unknown[] };
        defaultOptions?: unknown[];
      };
      const defaultOptions = ruleWithDefaults.defaultOptions;

      if (!defaultOptions || defaultOptions.length === 0) {
        continue;
      }

      const firstDefault = defaultOptions[0];
      if (!firstDefault || typeof firstDefault !== "object") {
        continue;
      }

      const defaultKeys = Object.keys(firstDefault);

      for (const key of defaultKeys) {
        expect(
          schemaProperties.has(key),
          `Rule "${ruleMeta.id}": defaultOptions property "${key}" is not in ESLint schema. ` +
            `ESLint schema has: [${[...schemaProperties].join(", ")}]. ` +
            `This will cause ESLint config validation to fail when the default option is applied.`
        ).toBe(true);
      }
    }
  });

  it("ESLint schema should not have additionalProperties:false without all option fields", () => {
    // This catches the exact bug we encountered: schema had additionalProperties: false
    // but was missing properties that optionSchema and defaultOptions had
    const rulesWithOptions = ruleRegistry.filter(
      (r) => r.optionSchema && r.optionSchema.fields.length > 0
    );

    for (const ruleMeta of rulesWithOptions) {
      const eslintRule = eslintRules[ruleMeta.id];
      if (!eslintRule?.meta?.schema || eslintRule.meta.schema.length === 0) {
        continue;
      }

      const firstSchema = eslintRule.meta.schema[0] as Record<string, unknown> | undefined;
      if (!firstSchema || firstSchema.additionalProperties !== false) {
        continue;
      }

      // Schema has additionalProperties: false - all options MUST be in schema
      const schemaProperties = getSchemaProperties(eslintRule.meta.schema);
      const optionFields = ruleMeta.optionSchema!.fields.map((f) => f.key);

      for (const field of optionFields) {
        expect(
          schemaProperties.has(field),
          `Rule "${ruleMeta.id}": ESLint schema has additionalProperties:false but is missing ` +
            `optionSchema field "${field}". This WILL break ESLint validation! ` +
            `Add "${field}" to the schema properties.`
        ).toBe(true);
      }
    }
  });
});
