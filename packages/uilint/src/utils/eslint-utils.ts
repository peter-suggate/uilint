/**
 * Shared ESLint Utilities
 *
 * Common functions for ESLint integration, JSX parsing, and data-loc mapping.
 * Extracted from serve.ts to be reusable across commands.
 */

import { existsSync, readFileSync } from "fs";

/** Generic AST node type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AstNode = Record<string, any>;
import { createRequire } from "module";
import { dirname, resolve, relative, join } from "path";
import { findEnclosingScopeBatch } from "../scope-extractor.js";

/**
 * JSX element span with character offsets and data-loc
 */
export type JsxElementSpan = {
  start: number;
  end: number;
  dataLoc: string;
};

/**
 * Lint issue structure
 */
export interface LintIssue {
  line: number;
  column?: number;
  message: string;
  ruleId?: string;
  dataLoc?: string;
  scopeInfo?: {
    enclosingScope: string | null;
    scopeType: "function" | "arrow-function" | "component" | "hook" | "method" | "class" | "module";
    parentScope?: string;
    jsxElementType?: string;
  };
}

/**
 * Known ESLint config filenames (flat + legacy).
 */
export const ESLINT_CONFIG_FILES = [
  // Flat config (ESLint v9+)
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  // Legacy config
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yaml",
  ".eslintrc.yml",
];

/**
 * Build an array of line start offsets for fast line/column -> offset conversion.
 */
export function buildLineStarts(code: string): number[] {
  const starts: number[] = [0];
  for (let i = 0; i < code.length; i++) {
    if (code.charCodeAt(i) === 10) starts.push(i + 1); // \n
  }
  return starts;
}

/**
 * Convert line (1-indexed) and column (0-indexed) to character offset.
 */
export function offsetFromLineCol(
  lineStarts: number[],
  line1: number,
  col0: number,
  codeLength: number
): number {
  const lineIndex = Math.max(0, Math.min(lineStarts.length - 1, line1 - 1));
  const base = lineStarts[lineIndex] ?? 0;
  return Math.max(0, Math.min(codeLength, base + Math.max(0, col0)));
}

/**
 * Parse JSX/TSX code and build a list of JSX element spans with data-loc values.
 * The data-loc is computed from the opening element's location.
 */
export function buildJsxElementSpans(
  code: string,
  dataLocFile: string
): JsxElementSpan[] {
  // Use local require to get the TypeScript ESTree parser
  const localRequire = createRequire(import.meta.url);
  const { parse } = localRequire("@typescript-eslint/typescript-estree") as {
    parse: (src: string, options: Record<string, unknown>) => AstNode;
  };

  const ast = parse(code, {
    loc: true,
    range: true,
    jsx: true,
    comment: false,
    errorOnUnknownASTType: false,
  });

  const spans: JsxElementSpan[] = [];

  function walk(node: AstNode): void {
    if (!node || typeof node !== "object") return;

    // Prefer mapping to JSXElement range so we can capture nested ownership precisely.
    if (node.type === "JSXElement") {
      const range = node.range as [number, number] | undefined;
      const opening = node.openingElement;
      const loc = opening?.loc?.start;
      if (
        range &&
        typeof range[0] === "number" &&
        typeof range[1] === "number" &&
        loc &&
        typeof loc.line === "number" &&
        typeof loc.column === "number"
      ) {
        const dataLoc = `${dataLocFile}:${loc.line}:${loc.column}`;
        spans.push({ start: range[0], end: range[1], dataLoc });
      }
    }

    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) walk(item);
      } else if (child && typeof child === "object") {
        walk(child);
      }
    }
  }

  walk(ast);

  // Keep spans small-first to make "smallest containing span" selection fast.
  spans.sort((a, b) => a.end - a.start - (b.end - b.start));
  return spans;
}

/**
 * Map an ESLint message (line/column) to the smallest containing JSX element's data-loc.
 */
export function mapMessageToDataLoc(params: {
  spans: JsxElementSpan[];
  lineStarts: number[];
  codeLength: number;
  messageLine1: number;
  messageCol1?: number;
}): string | undefined {
  const col0 =
    typeof params.messageCol1 === "number"
      ? Math.max(0, params.messageCol1 - 1)
      : 0;
  const offset = offsetFromLineCol(
    params.lineStarts,
    params.messageLine1,
    col0,
    params.codeLength
  );

  // Pick the smallest JSXElement range that contains this offset.
  for (const s of params.spans) {
    if (s.start <= offset && offset < s.end) return s.dataLoc;
  }
  return undefined;
}

/**
 * Normalize path separators to forward slashes.
 */
export function normalizePathSlashes(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Match `jsx-loc-plugin` behavior:
 * - Use a stable, project-relative path when possible, otherwise absolute.
 */
export function normalizeDataLocFilePath(
  absoluteFilePath: string,
  projectCwd: string
): string {
  const abs = normalizePathSlashes(resolve(absoluteFilePath));
  const cwd = normalizePathSlashes(resolve(projectCwd));
  if (abs === cwd || abs.startsWith(cwd + "/")) {
    return normalizePathSlashes(relative(cwd, abs));
  }
  return abs;
}

/**
 * Find a project root directory for ESLint by walking upward from a file dir.
 */
export function findESLintCwd(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 30; i++) {
    for (const cfg of ESLINT_CONFIG_FILES) {
      if (existsSync(join(dir, cfg))) return dir;
    }
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

// ESLint instances cached per detected project root
const eslintInstances = new Map<string, unknown>();

/**
 * Get or create an ESLint instance for a project directory.
 */
export async function getESLintForProject(projectCwd: string): Promise<unknown> {
  const cached = eslintInstances.get(projectCwd);
  if (cached) return cached;

  try {
    const req = createRequire(join(projectCwd, "package.json"));
    const mod = req("eslint");
    const ESLintCtor =
      mod?.ESLint ?? mod?.default?.ESLint ?? mod?.default ?? mod;
    if (!ESLintCtor) return null;

    const eslint = new ESLintCtor({ cwd: projectCwd });
    eslintInstances.set(projectCwd, eslint);
    return eslint;
  } catch {
    return null;
  }
}

/**
 * Clear the ESLint instance cache (useful for testing or config changes)
 */
export function clearESLintCache(): void {
  eslintInstances.clear();
}

/**
 * Lint a single file and return issues with data-loc mapping.
 */
export async function lintFileWithDataLoc(
  absolutePath: string,
  projectCwd: string,
  onProgress?: (phase: string) => void
): Promise<LintIssue[]> {
  const progress = onProgress ?? (() => {});

  if (!existsSync(absolutePath)) {
    progress(`File not found: ${absolutePath}`);
    return [];
  }

  progress(`Resolving ESLint project... ${projectCwd}`);

  const eslint = await getESLintForProject(projectCwd);
  if (!eslint) {
    progress("ESLint not available");
    return [];
  }

  try {
    progress("Running ESLint...");
    const results = await (eslint as { lintFiles(files: string[]): Promise<Array<{ messages: Record<string, unknown>[] }>> }).lintFiles([absolutePath]);
    const messages =
      Array.isArray(results) && results.length > 0
        ? results[0].messages || []
        : [];

    const dataLocFile = normalizeDataLocFilePath(absolutePath, projectCwd);
    let spans: JsxElementSpan[] = [];
    let lineStarts: number[] = [];
    let codeLength = 0;
    let fileCode: string | null = null;

    try {
      progress("Building JSX map...");
      fileCode = readFileSync(absolutePath, "utf-8");
      codeLength = fileCode.length;
      lineStarts = buildLineStarts(fileCode);
      spans = buildJsxElementSpans(fileCode, dataLocFile);
      progress(`JSX map: ${spans.length} element(s)`);
    } catch {
      // If parsing fails, we still return ESLint messages (unmapped).
      progress("JSX map failed (falling back to unmapped issues)");
      spans = [];
      lineStarts = [];
      codeLength = 0;
      fileCode = null;
    }

    let issues: LintIssue[] = messages
      .filter((m: Record<string, unknown>) => typeof m?.message === "string")
      .map((m: Record<string, unknown>) => {
        const line = typeof m.line === "number" ? m.line : 1;
        const column = typeof m.column === "number" ? m.column : undefined;
        const mappedDataLoc =
          spans.length > 0 && lineStarts.length > 0 && codeLength > 0
            ? mapMessageToDataLoc({
                spans,
                lineStarts,
                codeLength,
                messageLine1: line,
                messageCol1: column,
              })
            : undefined;
        return {
          line,
          column,
          message: m.message as string,
          ruleId: typeof m.ruleId === "string" ? m.ruleId : undefined,
          dataLoc: mappedDataLoc,
        } satisfies LintIssue;
      });

    const mappedCount = issues.filter((i) => Boolean(i.dataLoc)).length;
    if (issues.length > 0) {
      progress(`Mapped ${mappedCount}/${issues.length} issue(s) to JSX elements`);
    }

    // Enrich issues with scope information
    if (fileCode && issues.length > 0) {
      progress("Extracting scope info...");
      issues = enrichIssuesWithScopeInfo(issues, fileCode);
      const scopeCount = issues.filter((i) => Boolean(i.scopeInfo)).length;
      progress(`Enriched ${scopeCount}/${issues.length} issue(s) with scope info`);
    }

    return issues;
  } catch (error) {
    progress(`ESLint failed: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Extract source snippet around a given line
 */
export function extractSourceSnippet(
  code: string,
  centerLine: number,
  contextLines: number = 3
): { lines: string[]; startLine: number; endLine: number } {
  const allLines = code.split("\n");
  const startLine = Math.max(1, centerLine - contextLines);
  const endLine = Math.min(allLines.length, centerLine + contextLines);

  return {
    lines: allLines.slice(startLine - 1, endLine),
    startLine,
    endLine,
  };
}

/**
 * Enrich lint issues with scope information.
 *
 * Uses the scope-extractor to add context about where each issue occurs
 * in the code (function name, component name, hook, etc.). Uses batch
 * processing for efficiency when handling multiple issues in the same file.
 *
 * Gracefully degrades: if parsing fails, issues are returned without scopeInfo.
 *
 * @param issues - Array of lint issues to enrich
 * @param code - Source code of the file
 * @returns Issues with scopeInfo added (when available)
 */
export function enrichIssuesWithScopeInfo(
  issues: LintIssue[],
  code: string
): LintIssue[] {
  if (issues.length === 0) {
    return issues;
  }

  // Extract positions from issues
  const positions = issues.map((issue) => ({
    line: issue.line,
    column: issue.column ?? 0,
  }));

  // Batch extract scope info for all positions
  const scopeInfos = findEnclosingScopeBatch(code, positions);

  // Merge scope info back into issues
  return issues.map((issue, index) => {
    const scopeInfo = scopeInfos[index];
    if (scopeInfo) {
      return { ...issue, scopeInfo };
    }
    // If scope extraction failed, return issue without scopeInfo
    return issue;
  });
}
