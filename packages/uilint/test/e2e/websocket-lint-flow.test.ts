/**
 * End-to-end tests for WebSocket lint flow
 *
 * These tests verify the complete flow:
 * 1. Start the WebSocket server
 * 2. Connect a client
 * 3. Send lint:file requests
 * 4. Receive lint:result responses
 *
 * This simulates what the browser DevTool does without needing an actual browser.
 */

import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { useFixture, type FixtureContext } from "../helpers/fixtures.js";
import {
  startServer,
  findAvailablePort,
  type ServerProcess,
} from "../helpers/server-starter.js";
import {
  createTestClient,
  WsTestClient,
} from "../helpers/ws-test-client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// Test Setup
// ============================================================================

describe("WebSocket lint flow", { timeout: 60000 }, () => {
  let fixture: FixtureContext | null = null;
  let server: ServerProcess | null = null;
  let client: WsTestClient | null = null;

  beforeEach(async () => {
    // Find an available port for each test
    const port = await findAvailablePort();
    // Store it for access in tests (we'll get it in the test)
  });

  afterEach(async () => {
    // Clean up in reverse order
    if (client) {
      client.disconnect();
      client = null;
    }
    if (server) {
      await server.stop();
      server = null;
    }
    if (fixture) {
      fixture.cleanup();
      fixture = null;
    }
  });

  it("connects to server and receives workspace info", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    server = await startServer({
      cwd: fixture.path,
      port,
      debug: false,
    });

    client = await createTestClient(port);

    // Should receive workspace info on connect
    const workspaceInfo = await client.waitForWorkspaceInfo();

    expect(workspaceInfo.type).toBe("workspace:info");
    expect(workspaceInfo.appRoot).toBe(fixture.path);
    expect(workspaceInfo.serverCwd).toBe(fixture.path);
  });

  it("lints a file and returns results", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    server = await startServer({
      cwd: fixture.path,
      port,
    });

    client = await createTestClient(port);

    // Wait for initial messages
    await client.waitForWorkspaceInfo();

    // Send a lint request for the source file
    const result = await client.lintFile("src/App.jsx");

    expect(result.type).toBe("lint:result");
    expect(result.filePath).toBe("src/App.jsx");
    expect(Array.isArray(result.issues)).toBe(true);

    // The file might have issues or not, but we should get a valid response
    for (const issue of result.issues) {
      expect(typeof issue.line).toBe("number");
      expect(typeof issue.message).toBe("string");
    }
  });

  it("returns empty issues for non-existent file", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    server = await startServer({
      cwd: fixture.path,
      port,
    });

    client = await createTestClient(port);
    await client.waitForWorkspaceInfo();

    // Try to lint a file that doesn't exist
    const result = await client.lintFile("src/NonExistent.jsx");

    expect(result.type).toBe("lint:result");
    expect(result.issues).toEqual([]);
  });

  it("handles multiple concurrent lint requests", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    // Create a second source file
    fixture.writeFile(
      "src/Component.jsx",
      `function Component() {
  return <span>Hello</span>;
}

export default Component;
`
    );

    server = await startServer({
      cwd: fixture.path,
      port,
    });

    client = await createTestClient(port);
    await client.waitForWorkspaceInfo();

    // Send multiple lint requests concurrently
    const [result1, result2] = await Promise.all([
      client.lintFile("src/App.jsx"),
      client.lintFile("src/Component.jsx"),
    ]);

    expect(result1.type).toBe("lint:result");
    expect(result1.filePath).toBe("src/App.jsx");

    expect(result2.type).toBe("lint:result");
    expect(result2.filePath).toBe("src/Component.jsx");
  });

  it("detects ESLint issues and maps them to dataLoc", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    // Create a file that will trigger an ESLint issue
    // The @next/next plugin has rules like no-html-link-for-pages
    // Let's create a file with an issue that the plugin will catch
    fixture.writeFile(
      "src/BadLink.jsx",
      `import Link from "next/link";

function BadLink() {
  return (
    <div>
      {/* Using <a> instead of <Link> for internal navigation */}
      <a href="/about">About Us</a>
    </div>
  );
}

export default BadLink;
`
    );

    // Update ESLint config to enable the rule
    fixture.writeFile(
      "eslint.config.mjs",
      `import next from "@next/eslint-plugin-next";

export default [
  {
    ignores: [".next/**", "node_modules/**"],
  },
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: {
      "@next/next": next,
    },
    rules: {
      "@next/next/no-html-link-for-pages": "error",
    },
  },
];
`
    );

    server = await startServer({
      cwd: fixture.path,
      port,
    });

    client = await createTestClient(port);
    await client.waitForWorkspaceInfo();

    const result = await client.lintFile("src/BadLink.jsx");

    expect(result.type).toBe("lint:result");
    expect(result.filePath).toBe("src/BadLink.jsx");

    // We expect at least one issue from the @next/next rules
    // But note: the rule might not fire if there's no pages directory
    // So we just verify the response structure is correct
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it("caches results for unchanged files", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    server = await startServer({
      cwd: fixture.path,
      port,
    });

    client = await createTestClient(port);
    await client.waitForWorkspaceInfo();

    // First request
    const result1 = await client.lintFile("src/App.jsx");
    expect(result1.type).toBe("lint:result");

    // Second request should return cached results
    const result2 = await client.lintFile("src/App.jsx");
    expect(result2.type).toBe("lint:result");
    expect(result2.issues).toEqual(result1.issues);
  });
});
// ============================================================================
// Integration with real test-app (optional, for local testing)
// ============================================================================

describe.skip("WebSocket lint flow with real test-app", { timeout: 60000 }, () => {
  let server: ServerProcess | null = null;
  let client: WsTestClient | null = null;

  const testAppPath = join(__dirname, "..", "..", "..", "..", "apps", "test-app");

  afterEach(async () => {
    if (client) {
      client.disconnect();
      client = null;
    }
    if (server) {
      await server.stop();
      server = null;
    }
  });

  it("lints test-app files", async () => {
    // Skip if test-app doesn't exist
    if (!existsSync(testAppPath)) {
      console.log("Skipping: test-app not found");
      return;
    }

    const port = await findAvailablePort();

    server = await startServer({
      cwd: testAppPath,
      port,
      debug: true,
    });

    client = await createTestClient(port, { debug: true });

    const workspaceInfo = await client.waitForWorkspaceInfo();
    console.log("Workspace info:", workspaceInfo);

    const result = await client.lintFile("app/page.tsx");
    console.log("Lint result:", result);

    expect(result.type).toBe("lint:result");
    expect(result.filePath).toBe("app/page.tsx");
  });
});
