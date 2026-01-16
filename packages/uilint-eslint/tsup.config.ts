import { defineConfig } from "tsup";
import { readdirSync } from "fs";
import { join } from "path";

// Get all rule files (excluding tests)
const rulesDir = join(process.cwd(), "src", "rules");
const ruleFiles = readdirSync(rulesDir)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .map((f) => join("src", "rules", f));

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
    entry: ruleFiles.reduce((acc, file) => {
      // Output path: dist/rules/no-arbitrary-tailwind.js
      const ruleName = file.replace("src/rules/", "").replace(".ts", "");
      acc[`rules/${ruleName}`] = file;
      return acc;
    }, {} as Record<string, string>),
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
