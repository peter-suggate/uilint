import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    node: "src/node.ts",
    "browser/index": "src/browser/index.ts",
    "plugin/index": "src/plugin/index.ts",
    "eslint-rules/index": "src/eslint-rules/index.ts",
    "eslint-rules/register": "src/eslint-rules/register.ts",
    "eslint-rules/semantic-vision": "src/eslint-rules/semantic-vision.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["uilint-core", "uilint-eslint", "ollama"],
});
