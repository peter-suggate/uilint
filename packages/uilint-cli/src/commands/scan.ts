/**
 * Scan command - scans HTML for UI consistency issues
 */

import { dirname, resolve } from "path";
import { existsSync, mkdirSync, statSync, writeFileSync } from "fs";
import {
  OllamaClient,
  createStyleSummary,
  buildAnalysisPrompt,
  buildSourceAnalysisPrompt,
  formatViolationsText,
  sanitizeIssues,
  ensureOllamaReady,
  readStyleGuide,
  readStyleGuideFromProject,
  findStyleGuidePath,
  findUILintStyleGuideUpwards,
  STYLEGUIDE_PATHS,
  readTailwindThemeTokens,
} from "uilint-core/node";
import {
  getScanInput,
  type InputOptions,
  type ScanInput,
} from "../utils/input.js";
import { resolvePathSpecifier } from "../utils/path-specifiers.js";
import {
  intro,
  outro,
  withSpinner,
  createSpinner,
  note,
  logInfo,
  logWarning,
  logError,
  logSuccess,
  pc,
} from "../utils/prompts.js";
import { printJSON } from "../utils/output.js";

export interface ScanOptions extends InputOptions {
  styleguide?: string;
  output?: "text" | "json";
  model?: string;
  /**
   * Enable debug logging (stderr only; never pollutes JSON stdout).
   * Can also be enabled via UILINT_DEBUG=1
   */
  debug?: boolean;
  /**
   * Print full prompt/styleSummary/styleGuide to stderr (can be very large).
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

function debugEnabled(options: ScanOptions): boolean {
  return Boolean(options.debug) || envTruthy("UILINT_DEBUG");
}

function debugFullEnabled(options: ScanOptions): boolean {
  return Boolean(options.debugFull) || envTruthy("UILINT_DEBUG_FULL");
}

function debugDumpPath(options: ScanOptions): string | null {
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

export async function scan(options: ScanOptions): Promise<void> {
  // For JSON output, skip the fancy UI
  const isJsonOutput = options.output === "json";
  const dbg = debugEnabled(options);
  const dbgFull = debugFullEnabled(options);
  const dbgDump = debugDumpPath(options);

  if (!isJsonOutput) {
    intro("Scan for UI Issues");
  }

  try {
    // Get input
    let snapshot: ScanInput;
    try {
      const normalizedOptions: ScanOptions = {
        ...options,
        inputFile: options.inputFile
          ? resolvePathSpecifier(options.inputFile, process.cwd())
          : options.inputFile,
      };
      if (isJsonOutput) {
        snapshot = await getScanInput(normalizedOptions);
      } else {
        snapshot = await withSpinner("Parsing input", async () => {
          return await getScanInput(normalizedOptions);
        });
      }
    } catch {
      if (isJsonOutput) {
        printJSON({ error: "No input provided", issues: [] });
      } else {
        logError("No input provided. Use --input-file or pipe HTML to stdin.");
      }
      process.exit(1);
    }

    debugLog(dbg, "Input options", {
      inputFile: options.inputFile,
      inputJson: options.inputJson ? "(provided)" : undefined,
      styleguide: options.styleguide,
      output: options.output,
      model: options.model,
    });

    if (snapshot.kind === "dom") {
      const dom = snapshot.snapshot;
      debugLog(dbg, "Parsed snapshot (high-level)", {
        elementCount: dom.elementCount,
        timestamp: dom.timestamp,
        htmlLength: dom.html.length,
        styles: {
          colors: dom.styles.colors.size,
          fontSizes: dom.styles.fontSizes.size,
          fontFamilies: dom.styles.fontFamilies.size,
          fontWeights: dom.styles.fontWeights.size,
          spacing: dom.styles.spacing.size,
          borderRadius: dom.styles.borderRadius.size,
        },
      });
      if (dbgFull) {
        debugLog(dbg, "Snapshot HTML (full)", dom.html);
      } else if (dbg) {
        debugLog(dbg, "Snapshot HTML (preview)", preview(dom.html, 800));
      }

      if (!isJsonOutput) {
        logInfo(`Scanning ${pc.cyan(String(dom.elementCount))} elements`);
      }
    } else {
      debugLog(dbg, "Parsed source input (high-level)", {
        inputPath: snapshot.inputPath,
        extension: snapshot.extension,
        length: snapshot.source.length,
        lines: snapshot.source.split("\n").length,
      });
      if (dbgFull) {
        debugLog(dbg, "Source (full)", snapshot.source);
      } else if (dbg) {
        debugLog(dbg, "Source (preview)", preview(snapshot.source, 1200));
      }

      if (!isJsonOutput) {
        logInfo(
          `Scanning ${pc.cyan(snapshot.extension || "source")} (${pc.cyan(
            String(snapshot.source.split("\n").length)
          )} lines)`
        );
      }
    }

    // Get style guide
    // --styleguide can be either:
    // 1. Direct path to a styleguide file (e.g., /path/to/.uilint/styleguide.md)
    // 2. Path to a project directory to search in
    // 3. Not provided - search from cwd
    let styleGuide: string | null = null;
    let styleguideLocation: string | null = null;
    const projectPath = process.cwd();

    if (options.styleguide) {
      const styleguideArg = resolvePathSpecifier(
        options.styleguide,
        projectPath
      );
      if (existsSync(styleguideArg)) {
        const stat = statSync(styleguideArg);
        if (stat.isFile()) {
          // Direct path to styleguide file
          styleguideLocation = styleguideArg;
          styleGuide = await readStyleGuide(styleguideArg);
        } else if (stat.isDirectory()) {
          // Path to project directory - search within it
          styleguideLocation = findStyleGuidePath(styleguideArg);
          if (styleguideLocation) {
            styleGuide = await readStyleGuide(styleguideLocation);
          }
        }
      } else {
        if (!isJsonOutput) {
          logWarning(`Styleguide not found: ${styleguideArg}`);
        }
      }
    } else {
      // No --styleguide provided:
      // Prefer searching upward from the input file directory for `.uilint/styleguide.md`
      // (helps when running from repo root but scanning a nested app/package).
      const startPath =
        snapshot.kind === "source"
          ? snapshot.inputPath
          : snapshot.kind === "dom"
          ? snapshot.inputPath
          : undefined;
      if (startPath) {
        styleguideLocation = findUILintStyleGuideUpwards(dirname(startPath));
      }

      // Fallback: search from cwd
      styleguideLocation =
        styleguideLocation ?? findStyleGuidePath(projectPath);
      if (styleguideLocation) {
        styleGuide = await readStyleGuide(styleguideLocation);
      }
    }

    if (styleguideLocation && styleGuide) {
      if (!isJsonOutput) {
        logSuccess(`Using styleguide: ${pc.dim(styleguideLocation)}`);
      }
    } else if (!styleGuide) {
      if (!isJsonOutput) {
        logWarning("No styleguide found");
        note(
          [
            `Searched in: ${options.styleguide || projectPath}`,
            "",
            "Looked for:",
            ...STYLEGUIDE_PATHS.map((p) => `  • ${p}`),
            "",
            `Create ${pc.cyan(
              ".uilint/styleguide.md"
            )} (recommended: run ${pc.cyan("/genstyleguide")} in Cursor).`,
          ].join("\n"),
          "Missing Styleguide"
        );
      }
    }

    debugLog(dbg, "Styleguide resolved", {
      styleguideArg: options.styleguide,
      styleguideLocation: styleguideLocation ?? null,
      styleGuideLength: styleGuide ? styleGuide.length : 0,
    });
    if (dbgFull) {
      debugLog(dbg, "Styleguide contents (full)", styleGuide ?? "");
    } else if (dbg && styleGuide) {
      debugLog(dbg, "Styleguide contents (preview)", preview(styleGuide, 800));
    }

    // Create style summary
    const tailwindSearchDir =
      (snapshot.kind === "source" || snapshot.kind === "dom") &&
      snapshot.inputPath
        ? dirname(snapshot.inputPath)
        : projectPath;
    const tailwindTheme = readTailwindThemeTokens(tailwindSearchDir);
    const styleSummary =
      snapshot.kind === "dom"
        ? createStyleSummary(snapshot.snapshot.styles, {
            html: snapshot.snapshot.html,
            tailwindTheme,
          })
        : null;

    debugLog(dbg, "Tailwind context", {
      tailwindSearchDir,
      tailwindTheme: tailwindTheme
        ? {
            configPath: tailwindTheme.configPath,
            colors: tailwindTheme.colors.length,
            spacingKeys: tailwindTheme.spacingKeys.length,
            borderRadiusKeys: tailwindTheme.borderRadiusKeys.length,
            fontFamilyKeys: tailwindTheme.fontFamilyKeys.length,
            fontSizeKeys: tailwindTheme.fontSizeKeys.length,
          }
        : null,
    });

    debugLog(dbg, "Style summary (stats)", {
      length: styleSummary ? styleSummary.length : 0,
      lines: styleSummary ? styleSummary.split("\n").length : 0,
    });
    if (dbgFull) {
      debugLog(dbg, "Style summary (full)", styleSummary ?? "");
    } else if (dbg && styleSummary) {
      debugLog(dbg, "Style summary (preview)", preview(styleSummary, 800));
    }

    // Prepare Ollama
    if (!isJsonOutput) {
      await withSpinner("Preparing Ollama", async () => {
        await ensureOllamaReady({ model: options.model });
      });
    } else {
      await ensureOllamaReady({ model: options.model });
    }

    // Call Ollama for analysis
    const client = new OllamaClient({ model: options.model });
    let result;

    // Build the exact prompt (this is what analyzeStyles() uses internally)
    const prompt =
      snapshot.kind === "dom"
        ? buildAnalysisPrompt(styleSummary ?? "", styleGuide)
        : buildSourceAnalysisPrompt(snapshot.source, styleGuide, {
            filePath: snapshot.inputPath,
            languageHint: snapshot.extension.replace(/^\./, "") || "source",
            extraContext: tailwindTheme
              ? `Tailwind theme tokens loaded from: ${tailwindTheme.configPath}\n- colors: ${tailwindTheme.colors.length}\n- spacingKeys: ${tailwindTheme.spacingKeys.length}\n- borderRadiusKeys: ${tailwindTheme.borderRadiusKeys.length}\n- fontFamilyKeys: ${tailwindTheme.fontFamilyKeys.length}\n- fontSizeKeys: ${tailwindTheme.fontSizeKeys.length}`
              : "",
          });
    debugLog(dbg, "LLM request (high-level)", {
      baseUrl: "http://localhost:11434",
      model: client.getModel(),
      format: "json",
      stream: !isJsonOutput,
      promptLength: prompt.length,
      promptLines: prompt.split("\n").length,
    });

    if (dbgFull) {
      debugLog(dbg, "LLM prompt (full)", prompt);
    } else if (dbg) {
      debugLog(dbg, "LLM prompt (preview)", preview(prompt, 1200));
    }

    if (dbgDump) {
      try {
        const now = new Date();
        const safeStamp = now.toISOString().replace(/[:.]/g, "-");
        const resolved = resolve(process.cwd(), dbgDump);
        const dumpFile =
          resolved.endsWith(".json") || resolved.endsWith(".jsonl")
            ? resolved
            : resolve(resolved, `scan-debug-${safeStamp}.json`);

        // If path looks like a directory (or a non-json file), ensure dir exists.
        mkdirSync(dirname(dumpFile), { recursive: true });
        writeFileSync(
          dumpFile,
          JSON.stringify(
            {
              version: 1,
              timestamp: now.toISOString(),
              options: {
                inputFile: options.inputFile,
                inputJson: options.inputJson ? "(provided)" : undefined,
                styleguide: options.styleguide,
                styleguideLocation,
                output: options.output,
                model: client.getModel(),
              },
              snapshot: {
                kind: snapshot.kind,
                ...(snapshot.kind === "dom"
                  ? {
                      elementCount: snapshot.snapshot.elementCount,
                      timestamp: snapshot.snapshot.timestamp,
                      html: snapshot.snapshot.html,
                      styles: {
                        colors: [...snapshot.snapshot.styles.colors.entries()],
                        fontSizes: [
                          ...snapshot.snapshot.styles.fontSizes.entries(),
                        ],
                        fontFamilies: [
                          ...snapshot.snapshot.styles.fontFamilies.entries(),
                        ],
                        fontWeights: [
                          ...snapshot.snapshot.styles.fontWeights.entries(),
                        ],
                        spacing: [
                          ...snapshot.snapshot.styles.spacing.entries(),
                        ],
                        borderRadius: [
                          ...snapshot.snapshot.styles.borderRadius.entries(),
                        ],
                      },
                    }
                  : {
                      inputPath: snapshot.inputPath,
                      extension: snapshot.extension,
                      source: snapshot.source,
                    }),
              },
              styleGuide,
              styleSummary,
              prompt,
              tailwindTheme,
              llmRequest: {
                baseUrl: "http://localhost:11434",
                model: client.getModel(),
                format: "json",
                stream: !isJsonOutput,
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

    if (isJsonOutput) {
      result =
        snapshot.kind === "dom"
          ? await client.analyzeStyles(styleSummary ?? "", styleGuide)
          : await client.analyzeSource(snapshot.source, styleGuide, undefined, {
              filePath: snapshot.inputPath,
              languageHint: snapshot.extension.replace(/^\./, "") || "source",
              extraContext: tailwindTheme
                ? `Tailwind theme tokens loaded from: ${tailwindTheme.configPath}\n- colors: ${tailwindTheme.colors.length}\n- spacingKeys: ${tailwindTheme.spacingKeys.length}\n- borderRadiusKeys: ${tailwindTheme.borderRadiusKeys.length}\n- fontFamilyKeys: ${tailwindTheme.fontFamilyKeys.length}\n- fontSizeKeys: ${tailwindTheme.fontSizeKeys.length}`
                : "",
            });
    } else {
      // Use streaming to show progress
      const s = createSpinner();
      s.start("Analyzing with LLM");

      const onProgress = (latestLine: string): void => {
        // Truncate line if too long for terminal
        const maxLen = 60;
        const displayLine =
          latestLine.length > maxLen
            ? latestLine.slice(0, maxLen) + "…"
            : latestLine;
        s.message(`Analyzing: ${pc.dim(displayLine || "...")}`);
      };

      try {
        result =
          snapshot.kind === "dom"
            ? await client.analyzeStyles(
                styleSummary ?? "",
                styleGuide,
                onProgress
              )
            : await client.analyzeSource(
                snapshot.source,
                styleGuide,
                onProgress,
                {
                  filePath: snapshot.inputPath,
                  languageHint:
                    snapshot.extension.replace(/^\./, "") || "source",
                  extraContext: tailwindTheme
                    ? `Tailwind theme tokens loaded from: ${tailwindTheme.configPath}\n- colors: ${tailwindTheme.colors.length}\n- spacingKeys: ${tailwindTheme.spacingKeys.length}\n- borderRadiusKeys: ${tailwindTheme.borderRadiusKeys.length}\n- fontFamilyKeys: ${tailwindTheme.fontFamilyKeys.length}\n- fontSizeKeys: ${tailwindTheme.fontSizeKeys.length}`
                    : "",
                }
              );
        s.stop(pc.green("✓ ") + "Analyzing with LLM");
      } catch (error) {
        s.stop(pc.red("✗ ") + "Analyzing with LLM");
        throw error;
      }
    }

    // Sanitize (enforce violations-only output)
    const issues = sanitizeIssues(result.issues);

    // Output results
    if (isJsonOutput) {
      printJSON({
        issues,
        analysisTime: result.analysisTime,
        elementCount:
          snapshot.kind === "dom" ? snapshot.snapshot.elementCount : 0,
      });
    } else {
      // Minimal output: list violations only, plus footer to consult the style guide.
      process.stdout.write(
        formatViolationsText(issues, { includeFooter: issues.length > 0 }) +
          "\n"
      );
    }

    // Exit with error code if issues found
    if (issues.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    if (options.output === "json") {
      printJSON({
        error: error instanceof Error ? error.message : "Unknown error",
        issues: [],
      });
    } else {
      logError(error instanceof Error ? error.message : "Scan failed");
    }
    process.exit(1);
  }
}
