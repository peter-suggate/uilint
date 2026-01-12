import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/loader.ts", "src/vite.ts"],
  format: ["cjs", "esm"],
  dts: {
    resolve: true,
  },
  clean: true,
  external: ["next", "vite", "@builder.io/jsx-loc-internals"],
  noExternal: [],
});
