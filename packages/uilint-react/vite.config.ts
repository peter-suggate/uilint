import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import path from "path";

// Standard library build (ESM) for:
// - src/index.ts (browser-safe React exports)
// - src/node.ts (node/test-only exports)
//
// NOTE: This build intentionally keeps React external (peer deps).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./@"),
    },
  },
  plugins: [
    react(),
    dts({
      tsconfigPath: "./tsconfig.json",
      entryRoot: "src",
      outDir: "dist",
      // Keeps d.ts paths aligned with our exports map
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: {
        index: "src/index.ts",
        node: "src/node.ts",
      },
      formats: ["es"],
      fileName: (format, entryName) => `${entryName}.js`,
    },
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      // Keep peer deps external for the standard library build.
      external: ["react", "react-dom", "fs/promises", "path", "uilint-core"],
    },
  },
});
