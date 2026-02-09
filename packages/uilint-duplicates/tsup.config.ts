import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    node: "src/node.ts",
    "plugin/index": "src/plugin/index.ts",
    "eslint-rules/index": "src/eslint-rules/index.ts",
    "eslint-rules/register": "src/eslint-rules/register.ts",
    "eslint-rules/no-duplicates": "src/eslint-rules/no-duplicates.ts",
    "cli-manifest": "src/cli-manifest.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["uilint-core", "uilint-eslint"],
});
