/**
 * UILint ESLint Plugin
 *
 * THIS FILE IS AUTO-GENERATED from src/rule-registry.ts.
 * Do not edit by hand. Run: pnpm -C packages/uilint-eslint generate:index
 */

import type { Linter } from "eslint";
import noArbitraryTailwind from "./rules/no-arbitrary-tailwind.js";
import consistentSpacing from "./rules/consistent-spacing.js";
import consistentDarkMode from "./rules/consistent-dark-mode.js";
import noDirectStoreImport from "./rules/no-direct-store-import.js";
import preferZustandStateManagement from "./rules/prefer-zustand-state-management.js";
import noMixedComponentLibraries from "./rules/no-mixed-component-libraries.js";
import semantic from "./rules/semantic.js";

/**
 * All available rules
 */
const rules = {
  "no-arbitrary-tailwind": noArbitraryTailwind,
  "consistent-spacing": consistentSpacing,
  "consistent-dark-mode": consistentDarkMode,
  "no-direct-store-import": noDirectStoreImport,
  "prefer-zustand-state-management": preferZustandStateManagement,
  "no-mixed-component-libraries": noMixedComponentLibraries,
  "semantic": semantic,
};

// Package version (injected at build time or fallback)
const version = "0.1.0";

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
    "uilint/consistent-spacing": ["warn", ...[
        {
          "scale": [
            0,
            1,
            2,
            3,
            4,
            5,
            6,
            8,
            10,
            12,
            16
          ]
        }
      ]],
    "uilint/consistent-dark-mode": ["error", ...[
        {
          "warnOnMissingDarkMode": true
        }
      ]],
    "uilint/no-direct-store-import": ["warn", ...[
        {
          "storePattern": "use*Store"
        }
      ]],
    "uilint/prefer-zustand-state-management": ["warn", ...[
        {
          "maxStateHooks": 3,
          "countUseState": true,
          "countUseReducer": true,
          "countUseContext": true
        }
      ]],
    "uilint/no-mixed-component-libraries": ["error", ...[
        {
          "libraries": [
            "shadcn",
            "mui"
          ]
        }
      ]],
  },
};

/**
 * Strict config - static rules + semantic rules
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
    "uilint/consistent-spacing": ["warn", ...[
        {
          "scale": [
            0,
            1,
            2,
            3,
            4,
            5,
            6,
            8,
            10,
            12,
            16
          ]
        }
      ]],
    "uilint/consistent-dark-mode": ["error", ...[
        {
          "warnOnMissingDarkMode": true
        }
      ]],
    "uilint/no-direct-store-import": ["warn", ...[
        {
          "storePattern": "use*Store"
        }
      ]],
    "uilint/prefer-zustand-state-management": ["warn", ...[
        {
          "maxStateHooks": 3,
          "countUseState": true,
          "countUseReducer": true,
          "countUseContext": true
        }
      ]],
    "uilint/no-mixed-component-libraries": ["error", ...[
        {
          "libraries": [
            "shadcn",
            "mui"
          ]
        }
      ]],
    "uilint/semantic": ["warn", ...[
        {
          "model": "qwen3-coder:30b",
          "styleguidePath": ".uilint/styleguide.md"
        }
      ]],
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

// Re-export rule registry for CLI tooling
export {
  ruleRegistry,
  getRuleMetadata,
  getRulesByCategory,
  type RuleMetadata,
  type OptionFieldSchema,
  type RuleOptionSchema,
} from "./rule-registry.js";
