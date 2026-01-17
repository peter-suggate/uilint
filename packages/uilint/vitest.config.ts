import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    testTimeout: 30000, // Integration tests may take longer
  },
});
