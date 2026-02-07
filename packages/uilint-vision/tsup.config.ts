import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    node: "src/node.ts",
    "browser/index": "src/browser/index.ts",
    "plugin/index": "src/plugin/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["uilint-core", "ollama"],
});
