import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    // Exclude E2E tests by default - they require server infrastructure
    // Run them separately with: vitest run test/e2e/
    exclude: ["**/e2e/**", "**/node_modules/**"],
    testTimeout: 30000, // Integration tests may take longer
    // Disable file parallelism for e2e tests to avoid port conflicts
    // when multiple tests try to start WebSocket servers
    fileParallelism: false,
  },
});
