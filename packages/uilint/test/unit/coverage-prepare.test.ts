/**
 * Tests for: coverage-prepare utility
 *
 * Tests coverage preparation logic including config injection and
 * detection of preparation needs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from "fs";
import {
  prepareCoverage,
  needsCoveragePreparation,
  type CoveragePreparationResult,
} from "../../src/utils/coverage-prepare.js";
import { detectCoverageSetup } from "../../src/utils/coverage-detect.js";

const FIXTURES_DIR = join(__dirname, "../fixtures/coverage-detection");
const TEMP_DIR = join(__dirname, "../fixtures/temp-coverage-prepare");

describe("needsCoveragePreparation", () => {
  it("returns true when coverage package is missing", () => {
    const fixtureDir = join(FIXTURES_DIR, "vitest-no-coverage");
    const setup = detectCoverageSetup(fixtureDir);
    expect(needsCoveragePreparation(setup)).toBe(true);
  });

  it("returns true when coverage config is missing", () => {
    const fixtureDir = join(FIXTURES_DIR, "vitest-no-coverage");
    const setup = detectCoverageSetup(fixtureDir);
    expect(needsCoveragePreparation(setup)).toBe(true);
  });

  it("returns false when fully configured with data", () => {
    const fixtureDir = join(FIXTURES_DIR, "vitest-with-coverage");
    const setup = detectCoverageSetup(fixtureDir);
    expect(needsCoveragePreparation(setup)).toBe(false);
  });

  it("returns false when vitest is not installed", () => {
    const fixtureDir = join(FIXTURES_DIR, "no-vitest");
    const setup = detectCoverageSetup(fixtureDir);
    expect(needsCoveragePreparation(setup)).toBe(false);
  });
});

describe("prepareCoverage", () => {
  // Clean up temp directory before and after tests
  beforeEach(() => {
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEMP_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  describe("with no vitest", () => {
    it("returns error when vitest is not installed", async () => {
      // Copy the no-vitest fixture
      const sourceDir = join(FIXTURES_DIR, "no-vitest");
      copyFileSync(
        join(sourceDir, "package.json"),
        join(TEMP_DIR, "package.json")
      );

      const result = await prepareCoverage({
        appRoot: TEMP_DIR,
        skipPackageInstall: true,
        skipTests: true,
      });

      expect(result.error).toContain("Vitest not found");
      expect(result.packageAdded).toBe(false);
      expect(result.configModified).toBe(false);
    });
  });

  describe("config injection", () => {
    it("injects coverage config into vitest.config.ts", async () => {
      // Copy vitest-no-coverage fixture
      const sourceDir = join(FIXTURES_DIR, "vitest-no-coverage");
      copyFileSync(
        join(sourceDir, "package.json"),
        join(TEMP_DIR, "package.json")
      );
      copyFileSync(
        join(sourceDir, "vitest.config.ts"),
        join(TEMP_DIR, "vitest.config.ts")
      );

      // Verify initial state
      const initialConfig = readFileSync(join(TEMP_DIR, "vitest.config.ts"), "utf-8");
      expect(initialConfig).not.toContain("coverage:");

      const result = await prepareCoverage({
        appRoot: TEMP_DIR,
        skipPackageInstall: true,
        skipTests: true,
      });

      // Verify config was modified
      const modifiedConfig = readFileSync(join(TEMP_DIR, "vitest.config.ts"), "utf-8");
      expect(modifiedConfig).toContain("coverage:");
      expect(modifiedConfig).toContain('provider: "v8"');
      expect(modifiedConfig).toContain('reporter:');
      expect(result.configModified).toBe(true);
    });

    it("does not modify config if coverage already configured", async () => {
      // Copy vitest-with-coverage fixture
      const sourceDir = join(FIXTURES_DIR, "vitest-with-coverage");
      copyFileSync(
        join(sourceDir, "package.json"),
        join(TEMP_DIR, "package.json")
      );
      copyFileSync(
        join(sourceDir, "vitest.config.ts"),
        join(TEMP_DIR, "vitest.config.ts")
      );
      // Create coverage directory with data
      mkdirSync(join(TEMP_DIR, "coverage"), { recursive: true });
      copyFileSync(
        join(sourceDir, "coverage", "coverage-final.json"),
        join(TEMP_DIR, "coverage", "coverage-final.json")
      );

      const initialConfig = readFileSync(join(TEMP_DIR, "vitest.config.ts"), "utf-8");

      const result = await prepareCoverage({
        appRoot: TEMP_DIR,
        skipPackageInstall: true,
        skipTests: true,
      });

      const modifiedConfig = readFileSync(join(TEMP_DIR, "vitest.config.ts"), "utf-8");
      expect(modifiedConfig).toBe(initialConfig);
      expect(result.configModified).toBe(false);
    });
  });

  describe("progress callback", () => {
    it("calls onProgress during preparation", async () => {
      const sourceDir = join(FIXTURES_DIR, "vitest-no-coverage");
      copyFileSync(
        join(sourceDir, "package.json"),
        join(TEMP_DIR, "package.json")
      );
      copyFileSync(
        join(sourceDir, "vitest.config.ts"),
        join(TEMP_DIR, "vitest.config.ts")
      );

      const progressCalls: Array<{ message: string; phase: string }> = [];
      const onProgress = vi.fn((message: string, phase: string) => {
        progressCalls.push({ message, phase });
      });

      await prepareCoverage({
        appRoot: TEMP_DIR,
        skipPackageInstall: true,
        skipTests: true,
        onProgress,
      });

      expect(onProgress).toHaveBeenCalled();
      expect(progressCalls.some(c => c.phase === "detect")).toBe(true);
      expect(progressCalls.some(c => c.phase === "config")).toBe(true);
    });
  });

  describe("skip options", () => {
    it("respects skipPackageInstall option", async () => {
      const sourceDir = join(FIXTURES_DIR, "vitest-no-coverage");
      copyFileSync(
        join(sourceDir, "package.json"),
        join(TEMP_DIR, "package.json")
      );
      copyFileSync(
        join(sourceDir, "vitest.config.ts"),
        join(TEMP_DIR, "vitest.config.ts")
      );

      const result = await prepareCoverage({
        appRoot: TEMP_DIR,
        skipPackageInstall: true,
        skipTests: true,
      });

      // Package should not be added when skipPackageInstall is true
      expect(result.packageAdded).toBe(false);
      // Config should still be modified
      expect(result.configModified).toBe(true);
    });

    it("respects skipTests option", async () => {
      const sourceDir = join(FIXTURES_DIR, "vitest-no-coverage");
      copyFileSync(
        join(sourceDir, "package.json"),
        join(TEMP_DIR, "package.json")
      );
      copyFileSync(
        join(sourceDir, "vitest.config.ts"),
        join(TEMP_DIR, "vitest.config.ts")
      );

      const result = await prepareCoverage({
        appRoot: TEMP_DIR,
        skipPackageInstall: true,
        skipTests: true,
      });

      expect(result.testsRan).toBe(false);
    });
  });

  describe("duration tracking", () => {
    it("returns duration in result", async () => {
      const sourceDir = join(FIXTURES_DIR, "vitest-no-coverage");
      copyFileSync(
        join(sourceDir, "package.json"),
        join(TEMP_DIR, "package.json")
      );
      copyFileSync(
        join(sourceDir, "vitest.config.ts"),
        join(TEMP_DIR, "vitest.config.ts")
      );

      const result = await prepareCoverage({
        appRoot: TEMP_DIR,
        skipPackageInstall: true,
        skipTests: true,
      });

      expect(result.duration).toBeTypeOf("number");
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });
});
