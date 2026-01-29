/**
 * Lint Manifest Types
 *
 * Static JSON format for pre-computed lint results.
 * Used for remote/production deployments where the WebSocket
 * server is not available.
 */

import type { RuleOptionSchema } from "uilint-eslint";

/**
 * A single lint issue in the manifest
 */
export interface ManifestIssue {
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed, optional) */
  column?: number;
  /** Issue message */
  message: string;
  /** ESLint rule ID (e.g., "uilint/color-consistency") */
  ruleId?: string;
  /** data-loc attribute value (e.g., "app/page.tsx:45:10") */
  dataLoc: string;
}

/**
 * Source code snippet for context
 */
export interface SourceSnippet {
  /** Lines of source code around the issue */
  lines: string[];
  /** Starting line number (1-indexed) */
  startLine: number;
  /** Ending line number (1-indexed) */
  endLine: number;
}

/**
 * File entry in the manifest
 */
export interface ManifestFileEntry {
  /** Relative file path from project root */
  filePath: string;
  /** All issues found in this file */
  issues: ManifestIssue[];
  /** Source snippets for each dataLoc (optional) */
  snippets?: Record<string, SourceSnippet>;
}

/**
 * Rule metadata included in manifest
 */
export interface ManifestRuleMeta {
  /** Rule ID (e.g., "color-consistency") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Rule description */
  description: string;
  /** Category: static (ESLint) or semantic (AI) */
  category: "static" | "semantic";
  /** Default severity */
  defaultSeverity: "error" | "warn" | "off";
  /** Current severity from ESLint config */
  currentSeverity?: "error" | "warn" | "off";
  /** Documentation URL */
  docs?: string;
  /** Option schema for configuration */
  optionSchema?: RuleOptionSchema;
}

/**
 * The complete lint manifest
 */
export interface LintManifest {
  /** Manifest format version */
  version: "1.0";
  /** ISO timestamp when manifest was generated */
  generatedAt: string;
  /** Absolute path to workspace root */
  workspaceRoot: string;
  /** Absolute path to app root (Next.js project) */
  appRoot: string;
  /** Git commit SHA (if available) */
  commitSha?: string;
  /** Git branch name (if available) */
  branch?: string;
  /** All files with lint issues */
  files: ManifestFileEntry[];
  /** Rule metadata for UI display */
  rules: ManifestRuleMeta[];
  /** Summary statistics */
  summary: {
    /** Total number of files scanned */
    filesScanned: number;
    /** Total number of files with issues */
    filesWithIssues: number;
    /** Total number of issues */
    totalIssues: number;
    /** Issues by severity */
    bySeverity: {
      error: number;
      warn: number;
    };
  };
}

/**
 * Options for manifest generation
 */
export interface GenerateManifestOptions {
  /** Root directory to scan (defaults to cwd) */
  cwd?: string;
  /** Glob patterns for files to include (default: ["**\/*.tsx", "**\/*.jsx"]) */
  include?: string[];
  /** Glob patterns to exclude (default: ["node_modules/**", "dist/**", ".next/**"]) */
  exclude?: string[];
  /** Include source snippets in manifest (default: true) */
  includeSnippets?: boolean;
  /** Number of context lines around each issue (default: 3) */
  snippetContextLines?: number;
  /** Progress callback */
  onProgress?: (message: string, current?: number, total?: number) => void;
}
