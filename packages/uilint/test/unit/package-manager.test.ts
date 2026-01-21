/**
 * Unit tests for package-manager utilities
 */

import { describe, it, expect, afterEach } from "vitest";
import { useFixture, type FixtureContext } from "../helpers/fixtures.js";
import { detectPackageManager } from "../../src/utils/package-manager.js";

// Note: installDependencies is tested indirectly through integration tests
// These tests focus on the filtering logic that skips already-installed packages

let fixture: FixtureContext | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("detectPackageManager", () => {
  it("detects pnpm from pnpm-lock.yaml", async () => {
    fixture = useFixture("has-eslint-flat");
    fixture.writeFile("pnpm-lock.yaml", "lockfileVersion: 5.4\n");

    const pm = detectPackageManager(fixture.path);
    expect(pm).toBe("pnpm");
  });

  it("detects yarn from yarn.lock", async () => {
    fixture = useFixture("has-eslint-flat");
    fixture.writeFile("yarn.lock", "# yarn lockfile\n");

    const pm = detectPackageManager(fixture.path);
    expect(pm).toBe("yarn");
  });

  it("detects npm from package-lock.json", async () => {
    fixture = useFixture("has-eslint-flat");
    fixture.writeFile("package-lock.json", '{"lockfileVersion": 2}\n');

    const pm = detectPackageManager(fixture.path);
    expect(pm).toBe("npm");
  });

  it("defaults to npm when no lockfile found", async () => {
    fixture = useFixture("has-eslint-flat");
    // No lockfile written

    const pm = detectPackageManager(fixture.path);
    expect(pm).toBe("npm");
  });
});
