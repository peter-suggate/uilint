import { dirname, join, parse } from "path";
import { existsSync, statSync, mkdirSync, writeFileSync } from "fs";
import {
  ensureOllamaReady,
  findStyleGuidePath,
  findUILintStyleGuideUpwards,
  readStyleGuide,
  VisionAnalyzer,
  UILINT_DEFAULT_VISION_MODEL,
  type ElementManifest,
  type VisionIssue,
  type VisionAnalysisResult,
  type StreamProgressCallback,
} from "uilint-core/node";
import { resolvePathSpecifier } from "./path-specifiers.js";

export type ResolveVisionStyleGuideArgs = {
  /** Project root / cwd used to resolve relative path specifiers */
  projectPath: string;
  /** Path to style guide file OR project directory */
  styleguide?: string;
  /** A starting point for upward search (directory). Defaults to projectPath. */
  startDir?: string;
};

export type ResolveVisionStyleGuideResult = {
  styleGuide: string | null;
  styleguideLocation: string | null;
};

export async function resolveVisionStyleGuide(
  args: ResolveVisionStyleGuideArgs
): Promise<ResolveVisionStyleGuideResult> {
  const projectPath = args.projectPath;
  const startDir = args.startDir ?? projectPath;

  if (args.styleguide) {
    const styleguideArg = resolvePathSpecifier(args.styleguide, projectPath);
    if (existsSync(styleguideArg)) {
      const stat = statSync(styleguideArg);
      if (stat.isFile()) {
        return {
          styleguideLocation: styleguideArg,
          styleGuide: await readStyleGuide(styleguideArg),
        };
      }
      if (stat.isDirectory()) {
        const found = findStyleGuidePath(styleguideArg);
        return {
          styleguideLocation: found,
          styleGuide: found ? await readStyleGuide(found) : null,
        };
      }
    }
    return { styleGuide: null, styleguideLocation: null };
  }

  const upwards = findUILintStyleGuideUpwards(startDir);
  const fallback = upwards ?? findStyleGuidePath(projectPath);
  return {
    styleguideLocation: fallback,
    styleGuide: fallback ? await readStyleGuide(fallback) : null,
  };
}

export type RunVisionAnalysisArgs = {
  /** base64 image data (NO data: prefix) */
  imageBase64: string;
  manifest: ElementManifest[];
  /** Used to resolve styleguide arg and as default search root */
  projectPath: string;
  /** Path to style guide file OR directory; if omitted uses upward search */
  styleguide?: string;
  /** Directory for upward styleguide search; defaults to projectPath */
  styleguideStartDir?: string;
  /**
   * Override resolved styleguide content (lets callers do logging/notes based on resolution once).
   * If provided (even null), styleguide resolution is skipped.
   */
  styleGuide?: string | null;
  /**
   * Override resolved styleguide location (pairs with styleGuide override).
   * If provided, this is returned in the result.
   */
  styleguideLocation?: string | null;
  /** Ollama base URL (default: http://localhost:11434) */
  baseUrl?: string;
  /** Vision model override (default: UILINT_DEFAULT_VISION_MODEL) */
  model?: string;
  /**
   * Optional analyzer instance (lets servers reuse a singleton and lets tests inject a mock).
   * If omitted, a new `VisionAnalyzer` is created with baseUrl+model.
   */
  analyzer?: Pick<VisionAnalyzer, "analyzeScreenshot">;
  /** Optional streaming progress callback passed into the analyzer */
  onProgress?: StreamProgressCallback;
  /** Optional coarse-grained phase callback (good for spinners / WS progress) */
  onPhase?: (phase: string) => void;
  /** When true, skip calling `ensureOllamaReady` (caller is responsible). */
  skipEnsureOllama?: boolean;
  /** Optional debug dump destination (file path or directory) */
  debugDump?: string;
  /** When true, include base64 image and full styleguide in debug dump */
  debugDumpIncludeSensitive?: boolean;
  /** Optional extra metadata to include in debug dumps */
  debugDumpMetadata?: Record<string, unknown>;
};

export type RunVisionAnalysisResult = {
  issues: VisionIssue[];
  analysisTime: number;
  prompt?: string;
  rawResponse?: string;
  styleguideLocation: string | null;
  visionModel: string;
  baseUrl: string;
};

const ollamaReadyOnce = new Map<string, Promise<void>>();

async function ensureOllamaReadyCached(params: {
  model: string;
  baseUrl: string;
}): Promise<void> {
  const key = `${params.baseUrl}::${params.model}`;
  const existing = ollamaReadyOnce.get(key);
  if (existing) return existing;

  const p = ensureOllamaReady({ model: params.model, baseUrl: params.baseUrl })
    .then(() => undefined)
    .catch((e) => {
      // If startup/pull fails, allow retry on next request.
      ollamaReadyOnce.delete(key);
      throw e;
    });
  ollamaReadyOnce.set(key, p);
  return p;
}

function writeVisionDebugDump(params: {
  dumpPath: string;
  now: Date;
  inputs: {
    imageBase64: string;
    manifest: ElementManifest[];
    styleguideLocation: string | null;
    styleGuide: string | null;
  };
  runtime: { visionModel: string; baseUrl: string };
  includeSensitive: boolean;
  metadata?: Record<string, unknown>;
}): string {
  const resolvedDirOrFile = resolvePathSpecifier(
    params.dumpPath,
    process.cwd()
  );
  const safeStamp = params.now.toISOString().replace(/[:.]/g, "-");
  const dumpFile =
    resolvedDirOrFile.endsWith(".json") || resolvedDirOrFile.endsWith(".jsonl")
      ? resolvedDirOrFile
      : `${resolvedDirOrFile}/vision-debug-${safeStamp}.json`;

  mkdirSync(dirname(dumpFile), { recursive: true });
  writeFileSync(
    dumpFile,
    JSON.stringify(
      {
        version: 1,
        timestamp: params.now.toISOString(),
        runtime: params.runtime,
        metadata: params.metadata ?? null,
        inputs: {
          imageBase64: params.includeSensitive
            ? params.inputs.imageBase64
            : "(omitted; set debugDumpIncludeSensitive=true)",
          manifest: params.inputs.manifest,
          styleguideLocation: params.inputs.styleguideLocation,
          styleGuide: params.includeSensitive
            ? params.inputs.styleGuide
            : "(omitted; set debugDumpIncludeSensitive=true)",
        },
      },
      null,
      2
    ),
    "utf-8"
  );

  return dumpFile;
}

export async function runVisionAnalysis(
  args: RunVisionAnalysisArgs
): Promise<RunVisionAnalysisResult> {
  const visionModel = args.model || UILINT_DEFAULT_VISION_MODEL;
  const baseUrl = args.baseUrl ?? "http://localhost:11434";

  let styleGuide: string | null = null;
  let styleguideLocation: string | null = null;

  if (args.styleGuide !== undefined) {
    styleGuide = args.styleGuide;
    styleguideLocation = args.styleguideLocation ?? null;
  } else {
    args.onPhase?.("Resolving styleguide...");
    const resolved = await resolveVisionStyleGuide({
      projectPath: args.projectPath,
      styleguide: args.styleguide,
      startDir: args.styleguideStartDir,
    });
    styleGuide = resolved.styleGuide;
    styleguideLocation = resolved.styleguideLocation;
  }

  if (!args.skipEnsureOllama) {
    args.onPhase?.("Preparing Ollama...");
    await ensureOllamaReadyCached({ model: visionModel, baseUrl });
  }

  if (args.debugDump) {
    writeVisionDebugDump({
      dumpPath: args.debugDump,
      now: new Date(),
      runtime: { visionModel, baseUrl },
      inputs: {
        imageBase64: args.imageBase64,
        manifest: args.manifest,
        styleguideLocation,
        styleGuide,
      },
      includeSensitive: Boolean(args.debugDumpIncludeSensitive),
      metadata: args.debugDumpMetadata,
    });
  }

  const analyzer =
    args.analyzer ??
    new VisionAnalyzer({
      baseUrl: args.baseUrl,
      visionModel,
    });

  args.onPhase?.(`Analyzing ${args.manifest.length} elements...`);
  const result: VisionAnalysisResult = await analyzer.analyzeScreenshot(
    args.imageBase64,
    args.manifest,
    {
      styleGuide,
      onProgress: args.onProgress,
    }
  );

  args.onPhase?.(
    `Done (${result.issues.length} issues, ${result.analysisTime}ms)`
  );

  return {
    issues: result.issues,
    analysisTime: result.analysisTime,
    // Prompt is available in newer uilint-core versions; keep this resilient across versions.
    prompt: (result as any).prompt,
    rawResponse: result.rawResponse,
    styleguideLocation,
    visionModel,
    baseUrl,
  };
}

export type WriteVisionMarkdownReportArgs = {
  /** Absolute path to the source image file */
  imagePath: string;
  /** Route label (optional; included in report) */
  route?: string;
  /** Unix ms timestamp (optional; included in report) */
  timestamp?: number;
  visionModel?: string;
  baseUrl?: string;
  analysisTimeMs?: number;
  prompt?: string | null;
  rawResponse?: string | null;
  /** Extra JSON-ish metadata to include */
  metadata?: Record<string, unknown>;
  /**
   * Optional output path; if omitted, writes alongside the image:
   * `<basename>.vision.md`
   */
  outPath?: string;
};

export function writeVisionMarkdownReport(
  args: WriteVisionMarkdownReportArgs
): {
  outPath: string;
  content: string;
} {
  const p = parse(args.imagePath);
  const outPath = args.outPath ?? join(p.dir, `${p.name || p.base}.vision.md`);

  const lines: string[] = [];
  lines.push(`# UILint Vision Report`);
  lines.push(``);
  lines.push(`- Image: \`${p.base}\``);
  if (args.route) lines.push(`- Route: \`${args.route}\``);
  if (typeof args.timestamp === "number") {
    lines.push(`- Timestamp: \`${new Date(args.timestamp).toISOString()}\``);
  }
  if (args.visionModel) lines.push(`- Model: \`${args.visionModel}\``);
  if (args.baseUrl) lines.push(`- Ollama baseUrl: \`${args.baseUrl}\``);
  if (typeof args.analysisTimeMs === "number")
    lines.push(`- Analysis time: \`${args.analysisTimeMs}ms\``);
  lines.push(`- Generated: \`${new Date().toISOString()}\``);
  lines.push(``);

  if (args.metadata && Object.keys(args.metadata).length > 0) {
    lines.push(`## Metadata`);
    lines.push(``);
    lines.push("```json");
    lines.push(JSON.stringify(args.metadata, null, 2));
    lines.push("```");
    lines.push(``);
  }

  lines.push(`## Prompt`);
  lines.push(``);
  lines.push("```text");
  lines.push((args.prompt ?? "").trim());
  lines.push("```");
  lines.push(``);

  lines.push(`## Raw Response`);
  lines.push(``);
  lines.push("```text");
  lines.push((args.rawResponse ?? "").trim());
  lines.push("```");
  lines.push(``);

  const content = lines.join("\n");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, content, "utf-8");
  return { outPath, content };
}
