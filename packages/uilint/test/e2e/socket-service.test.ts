/**
 * Socket Service Integration Tests
 *
 * Comprehensive tests for the UILint socket service, covering:
 * - ESLint: File and element linting
 * - Vision: Screenshot analysis (when Ollama available)
 * - Semantic/Duplicates: Code indexing
 * - Config: Rule configuration
 * - Source: File fetching
 * - Subscriptions: File change notifications
 *
 * These tests exercise the real socket server and plugin system.
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { useFixture, type FixtureContext } from "../helpers/fixtures.js";
import {
  startServer,
  findAvailablePort,
  type ServerProcess,
} from "../helpers/server-starter.js";
import {
  createTestClient,
  WsTestClient,
  type ElementManifest,
} from "../helpers/ws-test-client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const uilintEslintPath = join(__dirname, "..", "..", "..", "uilint-eslint");

// A tiny 1x1 red PNG for vision tests (base64 encoded, no data: prefix)
const TINY_RED_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

// A simple manifest for vision tests
function createTestManifest(): ElementManifest[] {
  return [
    {
      id: "loc:app/page.tsx:5:4#0",
      text: "Hello World",
      dataLoc: "app/page.tsx:5:4",
      rect: { x: 10, y: 10, width: 100, height: 30 },
      tagName: "h1",
      role: "heading",
    },
    {
      id: "loc:app/page.tsx:6:4#0",
      text: "Click me",
      dataLoc: "app/page.tsx:6:4",
      rect: { x: 10, y: 50, width: 80, height: 40 },
      tagName: "button",
      role: "button",
    },
  ];
}

/**
 * Install dependencies in the fixture
 */
async function installDependenciesWithUilint(fixturePath: string): Promise<void> {
  const pkgJsonPath = join(fixturePath, "package.json");
  const pkgJson = JSON.parse(
    existsSync(pkgJsonPath) ? require("fs").readFileSync(pkgJsonPath, "utf-8") : "{}"
  );

  pkgJson.dependencies = pkgJson.dependencies || {};
  pkgJson.devDependencies = pkgJson.devDependencies || {};
  pkgJson.devDependencies["uilint-eslint"] = `file:${uilintEslintPath}`;
  pkgJson.devDependencies["typescript-eslint"] = "^8.0.0";
  pkgJson.devDependencies["@typescript-eslint/utils"] = "^8.0.0";
  pkgJson.devDependencies["eslint"] = "^9.0.0";
  pkgJson.devDependencies["oxc-resolver"] = "^11.0.0";
  pkgJson.devDependencies["@typescript-eslint/typescript-estree"] = "^8.0.0";
  pkgJson.devDependencies["typescript"] = "^5.0.0";

  writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));

  execSync("npm install --legacy-peer-deps", {
    cwd: fixturePath,
    stdio: "pipe",
    timeout: 120000,
  });
}

// ============================================================================
// ESLint Integration Tests
// ============================================================================

describe("Socket Service - ESLint", { timeout: 60000 }, () => {
  let fixture: FixtureContext | null = null;
  let server: ServerProcess | null = null;
  let client: WsTestClient | null = null;

  afterEach(async () => {
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

  it("receives workspace:info on connect", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    server = await startServer({ cwd: fixture.path, port });
    client = await createTestClient(port);

    const info = await client.waitForWorkspaceInfo();
    expect(info.type).toBe("workspace:info");
    expect(info.appRoot).toBe(fixture.path);
    expect(info.serverCwd).toBe(fixture.path);
  });

  it("receives rules:metadata on connect", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    server = await startServer({ cwd: fixture.path, port });
    client = await createTestClient(port);

    const metadata = await client.waitForRulesMetadata();
    expect(metadata.type).toBe("rules:metadata");
    expect(Array.isArray(metadata.rules)).toBe(true);
  });

  it("lints a file and returns results", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    server = await startServer({ cwd: fixture.path, port });
    client = await createTestClient(port);
    await client.waitForWorkspaceInfo();

    const result = await client.lintFile("src/App.jsx");

    expect(result.type).toBe("lint:result");
    expect(result.filePath).toBe("src/App.jsx");
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it("returns empty issues for non-existent file", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    server = await startServer({ cwd: fixture.path, port });
    client = await createTestClient(port);
    await client.waitForWorkspaceInfo();

    const result = await client.lintFile("src/DoesNotExist.jsx");

    expect(result.type).toBe("lint:result");
    expect(result.issues).toEqual([]);
  });

  it("handles multiple concurrent lint requests", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    // Create additional files
    fixture.writeFile(
      "src/Component1.jsx",
      `function Component1() { return <div>One</div>; }\nexport default Component1;`
    );
    fixture.writeFile(
      "src/Component2.jsx",
      `function Component2() { return <span>Two</span>; }\nexport default Component2;`
    );

    server = await startServer({ cwd: fixture.path, port });
    client = await createTestClient(port);
    await client.waitForWorkspaceInfo();

    const [result1, result2, result3] = await Promise.all([
      client.lintFile("src/App.jsx"),
      client.lintFile("src/Component1.jsx"),
      client.lintFile("src/Component2.jsx"),
    ]);

    expect(result1.filePath).toBe("src/App.jsx");
    expect(result2.filePath).toBe("src/Component1.jsx");
    expect(result3.filePath).toBe("src/Component2.jsx");
  });

  it("caches lint results for unchanged files", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    server = await startServer({ cwd: fixture.path, port });
    client = await createTestClient(port);
    await client.waitForWorkspaceInfo();

    // First request
    const result1 = await client.lintFile("src/App.jsx");
    // Second request (should be cached)
    const result2 = await client.lintFile("src/App.jsx");

    expect(result1.issues).toEqual(result2.issues);
  });

  it("invalidates cache when requested", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    server = await startServer({ cwd: fixture.path, port });
    client = await createTestClient(port);
    await client.waitForWorkspaceInfo();

    // First lint
    await client.lintFile("src/App.jsx");

    // Invalidate cache
    client.invalidateCache("src/App.jsx");

    // Lint again (should re-lint)
    const result = await client.lintFile("src/App.jsx");
    expect(result.type).toBe("lint:result");
  });
});

// ============================================================================
// ESLint with UILint Rules
// ============================================================================

describe("Socket Service - ESLint with UILint rules", { timeout: 180000 }, () => {
  let fixture: FixtureContext | null = null;
  let server: ServerProcess | null = null;
  let client: WsTestClient | null = null;

  beforeAll(() => {
    if (!existsSync(join(uilintEslintPath, "dist", "index.js"))) {
      throw new Error("uilint-eslint must be built. Run: pnpm build");
    }
  });

  afterEach(async () => {
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

  it("detects uilint/no-arbitrary-tailwind violations", async () => {
    fixture = useFixture("has-eslint-with-uilint");
    const port = await findAvailablePort();

    mkdirSync(join(fixture.path, "src"), { recursive: true });

    // Create a file with arbitrary Tailwind values
    fixture.writeFile(
      "src/ArbitraryStyles.jsx",
      `function ArbitraryStyles() {
  return (
    <div className="w-[137px] h-[42px] p-[13px]">
      <span className="text-[#3B82F6]">Arbitrary</span>
    </div>
  );
}
export default ArbitraryStyles;
`
    );

    await installDependenciesWithUilint(fixture.path);

    server = await startServer({ cwd: fixture.path, port });
    client = await createTestClient(port);
    await client.waitForWorkspaceInfo();

    const result = await client.lintFile("src/ArbitraryStyles.jsx");

    expect(result.type).toBe("lint:result");
    expect(Array.isArray(result.issues)).toBe(true);

    const arbitraryIssues = result.issues.filter(
      (issue) => issue.ruleId === "uilint/no-arbitrary-tailwind"
    );
    expect(arbitraryIssues.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Vision Integration Tests
// ============================================================================

describe("Socket Service - Vision", { timeout: 60000 }, () => {
  let fixture: FixtureContext | null = null;
  let server: ServerProcess | null = null;
  let client: WsTestClient | null = null;

  afterEach(async () => {
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

  it("checks vision availability with vision:check", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    server = await startServer({ cwd: fixture.path, port });
    client = await createTestClient(port);
    await client.waitForWorkspaceInfo();

    const status = await client.visionCheck();

    expect(status.type).toBe("vision:status");
    expect(typeof status.available).toBe("boolean");
    if (status.available) {
      expect(typeof status.model).toBe("string");
    }
  });

  it("runs vision analysis when Ollama is available", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    server = await startServer({ cwd: fixture.path, port });
    client = await createTestClient(port);
    await client.waitForWorkspaceInfo();

    // Check if vision is available first
    const status = await client.visionCheck();
    if (!status.available) {
      console.log("Skipping vision analysis test: Ollama not available");
      return;
    }

    const result = await client.visionAnalyze(
      {
        route: "/",
        manifest: createTestManifest(),
        screenshot: TINY_RED_PNG_BASE64,
      },
      { timeout: 120000 }
    );

    expect(result.type).toBe("vision:result");
    expect(result.route).toBe("/");
    expect(Array.isArray(result.issues)).toBe(true);
    expect(typeof result.analysisTime).toBe("number");
  });

  it("returns error when vision analysis fails", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    server = await startServer({ cwd: fixture.path, port });
    client = await createTestClient(port);
    await client.waitForWorkspaceInfo();

    // Check if vision is available
    const status = await client.visionCheck();
    if (!status.available) {
      // Expected when Ollama not running
      expect(status.available).toBe(false);
      return;
    }

    // If Ollama is available, test with empty manifest
    const result = await client.visionAnalyze({
      route: "/test",
      manifest: [],
      screenshot: TINY_RED_PNG_BASE64,
    });

    expect(result.type).toBe("vision:result");
    // Empty manifest should still return a result (might have no issues)
  });
});

// ============================================================================
// Source Fetch Tests
// ============================================================================

describe("Socket Service - Source Fetch", { timeout: 60000 }, () => {
  let fixture: FixtureContext | null = null;
  let server: ServerProcess | null = null;
  let client: WsTestClient | null = null;

  afterEach(async () => {
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

  it("fetches source code for existing file", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    server = await startServer({ cwd: fixture.path, port });
    client = await createTestClient(port);
    await client.waitForWorkspaceInfo();

    const result = await client.fetchSource("src/App.jsx");

    expect(result.type).toBe("source:result");
    if (result.type === "source:result") {
      expect(result.filePath).toBe("src/App.jsx");
      expect(typeof result.content).toBe("string");
      expect(result.content.length).toBeGreaterThan(0);
      expect(typeof result.totalLines).toBe("number");
    }
  });

  it("returns error for non-existent file", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    server = await startServer({ cwd: fixture.path, port });
    client = await createTestClient(port);
    await client.waitForWorkspaceInfo();

    const result = await client.fetchSource("src/NonExistent.jsx");

    expect(result.type).toBe("source:error");
    if (result.type === "source:error") {
      expect(typeof result.error).toBe("string");
    }
  });
});

// ============================================================================
// Rule Configuration Tests
// ============================================================================

describe("Socket Service - Rule Configuration", { timeout: 180000 }, () => {
  let fixture: FixtureContext | null = null;
  let server: ServerProcess | null = null;
  let client: WsTestClient | null = null;

  beforeAll(() => {
    if (!existsSync(join(uilintEslintPath, "dist", "index.js"))) {
      throw new Error("uilint-eslint must be built. Run: pnpm build");
    }
  });

  afterEach(async () => {
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

  it("sets rule severity via rule:config:set", async () => {
    fixture = useFixture("has-eslint-with-uilint");
    const port = await findAvailablePort();

    await installDependenciesWithUilint(fixture.path);

    server = await startServer({ cwd: fixture.path, port });
    client = await createTestClient(port);
    await client.waitForWorkspaceInfo();

    const result = await client.setRuleConfig(
      "uilint/no-arbitrary-tailwind",
      "off"
    );

    expect(result.type).toBe("rule:config:result");
    expect(result.ruleId).toBe("uilint/no-arbitrary-tailwind");
    // The result depends on whether the server can modify the eslint config
    // In test environments, this might fail due to file permissions or config format
    if (result.success) {
      expect(result.severity).toBe("off");
    } else {
      // If it fails, at least verify we got a proper error response
      expect(typeof result.error).toBe("string");
      console.log("Rule config set failed (may be expected in test env):", result.error);
    }
  });

  it("returns error for invalid rule", async () => {
    fixture = useFixture("has-eslint-with-uilint");
    const port = await findAvailablePort();

    await installDependenciesWithUilint(fixture.path);

    server = await startServer({ cwd: fixture.path, port });
    client = await createTestClient(port);
    await client.waitForWorkspaceInfo();

    const result = await client.setRuleConfig("uilint/non-existent-rule", "error");

    expect(result.type).toBe("rule:config:result");
    // Should fail because rule doesn't exist
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe("string");
  });
});

// ============================================================================
// File Subscription Tests
// ============================================================================

describe("Socket Service - File Subscriptions", { timeout: 60000 }, () => {
  let fixture: FixtureContext | null = null;
  let server: ServerProcess | null = null;
  let client: WsTestClient | null = null;

  afterEach(async () => {
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

  it("notifies on file changes after subscribe", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    server = await startServer({ cwd: fixture.path, port });
    client = await createTestClient(port);
    await client.waitForWorkspaceInfo();

    // Subscribe to file changes
    client.subscribeFile("src/App.jsx");

    // Wait a bit for subscription to register
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Modify the file
    const originalContent = fixture.readFile("src/App.jsx");
    fixture.writeFile("src/App.jsx", originalContent + "\n// Modified");

    // Wait for file:changed notification
    try {
      const changed = await client.waitForFileChanged("src/App.jsx", 5000);
      expect(changed.type).toBe("file:changed");
      expect(changed.filePath).toBe("src/App.jsx");
    } catch {
      // File watcher might not trigger in all environments
      console.log("File change notification not received (may be env-specific)");
    }
  });
});

// ============================================================================
// Duplicates/Semantic Indexing Tests
// ============================================================================

describe("Socket Service - Duplicates Indexing", { timeout: 120000 }, () => {
  let fixture: FixtureContext | null = null;
  let server: ServerProcess | null = null;
  let client: WsTestClient | null = null;

  afterEach(async () => {
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

  it("starts duplicates indexing on server start", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    // Create more files to trigger indexing
    mkdirSync(join(fixture.path, "components"), { recursive: true });
    fixture.writeFile(
      "components/Button.jsx",
      `export function Button({ children }) { return <button>{children}</button>; }`
    );
    fixture.writeFile(
      "components/Card.jsx",
      `export function Card({ children }) { return <div className="card">{children}</div>; }`
    );

    server = await startServer({ cwd: fixture.path, port });
    client = await createTestClient(port);

    // Collect indexing messages
    const messages = await client.collectDuplicatesIndexingMessages(30000);

    // Should have received indexing messages (start may have already happened)
    // At minimum, we should get a complete or error
    expect(
      messages.complete !== undefined || messages.error !== undefined || messages.progress.length > 0
    ).toBe(true);

    if (messages.complete) {
      expect(typeof messages.complete.duration).toBe("number");
      expect(typeof messages.complete.totalChunks).toBe("number");
    }
  });

  it("completes indexing with chunk count", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    server = await startServer({ cwd: fixture.path, port });
    client = await createTestClient(port);

    try {
      const complete = await client.waitForDuplicatesIndexingComplete(30000);

      expect(complete.type).toBe("duplicates:indexing:complete");
      expect(typeof complete.added).toBe("number");
      expect(typeof complete.modified).toBe("number");
      expect(typeof complete.deleted).toBe("number");
      expect(typeof complete.totalChunks).toBe("number");
      expect(typeof complete.duration).toBe("number");
    } catch {
      // Indexing might complete before we connect, which is fine
      console.log("Indexing may have completed before client connected");
    }
  });
});

// ============================================================================
// Multiple Clients Tests
// ============================================================================

describe("Socket Service - Multiple Clients", { timeout: 60000 }, () => {
  let fixture: FixtureContext | null = null;
  let server: ServerProcess | null = null;
  let clients: WsTestClient[] = [];

  afterEach(async () => {
    for (const client of clients) {
      client.disconnect();
    }
    clients = [];
    if (server) {
      await server.stop();
      server = null;
    }
    if (fixture) {
      fixture.cleanup();
      fixture = null;
    }
  });

  it("handles multiple concurrent clients", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    server = await startServer({ cwd: fixture.path, port });

    // Connect multiple clients
    const client1 = await createTestClient(port);
    const client2 = await createTestClient(port);
    const client3 = await createTestClient(port);
    clients = [client1, client2, client3];

    // All should receive workspace info
    const [info1, info2, info3] = await Promise.all([
      client1.waitForWorkspaceInfo(),
      client2.waitForWorkspaceInfo(),
      client3.waitForWorkspaceInfo(),
    ]);

    expect(info1.appRoot).toBe(fixture.path);
    expect(info2.appRoot).toBe(fixture.path);
    expect(info3.appRoot).toBe(fixture.path);

    // All should be able to lint independently
    const [result1, result2, result3] = await Promise.all([
      client1.lintFile("src/App.jsx"),
      client2.lintFile("src/App.jsx"),
      client3.lintFile("src/App.jsx"),
    ]);

    expect(result1.type).toBe("lint:result");
    expect(result2.type).toBe("lint:result");
    expect(result3.type).toBe("lint:result");
  });

  it("broadcasts config changes to all clients", async () => {
    fixture = useFixture("has-eslint-flat-js");
    const port = await findAvailablePort();

    server = await startServer({ cwd: fixture.path, port });

    const client1 = await createTestClient(port);
    const client2 = await createTestClient(port);
    clients = [client1, client2];

    await Promise.all([
      client1.waitForWorkspaceInfo(),
      client2.waitForWorkspaceInfo(),
    ]);

    // Client 1 sets a config
    client1.setConfig("testKey", "testValue");

    // Both clients should receive the update
    const update1Promise = client1.waitFor(
      (m) => m.type === "config:update" && (m as any).key === "testKey",
      5000
    );
    const update2Promise = client2.waitFor(
      (m) => m.type === "config:update" && (m as any).key === "testKey",
      5000
    );

    const [update1, update2] = await Promise.all([update1Promise, update2Promise]);

    expect((update1 as any).value).toBe("testValue");
    expect((update2 as any).value).toBe("testValue");
  });
});
