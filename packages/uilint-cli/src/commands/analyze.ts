/**
 * Analyze command - analyzes a source file/snippet for style issues (data-loc aware)
 */

import { dirname, resolve } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import {
  UILINT_DEFAULT_OLLAMA_MODEL,
  buildSourceScanPrompt,
  ensureOllamaReady,
  readStyleGuide,
  findStyleGuidePath,
  findWorkspaceRoot,
  findUILintStyleGuideUpwards,
} from "uilint-core/node";
import { getCodeInput } from "../utils/input.js";
import { resolvePathSpecifier } from "../utils/path-specifiers.js";
import { createLLMClient, flushLangfuse } from "../utils/llm-client.js";
import {
  intro,
  withSpinner,
  createSpinner,
  logError,
  logWarning,
  logSuccess,
  pc,
} from "../utils/prompts.js";
import { printJSON } from "../utils/output.js";

type UILintScanIssue = {
  line?: number;
  message: string;
  dataLoc?: string;
};

export interface AnalyzeOptions {
  // Input
  inputFile?: string;
  sourceCode?: string;

  // Styleguide
  styleGuide?: string;
  styleguidePath?: string;

  // Prompt context
  filePath?: string;
  componentName?: string;
  componentLine?: number;
  includeChildren?: boolean;
  dataLoc?: string[]; // repeatable

  // LLM
  model?: string;
  stream?: boolean;

  // Output
  output?: "text" | "json";

  /**
   * Enable debug logging (stderr only; never pollutes JSON stdout).
   * Can also be enabled via UILINT_DEBUG=1
   */
  debug?: boolean;
  /**
   * Print full prompt/styleguide to stderr (can be very large).
   * Can also be enabled via UILINT_DEBUG_FULL=1
   */
  debugFull?: boolean;
  /**
   * Dump full LLM payload (prompt + inputs) to a JSON file.
   * Can also be set via UILINT_DEBUG_DUMP=/path/to/file-or-dir
   */
  debugDump?: string;
}

function envTruthy(name: string): boolean {
  const v = process.env[name];
  if (!v) return false;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

function preview(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "\n…<truncated>…\n" + text.slice(-maxLen);
}

function debugEnabled(options: AnalyzeOptions): boolean {
  return Boolean(options.debug) || envTruthy("UILINT_DEBUG");
}

function debugFullEnabled(options: AnalyzeOptions): boolean {
  return Boolean(options.debugFull) || envTruthy("UILINT_DEBUG_FULL");
}

function debugDumpPath(options: AnalyzeOptions): string | null {
  const v = options.debugDump ?? process.env.UILINT_DEBUG_DUMP;
  if (!v) return null;
  // Allow UILINT_DEBUG_DUMP=1 to mean "use a sensible default".
  if (v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes") {
    return resolve(process.cwd(), ".uilint");
  }
  return v;
}

function debugLog(enabled: boolean, message: string, obj?: unknown): void {
  if (!enabled) return;
  if (obj === undefined) {
    console.error(pc.dim("[uilint:debug]"), message);
  } else {
    try {
      console.error(pc.dim("[uilint:debug]"), message, obj);
    } catch {
      console.error(pc.dim("[uilint:debug]"), message);
    }
  }
}

async function resolveStyleGuideForAnalyze(options: {
  styleGuide?: string;
  styleguidePath?: string;
  inputFile?: string;
}): Promise<{ content: string | null; path: string | null }> {
  // 1) Inline (highest priority)
  if (options.styleGuide && typeof options.styleGuide === "string") {
    return { content: options.styleGuide, path: null };
  }

  // 2) Explicit path
  if (options.styleguidePath && typeof options.styleguidePath === "string") {
    const p = resolvePathSpecifier(options.styleguidePath, process.cwd());
    if (existsSync(p)) {
      return { content: await readStyleGuide(p), path: p };
    }
    return { content: null, path: null };
  }

  // 3) Env var pin
  const env = process.env.UILINT_STYLEGUIDE_PATH;
  if (env && env.trim()) {
    const p = resolvePathSpecifier(env.trim(), process.cwd());
    if (existsSync(p)) {
      return { content: await readStyleGuide(p), path: p };
    }
  }

  // 4) Smarter default: walk upward from the input file dir looking for `.uilint/styleguide.md`
  if (options.inputFile) {
    const absInput = resolvePathSpecifier(options.inputFile, process.cwd());
    const found = findUILintStyleGuideUpwards(dirname(absInput));
    if (found) return { content: await readStyleGuide(found), path: found };
  }

  // 5) Fallbacks: cwd, then workspace root (monorepo)
  const cwdPath = findStyleGuidePath(process.cwd());
  if (cwdPath) return { content: await readStyleGuide(cwdPath), path: cwdPath };

  const wsRoot = findWorkspaceRoot(process.cwd());
  const wsPath = findStyleGuidePath(wsRoot);
  if (wsPath) return { content: await readStyleGuide(wsPath), path: wsPath };

  return { content: null, path: null };
}

function formatScanIssuesText(issues: UILintScanIssue[]): string {
  if (issues.length === 0) return pc.green("No issues found.");
  const lines = issues.map((i) => {
    const line = typeof i.line === "number" ? `Line ${i.line}: ` : "";
    const loc = i.dataLoc ? ` ${pc.dim(`(${i.dataLoc})`)}` : "";
    return `- ${line}${i.message}${loc}`;
  });
  return lines.join("\n");
}

export async function analyze(options: AnalyzeOptions): Promise<void> {
  const isJsonOutput = options.output === "json";
  const dbg = debugEnabled(options);
  const dbgFull = debugFullEnabled(options);
  const dbgDump = debugDumpPath(options);

  if (!isJsonOutput) {
    intro("Analyze Source Code");
  }

  try {
    debugLog(dbg, "Input options", {
      inputFile: options.inputFile,
      sourceCode: options.sourceCode ? "(provided)" : undefined,
      styleGuide: options.styleGuide ? "(inline)" : undefined,
      styleguidePath: options.styleguidePath,
      filePath: options.filePath,
      componentName: options.componentName,
      componentLine: options.componentLine,
      includeChildren: options.includeChildren,
      dataLoc: options.dataLoc,
      model: options.model,
      stream: options.stream,
      output: options.output,
    });

    // Input
    const sourceCode = await getCodeInput({
      code: options.sourceCode,
      file: options.inputFile
        ? resolvePathSpecifier(options.inputFile)
        : undefined,
    });

    debugLog(dbg, "Source code (high-level)", {
      length: sourceCode.length,
      lines: sourceCode.split("\n").length,
    });
    if (dbgFull) {
      debugLog(dbg, "Source code (full)", sourceCode);
    } else if (dbg) {
      debugLog(dbg, "Source code (preview)", preview(sourceCode, 800));
    }

    const resolvedStyle = await resolveStyleGuideForAnalyze({
      styleGuide: options.styleGuide,
      styleguidePath: options.styleguidePath,
      inputFile: options.inputFile,
    });

    debugLog(dbg, "Styleguide resolved", {
      styleGuideArg:
        options.styleguidePath ?? options.styleGuide ? "(inline)" : null,
      styleguideLocation: resolvedStyle.path,
      styleGuideLength: resolvedStyle.content
        ? resolvedStyle.content.length
        : 0,
    });
    if (dbgFull) {
      debugLog(dbg, "Styleguide contents (full)", resolvedStyle.content ?? "");
    } else if (dbg && resolvedStyle.content) {
      debugLog(
        dbg,
        "Styleguide contents (preview)",
        preview(resolvedStyle.content, 800)
      );
    }

    if (!resolvedStyle.content && !isJsonOutput) {
      logWarning("No styleguide found (analyzing without it)");
    } else if (resolvedStyle.path && !isJsonOutput) {
      logSuccess(`Using styleguide: ${pc.dim(resolvedStyle.path)}`);
    }

    // Prepare Ollama
    if (!isJsonOutput) {
      await withSpinner("Preparing Ollama", async () => {
        await ensureOllamaReady({ model: options.model });
      });
    } else {
      await ensureOllamaReady({ model: options.model });
    }

    const client = await createLLMClient({
      model: options.model || UILINT_DEFAULT_OLLAMA_MODEL,
    });

    const promptContext = {
      filePath:
        options.filePath ||
        (options.inputFile ? options.inputFile : undefined) ||
        "component.tsx",
      componentName: options.componentName,
      componentLine:
        typeof options.componentLine === "number"
          ? options.componentLine
          : undefined,
      includeChildren: options.includeChildren === true,
      dataLocs: Array.isArray(options.dataLoc) ? options.dataLoc : undefined,
    };

    const prompt = buildSourceScanPrompt(
      sourceCode,
      resolvedStyle.content,
      promptContext
    );

    debugLog(dbg, "LLM request (high-level)", {
      baseUrl: "http://localhost:11434",
      model: client.getModel(),
      format: "json",
      stream: options.stream ?? false,
      promptLength: prompt.length,
      promptLines: prompt.split("\n").length,
    });

    if (dbgFull) {
      debugLog(dbg, "LLM prompt (full)", prompt);
    } else if (dbg) {
      debugLog(dbg, "LLM prompt (preview)", preview(prompt, 1200));
    }

    // Debug dump
    if (dbgDump) {
      try {
        const now = new Date();
        const safeStamp = now.toISOString().replace(/[:.]/g, "-");
        const resolved = resolve(process.cwd(), dbgDump);
        const dumpFile =
          resolved.endsWith(".json") || resolved.endsWith(".jsonl")
            ? resolved
            : resolve(resolved, `analyze-debug-${safeStamp}.json`);

        mkdirSync(dirname(dumpFile), { recursive: true });
        writeFileSync(
          dumpFile,
          JSON.stringify(
            {
              version: 1,
              timestamp: now.toISOString(),
              command: "analyze",
              options: {
                inputFile: options.inputFile,
                sourceCode: options.sourceCode ? "(provided)" : undefined,
                styleGuide: options.styleGuide ? "(inline)" : undefined,
                styleguidePath: options.styleguidePath,
                styleguideLocation: resolvedStyle.path,
                filePath: options.filePath,
                componentName: options.componentName,
                componentLine: options.componentLine,
                includeChildren: options.includeChildren,
                dataLoc: options.dataLoc,
                model: client.getModel(),
                stream: options.stream,
                output: options.output,
              },
              input: {
                sourceCode,
                sourceLines: sourceCode.split("\n").length,
              },
              styleGuide: resolvedStyle.content,
              promptContext,
              prompt,
              llmRequest: {
                baseUrl: "http://localhost:11434",
                model: client.getModel(),
                format: "json",
                stream: options.stream ?? false,
              },
            },
            null,
            2
          ),
          "utf-8"
        );
        debugLog(dbg, `Wrote debug dump to ${dumpFile}`);
      } catch (e) {
        debugLog(
          dbg,
          "Failed to write debug dump",
          e instanceof Error ? e.message : e
        );
      }
    }

    let responseText = "";
    if (options.stream) {
      if (!isJsonOutput) {
        const s = createSpinner();
        s.start("Analyzing with LLM");
        try {
          responseText = await client.complete(prompt, {
            json: true,
            stream: true,
            onProgress: (latestLine: string) => {
              const maxLen = 60;
              const line =
                latestLine.length > maxLen
                  ? latestLine.slice(0, maxLen) + "…"
                  : latestLine;
              s.message(`Analyzing: ${pc.dim(line || "...")}`);
            },
          });
          s.stop(pc.green("✓ ") + "Analyzing with LLM");
        } catch (e) {
          s.stop(pc.red("✗ ") + "Analyzing with LLM");
          throw e;
        }
      } else {
        responseText = await client.complete(prompt, {
          json: true,
          stream: true,
          onProgress: () => {
            // JSON mode: never write progress to stdout
          },
        });
      }
    } else {
      responseText = await client.complete(prompt, { json: true });
    }

    const parsed = JSON.parse(responseText) as { issues?: UILintScanIssue[] };
    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];

    if (isJsonOutput) {
      printJSON({ issues });
    } else {
      process.stdout.write(formatScanIssuesText(issues) + "\n");
    }

    if (issues.length > 0) {
      await flushLangfuse();
      process.exit(1);
    }
  } catch (error) {
    if (isJsonOutput) {
      printJSON({
        error: error instanceof Error ? error.message : "Unknown error",
        issues: [],
      });
    } else {
      logError(error instanceof Error ? error.message : "Analyze failed");
    }
    await flushLangfuse();
    process.exit(1);
  }

  // Flush before normal exit
  await flushLangfuse();
}
