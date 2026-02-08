/**
 * Manifest Generator
 *
 * Scans all JSX/TSX files in a project and generates a static
 * lint manifest for remote/production deployments.
 */

import { readFileSync } from "fs";
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
import { findEnclosingScopeBatch } from "../../scope-extractor.js";
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
  // readRuleConfigsFromConfig strips the "uilint/" prefix, so match on bare rule.id
  return ruleRegistry
    .filter((rule) => currentRuleConfigs.has(rule.id))
    .map((rule) => {
      const currentConfig = currentRuleConfigs.get(rule.id);
      return {
        id: `uilint/${rule.id}`,
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
  // Default to including full source content (for production mode source display)
  const includeSource = options.includeSource ?? true;
  // Snippets are deprecated but still supported for backwards compatibility
  const includeSnippets = options.includeSnippets ?? false;
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

    // Filter issues that have dataLoc
    const filteredIssues = issues.filter(
      (issue): issue is LintIssue & { dataLoc: string } => Boolean(issue.dataLoc)
    );

    if (filteredIssues.length === 0) continue;

    // Read file content for source inclusion and scope extraction
    let fileContent: string | undefined;
    let snippets: Record<string, SourceSnippet> | undefined;

    try {
      fileContent = readFileSync(absolutePath, "utf-8");
    } catch {
      // Skip source/snippets if file can't be read
      fileContent = undefined;
    }

    // Extract scope information for all issues in this file (optimized: parse AST once)
    let scopeInfos: Array<ReturnType<typeof findEnclosingScopeBatch>[number]> = [];
    if (fileContent) {
      try {
        const positions = filteredIssues.map((issue) => ({
          line: issue.line,
          column: issue.column ?? 0,
        }));
        scopeInfos = findEnclosingScopeBatch(fileContent, positions);
      } catch {
        // Scope extraction failed - continue without scope info
        scopeInfos = filteredIssues.map(() => null);
      }
    }

    // Convert to manifest format with scope info
    const manifestIssues: ManifestIssue[] = filteredIssues.map((issue, index) => ({
      line: issue.line,
      column: issue.column,
      message: issue.message,
      ruleId: issue.ruleId,
      dataLoc: issue.dataLoc,
      scopeInfo: scopeInfos[index] ?? undefined,
    }));

    // Include snippets if requested (deprecated, for backwards compatibility)
    if (includeSnippets && fileContent) {
      snippets = {};

      // Group issues by dataLoc to avoid duplicate snippets
      const issuesByDataLoc = new Map<string, ManifestIssue>();
      for (const issue of manifestIssues) {
        if (!issuesByDataLoc.has(issue.dataLoc)) {
          issuesByDataLoc.set(issue.dataLoc, issue);
        }
      }

      for (const [dataLoc, issue] of issuesByDataLoc) {
        snippets[dataLoc] = extractSourceSnippet(fileContent, issue.line, snippetContextLines);
      }
    }

    // Count by severity
    for (const issue of manifestIssues) {
      if (issue.ruleId) {
        // Check rule config for severity (rules now have full IDs)
        const rule = rules.find((r) => r.id === issue.ruleId);
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
      // Include full source content for production mode source display
      content: includeSource ? fileContent : undefined,
      // Include snippets if explicitly requested (deprecated)
      snippets: includeSnippets ? snippets : undefined,
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
