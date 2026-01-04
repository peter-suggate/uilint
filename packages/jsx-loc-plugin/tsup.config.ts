import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/loader.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  external: ["next", "@builder.io/jsx-loc-internals"],
});
