import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
    pool: "threads",
    setupFiles: ["./src/test-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["json", "text-summary"],
      reportsDirectory: "./coverage",
    },
  },
  resolve: {
    alias: {
      // Resolve workspace packages from source during tests
      // This avoids needing built dist folders in CI
      "uilint-core": path.resolve(__dirname, "../uilint-core/src/index.ts"),
    },
  },
});
