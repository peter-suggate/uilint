/**
 * Rule: require-test-coverage
 *
 * Enforces that source files have test coverage above a configurable threshold.
 * Checks for:
 * - Existence of test files
 * - Coverage data in Istanbul JSON format
 * - Statement coverage percentage
 */

import { createRule, defineRuleMeta } from "../../utils/create-rule.js";
import { existsSync, readFileSync, statSync } from "fs";
import { dirname, join, basename, relative } from "path";
import { execSync } from "child_process";
import {
  aggregateCoverage,
  type IstanbulCoverage as AggregatorIstanbulCoverage,
} from "./lib/coverage-aggregator.js";
import {
  analyzeJSXElementCoverage,
  type IstanbulCoverage as JSXAnalyzerIstanbulCoverage,
} from "./lib/jsx-coverage-analyzer.js";
import { analyzeChunks, getChunkThreshold } from "./lib/chunk-analyzer.js";
import type { TSESTree } from "@typescript-eslint/utils";

/**
 * Simple glob pattern matching function
 * Supports: *, **, ?
 */
function simpleGlobMatch(pattern: string, path: string): boolean {
  // Normalize path separators
  const normalizedPath = path.replace(/\\/g, "/");
  const normalizedPattern = pattern.replace(/\\/g, "/");

  // Escape regex special chars except our glob patterns
  let regexStr = normalizedPattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape regex special chars
    .replace(/\*\*/g, "{{GLOBSTAR}}") // Placeholder for **
    .replace(/\*/g, "[^/]*") // * matches anything except /
    .replace(/\?/g, "[^/]") // ? matches single char except /
    .replace(/{{GLOBSTAR}}/g, ".*"); // ** matches anything including /

  // Add anchors
  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(normalizedPath);
}

type MessageIds =
  | "noCoverage"
  | "belowThreshold"
  | "noCoverageData"
  | "belowAggregateThreshold"
  | "jsxBelowThreshold"
  | "chunkBelowThreshold"
  | "untestedFunction";

type SeverityLevel = "error" | "warn" | "off";

type Options = [
  {
    /** Path to coverage JSON file. Default: "coverage/coverage-final.json" */
    coveragePath?: string;
    /** Coverage threshold percentage. Default: 80 */
    threshold?: number;
    /** Pattern-specific thresholds */
    thresholdsByPattern?: Array<{ pattern: string; threshold: number }>;
    /** Severity levels for different issue types */
    severity?: {
      noCoverage?: SeverityLevel;
      belowThreshold?: SeverityLevel;
    };
    /** Patterns to detect test files. Default: [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx", "__tests__/"] */
    testPatterns?: string[];
    /** Glob patterns for files to ignore. Default: ["**\/*.d.ts", "**\/index.ts"] */
    ignorePatterns?: string[];
    /** Mode: "all" checks all code, "changed" only checks git-changed lines. Default: "all" */
    mode?: "all" | "changed";
    /** Base branch for "changed" mode. Default: "main" */
    baseBranch?: string;
    /** Aggregate coverage threshold for components. Default: 70 */
    aggregateThreshold?: number;
    /** Severity for aggregate coverage check. Default: "warn" */
    aggregateSeverity?: SeverityLevel;
    /** JSX element coverage threshold percentage. Default: 50 */
    jsxThreshold?: number;
    /** Severity for JSX element coverage check. Default: "warn" */
    jsxSeverity?: SeverityLevel;
    /** Enable chunk-level coverage reporting (replaces file-level). Default: false */
    chunkCoverage?: boolean;
    /** Threshold for strict categories (utility/hook/store). Default: 80 */
    chunkThreshold?: number;
    /** Focus on non-React code with relaxed thresholds for components. Default: false */
    focusNonReact?: boolean;
    /** Threshold for relaxed categories (component/handler). Default: 50 */
    relaxedThreshold?: number;
    /** Severity for chunk coverage. Default: "warn" */
    chunkSeverity?: SeverityLevel;
  }
];

/**
 * Istanbul coverage JSON format
 */
interface IstanbulCoverage {
  [filePath: string]: {
    path: string;
    statementMap: {
      [key: string]: {
        start: { line: number; column: number };
        end: { line: number; column: number };
      };
    };
    fnMap: {
      [key: string]: {
        name: string;
        decl: {
          start: { line: number; column: number };
          end: { line: number; column: number };
        };
        loc: {
          start: { line: number; column: number };
          end: { line: number; column: number };
        };
      };
    };
    branchMap: {
      [key: string]: {
        loc: {
          start: { line: number; column: number };
          end: { line: number; column: number };
        };
        type: string;
        locations: Array<{
          start: { line: number; column: number };
          end: { line: number; column: number };
        }>;
      };
    };
    s: { [key: string]: number }; // Statement hit counts
    f: { [key: string]: number }; // Function hit counts
    b: { [key: string]: number[] }; // Branch hit counts
  };
}

/**
 * Rule metadata
 */
export const meta = defineRuleMeta({
  id: "require-test-coverage",
  name: "Require Test Coverage",
  description: "Enforce that source files have adequate test coverage",
  defaultSeverity: "warn",
  category: "static",
  icon: "🧪",
  hint: "Ensures code has tests",
  defaultEnabled: true,
  isDirectoryBased: true,
  requirements: [
    {
      type: "coverage",
      description: "Requires test coverage data",
      setupHint: "Run tests with coverage: npm test -- --coverage",
    },
  ],
  defaultOptions: [
    {
      coveragePath: "coverage/coverage-final.json",
      threshold: 80,
      thresholdsByPattern: [],
      severity: {
        noCoverage: "error",
        belowThreshold: "warn",
      },
      testPatterns: [
        ".test.ts",
        ".test.tsx",
        ".spec.ts",
        ".spec.tsx",
        "__tests__/",
      ],
      ignorePatterns: ["**/*.d.ts", "**/index.ts"],
      mode: "all",
      baseBranch: "main",
    },
  ],
  optionSchema: {
    fields: [
      {
        key: "threshold",
        label: "Coverage threshold",
        type: "number",
        defaultValue: 80,
        description: "Minimum coverage percentage required (0-100)",
      },
      {
        key: "coveragePath",
        label: "Coverage file path",
        type: "text",
        defaultValue: "coverage/coverage-final.json",
        description: "Path to Istanbul coverage JSON file",
      },
      {
        key: "mode",
        label: "Mode",
        type: "select",
        defaultValue: "all",
        options: [
          { value: "all", label: "Check all code" },
          { value: "changed", label: "Only check changed lines" },
        ],
        description: "Whether to check all code or only git-changed lines",
      },
      {
        key: "chunkCoverage",
        label: "Enable chunk-level coverage",
        type: "boolean",
        defaultValue: true,
        description:
          "Report coverage for individual functions instead of file level",
      },
      {
        key: "focusNonReact",
        label: "Focus on non-React code",
        type: "boolean",
        defaultValue: false,
        description:
          "Apply strict thresholds to utilities/stores/hooks, relaxed to components",
      },
      {
        key: "chunkThreshold",
        label: "Chunk coverage threshold",
        type: "number",
        defaultValue: 80,
        description:
          "Minimum coverage for utility/hook/store chunks (0-100)",
      },
      {
        key: "relaxedThreshold",
        label: "Relaxed threshold for React code",
        type: "number",
        defaultValue: 50,
        description:
          "Threshold for components/handlers when focusNonReact is enabled",
      },
    ],
  },
  docs: `
## What it does

Enforces that source files have test coverage above a configurable threshold.
It checks for:
- Existence of corresponding test files
- Coverage data in Istanbul JSON format
- Statement coverage percentage meeting the threshold

## Why it's useful

- **Quality Assurance**: Ensures critical code is tested
- **Catch Regressions**: Prevents merging untested changes
- **Configurable**: Different thresholds for different file patterns
- **Git Integration**: Can focus only on changed lines

## Configuration

\`\`\`js
// eslint.config.js
"uilint/require-test-coverage": ["warn", {
  coveragePath: "coverage/coverage-final.json",
  threshold: 80,
  thresholdsByPattern: [
    { pattern: "**/utils/*.ts", threshold: 90 },
    { pattern: "**/generated/**", threshold: 0 },
  ],
  severity: {
    noTestFile: "warn",
    noCoverage: "error",
    belowThreshold: "warn",
  },
  testPatterns: [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx", "__tests__/"],
  ignorePatterns: ["**/*.d.ts", "**/index.ts"],
  mode: "all",       // or "changed"
  baseBranch: "main" // for "changed" mode
}]
\`\`\`

## Examples

### Files without tests:
\`\`\`ts
// src/utils.ts - No corresponding test file
export function calculate() { ... }  // Warning: No test file found
\`\`\`

### Below threshold:
\`\`\`ts
// src/api.ts - 40% coverage (threshold: 80%)
export function fetchData() { ... }  // Warning: Coverage below threshold
\`\`\`
`,
});

// Cache for loaded coverage data
let coverageCache: {
  projectRoot: string;
  coveragePath: string;
  mtime: number;
  data: IstanbulCoverage;
} | null = null;

/**
 * Clear the coverage cache (useful for testing)
 */
export function clearCoverageCache(): void {
  coverageCache = null;
}

/**
 * Find project root by looking for package.json
 */
function findProjectRoot(startPath: string): string {
  let current = startPath;
  let lastPackageJson: string | null = null;

  while (current !== dirname(current)) {
    if (existsSync(join(current, "package.json"))) {
      lastPackageJson = current;
    }
    // If we find a coverage directory, use this as project root
    if (existsSync(join(current, "coverage"))) {
      return current;
    }
    current = dirname(current);
  }

  return lastPackageJson || startPath;
}

/**
 * Load coverage data from JSON file
 */
function loadCoverage(
  projectRoot: string,
  coveragePath: string
): IstanbulCoverage | null {
  const fullPath = join(projectRoot, coveragePath);

  if (!existsSync(fullPath)) {
    return null;
  }

  try {
    const stat = statSync(fullPath);
    const mtime = stat.mtimeMs;

    // Check cache
    if (
      coverageCache &&
      coverageCache.projectRoot === projectRoot &&
      coverageCache.coveragePath === coveragePath &&
      coverageCache.mtime === mtime
    ) {
      return coverageCache.data;
    }

    const content = readFileSync(fullPath, "utf-8");
    const data = JSON.parse(content) as IstanbulCoverage;

    // Update cache
    coverageCache = {
      projectRoot,
      coveragePath,
      mtime,
      data,
    };

    return data;
  } catch {
    return null;
  }
}

/**
 * Calculate statement coverage percentage for a file
 */
function calculateCoverage(fileCoverage: IstanbulCoverage[string]): number {
  const statements = fileCoverage.s;
  const keys = Object.keys(statements);

  if (keys.length === 0) {
    return 100; // No statements = 100% covered
  }

  const covered = keys.filter((key) => statements[key] > 0).length;
  return Math.round((covered / keys.length) * 100);
}

/**
 * Check if a test file exists for the given source file
 */
function testFileExists(filePath: string, testPatterns: string[]): boolean {
  const dir = dirname(filePath);
  const ext = filePath.match(/\.(tsx?|jsx?)$/)?.[0] || ".ts";
  const baseName = basename(filePath, ext);

  for (const pattern of testPatterns) {
    if (pattern.startsWith("__tests__/")) {
      // Check __tests__ directory
      const testDir = join(dir, "__tests__");
      const testFile = join(
        testDir,
        `${baseName}${pattern.replace("__tests__/", "")}`
      );
      if (existsSync(testFile)) {
        return true;
      }
      // Also check with extensions
      for (const testExt of [
        ".test.ts",
        ".test.tsx",
        ".spec.ts",
        ".spec.tsx",
      ]) {
        if (existsSync(join(testDir, `${baseName}${testExt}`))) {
          return true;
        }
      }
    } else {
      // Pattern is an extension like ".test.ts"
      const testFile = join(dir, `${baseName}${pattern}`);
      if (existsSync(testFile)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a file matches any of the ignore patterns
 */
function shouldIgnore(filePath: string, ignorePatterns: string[]): boolean {
  for (const pattern of ignorePatterns) {
    if (simpleGlobMatch(pattern, filePath)) {
      return true;
    }
  }
  return false;
}

/**
 * Get threshold for a file, checking pattern-specific thresholds first
 */
function getThreshold(
  filePath: string,
  globalThreshold: number,
  thresholdsByPattern: Array<{ pattern: string; threshold: number }>
): number {
  for (const { pattern, threshold } of thresholdsByPattern) {
    if (simpleGlobMatch(pattern, filePath)) {
      return threshold;
    }
  }
  return globalThreshold;
}

/**
 * Get changed line numbers from git diff
 */
function getChangedLines(
  projectRoot: string,
  filePath: string,
  baseBranch: string
): Set<number> | null {
  try {
    const relPath = relative(projectRoot, filePath);
    const diff = execSync(`git diff ${baseBranch}...HEAD -- "${relPath}"`, {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const changedLines = new Set<number>();
    const lines = diff.split("\n");

    let currentLine = 0;
    for (const line of lines) {
      // Parse hunk header: @@ -start,count +start,count @@
      const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunkMatch) {
        currentLine = parseInt(hunkMatch[1], 10);
        continue;
      }

      if (line.startsWith("+") && !line.startsWith("+++")) {
        changedLines.add(currentLine);
        currentLine++;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        // Deleted line, don't increment
      } else if (!line.startsWith("\\")) {
        currentLine++;
      }
    }

    return changedLines;
  } catch {
    // Git command failed, return null to fall back to "all" mode
    return null;
  }
}

/**
 * Calculate coverage for only changed lines
 */
function calculateChangedLinesCoverage(
  fileCoverage: IstanbulCoverage[string],
  changedLines: Set<number>
): number {
  const statementMap = fileCoverage.statementMap;
  const statements = fileCoverage.s;

  let relevantStatements = 0;
  let coveredStatements = 0;

  for (const [key, location] of Object.entries(statementMap)) {
    // Check if any line of this statement was changed
    let isRelevant = false;
    for (let line = location.start.line; line <= location.end.line; line++) {
      if (changedLines.has(line)) {
        isRelevant = true;
        break;
      }
    }

    if (isRelevant) {
      relevantStatements++;
      if (statements[key] > 0) {
        coveredStatements++;
      }
    }
  }

  if (relevantStatements === 0) {
    return 100; // No changed statements = 100% covered
  }

  return Math.round((coveredStatements / relevantStatements) * 100);
}

/**
 * Normalize file path for coverage lookup
 * Coverage JSON may store paths in different formats
 */
function findCoverageForFile(
  coverage: IstanbulCoverage,
  filePath: string,
  projectRoot: string
): IstanbulCoverage[string] | null {
  // Try exact match first
  if (coverage[filePath]) {
    return coverage[filePath];
  }

  // Try relative path from project root
  const relPath = relative(projectRoot, filePath);
  if (coverage[relPath]) {
    return coverage[relPath];
  }

  // Try with leading slash (common in Istanbul output)
  const withSlash = "/" + relPath;
  if (coverage[withSlash]) {
    return coverage[withSlash];
  }

  // Try just the src-relative path
  const srcMatch = relPath.match(/src\/.+$/);
  if (srcMatch) {
    const srcPath = "/" + srcMatch[0];
    if (coverage[srcPath]) {
      return coverage[srcPath];
    }
  }

  return null;
}

export default createRule<Options, MessageIds>({
  name: "require-test-coverage",
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce that source files have adequate test coverage",
    },
    messages: {
      noCoverage:
        "No coverage data found for '{{fileName}}' in coverage report",
      belowThreshold:
        "Coverage for '{{fileName}}' is {{coverage}}%, below threshold of {{threshold}}%",
      noCoverageData:
        "Coverage data not found at '{{coveragePath}}'. Run tests with coverage first.",
      belowAggregateThreshold:
        "Aggregate coverage ({{coverage}}%) is below threshold ({{threshold}}%). " +
        "Includes {{fileCount}} files. Lowest: {{lowestFile}} ({{lowestCoverage}}%)",
      jsxBelowThreshold:
        "<{{tagName}}> element coverage is {{coverage}}%, below threshold of {{threshold}}%",
      chunkBelowThreshold:
        "{{category}} '{{name}}' has {{coverage}}% coverage, below {{threshold}}% threshold",
      untestedFunction:
        "Function '{{name}}' ({{category}}) is not covered by tests",
    },
    schema: [
      {
        type: "object",
        properties: {
          coveragePath: {
            type: "string",
            description: "Path to coverage JSON file",
          },
          threshold: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "Coverage threshold percentage",
          },
          thresholdsByPattern: {
            type: "array",
            items: {
              type: "object",
              properties: {
                pattern: { type: "string" },
                threshold: { type: "number", minimum: 0, maximum: 100 },
              },
              required: ["pattern", "threshold"],
              additionalProperties: false,
            },
            description: "Pattern-specific thresholds",
          },
          severity: {
            type: "object",
            properties: {
              noCoverage: { type: "string", enum: ["error", "warn", "off"] },
              belowThreshold: {
                type: "string",
                enum: ["error", "warn", "off"],
              },
            },
            additionalProperties: false,
          },
          testPatterns: {
            type: "array",
            items: { type: "string" },
            description: "Patterns to detect test files",
          },
          ignorePatterns: {
            type: "array",
            items: { type: "string" },
            description: "Glob patterns for files to ignore",
          },
          mode: {
            type: "string",
            enum: ["all", "changed"],
            description: "Check all code or only changed lines",
          },
          baseBranch: {
            type: "string",
            description: "Base branch for changed mode",
          },
          aggregateThreshold: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description:
              "Aggregate coverage threshold for components (includes dependencies)",
          },
          aggregateSeverity: {
            type: "string",
            enum: ["error", "warn", "off"],
            description: "Severity for aggregate coverage check",
          },
          jsxThreshold: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description:
              "JSX element coverage threshold percentage (includes event handlers)",
          },
          jsxSeverity: {
            type: "string",
            enum: ["error", "warn", "off"],
            description: "Severity for JSX element coverage check",
          },
          chunkCoverage: {
            type: "boolean",
            description:
              "Enable chunk-level coverage reporting (replaces file-level)",
          },
          chunkThreshold: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description:
              "Threshold for strict categories (utility/hook/store)",
          },
          focusNonReact: {
            type: "boolean",
            description:
              "Focus on non-React code with relaxed thresholds for components",
          },
          relaxedThreshold: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "Threshold for relaxed categories (component/handler)",
          },
          chunkSeverity: {
            type: "string",
            enum: ["error", "warn", "off"],
            description: "Severity for chunk coverage check",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [
    {
      coveragePath: "coverage/coverage-final.json",
      threshold: 80,
      thresholdsByPattern: [],
      severity: {
        noCoverage: "error",
        belowThreshold: "warn",
      },
      testPatterns: [
        ".test.ts",
        ".test.tsx",
        ".spec.ts",
        ".spec.tsx",
        "__tests__/",
      ],
      ignorePatterns: ["**/*.d.ts", "**/index.ts"],
      mode: "all",
      baseBranch: "main",
      aggregateThreshold: 70,
      aggregateSeverity: "warn",
      jsxThreshold: 50,
      jsxSeverity: "warn",
      chunkCoverage: true,
      chunkThreshold: 80,
      focusNonReact: false,
      relaxedThreshold: 50,
      chunkSeverity: "warn",
    },
  ],
  create(context) {
    const options = context.options[0] || {};
    const coveragePath = options.coveragePath ?? "coverage/coverage-final.json";
    const threshold = options.threshold ?? 80;
    const thresholdsByPattern = options.thresholdsByPattern ?? [];
    const severity = {
      noCoverage: options.severity?.noCoverage ?? "error",
      belowThreshold: options.severity?.belowThreshold ?? "warn",
    };
    const aggregateThreshold = options.aggregateThreshold ?? 70;
    const aggregateSeverity = options.aggregateSeverity ?? "warn";
    const testPatterns = options.testPatterns ?? [
      ".test.ts",
      ".test.tsx",
      ".spec.ts",
      ".spec.tsx",
      "__tests__/",
    ];
    const ignorePatterns = options.ignorePatterns ?? [
      "**/*.d.ts",
      "**/index.ts",
    ];
    const mode = options.mode ?? "all";
    const baseBranch = options.baseBranch ?? "main";
    const jsxThreshold = options.jsxThreshold ?? 50;
    const jsxSeverity = options.jsxSeverity ?? "warn";
    const chunkCoverage = options.chunkCoverage ?? true;
    const chunkThreshold = options.chunkThreshold ?? 80;
    const focusNonReact = options.focusNonReact ?? false;
    const relaxedThreshold = options.relaxedThreshold ?? 50;
    const chunkSeverity = options.chunkSeverity ?? "warn";

    const filename = context.filename || context.getFilename();
    const projectRoot = findProjectRoot(dirname(filename));

    // Check if file should be ignored
    const relPath = relative(projectRoot, filename);
    if (shouldIgnore(relPath, ignorePatterns)) {
      return {};
    }

    // Skip test files themselves
    if (
      testPatterns.some((p) =>
        filename.includes(p.replace("__tests__/", "__tests__"))
      )
    ) {
      return {};
    }

    // Track if we've already reported for this file
    let reported = false;

    // Collect JSX elements with their ancestors for element-level coverage
    const jsxElements: Array<{
      node: TSESTree.JSXElement;
      ancestors: TSESTree.Node[];
    }> = [];

    return {
      // Collect JSX elements for element-level coverage analysis
      JSXElement(node: TSESTree.JSXElement) {
        // Get ancestors using context.sourceCode (ESLint v9) or context.getAncestors (legacy)
        const ancestors = context.sourceCode?.getAncestors?.(node) ?? [];
        jsxElements.push({ node, ancestors });
      },

      "Program:exit"(node: TSESTree.Program) {
        if (reported) return;
        reported = true;

        // Load coverage data
        const coverage = loadCoverage(projectRoot, coveragePath);

        // Check if coverage data exists
        if (!coverage) {
          if (severity.noCoverage !== "off") {
            context.report({
              node,
              messageId: "noCoverageData",
              data: {
                coveragePath,
              },
            });
          }
          return;
        }

        // Find coverage for this file
        const fileCoverage = findCoverageForFile(
          coverage,
          filename,
          projectRoot
        );

        if (!fileCoverage) {
          // File is not in coverage report - this is OK if coverage data exists
          // but this specific file wasn't covered (different from no coverage data at all)
          return;
        }

        // Calculate coverage
        let coveragePercent: number;

        if (mode === "changed") {
          const changedLines = getChangedLines(
            projectRoot,
            filename,
            baseBranch
          );
          if (changedLines && changedLines.size > 0) {
            coveragePercent = calculateChangedLinesCoverage(
              fileCoverage,
              changedLines
            );
          } else {
            // No changed lines or git failed - use full coverage
            coveragePercent = calculateCoverage(fileCoverage);
          }
        } else {
          coveragePercent = calculateCoverage(fileCoverage);
        }

        // Get threshold for this file
        const fileThreshold = getThreshold(
          relPath,
          threshold,
          thresholdsByPattern
        );

        // Check if below threshold (file-level) - skipped when chunkCoverage is enabled
        if (
          !chunkCoverage &&
          severity.belowThreshold !== "off" &&
          coveragePercent < fileThreshold
        ) {
          context.report({
            node,
            messageId: "belowThreshold",
            data: {
              fileName: basename(filename),
              coverage: String(coveragePercent),
              threshold: String(fileThreshold),
            },
          });
        }

        // Check chunk-level coverage (replaces file-level when enabled)
        if (chunkCoverage && chunkSeverity !== "off" && fileCoverage) {
          const chunks = analyzeChunks(
            context.sourceCode.ast,
            filename,
            fileCoverage
          );

          // Report one message per chunk below threshold, highlighting just the declaration
          for (const chunk of chunks) {
            const chunkThresholdValue = getChunkThreshold(chunk, {
              focusNonReact,
              chunkThreshold,
              relaxedThreshold,
            });

            if (chunk.coverage.percentage < chunkThresholdValue) {
              const messageId =
                chunk.coverage.functionCalled
                  ? "chunkBelowThreshold"
                  : "untestedFunction";

              context.report({
                loc: chunk.declarationLoc,
                messageId,
                data: {
                  name: chunk.name,
                  category: chunk.category,
                  coverage: String(chunk.coverage.percentage),
                  threshold: String(chunkThresholdValue),
                },
              });
            }
          }
        }

        // Check aggregate coverage for component files (JSX)
        if (
          aggregateSeverity !== "off" &&
          (filename.endsWith(".tsx") || filename.endsWith(".jsx"))
        ) {
          // Check if file actually contains JSX by looking at the AST
          const hasJSX = checkForJSX(context.sourceCode.ast);

          if (hasJSX) {
            const aggregateResult = aggregateCoverage(
              filename,
              projectRoot,
              coverage as AggregatorIstanbulCoverage
            );

            if (aggregateResult.aggregateCoverage < aggregateThreshold) {
              const lowestFile = aggregateResult.lowestCoverageFile;
              context.report({
                node,
                messageId: "belowAggregateThreshold",
                data: {
                  coverage: String(
                    Math.round(aggregateResult.aggregateCoverage)
                  ),
                  threshold: String(aggregateThreshold),
                  fileCount: String(aggregateResult.totalFiles),
                  lowestFile: lowestFile
                    ? basename(lowestFile.path)
                    : "N/A",
                  lowestCoverage: lowestFile
                    ? String(Math.round(lowestFile.percentage))
                    : "N/A",
                },
              });
            }
          }
        }

        // Check JSX element-level coverage
        if (
          jsxSeverity !== "off" &&
          jsxElements.length > 0 &&
          coverage
        ) {
          // Compute relative path for dataLoc (consistent with overlay matching)
          const fileRelPath = relPath.startsWith("/") ? relPath : `/${relPath}`;

          for (const { node: jsxNode, ancestors } of jsxElements) {
            // Only check elements with event handlers (interactive elements)
            const hasEventHandlers = jsxNode.openingElement.attributes.some(
              (attr) =>
                attr.type === "JSXAttribute" &&
                attr.name.type === "JSXIdentifier" &&
                /^on[A-Z]/.test(attr.name.name)
            );

            // Skip non-interactive elements to reduce noise
            if (!hasEventHandlers) {
              continue;
            }

            const result = analyzeJSXElementCoverage(
              jsxNode,
              fileRelPath,
              coverage as JSXAnalyzerIstanbulCoverage,
              ancestors,
              projectRoot
            );

            if (result.coverage.percentage < jsxThreshold) {
              // Get the tag name for the error message
              const openingElement = jsxNode.openingElement;
              let tagName = "unknown";
              if (openingElement.name.type === "JSXIdentifier") {
                tagName = openingElement.name.name;
              } else if (openingElement.name.type === "JSXMemberExpression") {
                // For Foo.Bar, use "Foo.Bar"
                let current: TSESTree.JSXTagNameExpression = openingElement.name;
                const parts: string[] = [];
                while (current.type === "JSXMemberExpression") {
                  if (current.property.type === "JSXIdentifier") {
                    parts.unshift(current.property.name);
                  }
                  current = current.object;
                }
                if (current.type === "JSXIdentifier") {
                  parts.unshift(current.name);
                }
                tagName = parts.join(".");
              }

              context.report({
                node: jsxNode,
                messageId: "jsxBelowThreshold",
                data: {
                  tagName,
                  coverage: String(result.coverage.percentage),
                  threshold: String(jsxThreshold),
                  dataLoc: result.dataLoc,
                },
              });
            }
          }
        }
      },
    };
  },
});

/**
 * Check if an AST contains JSX elements
 * Uses a visited set to avoid infinite recursion from circular references (e.g., parent pointers)
 */
function checkForJSX(ast: unknown, visited: WeakSet<object> = new WeakSet()): boolean {
  if (!ast || typeof ast !== "object") return false;

  // Avoid circular references
  if (visited.has(ast as object)) return false;
  visited.add(ast as object);

  const node = ast as Record<string, unknown>;

  // Check if this node is JSX
  if (
    node.type === "JSXElement" ||
    node.type === "JSXFragment" ||
    node.type === "JSXText"
  ) {
    return true;
  }

  // Only traverse known AST child properties to avoid parent/token references
  const childKeys = ["body", "declarations", "declaration", "expression", "expressions",
    "argument", "arguments", "callee", "elements", "properties", "value", "init",
    "consequent", "alternate", "test", "left", "right", "object", "property",
    "children", "openingElement", "closingElement", "attributes"];

  for (const key of childKeys) {
    const child = node[key];
    if (child && typeof child === "object") {
      if (Array.isArray(child)) {
        for (const item of child) {
          if (checkForJSX(item, visited)) return true;
        }
      } else {
        if (checkForJSX(child, visited)) return true;
      }
    }
  }

  return false;
}
