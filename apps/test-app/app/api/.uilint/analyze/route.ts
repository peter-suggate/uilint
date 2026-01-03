export const runtime = "nodejs";

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
    ? `\n## Focus Component\n\nFocus your analysis on the **${componentName}** component${
        componentLine ? ` (around line ${componentLine})` : ""
      }. While you have the full file for context, only report issues that are directly related to this specific component.\n`
    : "";

  const prompt = `You are a UI code reviewer. Analyze the following React/TypeScript component for style consistency issues.

${styleGuide ? `## Style Guide\n\n${styleGuide}\n\n` : ""}${componentContext}
## Source Code (${filePath})

\`\`\`tsx
${sourceCode}
\`\`\`

## Task

Identify any style inconsistencies, violations of best practices, or deviations from the style guide.
${componentName ? `Focus only on the ${componentName} component and its direct styling/structure.` : ""}
For each issue, provide the line number (if identifiable) and a clear description.

Respond with a JSON array of issues:
\`\`\`json
{
  "issues": [
    { "line": 12, "message": "Color #3575E2 should be #3B82F6 (primary blue from styleguide)" },
    { "line": 25, "message": "Use p-4 instead of p-3 for consistent button padding" }
  ]
}
\`\`\`

If no issues are found, respond with:
\`\`\`json
{ "issues": [] }
\`\`\``;

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
