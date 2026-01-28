/**
 * Shared ESLint Utilities
 *
 * Common functions for ESLint integration, JSX parsing, and data-loc mapping.
 * Extracted from serve.ts to be reusable across commands.
 */

import { existsSync, readFileSync } from "fs";
import { createRequire } from "module";
import { dirname, resolve, relative, join } from "path";

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
    parse: (src: string, options: Record<string, unknown>) => any;
  };

  const ast = parse(code, {
    loc: true,
    range: true,
    jsx: true,
    comment: false,
    errorOnUnknownASTType: false,
  });

  const spans: JsxElementSpan[] = [];

  function walk(node: any): void {
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
      const child = (node as any)[key];
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
export async function getESLintForProject(projectCwd: string): Promise<any | null> {
  const cached = eslintInstances.get(projectCwd);
  if (cached) return cached as any;

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
    const results = await eslint.lintFiles([absolutePath]);
    const messages =
      Array.isArray(results) && results.length > 0
        ? results[0].messages || []
        : [];

    const dataLocFile = normalizeDataLocFilePath(absolutePath, projectCwd);
    let spans: JsxElementSpan[] = [];
    let lineStarts: number[] = [];
    let codeLength = 0;

    try {
      progress("Building JSX map...");
      const code = readFileSync(absolutePath, "utf-8");
      codeLength = code.length;
      lineStarts = buildLineStarts(code);
      spans = buildJsxElementSpans(code, dataLocFile);
      progress(`JSX map: ${spans.length} element(s)`);
    } catch (e) {
      // If parsing fails, we still return ESLint messages (unmapped).
      progress("JSX map failed (falling back to unmapped issues)");
      spans = [];
      lineStarts = [];
      codeLength = 0;
    }

    const issues: LintIssue[] = messages
      .filter((m: any) => typeof m?.message === "string")
      .map((m: any) => {
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
          message: m.message,
          ruleId: typeof m.ruleId === "string" ? m.ruleId : undefined,
          dataLoc: mappedDataLoc,
        } satisfies LintIssue;
      });

    const mappedCount = issues.filter((i) => Boolean(i.dataLoc)).length;
    if (issues.length > 0) {
      progress(`Mapped ${mappedCount}/${issues.length} issue(s) to JSX elements`);
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
