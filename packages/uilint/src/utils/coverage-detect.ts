/**
 * Coverage detection utilities for vitest projects.
 *
 * Detects vitest installation, configuration, and coverage data.
 */

import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";

export interface CoverageSetupInfo {
  /** Whether vitest is in dependencies */
  hasVitest: boolean;
  /** Whether vitest config exists */
  hasVitestConfig: boolean;
  /** Path to vitest config if found */
  vitestConfigPath: string | null;
  /** Whether coverage is configured in vitest */
  hasCoverageConfig: boolean;
  /** Coverage provider (v8 or istanbul) */
  coverageProvider: "v8" | "istanbul" | null;
  /** Whether coverage data file exists */
  hasCoverageData: boolean;
  /** Path to coverage data */
  coverageDataPath: string | null;

  // Preparation flags
  /** Whether @vitest/coverage-v8 (or coverage-istanbul) package is missing */
  needsCoveragePackage: boolean;
  /** Whether vitest.config needs coverage block added */
  needsCoverageConfig: boolean;
  /** Age of coverage data in milliseconds (null if no data) */
  coverageDataAge: number | null;
}

const VITEST_CONFIG_FILES = [
  "vitest.config.ts",
  "vitest.config.js",
  "vitest.config.mts",
  "vitest.config.mjs",
];

interface PackageDepsInfo {
  hasVitest: boolean;
  hasCoveragePackage: boolean;
}

/**
 * Check if vitest and coverage packages are in package.json
 */
function checkPackageDeps(projectPath: string): PackageDepsInfo {
  try {
    const pkgPath = join(projectPath, "package.json");
    if (!existsSync(pkgPath)) return { hasVitest: false, hasCoveragePackage: false };

    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    const hasVitest = "vitest" in deps;
    const hasCoveragePackage =
      "@vitest/coverage-v8" in deps || "@vitest/coverage-istanbul" in deps;

    return { hasVitest, hasCoveragePackage };
  } catch {
    return { hasVitest: false, hasCoveragePackage: false };
  }
}

/**
 * Find the vitest config file in the project
 */
function findVitestConfig(projectPath: string): string | null {
  for (const configFile of VITEST_CONFIG_FILES) {
    const configPath = join(projectPath, configFile);
    if (existsSync(configPath)) {
      return configPath;
    }
  }
  return null;
}

/**
 * Parse vitest config to extract coverage settings
 */
function parseCoverageConfig(configPath: string): {
  hasCoverageConfig: boolean;
  coverageProvider: "v8" | "istanbul" | null;
} {
  try {
    const content = readFileSync(configPath, "utf-8");

    // Check if coverage block exists using regex
    const hasCoverageConfig = /coverage\s*:\s*\{/.test(content);

    if (!hasCoverageConfig) {
      return { hasCoverageConfig: false, coverageProvider: null };
    }

    // Extract provider value using regex
    // Match patterns like: provider: "v8", provider: 'v8', provider: "istanbul", etc.
    const providerMatch = content.match(/provider\s*:\s*["']?(v8|istanbul)["']?/);
    const coverageProvider = providerMatch
      ? (providerMatch[1] as "v8" | "istanbul")
      : null;

    return { hasCoverageConfig, coverageProvider };
  } catch {
    return { hasCoverageConfig: false, coverageProvider: null };
  }
}

/**
 * Check if coverage data file exists and get its age
 */
function findCoverageData(projectPath: string): {
  path: string | null;
  age: number | null;
} {
  const coverageDataPath = join(projectPath, "coverage", "coverage-final.json");
  if (existsSync(coverageDataPath)) {
    try {
      const stats = statSync(coverageDataPath);
      const age = Date.now() - stats.mtimeMs;
      return { path: coverageDataPath, age };
    } catch {
      return { path: coverageDataPath, age: null };
    }
  }
  return { path: null, age: null };
}

/**
 * Detect coverage setup in a project
 */
export function detectCoverageSetup(projectPath: string): CoverageSetupInfo {
  const { hasVitest, hasCoveragePackage } = checkPackageDeps(projectPath);
  const vitestConfigPath = findVitestConfig(projectPath);
  const hasVitestConfig = vitestConfigPath !== null;

  let hasCoverageConfig = false;
  let coverageProvider: "v8" | "istanbul" | null = null;

  if (vitestConfigPath) {
    const coverageInfo = parseCoverageConfig(vitestConfigPath);
    hasCoverageConfig = coverageInfo.hasCoverageConfig;
    coverageProvider = coverageInfo.coverageProvider;
  }

  const coverageData = findCoverageData(projectPath);
  const hasCoverageData = coverageData.path !== null;

  // Compute preparation flags
  const needsCoveragePackage = hasVitest && !hasCoveragePackage;
  const needsCoverageConfig = hasVitest && hasVitestConfig && !hasCoverageConfig;

  return {
    hasVitest,
    hasVitestConfig,
    vitestConfigPath,
    hasCoverageConfig,
    coverageProvider,
    hasCoverageData,
    coverageDataPath: coverageData.path,
    needsCoveragePackage,
    needsCoverageConfig,
    coverageDataAge: coverageData.age,
  };
}
