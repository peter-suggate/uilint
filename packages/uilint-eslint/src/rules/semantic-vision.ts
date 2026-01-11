/**
 * Rule: semantic-vision
 *
 * ESLint rule that reports cached vision analysis results for UI elements.
 * Vision analysis is performed by the UILint browser overlay and results are
 * cached in .uilint/screenshots/{timestamp}-{route}.json files.
 *
 * This rule:
 * 1. Finds cached vision analysis results for the current file
 * 2. Reports any issues that match elements in this file (by data-loc)
 * 3. If no cached results exist, silently passes (analysis is triggered by browser)
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import { dirname, join, relative } from "path";
import { createRule } from "../utils/create-rule.js";

type MessageIds = "visionIssue" | "analysisStale";

type Options = [
  {
    /** Maximum age of cached results in milliseconds (default: 1 hour) */
    maxAgeMs?: number;
    /** Path to screenshots directory (default: .uilint/screenshots) */
    screenshotsPath?: string;
  }
];

/**
 * Vision analysis result structure stored in JSON files
 */
interface VisionAnalysisResult {
  /** Timestamp when analysis was performed */
  timestamp: number;
  /** Route that was analyzed (e.g., "/", "/profile") */
  route: string;
  /** Screenshot filename (for reference) */
  screenshotFile?: string;
  /** Issues found by vision analysis */
  issues: VisionIssue[];
}

/**
 * Individual issue from vision analysis
 */
interface VisionIssue {
  /** Element text that the LLM referenced */
  elementText?: string;
  /** data-loc reference (format: "path:line:column") */
  dataLoc?: string;
  /** Human-readable description of the issue */
  message: string;
  /** Issue category */
  category?: "spacing" | "color" | "typography" | "alignment" | "accessibility" | "layout" | "other";
  /** Severity level */
  severity?: "error" | "warning" | "info";
}

/**
 * Find project root by looking for package.json
 */
function findProjectRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

/**
 * Get all vision analysis result files from screenshots directory
 */
function getVisionResultFiles(screenshotsDir: string): string[] {
  if (!existsSync(screenshotsDir)) {
    return [];
  }

  try {
    const files = readdirSync(screenshotsDir);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => join(screenshotsDir, f))
      .sort()
      .reverse(); // Most recent first
  } catch {
    return [];
  }
}

/**
 * Load and parse a vision analysis result file
 */
function loadVisionResult(filePath: string): VisionAnalysisResult | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as VisionAnalysisResult;
  } catch {
    return null;
  }
}

/**
 * Parse a data-loc string into file path and location
 * Format: "path/to/file.tsx:line:column"
 */
function parseDataLoc(dataLoc: string): { filePath: string; line: number; column: number } | null {
  // Match pattern: path:line:column (line and column are numbers)
  const match = dataLoc.match(/^(.+):(\d+):(\d+)$/);
  if (!match) return null;

  return {
    filePath: match[1]!,
    line: parseInt(match[2]!, 10),
    column: parseInt(match[3]!, 10),
  };
}

/**
 * Normalize file path for comparison (handle relative vs absolute paths)
 */
function normalizeFilePath(filePath: string, projectRoot: string): string {
  // If it's already a relative path, return as-is
  if (!filePath.startsWith("/")) {
    return filePath;
  }
  // Convert absolute to relative
  return relative(projectRoot, filePath);
}

export default createRule<Options, MessageIds>({
  name: "semantic-vision",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Report cached vision analysis results from UILint browser overlay",
    },
    messages: {
      visionIssue: "[Vision] {{message}}",
      analysisStale:
        "Vision analysis results are stale (older than {{age}}). Re-run analysis in browser.",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxAgeMs: {
            type: "number",
            description:
              "Maximum age of cached results in milliseconds (default: 1 hour)",
          },
          screenshotsPath: {
            type: "string",
            description:
              "Path to screenshots directory (default: .uilint/screenshots)",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{ maxAgeMs: 60 * 60 * 1000 }], // 1 hour default
  create(context) {
    const options = context.options[0] || {};
    const maxAgeMs = options.maxAgeMs ?? 60 * 60 * 1000;
    const filePath = context.filename;
    const fileDir = dirname(filePath);

    // Find project root and screenshots directory
    const projectRoot = findProjectRoot(fileDir);
    const screenshotsDir = options.screenshotsPath
      ? join(projectRoot, options.screenshotsPath)
      : join(projectRoot, ".uilint", "screenshots");

    // Get the relative path of the current file for matching against data-loc
    const relativeFilePath = normalizeFilePath(filePath, projectRoot);

    // Find all vision result files
    const resultFiles = getVisionResultFiles(screenshotsDir);
    if (resultFiles.length === 0) {
      // No cached results - silently pass (analysis happens in browser)
      return {};
    }

    // Collect issues that match this file from all recent results
    const matchingIssues: Array<{
      issue: VisionIssue;
      line: number;
      column: number;
      isStale: boolean;
    }> = [];

    const now = Date.now();

    for (const resultFile of resultFiles) {
      const result = loadVisionResult(resultFile);
      if (!result || !result.issues) continue;

      const isStale = now - result.timestamp > maxAgeMs;

      for (const issue of result.issues) {
        if (!issue.dataLoc) continue;

        const parsed = parseDataLoc(issue.dataLoc);
        if (!parsed) continue;

        // Check if this issue is for the current file
        const issueFilePath = normalizeFilePath(parsed.filePath, projectRoot);
        if (issueFilePath === relativeFilePath) {
          matchingIssues.push({
            issue,
            line: parsed.line,
            column: parsed.column,
            isStale,
          });
        }
      }
    }

    // De-duplicate issues by line:column:message
    const seenIssues = new Set<string>();
    const uniqueIssues = matchingIssues.filter((item) => {
      const key = `${item.line}:${item.column}:${item.issue.message}`;
      if (seenIssues.has(key)) return false;
      seenIssues.add(key);
      return true;
    });

    return {
      Program(node) {
        for (const { issue, line, column, isStale } of uniqueIssues) {
          // Build message with category prefix if available
          const categoryPrefix = issue.category
            ? `[${issue.category}] `
            : "";
          const message = `${categoryPrefix}${issue.message}`;

          // Report stale warning separately if enabled
          if (isStale) {
            const ageHours = Math.round(maxAgeMs / (60 * 60 * 1000));
            context.report({
              node,
              loc: { line, column },
              messageId: "analysisStale",
              data: { age: `${ageHours}h` },
            });
          }

          context.report({
            node,
            loc: { line, column },
            messageId: "visionIssue",
            data: { message },
          });
        }
      },
    };
  },
});
