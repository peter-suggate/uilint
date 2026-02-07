/**
 * Rule Registry
 *
 * Central registry of all UILint ESLint rules with metadata for CLI tooling.
 * Metadata is now colocated with each rule file - this module re-exports
 * the collected metadata for use by installers and other tools.
 *
 * Plugin packages (e.g. uilint-vision, uilint-semantic) contribute their
 * rules dynamically via `registerRuleMeta()` and `registerESLintRule()`.
 */

// Re-export types from create-rule for consumers
export type {
  RuleMeta,
  RuleOptionSchema,
  OptionFieldSchema,
  RuleRequirement,
  RuleMigration,
} from "./utils/create-rule.js";

// Backward compatibility alias
export type { RuleMeta as RuleMetadata } from "./utils/create-rule.js";

// Re-export category registry
export {
  categoryRegistry,
  getCategoryMeta,
  registerCategory,
  type CategoryMeta,
} from "./category-registry.js";

// Import colocated metadata from each rule file
// Single-file rules
import { meta as consistentDarkMode } from "./rules/consistent-dark-mode.js";
import { meta as noDirectStoreImport } from "./rules/no-direct-store-import.js";
import { meta as preferZustandStateManagement } from "./rules/prefer-zustand-state-management.js";
import { meta as enforceAbsoluteImports } from "./rules/enforce-absolute-imports.js";
import { meta as noAnyInProps } from "./rules/no-any-in-props.js";
import { meta as zustandUseSelectors } from "./rules/zustand-use-selectors.js";
import { meta as noSecretsInCode } from "./rules/no-secrets-in-code.js";
import { meta as requireInputValidation } from "./rules/require-input-validation.js";
import { meta as noPropDrillingDepth } from "./rules/no-prop-drilling-depth.js";
import { meta as noUnsafeTypeCasts } from "./rules/no-unsafe-type-casts.js";
import { meta as preferStoreSelectors } from "./rules/prefer-store-selectors.js";

// Directory-based rules (complex rules with colocated utilities)
import { meta as noMixedComponentLibraries } from "./rules/no-mixed-component-libraries/index.js";
import { meta as requireTestCoverage } from "./rules/require-test-coverage/index.js";
import { meta as preferTailwind } from "./rules/prefer-tailwind/index.js";

import type { RuleMeta } from "./utils/create-rule.js";

/**
 * Registry of all available UILint ESLint rules
 *
 * When adding a new rule:
 * 1. Create the rule file in src/rules/
 * 2. Export a `meta` object using `defineRuleMeta()`
 * 3. Import and add the meta to this array
 * 4. Run `pnpm generate:index` to regenerate exports
 */
export const ruleRegistry: RuleMeta[] = [
  // UI consistency rules
  consistentDarkMode,
  noDirectStoreImport,
  preferZustandStateManagement,
  noMixedComponentLibraries,
  // Import rules
  enforceAbsoluteImports,
  // Type safety rules
  noAnyInProps,
  noUnsafeTypeCasts,
  // State management rules
  zustandUseSelectors,
  preferStoreSelectors,
  // Code quality rules
  noPropDrillingDepth,
  // Security rules
  noSecretsInCode,
  requireInputValidation,
  // Test coverage enforcement
  requireTestCoverage,
  // Style preferences
  preferTailwind,
];

/**
 * Get rule metadata by ID
 */
export function getRuleMetadata(id: string): RuleMeta | undefined {
  return ruleRegistry.find((rule) => rule.id === id);
}

/**
 * Get all rules in a category
 */
export function getRulesByCategory(
  category: string
): RuleMeta[] {
  return ruleRegistry.filter((rule) => rule.category === category);
}

/**
 * Get documentation for a rule (useful for CLI help commands)
 */
export function getRuleDocs(id: string): string | undefined {
  const rule = getRuleMetadata(id);
  return rule?.docs;
}

/**
 * Get all rule IDs
 */
export function getAllRuleIds(): string[] {
  return ruleRegistry.map((rule) => rule.id);
}

// ---------------------------------------------------------------------------
// Dynamic registration API for plugin packages
// ---------------------------------------------------------------------------

import type { RuleModule } from "@typescript-eslint/utils/ts-eslint";

/** Registry for ESLint rule implementations contributed by plugin packages */
const externalRuleImplementations = new Map<string, RuleModule<string, readonly unknown[]>>();

/** Set of built-in rule IDs (for clearExternalRules) */
const builtInRuleIds = new Set(ruleRegistry.map((r) => r.id));

/**
 * Register additional rule metadata from an external plugin package.
 *
 * @param meta - Rule metadata to register
 * @throws Error if a rule with the same id is already registered
 */
export function registerRuleMeta(meta: RuleMeta): void {
  const existing = ruleRegistry.find((r) => r.id === meta.id);
  if (existing) {
    throw new Error(`Rule "${meta.id}" is already registered in the rule registry`);
  }
  ruleRegistry.push(meta);
}

/**
 * Register multiple rule metadata entries from an external plugin package.
 */
export function registerRuleMetas(metas: RuleMeta[]): void {
  for (const meta of metas) {
    registerRuleMeta(meta);
  }
}

/**
 * Register an ESLint rule implementation from a plugin package.
 * This makes the rule available to ESLint when constructing the plugin object.
 */
export function registerESLintRule(id: string, rule: RuleModule<string, readonly unknown[]>): void {
  externalRuleImplementations.set(id, rule);
}

/**
 * Get all registered external rule implementations.
 * Used by the serve command to merge plugin rules into the ESLint plugin.
 */
export function getExternalRules(): Map<string, RuleModule<string, readonly unknown[]>> {
  return externalRuleImplementations;
}

/**
 * Remove all externally registered rules (useful for testing).
 * Preserves the built-in static rules.
 */
export function clearExternalRules(): void {
  for (let i = ruleRegistry.length - 1; i >= 0; i--) {
    if (!builtInRuleIds.has(ruleRegistry[i].id)) {
      ruleRegistry.splice(i, 1);
    }
  }
  externalRuleImplementations.clear();
}
