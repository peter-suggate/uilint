/**
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
      { error: `File extension '${ext}' not allowed` },
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
