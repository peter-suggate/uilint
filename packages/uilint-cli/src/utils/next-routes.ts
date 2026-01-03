import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

export interface InstallNextRoutesOptions {
  projectPath: string;
  /**
   * Relative app root: "app" or "src/app"
   */
  appRoot: string;
  force?: boolean;
  confirmOverwrite?: (relPath: string) => Promise<boolean>;
}

const STYLEGUIDE_ROUTE_TS = `export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  findStyleGuidePath,
  readStyleGuide,
  writeStyleGuide,
  findWorkspaceRoot,
} from "uilint-core/node";
import { existsSync, readFileSync } from "fs";
import { dirname, isAbsolute, join, resolve } from "path";

function hasNextConfig(dir: string): boolean {
  return (
    existsSync(join(dir, "next.config.js")) ||
    existsSync(join(dir, "next.config.mjs")) ||
    existsSync(join(dir, "next.config.cjs")) ||
    existsSync(join(dir, "next.config.ts"))
  );
}

function hasNextDependency(dir: string): boolean {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) return false;
  try {
    const raw = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    return Boolean(
      pkg.dependencies?.next ||
        pkg.devDependencies?.next ||
        pkg.peerDependencies?.next
    );
  } catch {
    return false;
  }
}

function findNextAppRoot(startDir: string): string | null {
  let dir = startDir;
  for (;;) {
    if (hasNextConfig(dir) || hasNextDependency(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function resolveExplicitStyleGuidePath(
  raw: string | null,
  workspaceRoot: string
): { path?: string; error?: string } {
  if (!raw || !raw.trim()) return {};
  const trimmed = raw.trim();
  const candidate = isAbsolute(trimmed) ? trimmed : resolve(workspaceRoot, trimmed);
  const abs = resolve(candidate);
  const rootAbs = resolve(workspaceRoot);

  // Safety: avoid letting remote callers read arbitrary files outside the workspace
  if (abs !== rootAbs && !abs.startsWith(rootAbs + "/")) {
    return {
      error: "styleguidePath must be within the workspace root: " + rootAbs,
    };
  }
  if (!existsSync(abs)) {
    return { error: "styleguidePath not found: " + abs };
  }
  return { path: abs };
}

function resolveStyleGuidePath(explicit: string | null): {
  path: string | null;
  error?: string;
} {
  // Important: in monorepos it's common to start Next from the workspace root,
  // but the correct "project" root is the Next app root (where next.config.* lives).
  // We infer that from the route file location to be robust to how the dev server is launched.
  const appRoot = findNextAppRoot(__dirname) ?? process.cwd();
  const workspaceRoot = findWorkspaceRoot(appRoot);

  // 1) Explicit per-request param
  const explicitRes = resolveExplicitStyleGuidePath(explicit, workspaceRoot);
  if (explicitRes.error) return { path: null, error: explicitRes.error };
  if (explicitRes.path) return { path: explicitRes.path };

  // 2) Env var pin (optional)
  const envRes = resolveExplicitStyleGuidePath(
    process.env.UILINT_STYLEGUIDE_PATH ?? null,
    workspaceRoot
  );
  if (envRes.path) return { path: envRes.path };

  // 3) Prefer local (Next app root) first
  const local = findStyleGuidePath(appRoot);
  if (local) return { path: local };

  // 4) Fallback to workspace root (monorepo)
  return { path: findStyleGuidePath(workspaceRoot) };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const styleguidePath = url.searchParams.get("styleguidePath");
    const { path: stylePath, error } = resolveStyleGuidePath(styleguidePath);

    if (error) {
      return NextResponse.json(
        { error, exists: false, content: null },
        { status: 400 }
      );
    }

    if (!stylePath) {
      return NextResponse.json(
        {
          error:
            'No style guide found. Create ".uilint/styleguide.md", pass ?styleguidePath=..., or set UILINT_STYLEGUIDE_PATH.',
          exists: false,
          content: null,
        },
        { status: 404 }
      );
    }

    const content = await readStyleGuide(stylePath);
    return NextResponse.json({ exists: true, content, path: stylePath });
  } catch (error) {
    console.error("[UILint API] Error reading style guide:", error);
    return NextResponse.json(
      { error: "Failed to read style guide", exists: false, content: null },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const content = body?.content;
    const styleguidePath = (body?.styleguidePath as string | undefined) ?? null;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const { path: stylePath, error } = resolveStyleGuidePath(styleguidePath);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    if (!stylePath) {
      return NextResponse.json(
        {
          error:
            'No style guide found. Create ".uilint/styleguide.md", pass styleguidePath, or set UILINT_STYLEGUIDE_PATH before saving.',
        },
        { status: 404 }
      );
    }

    await writeStyleGuide(stylePath, content);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[UILint API] Error saving style guide:", error);
    return NextResponse.json(
      { error: "Failed to save style guide" },
      { status: 500 }
    );
  }
}
`;

const DEV_SOURCE_ROUTE_TS = `/**
 * Dev-only API route for fetching source files
 *
 * This route allows the UILint overlay to fetch and display source code
 * for components rendered on the page.
 *
 * Security:
 * - Only available in development mode
 * - Validates file path is within project root
 * - Only allows specific file extensions
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { resolve, relative, dirname, extname } from "path";

export const runtime = "nodejs";

// Allowed file extensions
const ALLOWED_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js", ".css"]);

/**
 * Find the project root by looking for package.json or next.config
 */
function findProjectRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (
      existsSync(resolve(dir, "package.json")) ||
      existsSync(resolve(dir, "next.config.js")) ||
      existsSync(resolve(dir, "next.config.ts"))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

/**
 * Validate that a path is within the allowed directory
 */
function isPathWithinRoot(filePath: string, root: string): boolean {
  const resolved = resolve(filePath);
  const resolvedRoot = resolve(root);
  return resolved.startsWith(resolvedRoot + "/") || resolved === resolvedRoot;
}

/**
 * Find workspace root by walking up looking for pnpm-workspace.yaml or .git
 */
function findWorkspaceRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (
      existsSync(resolve(dir, "pnpm-workspace.yaml")) ||
      existsSync(resolve(dir, ".git"))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

export async function GET(request: NextRequest) {
  // Block in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get("path");

  if (!filePath) {
    return NextResponse.json(
      { error: "Missing 'path' query parameter" },
      { status: 400 }
    );
  }

  // Validate extension
  const ext = extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: \`File extension '\${ext}' not allowed\` },
      { status: 403 }
    );
  }

  // Find project root
  const projectRoot = findProjectRoot(process.cwd());

  // Resolve the file path
  const resolvedPath = resolve(filePath);

  // Security check: ensure path is within project root or workspace root
  const workspaceRoot = findWorkspaceRoot(projectRoot);
  const isWithinApp = isPathWithinRoot(resolvedPath, projectRoot);
  const isWithinWorkspace = isPathWithinRoot(resolvedPath, workspaceRoot);

  if (!isWithinApp && !isWithinWorkspace) {
    return NextResponse.json(
      { error: "Path outside project directory" },
      { status: 403 }
    );
  }

  // Check file exists
  if (!existsSync(resolvedPath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    const content = readFileSync(resolvedPath, "utf-8");
    const relativePath = relative(workspaceRoot, resolvedPath);

    return NextResponse.json({
      content,
      relativePath,
    });
  } catch (error) {
    console.error("[Dev Source API] Error reading file:", error);
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
`;

const ANALYZE_ROUTE_TS = `export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OllamaClient, UILINT_DEFAULT_OLLAMA_MODEL } from "uilint-core";
import { existsSync, readFileSync } from "fs";
import { dirname, isAbsolute, join, resolve } from "path";
import {
  findStyleGuidePath,
  readStyleGuide,
  findWorkspaceRoot,
} from "uilint-core/node";

function hasNextConfig(dir: string): boolean {
  return (
    existsSync(join(dir, "next.config.js")) ||
    existsSync(join(dir, "next.config.mjs")) ||
    existsSync(join(dir, "next.config.cjs")) ||
    existsSync(join(dir, "next.config.ts"))
  );
}

function hasNextDependency(dir: string): boolean {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) return false;
  try {
    const raw = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    return Boolean(
      pkg.dependencies?.next ||
        pkg.devDependencies?.next ||
        pkg.peerDependencies?.next
    );
  } catch {
    return false;
  }
}

function findNextAppRoot(startDir: string): string | null {
  let dir = startDir;
  for (;;) {
    if (hasNextConfig(dir) || hasNextDependency(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function resolveExplicitStyleGuidePath(
  raw: string | null,
  workspaceRoot: string
): { path?: string; error?: string } {
  if (!raw || !raw.trim()) return {};
  const trimmed = raw.trim();
  const candidate = isAbsolute(trimmed) ? trimmed : resolve(workspaceRoot, trimmed);
  const abs = resolve(candidate);
  const rootAbs = resolve(workspaceRoot);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + "/")) {
    return {
      error: "styleguidePath must be within the workspace root: " + rootAbs,
    };
  }
  if (!existsSync(abs)) {
    return { error: "styleguidePath not found: " + abs };
  }
  return { path: abs };
}

async function resolveStyleGuideContent(input: {
  styleGuide?: string;
  styleguidePath?: string | null;
}): Promise<{ styleGuide?: string; error?: string; status?: number }> {
  if (input.styleGuide && typeof input.styleGuide === "string") {
    return { styleGuide: input.styleGuide };
  }

  const appRoot = findNextAppRoot(__dirname) ?? process.cwd();
  const workspaceRoot = findWorkspaceRoot(appRoot);

  // 1) Explicit per-request path
  const explicitRes = resolveExplicitStyleGuidePath(
    input.styleguidePath ?? null,
    workspaceRoot
  );
  if (explicitRes.error) return { error: explicitRes.error, status: 400 };
  if (explicitRes.path) {
    return { styleGuide: await readStyleGuide(explicitRes.path) };
  }

  // 2) Env var pin (optional)
  const envRes = resolveExplicitStyleGuidePath(
    process.env.UILINT_STYLEGUIDE_PATH ?? null,
    workspaceRoot
  );
  if (envRes.path) {
    return { styleGuide: await readStyleGuide(envRes.path) };
  }

  // 3) Local then workspace fallback
  const localPath = findStyleGuidePath(appRoot);
  if (localPath) return { styleGuide: await readStyleGuide(localPath) };

  const wsPath = findStyleGuidePath(workspaceRoot);
  if (wsPath) return { styleGuide: await readStyleGuide(wsPath) };

  return {
    error:
      'No style guide found. Create ".uilint/styleguide.md", pass styleguidePath, or set UILINT_STYLEGUIDE_PATH.',
    status: 404,
  };
}

/**
 * Analyze source code for style issues using LLM
 */
async function analyzeSourceCode(
  client: OllamaClient,
  sourceCode: string,
  filePath: string,
  styleGuide: string | null,
  componentName?: string,
  componentLine?: number
): Promise<{ issues: Array<{ line?: number; message: string }> }> {
  // Build component focus context
  const componentContext = componentName
    ? \`\\n## Focus Component\\n\\nFocus your analysis on the **\${componentName}** component\${
        componentLine ? \` (around line \${componentLine})\` : ""
      }. While you have the full file for context, only report issues that are directly related to this specific component.\\n\`
    : "";

  const prompt = \`You are a UI code reviewer. Analyze the following React/TypeScript component for style consistency issues.

\${styleGuide ? \`## Style Guide\\n\\n\${styleGuide}\\n\\n\` : ""}\${componentContext}
## Source Code (\${filePath})

\\\`\\\`\\\`tsx
\${sourceCode}
\\\`\\\`\\\`

## Task

Identify any style inconsistencies, violations of best practices, or deviations from the style guide.
\${componentName ? \`Focus only on the \${componentName} component and its direct styling/structure.\` : ""}
For each issue, provide the line number (if identifiable) and a clear description.

Respond with a JSON array of issues:
\\\`\\\`\\\`json
{
  "issues": [
    { "line": 12, "message": "Color #3575E2 should be #3B82F6 (primary blue from styleguide)" },
    { "line": 25, "message": "Use p-4 instead of p-3 for consistent button padding" }
  ]
}
\\\`\\\`\\\`

If no issues are found, respond with:
\\\`\\\`\\\`json
{ "issues": [] }
\\\`\\\`\\\`\`;

  try {
    const response = await client.complete(prompt, { json: true });
    const parsed = JSON.parse(response);
    return { issues: parsed.issues || [] };
  } catch (error) {
    console.error("[UILint] Failed to parse LLM response:", error);
    return { issues: [] };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      styleSummary, 
      styleGuide, 
      styleguidePath, 
      generateGuide, 
      model,
      // New fields for source code analysis
      sourceCode,
      filePath,
      // Component focus context
      componentName,
      componentLine,
    } = body;

    const client = new OllamaClient({
      model: model || UILINT_DEFAULT_OLLAMA_MODEL,
    });

    // Check if Ollama is available
    const available = await client.isAvailable();
    if (!available) {
      return NextResponse.json(
        { error: "Failed to connect to Ollama" },
        { status: 502 }
      );
    }

    // Source code analysis mode (for Alt+Click scan feature)
    if (sourceCode && typeof sourceCode === "string") {
      const resolved = await resolveStyleGuideContent({
        styleGuide,
        styleguidePath,
      });
      
      // Don't fail if no style guide - just analyze without it
      const styleGuideContent = resolved.error ? null : (resolved.styleGuide ?? null);
      
      const result = await analyzeSourceCode(
        client,
        sourceCode,
        filePath || "component.tsx",
        styleGuideContent,
        componentName,
        componentLine
      );
      return NextResponse.json(result);
    }

    if (generateGuide) {
      // Generate a new style guide
      const styleGuideContent = await client.generateStyleGuide(styleSummary);
      return NextResponse.json({ styleGuide: styleGuideContent });
    } else {
      const resolved = await resolveStyleGuideContent({
        styleGuide,
        styleguidePath,
      });
      if (resolved.error) {
        return NextResponse.json(
          { error: resolved.error, issues: [] },
          { status: resolved.status ?? 500 }
        );
      }

      // Analyze styles for issues
      const result = await client.analyzeStyles(
        styleSummary,
        resolved.styleGuide ?? null
      );
      return NextResponse.json({ issues: result.issues });
    }
  } catch (error) {
    console.error("[UILint API] Error:", error);
    return NextResponse.json(
      { error: "Analysis failed", issues: [] },
      { status: 500 }
    );
  }
}
`;

async function writeRouteFile(
  absPath: string,
  relPath: string,
  content: string,
  opts: InstallNextRoutesOptions
): Promise<void> {
  if (existsSync(absPath) && !opts.force) {
    const ok = await opts.confirmOverwrite?.(relPath);
    if (!ok) return;
  }
  await writeFile(absPath, content, "utf-8");
}

export async function installNextUILintRoutes(
  opts: InstallNextRoutesOptions
): Promise<void> {
  const baseRel = join(opts.appRoot, "api", ".uilint");
  const baseAbs = join(opts.projectPath, baseRel);

  // UILint API routes
  await mkdir(join(baseAbs, "styleguide"), { recursive: true });
  await mkdir(join(baseAbs, "analyze"), { recursive: true });

  await writeRouteFile(
    join(baseAbs, "styleguide", "route.ts"),
    join(baseRel, "styleguide", "route.ts"),
    STYLEGUIDE_ROUTE_TS,
    opts
  );

  await writeRouteFile(
    join(baseAbs, "analyze", "route.ts"),
    join(baseRel, "analyze", "route.ts"),
    ANALYZE_ROUTE_TS,
    opts
  );

  // Source file API (for source visualization in overlay)
  await mkdir(join(baseAbs, "source"), { recursive: true });

  await writeRouteFile(
    join(baseAbs, "source", "route.ts"),
    join(baseRel, "source", "route.ts"),
    DEV_SOURCE_ROUTE_TS,
    opts
  );
}
