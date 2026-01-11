/**
 * Dev-only API route for saving and retrieving vision analysis screenshots
 *
 * This route allows the UILint overlay to:
 * - POST: Save screenshots and element manifests for vision analysis
 * - GET: Retrieve screenshots or list available screenshots
 *
 * Security:
 * - Only available in development mode
 * - Saves to .uilint/screenshots/ directory within project
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { resolve, join, dirname, basename, sep } from "path";
import { fileURLToPath } from "url";

export const runtime = "nodejs";

// Maximum screenshot size (10MB)
const MAX_SCREENSHOT_SIZE = 10 * 1024 * 1024;

/**
 * Best-effort: resolve the Next.js project root (the dir that owns .next/) even in monorepos.
 */
function findNextProjectRoot(): string {
  try {
    const selfPath = fileURLToPath(import.meta.url);
    const marker = sep + ".next" + sep;
    const idx = selfPath.lastIndexOf(marker);
    if (idx !== -1) {
      return selfPath.slice(0, idx);
    }
  } catch {
    // ignore
  }

  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
    if (existsSync(resolve(dir, ".next"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return process.cwd();
}

/**
 * Get the screenshots directory path, creating it if needed
 */
function getScreenshotsDir(projectRoot: string): string {
  const screenshotsDir = join(projectRoot, ".uilint", "screenshots");
  if (!existsSync(screenshotsDir)) {
    mkdirSync(screenshotsDir, { recursive: true });
  }
  return screenshotsDir;
}

/**
 * Validate filename to prevent path traversal
 */
function isValidFilename(filename: string): boolean {
  // Only allow alphanumeric, hyphens, underscores, and dots
  // Must end with .png, .jpeg, .jpg, or .json
  const validPattern = /^[a-zA-Z0-9_-]+\.(png|jpeg|jpg|json)$/;
  return validPattern.test(filename) && !filename.includes("..");
}

/**
 * POST: Save a screenshot and optionally its manifest
 */
export async function POST(request: NextRequest) {
  // Block in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 404 }
    );
  }

  try {
    const body = await request.json();
    const { filename, imageData, manifest, analysisResult } = body;

    if (!filename) {
      return NextResponse.json({ error: "Missing 'filename'" }, { status: 400 });
    }

    // Validate filename
    if (!isValidFilename(filename)) {
      return NextResponse.json(
        { error: "Invalid filename format" },
        { status: 400 }
      );
    }

    // Allow "sidecar-only" updates (manifest/analysisResult) without re-sending image bytes.
    const hasImageData = typeof imageData === "string" && imageData.length > 0;
    const hasSidecar =
      typeof manifest !== "undefined" || typeof analysisResult !== "undefined";

    if (!hasImageData && !hasSidecar) {
      return NextResponse.json(
        { error: "Nothing to save (provide imageData and/or manifest/analysisResult)" },
        { status: 400 }
      );
    }

    // Check size (image only)
    if (hasImageData && imageData.length > MAX_SCREENSHOT_SIZE) {
      return NextResponse.json(
        { error: "Screenshot too large (max 10MB)" },
        { status: 413 }
      );
    }

    const projectRoot = findNextProjectRoot();
    const screenshotsDir = getScreenshotsDir(projectRoot);

    const imagePath = join(screenshotsDir, filename);

    // Save the image (base64 data URL) if provided
    if (hasImageData) {
      const base64Data = imageData.includes(",")
        ? imageData.split(",")[1]
        : imageData;
      writeFileSync(imagePath, Buffer.from(base64Data, "base64"));
    }

    // Save manifest and analysis result as JSON sidecar
    if (hasSidecar) {
      const jsonFilename = filename.replace(/\.(png|jpeg|jpg)$/, ".json");
      const jsonPath = join(screenshotsDir, jsonFilename);

      // If a sidecar already exists, merge updates (lets us POST analysisResult later without re-sending image).
      let existing: any = null;
      if (existsSync(jsonPath)) {
        try {
          existing = JSON.parse(readFileSync(jsonPath, "utf-8"));
        } catch {
          existing = null;
        }
      }

      const routeFromAnalysis =
        analysisResult && typeof analysisResult === "object"
          ? (analysisResult as any).route
          : undefined;
      const issuesFromAnalysis =
        analysisResult && typeof analysisResult === "object"
          ? (analysisResult as any).issues
          : undefined;

      const jsonData = {
        ...(existing && typeof existing === "object" ? existing : {}),
        timestamp: Date.now(),
        filename,
        screenshotFile: filename,
        route:
          typeof routeFromAnalysis === "string"
            ? routeFromAnalysis
            : (existing as any)?.route ?? null,
        issues:
          Array.isArray(issuesFromAnalysis)
            ? issuesFromAnalysis
            : (existing as any)?.issues ?? null,
        manifest: typeof manifest === "undefined" ? existing?.manifest ?? null : manifest,
        analysisResult:
          typeof analysisResult === "undefined"
            ? existing?.analysisResult ?? null
            : analysisResult,
      };
      writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
    }

    return NextResponse.json({
      success: true,
      path: imagePath,
      projectRoot,
      screenshotsDir,
    });
  } catch (error) {
    console.error("[Screenshot API] Error saving screenshot:", error);
    return NextResponse.json(
      { error: "Failed to save screenshot" },
      { status: 500 }
    );
  }
}

/**
 * GET: Retrieve a screenshot or list available screenshots
 */
export async function GET(request: NextRequest) {
  // Block in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");
  const list = searchParams.get("list");

  const projectRoot = findNextProjectRoot();
  const screenshotsDir = getScreenshotsDir(projectRoot);

  // List mode: return all screenshots
  if (list === "true") {
    try {
      const files = readdirSync(screenshotsDir);
      const screenshots = files
        .filter((f) => /\.(png|jpeg|jpg)$/.test(f))
        .map((f) => {
          const jsonFile = f.replace(/\.(png|jpeg|jpg)$/, ".json");
          const jsonPath = join(screenshotsDir, jsonFile);
          let metadata = null;
          if (existsSync(jsonPath)) {
            try {
              metadata = JSON.parse(readFileSync(jsonPath, "utf-8"));
            } catch {
              // Ignore parse errors
            }
          }
          return {
            filename: f,
            metadata,
          };
        })
        .sort((a, b) => {
          // Sort by timestamp descending (newest first)
          const aTime = a.metadata?.timestamp || 0;
          const bTime = b.metadata?.timestamp || 0;
          return bTime - aTime;
        });

      return NextResponse.json({ screenshots, projectRoot, screenshotsDir });
    } catch (error) {
      console.error("[Screenshot API] Error listing screenshots:", error);
      return NextResponse.json(
        { error: "Failed to list screenshots" },
        { status: 500 }
      );
    }
  }

  // Retrieve mode: get specific screenshot
  if (!filename) {
    return NextResponse.json(
      { error: "Missing 'filename' parameter" },
      { status: 400 }
    );
  }

  if (!isValidFilename(filename)) {
    return NextResponse.json(
      { error: "Invalid filename format" },
      { status: 400 }
    );
  }

  const filePath = join(screenshotsDir, filename);

  if (!existsSync(filePath)) {
    return NextResponse.json(
      { error: "Screenshot not found" },
      { status: 404 }
    );
  }

  try {
    const content = readFileSync(filePath);
    
    // Determine content type
    const ext = filename.split(".").pop()?.toLowerCase();
    const contentType =
      ext === "json"
        ? "application/json"
        : ext === "png"
        ? "image/png"
        : "image/jpeg";

    if (ext === "json") {
      return NextResponse.json(JSON.parse(content.toString()));
    }

    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[Screenshot API] Error reading screenshot:", error);
    return NextResponse.json(
      { error: "Failed to read screenshot" },
      { status: 500 }
    );
  }
}
