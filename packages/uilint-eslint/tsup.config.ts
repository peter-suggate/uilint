import { defineConfig } from "tsup";
import { readdirSync, statSync } from "fs";
import { join } from "path";

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
  // Individual rule files - each rule is bundled standalone (no shared chunks)
  // This is required because rules are copied to target projects and cannot
  // rely on shared chunk files that won't be present in the target
  {
    entry: ruleEntries,
    format: ["esm"],
    dts: false,
    sourcemap: true,
    minify: false,
    splitting: false, // Disable code splitting - each rule must be self-contained
    bundle: true, // Bundle dependencies into each rule file
    external: ["eslint", "uilint-eslint"], // Don't bundle uilint-eslint (it's installed in target)
    outDir: "dist",
  },
]);
