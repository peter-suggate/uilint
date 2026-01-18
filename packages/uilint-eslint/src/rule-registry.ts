/**
 * Rule Registry
 *
 * Central registry of all UILint ESLint rules with metadata for CLI tooling.
 * Metadata is now colocated with each rule file - this module re-exports
 * the collected metadata for use by installers and other tools.
 */

// Re-export types from create-rule for consumers
export type {
  RuleMeta,
  RuleOptionSchema,
  OptionFieldSchema,
} from "./utils/create-rule.js";

// Backward compatibility alias
export type { RuleMeta as RuleMetadata } from "./utils/create-rule.js";

// Import colocated metadata from each rule file
import { meta as noArbitraryTailwind } from "./rules/no-arbitrary-tailwind.js";
import { meta as consistentSpacing } from "./rules/consistent-spacing.js";
import { meta as consistentDarkMode } from "./rules/consistent-dark-mode.js";
import { meta as noDirectStoreImport } from "./rules/no-direct-store-import.js";
import { meta as preferZustandStateManagement } from "./rules/prefer-zustand-state-management.js";
import { meta as noMixedComponentLibraries } from "./rules/no-mixed-component-libraries.js";
import { meta as semantic } from "./rules/semantic.js";
import { meta as semanticVision } from "./rules/semantic-vision.js";

// New rules
import { meta as enforceAbsoluteImports } from "./rules/enforce-absolute-imports.js";
import { meta as noAnyInProps } from "./rules/no-any-in-props.js";
import { meta as zustandUseSelectors } from "./rules/zustand-use-selectors.js";
import { meta as noSecretsInCode } from "./rules/no-secrets-in-code.js";
import { meta as requireInputValidation } from "./rules/require-input-validation.js";
import { meta as noPropDrillingDepth } from "./rules/no-prop-drilling-depth.js";
import { meta as noSemanticDuplicates } from "./rules/no-semantic-duplicates.js";

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
  // Existing rules
  noArbitraryTailwind,
  consistentSpacing,
  consistentDarkMode,
  noDirectStoreImport,
  preferZustandStateManagement,
  noMixedComponentLibraries,
  semantic,
  semanticVision,
  // New UI rules
  enforceAbsoluteImports,
  noAnyInProps,
  zustandUseSelectors,
  noPropDrillingDepth,
  // New security rules
  noSecretsInCode,
  requireInputValidation,
  // Semantic duplicate detection
  noSemanticDuplicates,
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
  category: "static" | "semantic"
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
