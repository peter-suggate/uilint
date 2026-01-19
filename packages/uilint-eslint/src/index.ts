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
import semanticVision from "./rules/semantic-vision.js";
import enforceAbsoluteImports from "./rules/enforce-absolute-imports.js";
import noAnyInProps from "./rules/no-any-in-props.js";
import zustandUseSelectors from "./rules/zustand-use-selectors.js";
import noPropDrillingDepth from "./rules/no-prop-drilling-depth.js";
import noSecretsInCode from "./rules/no-secrets-in-code.js";
import requireInputValidation from "./rules/require-input-validation.js";
import noSemanticDuplicates from "./rules/no-semantic-duplicates.js";
import requireTestCoverage from "./rules/require-test-coverage.js";

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
  "semantic-vision": semanticVision,
  "enforce-absolute-imports": enforceAbsoluteImports,
  "no-any-in-props": noAnyInProps,
  "zustand-use-selectors": zustandUseSelectors,
  "no-prop-drilling-depth": noPropDrillingDepth,
  "no-secrets-in-code": noSecretsInCode,
  "require-input-validation": requireInputValidation,
  "no-semantic-duplicates": noSemanticDuplicates,
  "require-test-coverage": requireTestCoverage,
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
          "preferred": "shadcn",
          "libraries": [
            "shadcn",
            "mui"
          ]
        }
      ]],
    "uilint/enforce-absolute-imports": ["warn", ...[
        {
          "maxRelativeDepth": 1,
          "aliasPrefix": "@/"
        }
      ]],
    "uilint/no-any-in-props": ["error", ...[
        {
          "checkFCGenerics": true,
          "allowInGenericDefaults": false
        }
      ]],
    "uilint/zustand-use-selectors": ["warn", ...[
        {
          "storePattern": "^use\\w*Store$",
          "allowShallow": true,
          "requireNamedSelectors": false
        }
      ]],
    "uilint/no-prop-drilling-depth": ["warn", ...[
        {
          "maxDepth": 2,
          "ignoredProps": [
            "className",
            "style",
            "children",
            "key",
            "ref",
            "id"
          ],
          "ignoreComponents": []
        }
      ]],
    "uilint/no-secrets-in-code": ["error", ...[
        {
          "checkVariableNames": true,
          "minSecretLength": 16,
          "allowInTestFiles": false
        }
      ]],
    "uilint/require-input-validation": ["warn", ...[
        {
          "httpMethods": [
            "POST",
            "PUT",
            "PATCH",
            "DELETE"
          ],
          "routePatterns": [
            "route.ts",
            "route.tsx",
            "/api/",
            "/app/api/"
          ],
          "allowManualValidation": false
        }
      ]],
    "uilint/require-test-coverage": ["warn", ...[
        {
          "coveragePath": "coverage/coverage-final.json",
          "threshold": 80,
          "thresholdsByPattern": [],
          "severity": {
            "noTestFile": "warn",
            "noCoverage": "error",
            "belowThreshold": "warn"
          },
          "testPatterns": [
            ".test.ts",
            ".test.tsx",
            ".spec.ts",
            ".spec.tsx",
            "__tests__/"
          ],
          "ignorePatterns": [
            "**/*.d.ts",
            "**/index.ts"
          ],
          "mode": "all",
          "baseBranch": "main"
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
          "preferred": "shadcn",
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
    "uilint/semantic-vision": ["warn", ...[
        {
          "maxAgeMs": 3600000,
          "screenshotsPath": ".uilint/screenshots"
        }
      ]],
    "uilint/enforce-absolute-imports": ["warn", ...[
        {
          "maxRelativeDepth": 1,
          "aliasPrefix": "@/"
        }
      ]],
    "uilint/no-any-in-props": ["error", ...[
        {
          "checkFCGenerics": true,
          "allowInGenericDefaults": false
        }
      ]],
    "uilint/zustand-use-selectors": ["warn", ...[
        {
          "storePattern": "^use\\w*Store$",
          "allowShallow": true,
          "requireNamedSelectors": false
        }
      ]],
    "uilint/no-prop-drilling-depth": ["warn", ...[
        {
          "maxDepth": 2,
          "ignoredProps": [
            "className",
            "style",
            "children",
            "key",
            "ref",
            "id"
          ],
          "ignoreComponents": []
        }
      ]],
    "uilint/no-secrets-in-code": ["error", ...[
        {
          "checkVariableNames": true,
          "minSecretLength": 16,
          "allowInTestFiles": false
        }
      ]],
    "uilint/require-input-validation": ["warn", ...[
        {
          "httpMethods": [
            "POST",
            "PUT",
            "PATCH",
            "DELETE"
          ],
          "routePatterns": [
            "route.ts",
            "route.tsx",
            "/api/",
            "/app/api/"
          ],
          "allowManualValidation": false
        }
      ]],
    "uilint/no-semantic-duplicates": ["warn", ...[
        {
          "threshold": 0.85,
          "indexPath": ".uilint/.duplicates-index",
          "minLines": 3
        }
      ]],
    "uilint/require-test-coverage": ["warn", ...[
        {
          "coveragePath": "coverage/coverage-final.json",
          "threshold": 80,
          "thresholdsByPattern": [],
          "severity": {
            "noTestFile": "warn",
            "noCoverage": "error",
            "belowThreshold": "warn"
          },
          "testPatterns": [
            ".test.ts",
            ".test.tsx",
            ".spec.ts",
            ".spec.tsx",
            "__tests__/"
          ],
          "ignorePatterns": [
            "**/*.d.ts",
            "**/index.ts"
          ],
          "mode": "all",
          "baseBranch": "main"
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

// Re-export import graph utilities (used by rules like no-mixed-component-libraries)
export {
  getComponentLibrary,
  clearCache as clearImportGraphCache,
  type LibraryName,
} from "./utils/import-graph.js";

// Re-export rule registry for CLI tooling
export {
  ruleRegistry,
  getRuleMetadata,
  getRulesByCategory,
  getRuleDocs,
  getAllRuleIds,
  type RuleMeta,
  type RuleMetadata,  // Backward compatibility alias
  type OptionFieldSchema,
  type RuleOptionSchema,
} from "./rule-registry.js";

// Re-export defineRuleMeta for rule authors
export { defineRuleMeta } from "./utils/create-rule.js";

// Re-export coverage utilities for require-test-coverage rule
export {
  aggregateCoverage,
  type IstanbulCoverage,
  type FileCoverageInfo,
  type AggregatedCoverage,
} from "./utils/coverage-aggregator.js";

export {
  buildDependencyGraph,
  type DependencyGraph,
} from "./utils/dependency-graph.js";

export {
  categorizeFile,
  type FileCategory,
  type FileCategoryResult,
} from "./utils/file-categorizer.js";
