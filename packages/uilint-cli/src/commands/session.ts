/**
 * Session command - manages stateful file tracking across agentic sessions
 *
 * Used by Cursor hooks to track edited files and batch-validate on session end.
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { basename, dirname, resolve } from "path";
import {
  OllamaClient,
  createStyleSummary,
  type UILintIssue,
} from "uilint-core";
import {
  ensureOllamaReady,
  parseCLIInput,
  readStyleGuideFromProject,
  readTailwindThemeTokens,
} from "uilint-core/node";

const SESSION_FILE = "/tmp/uilint-session.json";

// File extensions we consider UI files
const UI_FILE_EXTENSIONS = [".tsx", ".jsx", ".css", ".scss", ".module.css"];

interface SessionState {
  files: string[];
  startedAt: string;
}

interface FileScanResult {
  file: string;
  issues: UILintIssue[];
}

interface SessionScanResult {
  totalFiles: number;
  filesWithIssues: number;
  results: FileScanResult[];
  followupMessage: string | null;
}

function readSession(): SessionState {
  if (!existsSync(SESSION_FILE)) {
    return { files: [], startedAt: new Date().toISOString() };
  }
  try {
    const content = readFileSync(SESSION_FILE, "utf-8");
    return JSON.parse(content) as SessionState;
  } catch {
    return { files: [], startedAt: new Date().toISOString() };
  }
}

function writeSession(state: SessionState): void {
  writeFileSync(SESSION_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function isUIFile(filePath: string): boolean {
  return UI_FILE_EXTENSIONS.some((ext) => filePath.endsWith(ext));
}

function isScannableMarkupFile(filePath: string): boolean {
  return [".tsx", ".jsx", ".html", ".htm"].some((ext) =>
    filePath.endsWith(ext)
  );
}

/**
 * Clear tracked files - called at start of new agent turn (beforeSubmitPrompt)
 */
export async function sessionClear(): Promise<void> {
  if (existsSync(SESSION_FILE)) {
    unlinkSync(SESSION_FILE);
  }
  // Output empty JSON for hook protocol
  console.log(JSON.stringify({ cleared: true }));
}

/**
 * Track a file edit - called on each file edit (afterFileEdit)
 */
export async function sessionTrack(filePath: string): Promise<void> {
  // Only track UI files
  if (!isUIFile(filePath)) {
    console.log(
      JSON.stringify({
        tracked: false,
        reason: "not_ui_file",
        file: filePath,
        message: `Skipped non-UI file: ${basename(filePath)}`,
      })
    );
    return;
  }

  const session = readSession();

  // Check if already tracked
  const wasAlreadyTracked = session.files.includes(filePath);

  // Add file if not already tracked
  if (!wasAlreadyTracked) {
    session.files.push(filePath);
    writeSession(session);
  }

  console.log(
    JSON.stringify({
      tracked: true,
      file: filePath,
      total: session.files.length,
      newlyAdded: !wasAlreadyTracked,
      message: wasAlreadyTracked
        ? `Already tracking: ${basename(filePath)} (${
            session.files.length
          } files total)`
        : `Now tracking: ${basename(filePath)} (${
            session.files.length
          } files total)`,
    })
  );
}

export interface SessionScanOptions {
  /** Output format for stop hook (outputs only followup_message JSON) */
  hookFormat?: boolean;
  /** Ollama model to use */
  model?: string;
}

/**
 * Scan all tracked markup files - called on agent stop
 * Uses the same pipeline as `uilint scan`, but emits clean JSON for Cursor hooks.
 */
export async function sessionScan(
  options: SessionScanOptions = {}
): Promise<void> {
  const session = readSession();

  if (session.files.length === 0) {
    if (options.hookFormat) {
      console.log("{}");
    } else {
      const result: SessionScanResult = {
        totalFiles: 0,
        filesWithIssues: 0,
        results: [],
        followupMessage: null,
      };
      console.log(JSON.stringify(result));
    }
    return;
  }

  // Load styleguide once
  const projectPath = process.cwd();
  let styleGuide: string | null;
  try {
    styleGuide = await readStyleGuideFromProject(projectPath);
  } catch {
    if (options.hookFormat) {
      console.log("{}");
    } else {
      const result: SessionScanResult = {
        totalFiles: session.files.length,
        filesWithIssues: 0,
        results: [],
        followupMessage: null,
      };
      console.log(JSON.stringify(result));
    }
    return;
  }

  // Prep Ollama + client once
  await ensureOllamaReady({ model: options.model });
  const client = new OllamaClient({ model: options.model });

  const results: FileScanResult[] = [];

  for (const filePath of session.files) {
    if (!existsSync(filePath)) continue;
    if (!isScannableMarkupFile(filePath)) continue;

    try {
      const absolutePath = resolve(process.cwd(), filePath);
      const htmlLike = readFileSync(filePath, "utf-8");
      const snapshot = parseCLIInput(htmlLike);

      const tailwindSearchDir = dirname(absolutePath);
      const tailwindTheme = readTailwindThemeTokens(tailwindSearchDir);

      const styleSummary = createStyleSummary(snapshot.styles, {
        html: snapshot.html,
        tailwindTheme,
      });

      const analysis = await client.analyzeStyles(styleSummary, styleGuide);

      results.push({
        file: filePath,
        issues: analysis.issues,
      });
    } catch {
      continue;
    }
  }

  const filesWithIssues = results.filter((r) => r.issues.length > 0);
  let followupMessage: string | null = null;

  if (filesWithIssues.length > 0) {
    const issueLines: string[] = [];

    for (const fileResult of filesWithIssues) {
      const fileName = basename(fileResult.file);
      for (const issue of fileResult.issues) {
        const type = issue.type?.toUpperCase?.() ?? "ISSUE";
        const detail =
          issue.currentValue && issue.expectedValue
            ? ` (${issue.currentValue} → ${issue.expectedValue})`
            : issue.currentValue
            ? ` (${issue.currentValue})`
            : "";
        issueLines.push(`- ${fileName}: [${type}] ${issue.message}${detail}`);
        if (issue.suggestion) {
          issueLines.push(`  Suggestion: ${issue.suggestion}`);
        }
      }
    }

    followupMessage = [
      `UILint scan found UI consistency issues in ${filesWithIssues.length} file(s):`,
      "",
      ...issueLines,
      "",
      "See .uilint/styleguide.md for style rules. Please fix these issues.",
    ].join("\n");
  }

  if (options.hookFormat) {
    if (followupMessage) {
      console.log(JSON.stringify({ followup_message: followupMessage }));
    } else {
      console.log("{}");
    }
  } else {
    const result: SessionScanResult = {
      totalFiles: results.length,
      filesWithIssues: filesWithIssues.length,
      results,
      followupMessage,
    };
    console.log(JSON.stringify(result));
  }

  // Clear session after scan
  if (existsSync(SESSION_FILE)) {
    unlinkSync(SESSION_FILE);
  }
}

/**
 * List tracked files (for debugging)
 */
export async function sessionList(): Promise<void> {
  const session = readSession();
  console.log(JSON.stringify(session));
}
