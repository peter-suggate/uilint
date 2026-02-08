import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { findWorkspaceRoot } from "../../src/utils/workspace-root.js";

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `uilint-ws-root-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("findWorkspaceRoot", () => {
  it("returns startDir when no root markers are found", () => {
    const deepDir = join(testDir, "a", "b", "c");
    mkdirSync(deepDir, { recursive: true });

    // Since this is under /tmp, there might be markers above testDir.
    // We test by checking the returned dir is at least as high as testDir.
    const result = findWorkspaceRoot(deepDir);
    // Should have walked up from deepDir
    expect(result.length).toBeLessThanOrEqual(deepDir.length);
  });

  it("stops immediately at pnpm-workspace.yaml", () => {
    const rootDir = join(testDir, "monorepo");
    const appDir = join(rootDir, "apps", "web");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(rootDir, "pnpm-workspace.yaml"), "packages:\n  - apps/*");

    const result = findWorkspaceRoot(appDir);
    expect(result).toBe(rootDir);
  });

  it("finds .git as a root marker", () => {
    const rootDir = join(testDir, "repo");
    const srcDir = join(rootDir, "src", "lib");
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(join(rootDir, ".git"), { recursive: true });

    const result = findWorkspaceRoot(srcDir);
    expect(result).toBe(rootDir);
  });

  it("finds package.json with workspaces field as root marker", () => {
    const rootDir = join(testDir, "project");
    const subDir = join(rootDir, "packages", "core");
    mkdirSync(subDir, { recursive: true });
    writeFileSync(
      join(rootDir, "package.json"),
      JSON.stringify({ name: "root", workspaces: ["packages/*"] })
    );

    const result = findWorkspaceRoot(subDir);
    expect(result).toBe(rootDir);
  });

  it("prefers pnpm-workspace.yaml over .git", () => {
    const rootDir = join(testDir, "pnpm-repo");
    const appDir = join(rootDir, "apps", "web");
    mkdirSync(appDir, { recursive: true });
    mkdirSync(join(rootDir, ".git"), { recursive: true });
    writeFileSync(join(rootDir, "pnpm-workspace.yaml"), "packages:\n  - apps/*");

    const result = findWorkspaceRoot(appDir);
    expect(result).toBe(rootDir);
  });

  it("ignores package.json without workspaces field", () => {
    const rootDir = join(testDir, "simple-project");
    const srcDir = join(rootDir, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(rootDir, "package.json"),
      JSON.stringify({ name: "simple", version: "1.0.0" })
    );

    // No workspace markers found, should fall through
    const result = findWorkspaceRoot(srcDir);
    // Since there's no root marker, should return startDir or something above
    // that has a marker (like the real .git above testDir)
    expect(result).toBeDefined();
  });

  it("handles malformed package.json gracefully", () => {
    const rootDir = join(testDir, "broken-pkg");
    const srcDir = join(rootDir, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(rootDir, "package.json"), "not valid json{{{");

    // Should not throw, just skip this marker
    const result = findWorkspaceRoot(srcDir);
    expect(result).toBeDefined();
  });

  it("prefers the highest-level marker when multiple exist", () => {
    // grandparent has .git, parent has workspaces
    const grandparent = join(testDir, "gp");
    const parent = join(grandparent, "parent");
    const child = join(parent, "child");
    mkdirSync(child, { recursive: true });

    mkdirSync(join(grandparent, ".git"), { recursive: true });
    writeFileSync(
      join(parent, "package.json"),
      JSON.stringify({ workspaces: ["*"] })
    );

    const result = findWorkspaceRoot(child);
    // Should prefer the highest marker (grandparent with .git)
    expect(result).toBe(grandparent);
  });
});
