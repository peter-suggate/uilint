import { defineConfig } from "tsup";
import { readdirSync, statSync } from "fs";
import { join } from "path";
import type { Plugin } from "esbuild";

// Get all rule entries (both single-file and directory-based)
const rulesDir = join(process.cwd(), "src", "rules");
const ruleEntries: Record<string, string> = {};

for (const entry of readdirSync(rulesDir)) {
  // Skip __fixtures__, __tests__, etc.
  if (entry.startsWith("__")) continue;

  const fullPath = join(rulesDir, entry);
  const stat = statSync(fullPath);

  if (stat.isDirectory()) {
    // Directory-based rule: use index.ts as entry
    ruleEntries[`rules/${entry}`] = join("src", "rules", entry, "index.ts");
  } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
    // Single-file rule
    const ruleName = entry.replace(".ts", "");
    ruleEntries[`rules/${ruleName}`] = join("src", "rules", entry);
  }
}

const externalizeSharedRuleHelpers: Plugin = {
  name: "externalize-shared-rule-helpers",
  setup(build) {
    build.onResolve(
      { filter: /^(\.\.\/)+utils\/create-rule\.js$/ },
      () => ({ path: "uilint-eslint", external: true })
    );
  },
};

export default defineConfig([
  // Main entry point
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    minify: false,
    external: ["eslint", "uilint-core"],
  },
  // Individual rule files - each rule bundles its own implementation, but
  // shares createRule/profiling through the installed uilint-eslint package.
  {
    entry: ruleEntries,
    format: ["esm"],
    dts: false,
    sourcemap: true,
    minify: false,
    splitting: false, // Disable code splitting - each rule must be self-contained
    bundle: true, // Bundle dependencies into each rule file
    external: ["eslint", "uilint-eslint"], // Don't bundle uilint-eslint (it's installed in target)
    esbuildPlugins: [externalizeSharedRuleHelpers],
    outDir: "dist",
  },
]);
