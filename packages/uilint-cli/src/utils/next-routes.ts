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

const CONSISTENCY_ROUTE_TS = `export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { dirname, join } from "path";
import type { GroupedSnapshot } from "uilint-core";

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
    const { readFileSync } = require("fs");
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

/**
 * Find the uilint CLI binary, preferring local installation over npx
 */
function findUILintCLI(appRoot: string): { command: string; args: string[] } {
  // 1) Check local node_modules/.bin/uilint
  const localBin = join(appRoot, "node_modules", ".bin", "uilint");
  if (existsSync(localBin)) {
    return { command: localBin, args: [] };
  }

  // 2) Walk up to find workspace root with local CLI
  let dir = dirname(appRoot);
  while (dir !== dirname(dir)) {
    const wsLocalBin = join(dir, "node_modules", ".bin", "uilint");
    if (existsSync(wsLocalBin)) {
      return { command: wsLocalBin, args: [] };
    }
    dir = dirname(dir);
  }

  // 3) Fallback to npx (package is "uilint-cli", binary is "uilint")
  return { command: "npx", args: ["--yes", "uilint-cli"] };
}

function runCLI(
  cliInfo: { command: string; args: string[] },
  cliArgs: string[],
  input: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cliInfo.command, [...cliInfo.args, ...cliArgs], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });

    proc.on("error", (err) => {
      stderr += err.message;
      resolve({ stdout, stderr, exitCode: 1 });
    });

    proc.stdin.write(input);
    proc.stdin.end();
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { snapshot, model } = body as {
      snapshot: GroupedSnapshot;
      model?: string;
    };

    if (!snapshot) {
      return NextResponse.json(
        { error: "No snapshot provided", violations: [], elementCount: 0, analysisTime: 0 },
        { status: 400 }
      );
    }

    const appRoot = findNextAppRoot(__dirname) ?? process.cwd();
    const cliInfo = findUILintCLI(appRoot);

    // Build CLI args
    const cliArgs = ["consistency", "--output", "json"];
    if (model) {
      cliArgs.push("--model", model);
    }

    // Run CLI with snapshot as stdin
    const snapshotJson = JSON.stringify(snapshot);
    const { stdout, stderr, exitCode } = await runCLI(cliInfo, cliArgs, snapshotJson);

    // Parse CLI output (JSON format)
    try {
      const result = JSON.parse(stdout);
      return NextResponse.json(result);
    } catch {
      // If JSON parse fails, return error with raw output
      console.error("[UILint API] CLI stderr:", stderr);
      console.error("[UILint API] CLI stdout:", stdout);
      return NextResponse.json(
        {
          error: stderr || stdout || "CLI returned invalid JSON",
          violations: [],
          elementCount: 0,
          analysisTime: 0,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[UILint API] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Analysis failed",
        violations: [],
        elementCount: 0,
        analysisTime: 0,
      },
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

export async function POST(request: NextRequest) {
  try {
    const { styleSummary, styleGuide, styleguidePath, generateGuide, model } =
      await request.json();

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
  const baseRel = join(opts.appRoot, "api", "uilint");
  const baseAbs = join(opts.projectPath, baseRel);

  // UILint API routes
  await mkdir(join(baseAbs, "styleguide"), { recursive: true });
  await mkdir(join(baseAbs, "analyze"), { recursive: true });
  await mkdir(join(baseAbs, "consistency"), { recursive: true });

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

  await writeRouteFile(
    join(baseAbs, "consistency", "route.ts"),
    join(baseRel, "consistency", "route.ts"),
    CONSISTENCY_ROUTE_TS,
    opts
  );

  // Dev-only source file API (for source visualization overlay)
  const devSourceRel = join(opts.appRoot, "api", "dev", "source");
  const devSourceAbs = join(opts.projectPath, devSourceRel);

  await mkdir(devSourceAbs, { recursive: true });

  await writeRouteFile(
    join(devSourceAbs, "route.ts"),
    join(devSourceRel, "route.ts"),
    DEV_SOURCE_ROUTE_TS,
    opts
  );
}
