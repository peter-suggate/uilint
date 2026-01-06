/**
 * UILint ESLint Plugin
 *
 * Provides ESLint rules for UI consistency checking:
 * - Static rules for common patterns (arbitrary values, spacing, component libraries)
 * - LLM-powered semantic rule that reads your styleguide
 */

import type { Linter } from "eslint";
import noArbitraryTailwind from "./rules/no-arbitrary-tailwind.js";
import consistentSpacing from "./rules/consistent-spacing.js";
import noDirectStoreImport from "./rules/no-direct-store-import.js";
import noMixedComponentLibraries from "./rules/no-mixed-component-libraries.js";
import semantic from "./rules/semantic.js";

// Package version (injected at build time or fallback)
const version = "0.1.0";

/**
 * All available rules
 */
const rules = {
  "no-arbitrary-tailwind": noArbitraryTailwind,
  "consistent-spacing": consistentSpacing,
  "no-direct-store-import": noDirectStoreImport,
  "no-mixed-component-libraries": noMixedComponentLibraries,
  semantic: semantic,
};

/**
 * Plugin metadata
 */
const meta = {
  name: "uilint",
  version,
};

/**
 * The ESLint plugin object
 */
const plugin = {
  meta,
  rules,
};

/**
 * Shared language options for all configs
 */
const jsxLanguageOptions: Linter.Config["languageOptions"] = {
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
  },
};

/**
 * Recommended config - static rules only
 *
 * Usage:
 * ```js
 * import uilint from 'uilint-eslint';
 * export default [uilint.configs.recommended];
 * ```
 */
const recommendedConfig: Linter.Config = {
  name: "uilint/recommended",
  plugins: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uilint: plugin as any,
  },
  languageOptions: jsxLanguageOptions,
  rules: {
    "uilint/no-arbitrary-tailwind": "error",
    "uilint/consistent-spacing": "warn",
    "uilint/no-direct-store-import": "warn",
    "uilint/no-mixed-component-libraries": "error",
  },
};

/**
 * Strict config - static rules + LLM semantic rule
 *
 * Usage:
 * ```js
 * import uilint from 'uilint-eslint';
 * export default [uilint.configs.strict];
 * ```
 */
const strictConfig: Linter.Config = {
  name: "uilint/strict",
  plugins: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uilint: plugin as any,
  },
  languageOptions: jsxLanguageOptions,
  rules: {
    "uilint/no-arbitrary-tailwind": "error",
    "uilint/consistent-spacing": "warn",
    "uilint/no-direct-store-import": "error",
    "uilint/no-mixed-component-libraries": "error",
    "uilint/semantic": "warn",
  },
};

/**
 * Pre-configured configs
 */
const configs: Record<string, Linter.Config> = {
  recommended: recommendedConfig,
  strict: strictConfig,
};

/**
 * UILint ESLint export interface
 */
export interface UILintESLint {
  meta: typeof meta;
  plugin: typeof plugin;
  rules: typeof rules;
  configs: Record<string, Linter.Config>;
}

/**
 * Default export for ESLint flat config
 */
const uilintEslint: UILintESLint = {
  meta,
  plugin,
  rules,
  configs,
};

export default uilintEslint;

// Named exports for convenience
export { plugin, rules, configs, meta };

// Re-export utilities for custom rule creation
export { createRule } from "./utils/create-rule.js";
export {
  loadStyleguide,
  findStyleguidePath,
  getStyleguide,
} from "./utils/styleguide-loader.js";
export {
  hashContent,
  hashContentSync,
  getCacheEntry,
  setCacheEntry,
  clearCache,
  clearCacheEntry,
  loadCache,
  saveCache,
  type CacheEntry,
  type CachedIssue,
  type CacheStore,
} from "./utils/cache.js";
