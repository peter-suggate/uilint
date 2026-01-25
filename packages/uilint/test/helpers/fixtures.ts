/**
 * Test fixture utilities
 *
 * Provides helpers for working with test fixtures - copying them to temp
 * directories, reading files, and cleanup.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, cpSync, rmSync, renameSync, realpathSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures");

export interface FixtureContext {
  /** Path to the temp directory containing the fixture copy */
  path: string;

  /** Read a file from the fixture (returns content as string) */
  readFile(relativePath: string): string;

  /** Write a file to the fixture */
  writeFile(relativePath: string, content: string): void;

  /** Check if a file exists in the fixture */
  exists(relativePath: string): boolean;

  /** Get file permissions (returns mode as number) */
  fileMode(relativePath: string): number;

  /** Parse a JSON file from the fixture */
  readJson<T = unknown>(relativePath: string): T;

  /** Write a JSON file to the fixture */
  writeJson(relativePath: string, data: unknown): void;

  /** Clean up the temp directory */
  cleanup(): void;
}

/**
 * Copy a fixture to a temp directory for testing
 *
 * This creates an isolated copy of the fixture that can be modified
 * during tests without affecting the original.
 *
 * @param name - Name of the fixture directory (e.g., "fresh-nextjs-app")
 * @returns FixtureContext with helpers for working with the fixture
 */
export function useFixture(name: string): FixtureContext {
  const sourcePath = join(FIXTURES_DIR, name);

  if (!existsSync(sourcePath)) {
    throw new Error(`Fixture not found: ${name} (looked in ${sourcePath})`);
  }

  // Create temp directory
  const tempPath = join(tmpdir(), `uilint-test-${randomUUID()}`);
  mkdirSync(tempPath, { recursive: true });

  // Copy fixture to temp directory
  cpSync(sourcePath, tempPath, { recursive: true });

  // Rename dot-cursor to .cursor (workaround for sandbox restrictions)
  const dotCursorPath = join(tempPath, "dot-cursor");
  const realCursorPath = join(tempPath, ".cursor");
  if (existsSync(dotCursorPath)) {
    renameSync(dotCursorPath, realCursorPath);
  }

  // Resolve the real path to handle macOS symlinks (/var -> /private/var)
  const realTempPath = realpathSync(tempPath);

  const context: FixtureContext = {
    path: realTempPath,

    readFile(relativePath: string): string {
      const fullPath = join(realTempPath, relativePath);
      if (!existsSync(fullPath)) {
        throw new Error(`File not found: ${relativePath}`);
      }
      return readFileSync(fullPath, "utf-8");
    },

    writeFile(relativePath: string, content: string): void {
      const fullPath = join(realTempPath, relativePath);
      writeFileSync(fullPath, content, "utf-8");
    },

    exists(relativePath: string): boolean {
      return existsSync(join(realTempPath, relativePath));
    },

    fileMode(relativePath: string): number {
      const fullPath = join(realTempPath, relativePath);
      if (!existsSync(fullPath)) {
        throw new Error(`File not found: ${relativePath}`);
      }
      const stats = statSync(fullPath);
      return stats.mode & 0o777; // Return just the permission bits
    },

    readJson<T = unknown>(relativePath: string): T {
      const content = context.readFile(relativePath);
      return JSON.parse(content) as T;
    },

    writeJson(relativePath: string, data: unknown): void {
      const content = JSON.stringify(data, null, 2) + "\n";
      context.writeFile(relativePath, content);
    },

    cleanup(): void {
      if (existsSync(realTempPath)) {
        rmSync(realTempPath, { recursive: true, force: true });
      }
    },
  };

  return context;
}

/**
 * Get the path to a fixture without copying it
 * (useful for read-only tests or when you need to reference the original)
 */
export function getFixturePath(name: string): string {
  const fixturePath = join(FIXTURES_DIR, name);
  if (!existsSync(fixturePath)) {
    throw new Error(`Fixture not found: ${name}`);
  }
  return fixturePath;
}

/**
 * List all available fixtures
 */
export function listFixtures(): string[] {
  const { readdirSync } = require("fs");
  return readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((dirent: { isDirectory: () => boolean }) => dirent.isDirectory())
    .map((dirent: { name: string }) => dirent.name);
}
