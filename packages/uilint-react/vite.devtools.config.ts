import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Single-file devtools bundle (web component) for injection into apps.
// This bundle intentionally INCLUDES React + CSS (inlined via ?inline).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./@"),
    },
  },
  plugins: [react()],
  build: {
    lib: {
      entry: "src/devtools.ts",
      name: "UILintDevtools",
      formats: ["iife"],
      fileName: () => "devtools.js",
    },
    outDir: "dist",
    emptyOutDir: false, // keep dist outputs from the standard library build
    sourcemap: true,
    cssCodeSplit: false,
    // Ensure a single JS output (no code splitting).
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
