/**
 * Coverage preparation utilities.
 *
 * Handles automatically setting up coverage for vitest projects:
 * - Installing @vitest/coverage-v8 package
 * - Adding coverage config to vitest.config.ts
 * - Running tests with coverage to generate data
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  detectPackageManager,
  installDependencies,
  runTestsWithCoverage,
} from "./package-manager.js";
import { detectCoverageSetup, type CoverageSetupInfo } from "./coverage-detect.js";

export interface CoveragePreparationResult {
  /** Whether @vitest/coverage-v8 was added to package.json */
  packageAdded: boolean;
  /** Whether vitest.config.ts was modified to add coverage */
  configModified: boolean;
  /** Whether tests were run with coverage */
  testsRan: boolean;
  /** Whether coverage-final.json was generated */
  coverageGenerated: boolean;
  /** Total time taken in milliseconds */
  duration: number;
  /** Error message if something failed */
  error?: string;
}

export interface PrepareCoverageOptions {
  /** Root directory of the app to prepare */
  appRoot: string;
  /** Progress callback for streaming updates */
  onProgress?: (message: string, phase: string) => void;
  /** Skip installing packages (useful in CI) */
  skipPackageInstall?: boolean;
  /** Skip running tests (useful when tests run separately) */
  skipTests?: boolean;
}

/**
 * Inject coverage configuration into vitest.config.ts
 * @returns true if config was modified, false if already configured or error
 */
export function injectCoverageConfig(vitestConfigPath: string): boolean {
  try {
    const content = readFileSync(vitestConfigPath, "utf-8");

    // Check if already has coverage config
    if (/coverage\s*:\s*\{/.test(content)) {
      return false; // Already configured
    }

    // Find the `test: {` block and inject coverage after it
    // This handles patterns like:
    // - test: {
    // - test:{
    // - test : {
    const testBlockRegex = /(test\s*:\s*\{)/;
    const match = content.match(testBlockRegex);

    if (!match) {
      // Can't find test block - might be a different config format
      return false;
    }

    const coverageConfig = `
    coverage: {
      provider: "v8",
      reporter: ["text", "json"],
      reportsDirectory: "./coverage",
    },`;

    // Insert coverage config right after `test: {`
    const newContent = content.replace(
      testBlockRegex,
      `$1${coverageConfig}`
    );

    writeFileSync(vitestConfigPath, newContent, "utf-8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Prepare a project for coverage generation.
 *
 * This function:
 * 1. Detects current coverage setup
 * 2. Installs @vitest/coverage-v8 if needed
 * 3. Adds coverage config to vitest.config.ts if needed
 * 4. Runs tests with coverage to generate data
 */
export async function prepareCoverage(
  options: PrepareCoverageOptions
): Promise<CoveragePreparationResult> {
  const { appRoot, onProgress, skipPackageInstall, skipTests } = options;
  const start = Date.now();

  const result: CoveragePreparationResult = {
    packageAdded: false,
    configModified: false,
    testsRan: false,
    coverageGenerated: false,
    duration: 0,
  };

  try {
    // 1. Detect current setup
    onProgress?.("Detecting coverage setup...", "detect");
    const setup = detectCoverageSetup(appRoot);

    // If no vitest, we can't set up coverage
    if (!setup.hasVitest) {
      result.error = "Vitest not found in dependencies";
      result.duration = Date.now() - start;
      return result;
    }

    // 2. Install coverage package if needed
    if (setup.needsCoveragePackage && !skipPackageInstall) {
      onProgress?.("Installing @vitest/coverage-v8...", "install");
      const pm = detectPackageManager(appRoot);
      try {
        await installDependencies(pm, appRoot, ["@vitest/coverage-v8"]);
        result.packageAdded = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.error = `Failed to install coverage package: ${msg}`;
        result.duration = Date.now() - start;
        return result;
      }
    }

    // 3. Add coverage config if needed
    if (setup.needsCoverageConfig && setup.vitestConfigPath) {
      onProgress?.("Adding coverage configuration...", "config");
      result.configModified = injectCoverageConfig(setup.vitestConfigPath);
    }

    // 4. Run tests with coverage
    if (!skipTests) {
      // Re-check if we need to run tests
      const updatedSetup = detectCoverageSetup(appRoot);

      // Only run if:
      // - No coverage data exists, OR
      // - Config was just modified (data is stale)
      if (!updatedSetup.hasCoverageData || result.configModified) {
        onProgress?.("Running tests with coverage...", "test");
        const pm = detectPackageManager(appRoot);
        try {
          await runTestsWithCoverage(pm, appRoot);
          result.testsRan = true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // Tests might fail, but coverage might still be generated
          result.error = `Tests failed: ${msg}`;
        }

        // Check if coverage was generated
        const finalSetup = detectCoverageSetup(appRoot);
        result.coverageGenerated = finalSetup.hasCoverageData;
      }
    } else {
      onProgress?.("Skipping tests (skipTests=true)", "skip");
    }

    result.duration = Date.now() - start;
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.error = `Coverage preparation failed: ${msg}`;
    result.duration = Date.now() - start;
    return result;
  }
}

/**
 * Check if coverage data needs to be regenerated.
 *
 * Returns true if:
 * - Coverage data doesn't exist
 * - Coverage package is missing
 * - Coverage config is missing
 */
export function needsCoveragePreparation(setup: CoverageSetupInfo): boolean {
  if (!setup.hasVitest) {
    return false; // Can't prepare without vitest
  }

  return (
    setup.needsCoveragePackage ||
    setup.needsCoverageConfig ||
    !setup.hasCoverageData
  );
}
