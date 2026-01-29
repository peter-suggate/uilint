/**
 * Manifest Generator
 *
 * Scans all JSX/TSX files in a project and generates a static
 * lint manifest for remote/production deployments.
 */

import { existsSync, readFileSync, statSync } from "fs";
import { resolve, dirname, relative } from "path";
import { glob } from "glob";
import { execSync } from "child_process";
import { findWorkspaceRoot } from "uilint-core/node";
import { ruleRegistry } from "uilint-eslint";
import { findEslintConfigFile, readRuleConfigsFromConfig } from "../../utils/eslint-config-inject.js";
import {
  findESLintCwd,
  lintFileWithDataLoc,
  extractSourceSnippet,
  normalizeDataLocFilePath,
  type LintIssue,
} from "../../utils/eslint-utils.js";
import type {
  LintManifest,
  ManifestFileEntry,
  ManifestIssue,
  ManifestRuleMeta,
  SourceSnippet,
  GenerateManifestOptions,
} from "./types.js";

/**
 * Default glob patterns for JSX/TSX files
 */
const DEFAULT_INCLUDE = ["**/*.tsx", "**/*.jsx"];

/**
 * Default glob patterns to exclude
 */
const DEFAULT_EXCLUDE = [
  "node_modules/**",
  "dist/**",
  ".next/**",
  "build/**",
  "coverage/**",
  ".uilint/**",
  "**/*.test.tsx",
  "**/*.test.jsx",
  "**/*.spec.tsx",
  "**/*.spec.jsx",
];

/**
 * Get git information if available
 */
function getGitInfo(cwd: string): { commitSha?: string; branch?: string } {
  try {
    const commitSha = execSync("git rev-parse HEAD", {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    return { commitSha, branch };
  } catch {
    return {};
  }
}

/**
 * Build rule metadata for the manifest
 */
function buildRuleMetadata(appRoot: string): ManifestRuleMeta[] {
  // Read current rule configs from ESLint config file
  const eslintConfigPath = findEslintConfigFile(appRoot);
  const currentRuleConfigs = eslintConfigPath
    ? readRuleConfigsFromConfig(eslintConfigPath)
    : new Map<string, { severity: "error" | "warn" | "off"; options?: Record<string, unknown> }>();

  // Only include rules that are configured in the ESLint config
  return ruleRegistry
    .filter((rule) => currentRuleConfigs.has(rule.id))
    .map((rule) => {
      const currentConfig = currentRuleConfigs.get(rule.id);
      return {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        category: rule.category,
        defaultSeverity: rule.defaultSeverity,
        currentSeverity: currentConfig?.severity,
        docs: rule.docs,
        optionSchema: rule.optionSchema,
      };
    });
}

/**
 * Generate a lint manifest for a project
 */
export async function generateManifest(
  options: GenerateManifestOptions = {}
): Promise<LintManifest> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const include = options.include ?? DEFAULT_INCLUDE;
  const exclude = options.exclude ?? DEFAULT_EXCLUDE;
  const includeSnippets = options.includeSnippets ?? true;
  const snippetContextLines = options.snippetContextLines ?? 3;
  const onProgress = options.onProgress ?? (() => {});

  onProgress("Finding workspace root...");
  const workspaceRoot = findWorkspaceRoot(cwd);
  const appRoot = cwd;

  onProgress("Scanning for JSX/TSX files...");

  // Find all matching files
  const files = await glob(include, {
    cwd,
    ignore: exclude,
    absolute: true,
    nodir: true,
  });

  onProgress(`Found ${files.length} files to scan`);

  // Get git info
  const gitInfo = getGitInfo(cwd);

  // Build rule metadata
  const rules = buildRuleMetadata(appRoot);
  onProgress(`Loaded ${rules.length} rule definitions`);

  // Process each file
  const manifestFiles: ManifestFileEntry[] = [];
  let totalIssues = 0;
  let errorCount = 0;
  let warnCount = 0;

  for (let i = 0; i < files.length; i++) {
    const absolutePath = files[i]!;
    const relativePath = relative(cwd, absolutePath);

    onProgress(`Linting ${relativePath}...`, i + 1, files.length);

    // Find ESLint project root for this file
    const fileDir = dirname(absolutePath);
    const projectCwd = findESLintCwd(fileDir);

    // Lint the file
    const issues = await lintFileWithDataLoc(absolutePath, projectCwd);

    if (issues.length === 0) continue;

    // Convert to manifest format
    const manifestIssues: ManifestIssue[] = issues
      .filter((issue): issue is LintIssue & { dataLoc: string } => Boolean(issue.dataLoc))
      .map((issue) => ({
        line: issue.line,
        column: issue.column,
        message: issue.message,
        ruleId: issue.ruleId,
        dataLoc: issue.dataLoc,
      }));

    if (manifestIssues.length === 0) continue;

    // Extract source snippets if requested
    let snippets: Record<string, SourceSnippet> | undefined;
    if (includeSnippets) {
      try {
        const code = readFileSync(absolutePath, "utf-8");
        snippets = {};

        // Group issues by dataLoc to avoid duplicate snippets
        const issuesByDataLoc = new Map<string, ManifestIssue>();
        for (const issue of manifestIssues) {
          if (!issuesByDataLoc.has(issue.dataLoc)) {
            issuesByDataLoc.set(issue.dataLoc, issue);
          }
        }

        for (const [dataLoc, issue] of issuesByDataLoc) {
          snippets[dataLoc] = extractSourceSnippet(code, issue.line, snippetContextLines);
        }
      } catch {
        // Skip snippets if file can't be read
      }
    }

    // Count by severity
    for (const issue of manifestIssues) {
      if (issue.ruleId) {
        // Check rule config for severity
        const rule = rules.find((r) => `uilint/${r.id}` === issue.ruleId || r.id === issue.ruleId);
        const severity = rule?.currentSeverity ?? rule?.defaultSeverity ?? "warn";
        if (severity === "error") {
          errorCount++;
        } else {
          warnCount++;
        }
      } else {
        warnCount++;
      }
    }

    totalIssues += manifestIssues.length;

    // Use the normalized relative path for the manifest
    const dataLocFilePath = normalizeDataLocFilePath(absolutePath, projectCwd);

    manifestFiles.push({
      filePath: dataLocFilePath,
      issues: manifestIssues,
      snippets,
    });
  }

  onProgress(`Scan complete: ${totalIssues} issues in ${manifestFiles.length} files`);

  return {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    workspaceRoot,
    appRoot,
    commitSha: gitInfo.commitSha,
    branch: gitInfo.branch,
    files: manifestFiles,
    rules,
    summary: {
      filesScanned: files.length,
      filesWithIssues: manifestFiles.length,
      totalIssues,
      bySeverity: {
        error: errorCount,
        warn: warnCount,
      },
    },
  };
}
