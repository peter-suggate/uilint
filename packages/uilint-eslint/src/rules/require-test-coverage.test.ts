/**
 * Tests for: require-test-coverage
 *
 * Tests the detection of missing test coverage using Istanbul JSON coverage data.
 * These tests use fixture directories with pre-built coverage data.
 *
 * NOTE: When this test file is copied to a target app's .uilint/rules/ directory,
 * the fixtures won't be present. Tests that require fixtures will be skipped.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { describe, it, afterAll, beforeEach } from "vitest";
import rule, { clearCoverageCache } from "./require-test-coverage.js";
import { join } from "path";
import { existsSync } from "fs";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

// Fixtures directory
const FIXTURES_DIR = join(__dirname, "__fixtures__/coverage");

// Check if fixtures are available (they won't be when test is copied to target app)
const FIXTURES_AVAILABLE = existsSync(FIXTURES_DIR);

// Use describe.skipIf for tests that require fixtures
const describeWithFixtures = FIXTURES_AVAILABLE ? describe : describe.skip;

// Clear cache before each test
beforeEach(() => {
  clearCoverageCache();
});

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

// ============================================
// NO COVERAGE DATA (warning to run coverage first)
// ============================================
describeWithFixtures("require-test-coverage without coverage data", () => {
  const fixtureDir = join(FIXTURES_DIR, "with-no-coverage-data");

  ruleTester.run("require-test-coverage", rule, {
    valid: [
      {
        // When coverage data doesn't exist and severity.noCoverage is "off"
        name: "no error when noCoverage severity is off",
        filename: join(fixtureDir, "src/utils.ts"),
        code: `export function process(data: string): string { return data.trim(); }`,
        options: [{ severity: { noCoverage: "off" } }],
      },
    ],
    invalid: [
      {
        name: "warns when coverage data not found",
        filename: join(fixtureDir, "src/utils.ts"),
        code: `export function process(data: string): string { return data.trim(); }`,
        errors: [{ messageId: "noCoverageData" }],
      },
    ],
  });
});

// ============================================
// NO TEST FILE DETECTION
// ============================================
describeWithFixtures("require-test-coverage no test file", () => {
  const fixtureDir = join(FIXTURES_DIR, "with-no-tests");

  ruleTester.run("require-test-coverage", rule, {
    valid: [
      {
        // File that HAS a corresponding test file
        name: "no warning when test file exists",
        filename: join(fixtureDir, "src/hasTest.ts"),
        code: `export function greet(name: string): string { return \`Hello, \${name}!\`; }`,
      },
      {
        // noTestFile severity is off
        name: "no warning when noTestFile severity is off",
        filename: join(fixtureDir, "src/noTest.ts"),
        code: `export function farewell(name: string): string { return \`Goodbye, \${name}!\`; }`,
        options: [{ severity: { noTestFile: "off" } }],
      },
    ],
    invalid: [
      {
        // File with NO corresponding test file
        name: "warns when no test file found",
        filename: join(fixtureDir, "src/noTest.ts"),
        code: `export function farewell(name: string): string { return \`Goodbye, \${name}!\`; }`,
        errors: [{ messageId: "noTestFile" }],
      },
    ],
  });
});

// ============================================
// FULL COVERAGE (no violations)
// ============================================
describeWithFixtures("require-test-coverage full coverage", () => {
  const fixtureDir = join(FIXTURES_DIR, "with-full-coverage");

  ruleTester.run("require-test-coverage", rule, {
    valid: [
      {
        name: "no warning when file has full coverage",
        filename: join(fixtureDir, "src/utils.ts"),
        code: `
export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}
`,
      },
    ],
    invalid: [],
  });
});

// ============================================
// PARTIAL COVERAGE (below threshold)
// ============================================
describeWithFixtures("require-test-coverage partial coverage", () => {
  const fixtureDir = join(FIXTURES_DIR, "with-partial-coverage");

  ruleTester.run("require-test-coverage", rule, {
    valid: [
      {
        // Well-covered file (90% coverage, above default 80% threshold)
        name: "no warning when coverage above threshold",
        filename: join(fixtureDir, "src/covered.ts"),
        code: `
export function formatName(first: string, last: string): string {
  return \`\${first} \${last}\`;
}
`,
      },
      {
        // Poorly-covered file (14% coverage = 1/7 statements), but threshold lowered
        name: "no warning when coverage above custom threshold",
        filename: join(fixtureDir, "src/uncovered.ts"),
        code: `
export function calculateTotal(items: number[]): number {
  return items.reduce((sum, item) => sum + item, 0);
}
`,
        options: [{ threshold: 10 }], // 14% > 10%
      },
      {
        // belowThreshold severity is off
        name: "no warning when belowThreshold severity is off",
        filename: join(fixtureDir, "src/uncovered.ts"),
        code: `export function calculateTotal(items: number[]): number { return items.reduce((sum, item) => sum + item, 0); }`,
        options: [{ severity: { belowThreshold: "off" } }],
      },
    ],
    invalid: [
      {
        // Poorly-covered file (14% coverage = 1/7 statements, below default 80% threshold)
        name: "warns when coverage below threshold",
        filename: join(fixtureDir, "src/uncovered.ts"),
        code: `
export function calculateTotal(items: number[]): number {
  return items.reduce((sum, item) => sum + item, 0);
}
`,
        errors: [{ messageId: "belowThreshold" }],
      },
      {
        // covered.ts has 90% coverage (9/10 statements), so use 95% threshold to trigger warning
        name: "warns when coverage below custom threshold",
        filename: join(fixtureDir, "src/covered.ts"),
        code: `export function formatName(first: string, last: string): string { return \`\${first} \${last}\`; }`,
        options: [{ threshold: 95 }], // 90% < 95%
        errors: [{ messageId: "belowThreshold" }],
      },
    ],
  });
});

// ============================================
// THRESHOLD BY PATTERN
// ============================================
describeWithFixtures("require-test-coverage threshold by pattern", () => {
  const fixtureDir = join(FIXTURES_DIR, "with-partial-coverage");

  ruleTester.run("require-test-coverage", rule, {
    valid: [
      {
        // File matches a pattern with lower threshold (14% coverage > 10% threshold)
        name: "uses pattern-specific threshold when matched",
        filename: join(fixtureDir, "src/uncovered.ts"),
        code: `export function calculateTotal(items: number[]): number { return items.reduce((sum, item) => sum + item, 0); }`,
        options: [{
          threshold: 80,
          thresholdsByPattern: [
            { pattern: "**/uncovered.ts", threshold: 10 }, // 14% > 10%
          ],
        }],
      },
    ],
    invalid: [
      {
        // File doesn't match pattern, uses global threshold
        name: "uses global threshold when no pattern matches",
        filename: join(fixtureDir, "src/uncovered.ts"),
        code: `export function calculateTotal(items: number[]): number { return items.reduce((sum, item) => sum + item, 0); }`,
        options: [{
          threshold: 80,
          thresholdsByPattern: [
            { pattern: "**/components/*.tsx", threshold: 30 },
          ],
        }],
        errors: [{ messageId: "belowThreshold" }],
      },
    ],
  });
});

// ============================================
// IGNORE PATTERNS
// ============================================
describeWithFixtures("require-test-coverage ignore patterns", () => {
  const fixtureDir = join(FIXTURES_DIR, "with-no-tests");

  ruleTester.run("require-test-coverage", rule, {
    valid: [
      {
        // File matches ignore pattern
        name: "no warning when file matches ignore pattern",
        filename: join(fixtureDir, "src/noTest.ts"),
        code: `export function farewell(name: string): string { return \`Goodbye, \${name}!\`; }`,
        options: [{ ignorePatterns: ["**/noTest.ts"] }],
      },
    ],
    invalid: [],
  });
});

// ============================================
// TEST FILE PATTERNS
// ============================================
describeWithFixtures("require-test-coverage test file patterns", () => {
  const fixtureDir = join(FIXTURES_DIR, "with-no-tests");

  ruleTester.run("require-test-coverage", rule, {
    valid: [
      {
        // Custom test pattern matches
        name: "finds test with custom pattern",
        filename: join(fixtureDir, "src/hasTest.ts"),
        code: `export function greet(name: string): string { return \`Hello, \${name}!\`; }`,
        options: [{ testPatterns: [".test.ts"] }],
      },
    ],
    invalid: [
      {
        // Custom test pattern doesn't match existing test
        name: "does not find test when pattern excludes it",
        filename: join(fixtureDir, "src/hasTest.ts"),
        code: `export function greet(name: string): string { return \`Hello, \${name}!\`; }`,
        options: [{ testPatterns: [".spec.ts"] }], // Only looks for .spec.ts, not .test.ts
        errors: [{ messageId: "noTestFile" }],
      },
    ],
  });
});

// ============================================
// MODE: ALL vs CHANGED
// ============================================
describeWithFixtures("require-test-coverage mode", () => {
  const fixtureDir = join(FIXTURES_DIR, "with-git-changes");

  ruleTester.run("require-test-coverage", rule, {
    valid: [
      {
        // mode: "changed" - when git shows no changes for file (no diff)
        // The file has 25% coverage but since there are no git changes,
        // we fall back to "all" mode. But we disable belowThreshold and noTestFile.
        name: "no warning in changed mode when no git changes",
        filename: join(fixtureDir, "src/modified.ts"),
        code: `export function existingFunction(): string { return "I exist"; }`,
        options: [{
          mode: "changed",
          baseBranch: "main",
          severity: { noTestFile: "off", belowThreshold: "off" },
        }],
      },
    ],
    invalid: [
      {
        // mode: "all" (default) - check all uncovered code (25% coverage < 80%)
        // Also reports noTestFile since there's no test file for modified.ts
        name: "warns on all uncovered code in default mode",
        filename: join(fixtureDir, "src/modified.ts"),
        code: `
export function existingFunction(): string { return "I exist"; }
export function newFunction(): string { return "I am new"; }
`,
        errors: [
          { messageId: "noTestFile" },
          { messageId: "belowThreshold" },
        ],
      },
    ],
  });
});

// ============================================
// COVERAGE PATH CONFIGURATION
// ============================================
describeWithFixtures("require-test-coverage coverage path", () => {
  const fixtureDir = join(FIXTURES_DIR, "with-full-coverage");

  ruleTester.run("require-test-coverage", rule, {
    valid: [
      {
        // Custom coverage path
        name: "uses custom coverage path",
        filename: join(fixtureDir, "src/utils.ts"),
        code: `export function add(a: number, b: number): number { return a + b; }`,
        options: [{ coveragePath: "coverage/coverage-final.json" }],
      },
    ],
    invalid: [],
  });
});

// ============================================
// ERROR MESSAGE FORMAT
// ============================================
describeWithFixtures("require-test-coverage message format", () => {
  const fixtureDir = join(FIXTURES_DIR, "with-partial-coverage");

  ruleTester.run("require-test-coverage", rule, {
    valid: [],
    invalid: [
      {
        name: "includes coverage percentage in error message",
        filename: join(fixtureDir, "src/uncovered.ts"),
        code: `export function calculateTotal(items: number[]): number { return items.reduce((sum, item) => sum + item, 0); }`,
        errors: [
          {
            messageId: "belowThreshold",
            // Data should include actual coverage (14%) and threshold (80%)
            data: {
              fileName: "uncovered.ts",
              coverage: "14",
              threshold: "80",
            },
          },
        ],
      },
    ],
  });
});

// ============================================
// SEVERITY CONFIGURATION
// ============================================
describeWithFixtures("require-test-coverage severity levels", () => {
  const noTestsDir = join(FIXTURES_DIR, "with-no-tests");
  const partialDir = join(FIXTURES_DIR, "with-partial-coverage");

  ruleTester.run("require-test-coverage", rule, {
    valid: [
      {
        // All severities off
        name: "no warnings when all severities are off",
        filename: join(noTestsDir, "src/noTest.ts"),
        code: `export function farewell(name: string): string { return \`Goodbye, \${name}!\`; }`,
        options: [{
          severity: {
            noTestFile: "off",
            noCoverage: "off",
            belowThreshold: "off",
          },
        }],
      },
    ],
    invalid: [],
  });
});

// ============================================
// AGGREGATE COVERAGE
// ============================================
describeWithFixtures("require-test-coverage aggregate coverage", () => {
  const fixtureDir = join(FIXTURES_DIR, "with-aggregate-coverage");

  ruleTester.run("require-test-coverage", rule, {
    valid: [
      {
        // Component with good aggregate coverage (above threshold)
        name: "no warning when aggregate coverage meets threshold",
        filename: join(fixtureDir, "src/WellTestedComponent.tsx"),
        code: `
export function WellTestedComponent() {
  return <div>Hello World</div>;
}
`,
        options: [{
          aggregateThreshold: 70,
          severity: { noTestFile: "off" },
        }],
      },
      {
        // Component with low aggregate but aggregateSeverity is "off"
        name: "no warning when aggregateSeverity is off",
        filename: join(fixtureDir, "src/Component.tsx"),
        code: `
import { useData } from "./useHook";
import { formatValue } from "./utils";

export function Component() {
  const data = useData();
  return <div>{formatValue(data)}</div>;
}
`,
        options: [{
          aggregateSeverity: "off",
          severity: { noTestFile: "off" },
        }],
      },
      {
        // .tsx file without JSX should not trigger aggregate check
        name: "does not check aggregate on .tsx file without JSX",
        filename: join(fixtureDir, "src/NonJsxFile.tsx"),
        code: `
export function helper(value: number): number {
  return value * 2;
}
`,
        options: [{
          aggregateThreshold: 70,
          severity: { noTestFile: "off" },
        }],
      },
      {
        // Regular .ts file should not trigger aggregate check
        // Also disable belowThreshold since useHook.ts has 0% coverage
        name: "does not check aggregate on .ts files",
        filename: join(fixtureDir, "src/useHook.ts"),
        code: `
export function useData() {
  const data = fetchFromApi();
  return data;
}

function fetchFromApi() {
  return { value: 42 };
}
`,
        options: [{
          aggregateThreshold: 70,
          severity: { noTestFile: "off", belowThreshold: "off" },
        }],
      },
    ],
    invalid: [
      {
        // Component with low aggregate coverage (below 70% threshold)
        // Component.tsx imports useHook.ts (0% coverage) and utils.ts (50% coverage)
        name: "reports when aggregate coverage is below threshold",
        filename: join(fixtureDir, "src/Component.tsx"),
        code: `
import { useData } from "./useHook";
import { formatValue } from "./utils";

export function Component() {
  const data = useData();
  return <div>{formatValue(data)}</div>;
}
`,
        options: [{
          aggregateThreshold: 70,
          severity: { noTestFile: "off" },
        }],
        errors: [{ messageId: "belowAggregateThreshold" }],
      },
      {
        // Same component but with custom lower threshold - should still fail at 50%
        name: "reports when aggregate coverage is below custom threshold",
        filename: join(fixtureDir, "src/Component.tsx"),
        code: `
import { useData } from "./useHook";
import { formatValue } from "./utils";

export function Component() {
  const data = useData();
  return <div>{formatValue(data)}</div>;
}
`,
        options: [{
          aggregateThreshold: 50,
          severity: { noTestFile: "off" },
        }],
        errors: [{ messageId: "belowAggregateThreshold" }],
      },
    ],
  });
});
