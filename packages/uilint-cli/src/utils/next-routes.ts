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

export async function GET() {
  try {
    const workspaceRoot = findWorkspaceRoot(process.cwd());
    const stylePath = findStyleGuidePath(workspaceRoot);

    if (!stylePath) {
      return NextResponse.json(
        {
          error:
            'No style guide found. Create ".uilint/styleguide.md" at your workspace root.',
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
    const { content } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const workspaceRoot = findWorkspaceRoot(process.cwd());
    const stylePath = findStyleGuidePath(workspaceRoot);

    if (!stylePath) {
      return NextResponse.json(
        {
          error:
            'No style guide found. Create ".uilint/styleguide.md" at your workspace root before saving.',
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
import { OllamaClient } from "uilint-core";

const DEFAULT_MODEL = "qwen2.5-coder:7b";

export async function POST(request: NextRequest) {
  try {
    const { styleSummary, styleGuide, generateGuide, model } =
      await request.json();

    const client = new OllamaClient({ model: model || DEFAULT_MODEL });

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
      // Analyze styles for issues
      const result = await client.analyzeStyles(styleSummary, styleGuide);
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
