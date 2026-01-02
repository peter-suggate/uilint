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
}
