import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { ruleRegistry } from "../src/rule-registry.js";

function toPascalCase(input: string): string {
  return input
    .split(/[^a-zA-Z0-9]+/g)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

function toVarName(ruleId: string): string {
  const base = toPascalCase(ruleId);
  return base.length ? base.charAt(0).toLowerCase() + base.slice(1) : "rule";
}

function uniqueVarName(base: string, used: Set<string>): string {
  let name = base;
  let i = 2;
  while (used.has(name)) {
    name = `${base}${i++}`;
  }
  used.add(name);
  return name;
}

function formatRuleSetting(
  severity: "error" | "warn" | "off",
  defaultOptions?: unknown[]
): string {
  if (defaultOptions && defaultOptions.length > 0) {
    const opts = JSON.stringify(defaultOptions, null, 2)
      .split("\n")
      .map((l, i) => (i === 0 ? l : `      ${l}`))
      .join("\n");
    return `["${severity}", ...${opts}]`;
  }
  return `"${severity}"`;
}

const srcIndexPath = resolve(process.cwd(), "src/index.ts");

const header = `/**
 * UILint ESLint Plugin
 *
 * THIS FILE IS AUTO-GENERATED from src/rule-registry.ts.
 * Do not edit by hand. Run: pnpm -C packages/uilint-eslint generate:index
 */
`;

const imports: string[] = [];
imports.push(`import type { Linter } from "eslint";`);

// Rule imports from registry (single source of truth)
const used = new Set<string>();
const ruleVars = ruleRegistry.map((r) => {
  const varBase = toVarName(r.id);
  const v = uniqueVarName(varBase, used);
  imports.push(`import ${v} from "./rules/${r.id}.js";`);
  return { id: r.id, v };
});

const rulesObject = `const rules = {
${ruleVars.map(({ id, v }) => `  "${id}": ${v},`).join("\n")}
};`;

const meta = `// Package version (injected at build time or fallback)
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
};`;

const jsxLanguageOptions = `/**
 * Shared language options for all configs
 */
const jsxLanguageOptions: Linter.Config["languageOptions"] = {
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
  },
};`;

const recommendedRules = ruleRegistry
  .filter((r) => r.category === "static")
  .map(
    (r) =>
      `    "uilint/${r.id}": ${formatRuleSetting(
        r.defaultSeverity,
        r.defaultOptions
      )},`
  )
  .join("\n");

const strictRules = ruleRegistry
  .map(
    (r) =>
      `    "uilint/${r.id}": ${formatRuleSetting(
        r.defaultSeverity,
        r.defaultOptions
      )},`
  )
  .join("\n");

const configs = `/**
 * Recommended config - static rules only
 *
 * Usage:
 * \`\`\`js
 * import uilint from 'uilint-eslint';
 * export default [uilint.configs.recommended];
 * \`\`\`
 */
const recommendedConfig: Linter.Config = {
  name: "uilint/recommended",
  plugins: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uilint: plugin as any,
  },
  languageOptions: jsxLanguageOptions,
  rules: {
${recommendedRules}
  },
};

/**
 * Strict config - static rules + semantic rules
 *
 * Usage:
 * \`\`\`js
 * import uilint from 'uilint-eslint';
 * export default [uilint.configs.strict];
 * \`\`\`
 */
const strictConfig: Linter.Config = {
  name: "uilint/strict",
  plugins: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uilint: plugin as any,
  },
  languageOptions: jsxLanguageOptions,
  rules: {
${strictRules}
  },
};

/**
 * Pre-configured configs
 */
const configs: Record<string, Linter.Config> = {
  recommended: recommendedConfig,
  strict: strictConfig,
};`;

const exportsBlock = `/**
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
`;

const output =
  header +
  "\n" +
  imports.join("\n") +
  "\n\n" +
  "/**\n * All available rules\n */\n" +
  rulesObject +
  "\n\n" +
  meta +
  "\n\n" +
  jsxLanguageOptions +
  "\n\n" +
  configs +
  "\n\n" +
  exportsBlock;

// Avoid rewriting if identical (keeps git diffs clean)
const prev = readFileSync(srcIndexPath, "utf-8");
if (prev !== output) {
  writeFileSync(srcIndexPath, output, "utf-8");
}
