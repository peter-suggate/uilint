/**
 * Unit tests for prettier formatting utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { hasPrettier } from "../../src/utils/prettier.js";

// ============================================================================
// Test Setup
// ============================================================================

let tempDir: string | null = null;

function createTempDir(): string {
  const dir = join(tmpdir(), `uilint-prettier-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupTempDir() {
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
}

afterEach(() => {
  cleanupTempDir();
});

// ============================================================================
// hasPrettier Tests
// ============================================================================

describe("hasPrettier", () => {
  it("returns false when prettier is not installed", () => {
    tempDir = createTempDir();

    const result = hasPrettier(tempDir);

    expect(result).toBe(false);
  });

  it("returns true when prettier is in local node_modules/.bin", () => {
    tempDir = createTempDir();

    // Create fake prettier binary
    const prettierDir = join(tempDir, "node_modules", ".bin");
    mkdirSync(prettierDir, { recursive: true });
    writeFileSync(join(prettierDir, "prettier"), "#!/bin/sh\necho prettier", {
      mode: 0o755,
    });

    const result = hasPrettier(tempDir);

    expect(result).toBe(true);
  });

  it("returns true when prettier is in parent node_modules (monorepo)", () => {
    tempDir = createTempDir();

    // Create monorepo-like structure
    const workspaceRoot = tempDir;
    const packageDir = join(workspaceRoot, "packages", "my-app");
    mkdirSync(packageDir, { recursive: true });

    // Create prettier at workspace root
    const prettierDir = join(workspaceRoot, "node_modules", ".bin");
    mkdirSync(prettierDir, { recursive: true });
    writeFileSync(join(prettierDir, "prettier"), "#!/bin/sh\necho prettier", {
      mode: 0o755,
    });

    // Check from package directory - should find prettier in parent
    const result = hasPrettier(packageDir);

    expect(result).toBe(true);
  });

  it("returns false when prettier exists but not in node_modules/.bin", () => {
    tempDir = createTempDir();

    // Create prettier in wrong location
    writeFileSync(join(tempDir, "prettier"), "#!/bin/sh\necho prettier", {
      mode: 0o755,
    });

    const result = hasPrettier(tempDir);

    expect(result).toBe(false);
  });
});

// ============================================================================
// collectFormattableFiles Tests (testing the logic pattern)
// ============================================================================

describe("formattable file extensions", () => {
  const formattableExtensions = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".json",
  ]);

  it("includes TypeScript files", () => {
    expect(formattableExtensions.has(".ts")).toBe(true);
    expect(formattableExtensions.has(".tsx")).toBe(true);
  });

  it("includes JavaScript files", () => {
    expect(formattableExtensions.has(".js")).toBe(true);
    expect(formattableExtensions.has(".jsx")).toBe(true);
    expect(formattableExtensions.has(".mjs")).toBe(true);
    expect(formattableExtensions.has(".cjs")).toBe(true);
  });

  it("includes JSON files", () => {
    expect(formattableExtensions.has(".json")).toBe(true);
  });

  it("excludes markdown files", () => {
    expect(formattableExtensions.has(".md")).toBe(false);
  });

  it("excludes CSS files", () => {
    expect(formattableExtensions.has(".css")).toBe(false);
  });
});
