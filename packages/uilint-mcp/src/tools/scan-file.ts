/**
 * Scan a file against the style guide.
 *
 * This provides functionality equivalent to the Cursor hooks - reading a file
 * from disk and scanning it against the project's style guide using an LLM.
 */

import { readFileSync, existsSync } from "fs";
import { dirname, resolve, isAbsolute } from "path";
import type { AnalysisResult } from "uilint-core";
import { OllamaClient, createStyleSummary } from "uilint-core";
import {
  ensureOllamaReady,
  parseCLIInput,
  readTailwindThemeTokens,
} from "uilint-core/node";

/**
 * Extended analysis result with file-specific metadata
 */
export interface FileAnalysisResult extends AnalysisResult {
  filePath?: string;
  elementCount?: number;
  error?: string;
}

export interface ScanFileOptions {
  model?: string;
}

/**
 * File extensions we can scan for UI issues
 */
const SCANNABLE_EXTENSIONS = [".tsx", ".jsx", ".html", ".htm"];

/**
 * Check if a file is scannable (UI markup file)
 */
function isScannableFile(filePath: string): boolean {
  return SCANNABLE_EXTENSIONS.some((ext) => filePath.endsWith(ext));
}

/**
 * Scan a file from disk against the style guide
 */
export async function scanFile(
  filePath: string,
  styleGuide: string | null,
  options: ScanFileOptions = {}
): Promise<FileAnalysisResult> {
  const projectPath = process.cwd();

  // Resolve the file path
  const absolutePath = isAbsolute(filePath)
    ? filePath
    : resolve(projectPath, filePath);

  // Check if file exists
  if (!existsSync(absolutePath)) {
    return {
      issues: [],
      analysisTime: 0,
      error: `File not found: ${absolutePath}`,
    };
  }

  // Check if file is scannable
  if (!isScannableFile(absolutePath)) {
    return {
      issues: [],
      analysisTime: 0,
      error: `File type not supported. Scannable extensions: ${SCANNABLE_EXTENSIONS.join(
        ", "
      )}`,
    };
  }

  const startTime = Date.now();

  try {
    // Read the file
    const fileContent = readFileSync(absolutePath, "utf-8");

    // Parse the content
    const snapshot = parseCLIInput(fileContent);

    // Get Tailwind theme from the file's directory or project path
    const tailwindSearchDir = dirname(absolutePath);
    const tailwindTheme = readTailwindThemeTokens(tailwindSearchDir);

    // Create style summary
    const summary = createStyleSummary(snapshot.styles, {
      html: snapshot.html,
      tailwindTheme: tailwindTheme ?? undefined,
    });

    // Ensure Ollama is ready
    await ensureOllamaReady({ model: options.model });

    // Analyze with LLM
    const client = new OllamaClient({ model: options.model });
    const result = await client.analyzeStyles(summary, styleGuide);

    return {
      ...result,
      analysisTime: Date.now() - startTime,
      filePath: absolutePath,
      elementCount: snapshot.elementCount,
    };
  } catch (error) {
    return {
      issues: [],
      analysisTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
