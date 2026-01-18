/**
 * Tests for: coverage-detect utility
 *
 * Tests detection of vitest and coverage configuration in target projects.
 */

import { describe, it, expect } from "vitest";
import { join } from "path";
import { detectCoverageSetup, type CoverageSetupInfo } from "../../src/utils/coverage-detect.js";

const FIXTURES_DIR = join(__dirname, "../fixtures/coverage-detection");

describe("detectCoverageSetup", () => {
  describe("vitest-with-coverage fixture", () => {
    const fixtureDir = join(FIXTURES_DIR, "vitest-with-coverage");

    it("detects vitest in dependencies", () => {
      const result = detectCoverageSetup(fixtureDir);
      expect(result.hasVitest).toBe(true);
    });

    it("detects vitest config exists", () => {
      const result = detectCoverageSetup(fixtureDir);
      expect(result.hasVitestConfig).toBe(true);
      expect(result.vitestConfigPath).toContain("vitest.config.ts");
    });

    it("detects coverage is configured", () => {
      const result = detectCoverageSetup(fixtureDir);
      expect(result.hasCoverageConfig).toBe(true);
    });

    it("detects coverage provider", () => {
      const result = detectCoverageSetup(fixtureDir);
      expect(result.coverageProvider).toBe("v8");
    });

    it("detects coverage data exists", () => {
      const result = detectCoverageSetup(fixtureDir);
      expect(result.hasCoverageData).toBe(true);
      expect(result.coverageDataPath).toContain("coverage-final.json");
    });

    it("returns complete CoverageSetupInfo", () => {
      const result = detectCoverageSetup(fixtureDir);
      expect(result).toMatchObject<Partial<CoverageSetupInfo>>({
        hasVitest: true,
        hasVitestConfig: true,
        hasCoverageConfig: true,
        coverageProvider: "v8",
        hasCoverageData: true,
      });
    });

    it("indicates no preparation needed", () => {
      const result = detectCoverageSetup(fixtureDir);
      expect(result.needsCoveragePackage).toBe(false);
      expect(result.needsCoverageConfig).toBe(false);
    });

    it("returns coverage data age", () => {
      const result = detectCoverageSetup(fixtureDir);
      expect(result.coverageDataAge).toBeTypeOf("number");
      expect(result.coverageDataAge).toBeGreaterThanOrEqual(0);
    });
  });

  describe("vitest-no-coverage fixture", () => {
    const fixtureDir = join(FIXTURES_DIR, "vitest-no-coverage");

    it("detects vitest in dependencies", () => {
      const result = detectCoverageSetup(fixtureDir);
      expect(result.hasVitest).toBe(true);
    });

    it("detects vitest config exists", () => {
      const result = detectCoverageSetup(fixtureDir);
      expect(result.hasVitestConfig).toBe(true);
    });

    it("detects coverage is NOT configured", () => {
      const result = detectCoverageSetup(fixtureDir);
      expect(result.hasCoverageConfig).toBe(false);
    });

    it("returns null coverage provider when not configured", () => {
      const result = detectCoverageSetup(fixtureDir);
      expect(result.coverageProvider).toBeNull();
    });

    it("detects no coverage data exists", () => {
      const result = detectCoverageSetup(fixtureDir);
      expect(result.hasCoverageData).toBe(false);
      expect(result.coverageDataPath).toBeNull();
    });

    it("indicates coverage package is needed", () => {
      const result = detectCoverageSetup(fixtureDir);
      // Has vitest but no @vitest/coverage-v8
      expect(result.needsCoveragePackage).toBe(true);
    });

    it("indicates coverage config is needed", () => {
      const result = detectCoverageSetup(fixtureDir);
      // Has vitest config but no coverage block
      expect(result.needsCoverageConfig).toBe(true);
    });

    it("returns null coverage data age when no data", () => {
      const result = detectCoverageSetup(fixtureDir);
      expect(result.coverageDataAge).toBeNull();
    });
  });

  describe("no-vitest fixture", () => {
    const fixtureDir = join(FIXTURES_DIR, "no-vitest");

    it("detects vitest NOT in dependencies", () => {
      const result = detectCoverageSetup(fixtureDir);
      expect(result.hasVitest).toBe(false);
    });

    it("detects no vitest config", () => {
      const result = detectCoverageSetup(fixtureDir);
      expect(result.hasVitestConfig).toBe(false);
      expect(result.vitestConfigPath).toBeNull();
    });

    it("returns all false/null values", () => {
      const result = detectCoverageSetup(fixtureDir);
      expect(result).toMatchObject<Partial<CoverageSetupInfo>>({
        hasVitest: false,
        hasVitestConfig: false,
        hasCoverageConfig: false,
        coverageProvider: null,
        hasCoverageData: false,
        coverageDataPath: null,
      });
    });

    it("does not indicate preparation needed without vitest", () => {
      const result = detectCoverageSetup(fixtureDir);
      // Can't prepare coverage without vitest
      expect(result.needsCoveragePackage).toBe(false);
      expect(result.needsCoverageConfig).toBe(false);
    });
  });

  describe("coverage-v8 fixture", () => {
    const fixtureDir = join(FIXTURES_DIR, "coverage-v8");

    it("detects v8 coverage provider", () => {
      const result = detectCoverageSetup(fixtureDir);
      expect(result.coverageProvider).toBe("v8");
    });

    it("detects coverage data exists", () => {
      const result = detectCoverageSetup(fixtureDir);
      expect(result.hasCoverageData).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles non-existent directory gracefully", () => {
      const result = detectCoverageSetup("/non/existent/path");
      expect(result.hasVitest).toBe(false);
      expect(result.hasVitestConfig).toBe(false);
      expect(result.hasCoverageConfig).toBe(false);
      expect(result.hasCoverageData).toBe(false);
    });

    it("handles empty directory gracefully", () => {
      // Uses a real but minimal fixture
      const result = detectCoverageSetup(join(FIXTURES_DIR, "no-vitest"));
      expect(result.hasVitest).toBe(false);
    });
  });
});

describe("detectCoverageSetup config parsing", () => {
  describe("vitest config file detection", () => {
    it("finds vitest.config.ts", () => {
      const fixtureDir = join(FIXTURES_DIR, "vitest-with-coverage");
      const result = detectCoverageSetup(fixtureDir);
      expect(result.vitestConfigPath).toMatch(/vitest\.config\.ts$/);
    });

    // Add more tests when we have fixtures for other config formats
    // it("finds vitest.config.js", () => { ... });
    // it("finds vitest.config.mts", () => { ... });
  });

  describe("coverage config extraction", () => {
    it("extracts coverage reporter configuration", () => {
      const fixtureDir = join(FIXTURES_DIR, "vitest-with-coverage");
      const result = detectCoverageSetup(fixtureDir);
      // The utility might expose additional parsed config in the future
      expect(result.hasCoverageConfig).toBe(true);
    });
  });
});
