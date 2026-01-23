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
import rule, { clearCoverageCache } from "./require-test-coverage/index.js";
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
        options: [{ chunkCoverage: false }],
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
        options: [{ chunkCoverage: false }],
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
        options: [{ threshold: 10, chunkCoverage: false }], // 14% > 10%
      },
      {
        // belowThreshold severity is off
        name: "no warning when belowThreshold severity is off",
        filename: join(fixtureDir, "src/uncovered.ts"),
        code: `export function calculateTotal(items: number[]): number { return items.reduce((sum, item) => sum + item, 0); }`,
        options: [{ severity: { belowThreshold: "off" }, chunkSeverity: "off" }],
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
        options: [{ chunkCoverage: false }],
        errors: [{ messageId: "belowThreshold" }],
      },
      {
        // covered.ts has 90% coverage (9/10 statements), so use 95% threshold to trigger warning
        name: "warns when coverage below custom threshold",
        filename: join(fixtureDir, "src/covered.ts"),
        code: `export function formatName(first: string, last: string): string { return \`\${first} \${last}\`; }`,
        options: [{ threshold: 95, chunkCoverage: false }], // 90% < 95%
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
          chunkCoverage: false,
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
          chunkCoverage: false,
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
// MODE: ALL vs CHANGED
// ============================================
describeWithFixtures("require-test-coverage mode", () => {
  const fixtureDir = join(FIXTURES_DIR, "with-git-changes");

  ruleTester.run("require-test-coverage", rule, {
    valid: [
      {
        // mode: "changed" - when git shows no changes for file (no diff)
        // The file has 25% coverage but since there are no git changes,
        // we fall back to "all" mode. But we disable belowThreshold.
        name: "no warning in changed mode when no git changes",
        filename: join(fixtureDir, "src/modified.ts"),
        code: `export function existingFunction(): string { return "I exist"; }`,
        options: [{
          mode: "changed",
          baseBranch: "main",
          severity: { belowThreshold: "off" },
          chunkSeverity: "off",
        }],
      },
    ],
    invalid: [
      {
        // mode: "all" (default) - check all uncovered code (25% coverage < 80%)
        name: "warns on all uncovered code in default mode",
        filename: join(fixtureDir, "src/modified.ts"),
        code: `
export function existingFunction(): string { return "I exist"; }
export function newFunction(): string { return "I am new"; }
`,
        options: [{ chunkCoverage: false }],
        errors: [
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
        options: [{ coveragePath: "coverage/coverage-final.json", chunkCoverage: false }],
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
        options: [{ chunkCoverage: false }],
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
          severity: {},
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
          severity: {},
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
          severity: {},
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
          severity: { belowThreshold: "off" },
          chunkSeverity: "off",
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
          severity: {},
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
          severity: {},
        }],
        errors: [{ messageId: "belowAggregateThreshold" }],
      },
    ],
  });
});

// ============================================
// JSX ELEMENT COVERAGE
// ============================================
describeWithFixtures("require-test-coverage JSX element coverage", () => {
  const fixtureDir = join(FIXTURES_DIR, "with-jsx-coverage");

  ruleTester.run("require-test-coverage", rule, {
    valid: [
      {
        // Well-tested component with all handlers covered
        name: "no warning when JSX element handlers are tested",
        filename: join(fixtureDir, "src/WellTestedComponent.tsx"),
        code: `
export function WellTestedComponent() {
  const handleClick = () => {
    console.log("clicked");
    return "handled";
  };

  return (
    <button onClick={handleClick}>Click me</button>
  );
}
`,
        options: [{
          jsxThreshold: 50,
          severity: { belowThreshold: "off" },
          aggregateSeverity: "off",
        }],
      },
      {
        // JSX elements without event handlers should be ignored
        name: "no warning for non-interactive elements",
        filename: join(fixtureDir, "src/ComponentWithHandlers.tsx"),
        code: `
export function SimpleComponent() {
  return (
    <div>
      <span>Hello</span>
      <p>World</p>
    </div>
  );
}
`,
        options: [{
          jsxThreshold: 50,
          severity: { belowThreshold: "off" },
          aggregateSeverity: "off",
          chunkSeverity: "off",
        }],
      },
      {
        // jsxSeverity is "off" - no reporting
        name: "no warning when jsxSeverity is off",
        filename: join(fixtureDir, "src/ComponentWithHandlers.tsx"),
        code: `
export function ComponentWithHandlers() {
  const handleClick = () => {
    console.log("clicked");
  };

  return <button onClick={handleClick}>Submit</button>;
}
`,
        options: [{
          jsxSeverity: "off",
          severity: { belowThreshold: "off" },
          aggregateSeverity: "off",
          chunkSeverity: "off",
        }],
      },
    ],
    invalid: [
      {
        // Component with untested onClick handler
        name: "warns when JSX element handler is untested",
        filename: join(fixtureDir, "src/ComponentWithHandlers.tsx"),
        code: `
export function ComponentWithHandlers() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("submitted");
  };

  const handleClick = () => {
    console.log("clicked");
    doSomething();
  };

  function doSomething() {
    return "done";
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input onChange={(e) => console.log(e.target.value)} />
        <button onClick={handleClick}>Submit</button>
      </div>
    </form>
  );
}
`,
        options: [{
          jsxThreshold: 50,
          severity: { belowThreshold: "off" },
          aggregateSeverity: "off",
          chunkSeverity: "off",
        }],
        errors: [
          // The <form> element has 33% coverage (below 50% threshold)
          // The handler bodies inside (handleSubmit, handleClick) are not executed
          { messageId: "jsxBelowThreshold" },
        ],
      },
    ],
  });
});

// ============================================
// CHUNK-LEVEL COVERAGE
// ============================================
describeWithFixtures("require-test-coverage chunk-level coverage", () => {
  const fixtureDir = join(FIXTURES_DIR, "with-chunk-coverage");

  ruleTester.run("require-test-coverage", rule, {
    valid: [
      {
        // Chunk coverage disabled (default) - file-level reporting only
        name: "no chunk warnings when chunkCoverage is disabled",
        filename: join(fixtureDir, "src/utils.ts"),
        code: `
export function formatName(first: string, last: string): string {
  return \`\${first} \${last}\`;
}

export function validateEmail(email: string): boolean {
  return email.includes("@");
}

export function calculateTotal(items: number[]): number {
  return items.reduce((sum, item) => sum + item, 0);
}

export const formatCurrency = (amount: number): string => {
  return \`$\${amount.toFixed(2)}\`;
};
`,
        options: [{
          chunkCoverage: false,
          severity: { belowThreshold: "off" },
        }],
      },
      {
        // Chunk coverage enabled but severity is off
        name: "no chunk warnings when chunkSeverity is off",
        filename: join(fixtureDir, "src/utils.ts"),
        code: `
export function formatName(first: string, last: string): string {
  return \`\${first} \${last}\`;
}
`,
        options: [{
          chunkCoverage: true,
          chunkSeverity: "off",
          severity: {},
        }],
      },
      {
        // All chunks above threshold - threshold set low enough to pass
        name: "no chunk warnings when all functions are covered",
        filename: join(fixtureDir, "src/utils.ts"),
        code: `
export function formatName(first: string, last: string): string {
  return \`\${first} \${last}\`;
}
`,
        options: [{
          chunkCoverage: true,
          chunkThreshold: 0, // Allow any coverage
          severity: {},
        }],
      },
      {
        // focusNonReact with component - relaxed threshold allows low coverage
        name: "no warning for component when focusNonReact uses relaxed threshold",
        filename: join(fixtureDir, "src/Button.tsx"),
        code: `
import React from "react";

export function Button({ onClick, label }: { onClick: () => void; label: string }) {
  return <button onClick={onClick}>{label}</button>;
}
`,
        options: [{
          chunkCoverage: true,
          focusNonReact: true,
          chunkThreshold: 90,
          relaxedThreshold: 0, // Allow any coverage for components
          severity: {},
          aggregateSeverity: "off",
          jsxSeverity: "off",
        }],
      },
    ],
    invalid: [
      {
        // Chunk coverage enabled - reports functions below threshold
        name: "warns on utility functions below threshold",
        filename: join(fixtureDir, "src/utils.ts"),
        code: `
export function formatName(first: string, last: string): string {
  return \`\${first} \${last}\`;
}
`,
        options: [{
          chunkCoverage: true,
          chunkThreshold: 80,
          severity: {},
        }],
        errors: [
          // Function below threshold (coverage data doesn't match test code line numbers)
          { messageId: "chunkBelowThreshold" },
        ],
      },
      {
        // focusNonReact mode - strict threshold applies to utility functions
        name: "strict threshold applies to utilities with focusNonReact",
        filename: join(fixtureDir, "src/utils.ts"),
        code: `
export function formatName(first: string, last: string): string {
  return \`\${first} \${last}\`;
}
`,
        options: [{
          chunkCoverage: true,
          focusNonReact: true,
          chunkThreshold: 100, // Set impossibly high to guarantee error
          relaxedThreshold: 40,
          severity: {},
        }],
        errors: [
          // Utility will be below 100% threshold
          { messageId: "chunkBelowThreshold" },
        ],
      },
    ],
  });
});
