/**
 * Vision command - analyze a screenshot with Ollama vision models
 *
 * Mirrors the "scan" command UX (debug flags, JSON/text output), but operates on images.
 */

import { dirname, resolve, join } from "path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "fs";
import {
  ensureOllamaReady,
  STYLEGUIDE_PATHS,
  UILINT_DEFAULT_VISION_MODEL,
  type ElementManifest,
  type VisionIssue,
} from "uilint-core/node";
import { resolvePathSpecifier } from "../utils/path-specifiers.js";
import { flushLangfuse } from "../utils/llm-client.js";
import { nsNow, nsToMs, formatMs, maybeMs } from "../utils/timing.js";
import {
  resolveVisionStyleGuide,
  runVisionAnalysis,
} from "../utils/vision-run.js";
import {
  intro,
  withSpinner,
  note,
  logInfo,
  logWarning,
  logError,
  logSuccess,
  pc,
} from "../utils/prompts.js";
import { printJSON } from "../utils/output.js";

export interface VisionOptions {
  /** Path to a screenshot image (png/jpg). */
  image?: string;
  /** Path to a `.json` sidecar containing { manifest, ... } (as saved by the Next screenshot route). */
  sidecar?: string;
  /** Inline manifest JSON string (array). */
  manifestJson?: string;
  /** Path to a manifest JSON file (array). */
  manifestFile?: string;
  /** Explicit route label (used in output and debug dump). */
  route?: string;
  /** Path to style guide file or project dir (same semantics as scan.ts). */
  styleguide?: string;
  /** Output format */
  output?: "text" | "json";
  /** List available `.uilint/screenshots/*.json` sidecars and exit */
  list?: boolean;
  /** Optional screenshots directory to list from (default: nearest `.uilint/screenshots`) */
  screenshotsDir?: string;
  /** Stream model output/progress (text mode only; JSON output stays non-streaming) */
  stream?: boolean;
  /** Ollama base URL (default: http://localhost:11434) */
  baseUrl?: string;
  /** Vision model override (default: UILINT_DEFAULT_VISION_MODEL) */
  model?: string;
  /** Enable debug logging (stderr only; never pollutes JSON stdout). Can also be enabled via UILINT_DEBUG=1 */
  debug?: boolean;
  /** Print full prompt/styleguide (can be very large). Can also be enabled via UILINT_DEBUG_FULL=1 */
  debugFull?: boolean;
  /** Dump payload to file. Can also be set via UILINT_DEBUG_DUMP=/path */
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

function debugEnabled(options: VisionOptions): boolean {
  return Boolean(options.debug) || envTruthy("UILINT_DEBUG");
}

function debugFullEnabled(options: VisionOptions): boolean {
  return Boolean(options.debugFull) || envTruthy("UILINT_DEBUG_FULL");
}

function debugDumpPath(options: VisionOptions): string | null {
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

function findScreenshotsDirUpwards(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 20; i++) {
    const candidate = join(dir, ".uilint", "screenshots");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

type ScreenshotSidecarSummary = {
  path: string;
  filename: string;
  timestamp?: number;
  route?: string;
  issueCount?: number;
};

function listScreenshotSidecars(dirPath: string): ScreenshotSidecarSummary[] {
  if (!existsSync(dirPath)) return [];
  const entries = readdirSync(dirPath)
    .filter((f) => f.endsWith(".json"))
    .map((f) => join(dirPath, f));

  const out: ScreenshotSidecarSummary[] = [];
  for (const p of entries) {
    try {
      const json = loadJsonFile<any>(p);
      const issues = Array.isArray(json?.issues)
        ? json.issues
        : json?.analysisResult?.issues;
      out.push({
        path: p,
        filename:
          json?.filename || json?.screenshotFile || p.split("/").pop() || p,
        timestamp:
          typeof json?.timestamp === "number" ? json.timestamp : undefined,
        route: typeof json?.route === "string" ? json.route : undefined,
        issueCount: Array.isArray(issues) ? issues.length : undefined,
      });
    } catch {
      out.push({
        path: p,
        filename: p.split("/").pop() || p,
      });
    }
  }

  // Newest first (fallback to filename sort)
  out.sort((a, b) => {
    const at = a.timestamp ?? 0;
    const bt = b.timestamp ?? 0;
    if (at !== bt) return bt - at;
    return b.path.localeCompare(a.path);
  });

  return out;
}

function readImageAsBase64(imagePath: string): {
  base64: string;
  sizeBytes: number;
} {
  const bytes = readFileSync(imagePath);
  return { base64: bytes.toString("base64"), sizeBytes: bytes.byteLength };
}

function loadJsonFile<T>(filePath: string): T {
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

function formatIssuesText(issues: VisionIssue[]): string {
  if (issues.length === 0) return "No vision issues found.\n";
  return (
    issues
      .map((i) => {
        const sev = i.severity || "info";
        const cat = i.category || "other";
        const where = i.dataLoc ? ` (${i.dataLoc})` : "";
        return `- [${sev}/${cat}] ${i.message}${where}`;
      })
      .join("\n") + "\n"
  );
}

export async function vision(options: VisionOptions): Promise<void> {
  const isJsonOutput = options.output === "json";
  const dbg = debugEnabled(options);
  const dbgFull = debugFullEnabled(options);
  const dbgDump = debugDumpPath(options);

  if (!isJsonOutput) intro("Vision (Screenshot) Analysis");

  try {
    const projectPath = process.cwd();

    // List mode (no analysis)
    if (options.list) {
      const base =
        (options.screenshotsDir
          ? resolvePathSpecifier(options.screenshotsDir, projectPath)
          : null) || findScreenshotsDirUpwards(projectPath);

      if (!base) {
        if (isJsonOutput) {
          printJSON({ screenshotsDir: null, sidecars: [] });
        } else {
          logWarning(
            "No `.uilint/screenshots` directory found (walked up from cwd)."
          );
        }
        await flushLangfuse();
        return;
      }

      const sidecars = listScreenshotSidecars(base);
      if (isJsonOutput) {
        printJSON({ screenshotsDir: base, sidecars });
      } else {
        logInfo(`Screenshots dir: ${pc.dim(base)}`);
        if (sidecars.length === 0) {
          process.stdout.write("No sidecars found.\n");
        } else {
          process.stdout.write(
            sidecars
              .map((s, idx) => {
                const stamp = s.timestamp
                  ? new Date(s.timestamp).toLocaleString()
                  : "(no timestamp)";
                const route = s.route ? ` ${pc.dim(s.route)}` : "";
                const count =
                  typeof s.issueCount === "number"
                    ? ` ${pc.dim(`(${s.issueCount} issues)`)}`
                    : "";
                return `${idx === 0 ? "*" : "-"} ${s.path}${pc.dim(
                  ` — ${stamp}`
                )}${route}${count}`;
              })
              .join("\n") + "\n"
          );
          process.stdout.write(
            pc.dim(
              `Tip: run \`uilint vision --sidecar <path>\` (the newest is marked with "*").\n`
            )
          );
        }
      }
      await flushLangfuse();
      return;
    }

    // Resolve inputs
    const imagePath = options.image
      ? resolvePathSpecifier(options.image, projectPath)
      : undefined;
    const sidecarPath = options.sidecar
      ? resolvePathSpecifier(options.sidecar, projectPath)
      : undefined;
    const manifestFilePath = options.manifestFile
      ? resolvePathSpecifier(options.manifestFile, projectPath)
      : undefined;

    if (!imagePath && !sidecarPath) {
      if (isJsonOutput) {
        printJSON({ error: "No input provided", issues: [] });
      } else {
        logError("No input provided. Use --image or --sidecar.");
      }
      await flushLangfuse();
      process.exit(1);
    }

    if (imagePath && !existsSync(imagePath)) {
      throw new Error(`Image not found: ${imagePath}`);
    }
    if (sidecarPath && !existsSync(sidecarPath)) {
      throw new Error(`Sidecar not found: ${sidecarPath}`);
    }
    if (manifestFilePath && !existsSync(manifestFilePath)) {
      throw new Error(`Manifest file not found: ${manifestFilePath}`);
    }

    // Load sidecar if provided (supports the Next screenshot route payload)
    const sidecar = sidecarPath
      ? loadJsonFile<{
          filename?: string;
          screenshotFile?: string;
          route?: string;
          manifest?: unknown;
          analysisResult?: unknown;
          issues?: unknown;
        }>(sidecarPath)
      : null;

    const routeLabel =
      options.route ||
      (typeof sidecar?.route === "string" ? sidecar.route : undefined) ||
      (sidecarPath ? `(from ${sidecarPath})` : "(unknown)");

    // Manifest sources (priority: --manifest-json > --manifest-file > sidecar.manifest)
    let manifest: ElementManifest[] | null = null;
    if (options.manifestJson) {
      manifest = JSON.parse(options.manifestJson) as ElementManifest[];
    } else if (manifestFilePath) {
      manifest = loadJsonFile<ElementManifest[]>(manifestFilePath);
    } else if (sidecar && Array.isArray(sidecar.manifest)) {
      manifest = sidecar.manifest as ElementManifest[];
    }

    if (!manifest || manifest.length === 0) {
      throw new Error(
        "No manifest provided. Supply --manifest-json, --manifest-file, or a sidecar JSON with a `manifest` array."
      );
    }

    // Styleguide resolution: same semantics as scan.ts (path/file/dir), with a good default start dir.
    let styleGuide: string | null = null;
    let styleguideLocation: string | null = null;
    const startPath =
      (imagePath ?? sidecarPath ?? manifestFilePath ?? undefined) || undefined;

    {
      const resolved = await resolveVisionStyleGuide({
        projectPath,
        styleguide: options.styleguide,
        startDir: startPath ? dirname(startPath) : projectPath,
      });
      styleGuide = resolved.styleGuide;
      styleguideLocation = resolved.styleguideLocation;
    }

    if (styleguideLocation && styleGuide) {
      if (!isJsonOutput)
        logSuccess(`Using styleguide: ${pc.dim(styleguideLocation)}`);
    } else if (!styleGuide && !isJsonOutput) {
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

    debugLog(dbg, "Vision input (high-level)", {
      imagePath: imagePath ?? null,
      sidecarPath: sidecarPath ?? null,
      manifestFile: manifestFilePath ?? null,
      manifestElements: manifest.length,
      route: routeLabel,
      styleguideLocation,
      styleGuideLength: styleGuide ? styleGuide.length : 0,
    });

    // Prepare Ollama (ensure model exists & server up)
    const visionModel = options.model || UILINT_DEFAULT_VISION_MODEL;
    const prepStartNs = nsNow();
    if (!isJsonOutput) {
      await withSpinner("Preparing Ollama", async () => {
        await ensureOllamaReady({
          model: visionModel,
          baseUrl: options.baseUrl,
        });
      });
    } else {
      await ensureOllamaReady({ model: visionModel, baseUrl: options.baseUrl });
    }
    const prepEndNs = nsNow();

    // Load screenshot bytes
    const resolvedImagePath =
      imagePath ||
      (() => {
        // If sidecar contains screenshotFile and is relative, resolve relative to the sidecar dir.
        const screenshotFile =
          typeof sidecar?.screenshotFile === "string"
            ? sidecar.screenshotFile
            : typeof sidecar?.filename === "string"
            ? sidecar.filename
            : undefined;
        if (!screenshotFile) return null;
        const baseDir = sidecarPath ? dirname(sidecarPath) : projectPath;
        const abs = resolve(baseDir, screenshotFile);
        return abs;
      })();

    if (!resolvedImagePath) {
      throw new Error(
        "No image path could be resolved. Provide --image or a sidecar with `screenshotFile`/`filename`."
      );
    }
    if (!existsSync(resolvedImagePath)) {
      throw new Error(`Image not found: ${resolvedImagePath}`);
    }

    const { base64, sizeBytes } = readImageAsBase64(resolvedImagePath);
    debugLog(dbg, "Image loaded", {
      imagePath: resolvedImagePath,
      sizeBytes,
      base64Length: base64.length,
    });

    if (dbgFull && styleGuide) {
      debugLog(dbg, "Styleguide (full)", styleGuide);
    } else if (dbg && styleGuide) {
      debugLog(dbg, "Styleguide (preview)", preview(styleGuide, 800));
    }

    // Run analysis (optionally show streaming progress in text mode)
    let result: {
      issues: VisionIssue[];
      analysisTime: number;
      rawResponse?: string;
    } | null = null;

    const analysisStartNs = nsNow();
    let firstTokenNs: bigint | null = null;
    let firstThinkingNs: bigint | null = null;
    let lastThinkingNs: bigint | null = null;
    let firstAnswerNs: bigint | null = null;
    let lastAnswerNs: bigint | null = null;

    if (isJsonOutput) {
      result = await runVisionAnalysis({
        imageBase64: base64,
        manifest,
        projectPath,
        styleGuide,
        styleguideLocation,
        baseUrl: options.baseUrl,
        model: visionModel,
        skipEnsureOllama: true,
        debugDump: dbgDump ?? undefined,
        debugDumpIncludeSensitive: dbgFull,
        debugDumpMetadata: {
          route: routeLabel,
          imagePath: resolvedImagePath,
          imageSizeBytes: sizeBytes,
          imageBase64Length: base64.length,
        },
      });
    } else {
      if (options.stream) {
        let lastStatus = "";
        let printedAnyText = false;
        let inThinking = false;
        result = await runVisionAnalysis({
          imageBase64: base64,
          manifest,
          projectPath,
          styleGuide,
          styleguideLocation,
          baseUrl: options.baseUrl,
          model: visionModel,
          skipEnsureOllama: true,
          debugDump: dbgDump ?? undefined,
          debugDumpIncludeSensitive: dbgFull,
          debugDumpMetadata: {
            route: routeLabel,
            imagePath: resolvedImagePath,
            imageSizeBytes: sizeBytes,
            imageBase64Length: base64.length,
          },
          onProgress: (
            latestLine: string,
            _fullResponse: string,
            delta?: string,
            thinkingDelta?: string
          ) => {
            const nowNs = nsNow();
            if (!firstTokenNs && (thinkingDelta || delta)) firstTokenNs = nowNs;
            if (thinkingDelta) {
              if (!firstThinkingNs) firstThinkingNs = nowNs;
              lastThinkingNs = nowNs;
            }
            if (delta) {
              if (!firstAnswerNs) firstAnswerNs = nowNs;
              lastAnswerNs = nowNs;
            }

            if (thinkingDelta) {
              if (!printedAnyText) {
                printedAnyText = true;
                console.error(pc.dim("[vision] streaming:"));
                process.stderr.write(pc.dim("Thinking:\n"));
                inThinking = true;
              } else if (!inThinking) {
                process.stderr.write(pc.dim("\n\nThinking:\n"));
                inThinking = true;
              }
              process.stderr.write(thinkingDelta);
              return;
            }

            // If we got a text delta, stream it directly
            if (delta) {
              if (!printedAnyText) {
                printedAnyText = true;
                console.error(pc.dim("[vision] streaming:"));
              }
              if (inThinking) {
                process.stderr.write(pc.dim("\n\nAnswer:\n"));
                inThinking = false;
              }
              // Stream raw text to stderr to avoid corrupting stdout.
              process.stderr.write(delta);
              return;
            }

            // Fallback to status output (latest line / heartbeats).
            const line = (latestLine || "").trim();
            if (!line || line === lastStatus) return;
            lastStatus = line;
            console.error(pc.dim("[vision]"), line);
          },
        });
      } else {
        result = await withSpinner(
          "Analyzing screenshot with vision model",
          async (s) => {
            return await runVisionAnalysis({
              imageBase64: base64,
              manifest,
              projectPath,
              styleGuide,
              styleguideLocation,
              baseUrl: options.baseUrl,
              model: visionModel,
              skipEnsureOllama: true,
              debugDump: dbgDump ?? undefined,
              debugDumpIncludeSensitive: dbgFull,
              debugDumpMetadata: {
                route: routeLabel,
                imagePath: resolvedImagePath,
                imageSizeBytes: sizeBytes,
                imageBase64Length: base64.length,
              },
              onProgress: (
                latestLine: string,
                _fullResponse: string,
                delta?: string,
                thinkingDelta?: string
              ) => {
                const nowNs = nsNow();
                if (!firstTokenNs && (thinkingDelta || delta))
                  firstTokenNs = nowNs;
                if (thinkingDelta) {
                  if (!firstThinkingNs) firstThinkingNs = nowNs;
                  lastThinkingNs = nowNs;
                }
                if (delta) {
                  if (!firstAnswerNs) firstAnswerNs = nowNs;
                  lastAnswerNs = nowNs;
                }

                const maxLen = 60;
                const displayLine =
                  latestLine.length > maxLen
                    ? latestLine.slice(0, maxLen) + "…"
                    : latestLine;
                s.message(`Analyzing: ${pc.dim(displayLine || "...")}`);
              },
            });
          }
        );
      }
    }

    const analysisEndNs = nsNow();

    const issues = result?.issues ?? [];

    if (isJsonOutput) {
      printJSON({
        route: routeLabel,
        model: visionModel,
        issues,
        analysisTime: result?.analysisTime ?? 0,
        imagePath: resolvedImagePath,
        imageSizeBytes: sizeBytes,
      });
    } else {
      logInfo(`Route: ${pc.dim(routeLabel)}`);
      logInfo(`Model: ${pc.dim(visionModel)}`);
      process.stdout.write(formatIssuesText(issues));

      // Pretty timings (TTY-only so we don't clutter non-interactive usage)
      if (process.stdout.isTTY) {
        const prepMs = nsToMs(prepEndNs - prepStartNs);
        const totalMs = nsToMs(analysisEndNs - analysisStartNs);
        const endToEndMs = nsToMs(analysisEndNs - prepStartNs);
        const ttftMs = firstTokenNs
          ? nsToMs(firstTokenNs - analysisStartNs)
          : null;
        const thinkingMs =
          firstThinkingNs && (firstAnswerNs || lastThinkingNs)
            ? nsToMs(
                (firstAnswerNs ?? lastThinkingNs ?? analysisEndNs) -
                  firstThinkingNs
              )
            : null;
        const outputMs =
          firstAnswerNs && (lastAnswerNs || analysisEndNs)
            ? nsToMs((lastAnswerNs ?? analysisEndNs) - firstAnswerNs)
            : null;

        note(
          [
            `Prepare Ollama: ${formatMs(prepMs)}`,
            `Time to first token: ${maybeMs(ttftMs)}`,
            `Thinking: ${maybeMs(thinkingMs)}`,
            `Outputting: ${maybeMs(outputMs)}`,
            `LLM total: ${formatMs(totalMs)}`,
            `End-to-end: ${formatMs(endToEndMs)}`,
            result?.analysisTime
              ? pc.dim(`(core analysisTime: ${formatMs(result.analysisTime)})`)
              : pc.dim("(core analysisTime: n/a)"),
          ].join("\n"),
          "Timings"
        );
      }
    }

    // Exit with error code if issues found
    if (issues.length > 0) {
      await flushLangfuse();
      process.exit(1);
    }
  } catch (error) {
    if (options.output === "json") {
      printJSON({
        error: error instanceof Error ? error.message : "Unknown error",
        issues: [],
      });
    } else {
      logError(
        error instanceof Error ? error.message : "Vision analysis failed"
      );
    }
    await flushLangfuse();
    process.exit(1);
  }

  await flushLangfuse();
}
