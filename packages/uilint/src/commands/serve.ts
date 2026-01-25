/**
 * UILint WebSocket Server
 *
 * Provides real-time lint results for the UI overlay.
 *
 * Protocol:
 * - Client -> Server: { type: 'lint:file', filePath: string, requestId?: string }
 * - Client -> Server: { type: 'lint:element', filePath: string, dataLoc: string, requestId?: string }
 * - Client -> Server: { type: 'subscribe:file', filePath: string }
 * - Client -> Server: { type: 'cache:invalidate', filePath?: string }
 * - Client -> Server: { type: 'vision:analyze', route: string, timestamp: number, screenshot?: string, screenshotFile?: string, manifest: ElementManifest[], requestId?: string }
 * - Client -> Server: { type: 'vision:check', requestId?: string }
 * - Client -> Server: { type: 'config:set', key: string, value: any }
 * - Client -> Server: { type: 'rule:config:set', ruleId: string, severity: 'error'|'warn'|'off', options?: object, requestId?: string }
 * - Server -> Client: { type: 'lint:result', filePath: string, issues: Issue[], requestId?: string }
 * - Server -> Client: { type: 'lint:progress', filePath: string, phase: string, requestId?: string }
 * - Server -> Client: { type: 'file:changed', filePath: string }
 * - Server -> Client: { type: 'vision:result', route: string, issues: VisionIssue[], analysisTime: number, error?: string, requestId?: string }
 * - Server -> Client: { type: 'vision:progress', route: string, phase: string, requestId?: string }
 * - Server -> Client: { type: 'vision:status', available: boolean, model?: string, requestId?: string }
 * - Server -> Client: { type: 'config:update', key: string, value: any }
 * - Server -> Client: { type: 'rule:config:result', ruleId: string, severity: string, options?: object, success: boolean, error?: string, requestId?: string }
 * - Server -> Client: { type: 'rule:config:changed', ruleId: string, severity: string, options?: object }
 * - Server -> Client: { type: 'duplicates:indexing:start' }
 * - Server -> Client: { type: 'duplicates:indexing:progress', message: string, current?: number, total?: number }
 * - Server -> Client: { type: 'duplicates:indexing:complete', added: number, modified: number, deleted: number, totalChunks: number, duration: number }
 * - Server -> Client: { type: 'duplicates:indexing:error', error: string }
 * - Server -> Client: { type: 'coverage:setup:start' }
 * - Server -> Client: { type: 'coverage:setup:progress', message: string, phase: string }
 * - Server -> Client: { type: 'coverage:setup:complete', packageAdded: boolean, configModified: boolean, testsRan: boolean, coverageGenerated: boolean, duration: number, error?: string }
 * - Server -> Client: { type: 'coverage:setup:error', error: string }
 * - Client -> Server: { type: 'coverage:request', requestId?: string }
 * - Server -> Client: { type: 'coverage:result', coverage: object, timestamp: number, requestId?: string }
 * - Server -> Client: { type: 'coverage:error', error: string, requestId?: string }
 * - Client -> Server: { type: 'source:fetch', filePath: string, requestId?: string }
 * - Server -> Client: { type: 'source:result', filePath: string, content: string, totalLines: number, relativePath: string, requestId?: string }
 * - Server -> Client: { type: 'source:error', filePath: string, error: string, requestId?: string }
 * - Client -> Server: { type: 'screenshot:save', dataUrl: string, route: string, timestamp: number, requestId?: string }
 * - Server -> Client: { type: 'screenshot:saved', filename: string, path: string, requestId?: string }
 * - Server -> Client: { type: 'screenshot:error', error: string, requestId?: string }
 */

import { existsSync, statSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { createRequire } from "module";
import { dirname, resolve, relative, join, parse } from "path";
import { WebSocketServer, WebSocket } from "ws";
import { watch, type FSWatcher } from "chokidar";
import {
  findWorkspaceRoot,
  getVisionAnalyzer as getCoreVisionAnalyzer,
} from "uilint-core/node";
import {
  detectNextAppRouter,
  findNextAppRouterProjects,
} from "../utils/next-detect.js";
import {
  runVisionAnalysis,
  writeVisionMarkdownReport,
} from "../utils/vision-run.js";
import {
  logInfo,
  logSuccess,
  logWarning,
  logError,
  pc,
} from "../utils/prompts.js";
import { ruleRegistry, type RuleOptionSchema } from "uilint-eslint";
import {
  findEslintConfigFile,
  updateRuleSeverityInConfig,
  updateRuleConfigInConfig,
  readRuleConfigsFromConfig,
} from "../utils/eslint-config-inject.js";
import { detectCoverageSetup } from "../utils/coverage-detect.js";
import {
  prepareCoverage,
  needsCoveragePreparation,
} from "../utils/coverage-prepare.js";

export interface ServeOptions {
  port?: number;
}

export interface LintIssue {
  line: number;
  column?: number;
  message: string;
  ruleId?: string;
  dataLoc?: string;
}

// Message types
interface LintFileMessage {
  type: "lint:file";
  filePath: string;
  requestId?: string;
}

interface LintElementMessage {
  type: "lint:element";
  filePath: string;
  dataLoc: string;
  requestId?: string;
}

interface SubscribeFileMessage {
  type: "subscribe:file";
  filePath: string;
}

interface CacheInvalidateMessage {
  type: "cache:invalidate";
  filePath?: string;
}

interface VisionAnalyzeMessage {
  type: "vision:analyze";
  route: string;
  timestamp: number;
  screenshot?: string;
  /** Screenshot filename persisted under `.uilint/screenshots/` (e.g. uilint-...png) */
  screenshotFile?: string;
  manifest: ElementManifest[];
  requestId?: string;
}

interface VisionCheckMessage {
  type: "vision:check";
  requestId?: string;
}

interface ConfigSetMessage {
  type: "config:set";
  key: string;
  value: unknown;
}

interface RuleConfigSetMessage {
  type: "rule:config:set";
  ruleId: string;
  severity: "error" | "warn" | "off";
  options?: Record<string, unknown>;
  requestId?: string;
}

interface SourceFetchMessage {
  type: "source:fetch";
  filePath: string;
  requestId?: string;
}

interface ScreenshotSaveMessage {
  type: "screenshot:save";
  dataUrl: string;
  route: string;
  timestamp: number;
  requestId?: string;
}

type ClientMessage =
  | LintFileMessage
  | LintElementMessage
  | SubscribeFileMessage
  | CacheInvalidateMessage
  | VisionAnalyzeMessage
  | VisionCheckMessage
  | ConfigSetMessage
  | RuleConfigSetMessage
  | CoverageRequestMessage
  | SourceFetchMessage
  | ScreenshotSaveMessage;

interface LintResultMessage {
  type: "lint:result";
  filePath: string;
  issues: LintIssue[];
  requestId?: string;
}

interface LintProgressMessage {
  type: "lint:progress";
  filePath: string;
  phase: string;
  requestId?: string;
}

interface FileChangedMessage {
  type: "file:changed";
  filePath: string;
}

interface WorkspaceInfoMessage {
  type: "workspace:info";
  /**
   * Absolute path to the Next.js app project root (dir containing app/ or src/app/).
   * This is the base dir we should use to resolve `data-loc` relative file paths.
   */
  appRoot: string;
  workspaceRoot: string;
  serverCwd: string;
}

interface VisionResultMessage {
  type: "vision:result";
  route: string;
  issues: VisionIssue[];
  analysisTime: number;
  error?: string;
  requestId?: string;
}

interface VisionProgressMessage {
  type: "vision:progress";
  route: string;
  phase: string;
  requestId?: string;
}

interface VisionStatusMessage {
  type: "vision:status";
  available: boolean;
  model?: string;
  requestId?: string;
}

interface RulesMetadataMessage {
  type: "rules:metadata";
  rules: Array<{
    id: string;
    name: string;
    description: string;
    category: "static" | "semantic";
    defaultSeverity: "error" | "warn" | "off";
    /** Current severity from ESLint config (may differ from default) */
    currentSeverity?: "error" | "warn" | "off";
    /** Current options from ESLint config */
    currentOptions?: Record<string, unknown>;
    docs?: string;
    optionSchema?: RuleOptionSchema;
    defaultOptions?: unknown[];
  }>;
}

interface ConfigUpdateMessage {
  type: "config:update";
  key: string;
  value: unknown;
}

interface RuleConfigResultMessage {
  type: "rule:config:result";
  ruleId: string;
  severity: "error" | "warn" | "off";
  options?: Record<string, unknown>;
  success: boolean;
  error?: string;
  requestId?: string;
}

interface RuleConfigChangedMessage {
  type: "rule:config:changed";
  ruleId: string;
  severity: "error" | "warn" | "off";
  options?: Record<string, unknown>;
}

// Duplicates indexing messages
interface DuplicatesIndexingStartMessage {
  type: "duplicates:indexing:start";
}

interface DuplicatesIndexingProgressMessage {
  type: "duplicates:indexing:progress";
  message: string;
  current?: number;
  total?: number;
}

interface DuplicatesIndexingCompleteMessage {
  type: "duplicates:indexing:complete";
  added: number;
  modified: number;
  deleted: number;
  totalChunks: number;
  duration: number;
}

interface DuplicatesIndexingErrorMessage {
  type: "duplicates:indexing:error";
  error: string;
}

// Coverage heatmap messages
interface CoverageRequestMessage {
  type: "coverage:request";
  requestId?: string;
}

interface CoverageResultMessage {
  type: "coverage:result";
  coverage: Record<string, unknown>;
  timestamp: number;
  requestId?: string;
}

interface CoverageErrorMessage {
  type: "coverage:error";
  error: string;
  requestId?: string;
}

// Coverage setup messages (existing)
interface CoverageSetupStartMessage {
  type: "coverage:setup:start";
}

interface CoverageSetupProgressMessage {
  type: "coverage:setup:progress";
  message: string;
  phase: string;
}

interface CoverageSetupCompleteMessage {
  type: "coverage:setup:complete";
  packageAdded: boolean;
  configModified: boolean;
  testsRan: boolean;
  coverageGenerated: boolean;
  duration: number;
  error?: string;
}

interface CoverageSetupErrorMessage {
  type: "coverage:setup:error";
  error: string;
}

interface SourceResultMessage {
  type: "source:result";
  filePath: string;
  content: string;
  totalLines: number;
  relativePath: string;
  requestId?: string;
}

interface SourceErrorMessage {
  type: "source:error";
  filePath: string;
  error: string;
  requestId?: string;
}

interface ScreenshotSavedMessage {
  type: "screenshot:saved";
  filename: string;
  path: string;
  requestId?: string;
}

interface ScreenshotErrorMessage {
  type: "screenshot:error";
  error: string;
  requestId?: string;
}

type ServerMessage =
  | LintResultMessage
  | LintProgressMessage
  | FileChangedMessage
  | WorkspaceInfoMessage
  | VisionResultMessage
  | VisionProgressMessage
  | VisionStatusMessage
  | RulesMetadataMessage
  | ConfigUpdateMessage
  | RuleConfigResultMessage
  | RuleConfigChangedMessage
  | DuplicatesIndexingStartMessage
  | DuplicatesIndexingProgressMessage
  | DuplicatesIndexingCompleteMessage
  | DuplicatesIndexingErrorMessage
  | CoverageResultMessage
  | CoverageErrorMessage
  | CoverageSetupStartMessage
  | CoverageSetupProgressMessage
  | CoverageSetupCompleteMessage
  | CoverageSetupErrorMessage
  | SourceResultMessage
  | SourceErrorMessage
  | ScreenshotSavedMessage
  | ScreenshotErrorMessage;

function pickAppRoot(params: { cwd: string; workspaceRoot: string }): string {
  const { cwd, workspaceRoot } = params;

  // If started from a Next.js app root (app/ or src/app/ exists), use cwd.
  if (detectNextAppRouter(cwd)) return cwd;

  // Otherwise, try to discover Next apps from the workspace root.
  const matches = findNextAppRouterProjects(workspaceRoot, { maxDepth: 5 });
  if (matches.length === 0) return cwd;
  if (matches.length === 1) return matches[0]!.projectPath;

  // Prefer a project that contains the current cwd (common in monorepos).
  const containing = matches.find(
    (m) => cwd === m.projectPath || cwd.startsWith(m.projectPath + "/")
  );
  if (containing) return containing.projectPath;

  // Fallback: pick the first match deterministically.
  return matches[0]!.projectPath;
}

// Simple in-memory cache
interface CacheEntry {
  issues: LintIssue[];
  mtimeMs: number;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

// ESLint instances cached per detected project root
const eslintInstances = new Map<string, unknown>();

// Vision analyzer instance (lazy loaded)
type VisionIssue = {
  elementText: string;
  dataLoc?: string;
  message: string;
  category: string;
  severity: string;
  suggestion?: string;
};

type ElementManifest = {
  id: string;
  text: string;
  dataLoc: string;
  rect: { x: number; y: number; width: number; height: number };
  tagName: string;
  role?: string;
  instanceCount?: number;
};

let visionAnalyzer: ReturnType<typeof getCoreVisionAnalyzer> | null = null;

function getVisionAnalyzerInstance(): ReturnType<typeof getCoreVisionAnalyzer> {
  if (!visionAnalyzer) {
    visionAnalyzer = getCoreVisionAnalyzer();
  }
  return visionAnalyzer;
}

// Default styleguide search root for vision analysis (set when `serve()` starts)
let serverAppRootForVision = process.cwd();

function isValidScreenshotFilename(filename: string): boolean {
  // Only allow alphanumeric, hyphens, underscores, and dots; must end with a safe image extension.
  const validPattern = /^[a-zA-Z0-9_-]+\.(png|jpeg|jpg)$/;
  return validPattern.test(filename) && !filename.includes("..");
}

// Cache resolved paths for incoming filePath strings
const resolvedPathCache = new Map<string, string>();

// File subscriptions: absolutePath -> Set of clients (and the original client filePath string)
const subscriptions = new Map<
  string,
  Set<{ ws: WebSocket; clientFilePath: string }>
>();

// File watcher
let fileWatcher: FSWatcher | null = null;

// Basic client tracking for CLI feedback
let connectedClients = 0;

// Local require (from uilint deps) for TSX parsing
const localRequire = createRequire(import.meta.url);

type JsxElementSpan = {
  start: number;
  end: number;
  dataLoc: string;
};

function buildLineStarts(code: string): number[] {
  const starts: number[] = [0];
  for (let i = 0; i < code.length; i++) {
    if (code.charCodeAt(i) === 10) starts.push(i + 1); // \n
  }
  return starts;
}

function offsetFromLineCol(
  lineStarts: number[],
  line1: number,
  col0: number,
  codeLength: number
): number {
  const lineIndex = Math.max(0, Math.min(lineStarts.length - 1, line1 - 1));
  const base = lineStarts[lineIndex] ?? 0;
  return Math.max(0, Math.min(codeLength, base + Math.max(0, col0)));
}

function buildJsxElementSpans(
  code: string,
  dataLocFile: string
): JsxElementSpan[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { parse } = localRequire("@typescript-eslint/typescript-estree") as {
    parse: (src: string, options: Record<string, unknown>) => any;
  };

  const ast = parse(code, {
    loc: true,
    range: true,
    jsx: true,
    comment: false,
    errorOnUnknownASTType: false,
  });

  const spans: JsxElementSpan[] = [];

  function walk(node: any): void {
    if (!node || typeof node !== "object") return;

    // Prefer mapping to JSXElement range so we can capture nested ownership precisely.
    if (node.type === "JSXElement") {
      const range = node.range as [number, number] | undefined;
      const opening = node.openingElement;
      const loc = opening?.loc?.start;
      if (
        range &&
        typeof range[0] === "number" &&
        typeof range[1] === "number" &&
        loc &&
        typeof loc.line === "number" &&
        typeof loc.column === "number"
      ) {
        const dataLoc = `${dataLocFile}:${loc.line}:${loc.column}`;
        spans.push({ start: range[0], end: range[1], dataLoc });
      }
    }

    for (const key of Object.keys(node)) {
      const child = (node as any)[key];
      if (Array.isArray(child)) {
        for (const item of child) walk(item);
      } else if (child && typeof child === "object") {
        walk(child);
      }
    }
  }

  walk(ast);

  // Keep spans small-first to make “smallest containing span” selection fast.
  spans.sort((a, b) => a.end - a.start - (b.end - b.start));
  return spans;
}

function mapMessageToDataLoc(params: {
  spans: JsxElementSpan[];
  lineStarts: number[];
  codeLength: number;
  messageLine1: number;
  messageCol1?: number;
}): string | undefined {
  const col0 =
    typeof params.messageCol1 === "number"
      ? Math.max(0, params.messageCol1 - 1)
      : 0;
  const offset = offsetFromLineCol(
    params.lineStarts,
    params.messageLine1,
    col0,
    params.codeLength
  );

  // Pick the smallest JSXElement range that contains this offset.
  for (const s of params.spans) {
    if (s.start <= offset && offset < s.end) return s.dataLoc;
  }
  return undefined;
}

/**
 * Known ESLint config filenames (flat + legacy).
 */
const ESLINT_CONFIG_FILES = [
  // Flat config (ESLint v9+)
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  // Legacy config
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yaml",
  ".eslintrc.yml",
];

/**
 * Find a project root directory for ESLint by walking upward from a file dir.
 */
function findESLintCwd(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 30; i++) {
    for (const cfg of ESLINT_CONFIG_FILES) {
      if (existsSync(join(dir, cfg))) return dir;
    }
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

function normalizePathSlashes(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Match `jsx-loc-plugin` behavior:
 * - Use a stable, project-relative path when possible, otherwise absolute.
 */
function normalizeDataLocFilePath(
  absoluteFilePath: string,
  projectCwd: string
): string {
  const abs = normalizePathSlashes(resolve(absoluteFilePath));
  const cwd = normalizePathSlashes(resolve(projectCwd));
  if (abs === cwd || abs.startsWith(cwd + "/")) {
    return normalizePathSlashes(relative(cwd, abs));
  }
  return abs;
}

function resolveRequestedFilePath(filePath: string): string {
  // Absolute (POSIX) or Windows drive path
  if (filePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(filePath)) {
    return resolve(filePath);
  }

  const cached = resolvedPathCache.get(filePath);
  if (cached) return cached;

  const cwd = process.cwd();
  const fromCwd = resolve(cwd, filePath);
  if (existsSync(fromCwd)) {
    resolvedPathCache.set(filePath, fromCwd);
    return fromCwd;
  }

  const wsRoot = findWorkspaceRoot(cwd);
  const fromWs = resolve(wsRoot, filePath);
  if (existsSync(fromWs)) {
    resolvedPathCache.set(filePath, fromWs);
    return fromWs;
  }

  // Monorepo helper: try common workspace folders (apps/*, packages/*)
  // Example: filePath="app/page.tsx" -> apps/test-app/app/page.tsx
  for (const top of ["apps", "packages"]) {
    const base = join(wsRoot, top);
    if (!existsSync(base)) continue;
    try {
      const entries = readdirSync(base, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const p = resolve(base, ent.name, filePath);
        if (existsSync(p)) {
          resolvedPathCache.set(filePath, p);
          return p;
        }
      }
    } catch {
      // ignore
    }
  }

  // Cache deterministic fallback so repeated requests don't thrash
  resolvedPathCache.set(filePath, fromCwd);
  return fromCwd;
}

async function getESLintForProject(projectCwd: string): Promise<any | null> {
  const cached = eslintInstances.get(projectCwd);
  if (cached) return cached as any;

  try {
    const req = createRequire(join(projectCwd, "package.json"));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = req("eslint");
    const ESLintCtor =
      mod?.ESLint ?? mod?.default?.ESLint ?? mod?.default ?? mod;
    if (!ESLintCtor) return null;

    const eslint = new ESLintCtor({ cwd: projectCwd });
    eslintInstances.set(projectCwd, eslint);
    return eslint;
  } catch {
    return null;
  }
}

/**
 * Lint a file and return issues
 */
async function lintFile(
  filePath: string,
  onProgress: (phase: string) => void
): Promise<LintIssue[]> {
  const absolutePath = resolveRequestedFilePath(filePath);

  // Check if file exists
  if (!existsSync(absolutePath)) {
    onProgress(`File not found: ${pc.dim(absolutePath)}`);
    return [];
  }

  const mtimeMs = (() => {
    try {
      return statSync(absolutePath).mtimeMs;
    } catch {
      return 0;
    }
  })();

  // Check cache (mtime-based)
  const cached = cache.get(absolutePath);
  if (cached && cached.mtimeMs === mtimeMs) {
    onProgress("Cache hit (unchanged)");
    return cached.issues;
  }

  const fileDir = dirname(absolutePath);
  const projectCwd = findESLintCwd(fileDir);

  onProgress(`Resolving ESLint project... ${pc.dim(projectCwd)}`);

  const eslint = await getESLintForProject(projectCwd);
  if (!eslint) {
    logWarning(
      `ESLint not found in project. Install it in ${pc.dim(
        projectCwd
      )} to enable server-side linting.`
    );
    onProgress("ESLint not available (install eslint in this project)");
    return [];
  }

  try {
    onProgress("Running ESLint...");
    const results = await eslint.lintFiles([absolutePath]);
    const messages =
      Array.isArray(results) && results.length > 0
        ? results[0].messages || []
        : [];

    const dataLocFile = normalizeDataLocFilePath(absolutePath, projectCwd);
    let spans: JsxElementSpan[] = [];
    let lineStarts: number[] = [];
    let codeLength = 0;

    try {
      onProgress("Building JSX map...");
      const code = readFileSync(absolutePath, "utf-8");
      codeLength = code.length;
      lineStarts = buildLineStarts(code);
      spans = buildJsxElementSpans(code, dataLocFile);
      onProgress(`JSX map: ${spans.length} element(s)`);
    } catch (e) {
      // If parsing fails, we still return ESLint messages (unmapped).
      onProgress("JSX map failed (falling back to unmapped issues)");
      console.error("[uilint-serve] JSX map failed:", e);
      spans = [];
      lineStarts = [];
      codeLength = 0;
    }

    const issues: LintIssue[] = messages
      .filter((m: any) => typeof m?.message === "string")
      .map((m: any) => {
        const line = typeof m.line === "number" ? m.line : 1;
        const column = typeof m.column === "number" ? m.column : undefined;
        const mappedDataLoc =
          spans.length > 0 && lineStarts.length > 0 && codeLength > 0
            ? mapMessageToDataLoc({
                spans,
                lineStarts,
                codeLength,
                messageLine1: line,
                messageCol1: column,
              })
            : undefined;
        return {
          line,
          column,
          message: m.message,
          ruleId: typeof m.ruleId === "string" ? m.ruleId : undefined,
          dataLoc: mappedDataLoc,
        } satisfies LintIssue;
      });

    const mappedCount = issues.filter((i) => Boolean(i.dataLoc)).length;
    if (issues.length > 0) {
      onProgress(
        `Mapped ${mappedCount}/${issues.length} issue(s) to JSX elements`
      );
    }

    cache.set(absolutePath, { issues, mtimeMs, timestamp: Date.now() });
    return issues;
  } catch (error) {
    console.error("[uilint-serve] ESLint failed:", error);
    return [];
  }
}

/**
 * Send message to client
 */
function sendMessage(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Handle incoming client message
 */
async function handleMessage(ws: WebSocket, data: string): Promise<void> {
  let message: ClientMessage;
  try {
    message = JSON.parse(data) as ClientMessage;
  } catch {
    return;
  }

  // Server-side tracing to confirm activity
  if (message.type === "lint:file" || message.type === "lint:element") {
    const fp = (message as any).filePath as string | undefined;
    const rid = (message as any).requestId as string | undefined;
    logInfo(
      `${pc.dim("[ws]")} ${pc.bold(message.type)} ${pc.dim(fp ?? "")}${
        rid ? ` ${pc.dim(`(req ${rid})`)}` : ""
      }`
    );
  } else if (message.type === "subscribe:file") {
    logInfo(`${pc.dim("[ws]")} subscribe:file ${pc.dim(message.filePath)}`);
  } else if (message.type === "cache:invalidate") {
    logInfo(
      `${pc.dim("[ws]")} cache:invalidate ${pc.dim(
        message.filePath ?? "(all)"
      )}`
    );
  } else if (message.type === "vision:analyze") {
    // Logged in handler for more detailed output
  } else if (message.type === "vision:check") {
    // Logged in handler
  } else if (message.type === "config:set") {
    // Logged in handler
  } else if (message.type === "screenshot:save") {
    const rid = (message as ScreenshotSaveMessage).requestId;
    logInfo(
      `${pc.dim("[ws]")} ${pc.bold("screenshot:save")} ${pc.dim(message.route)}${
        rid ? ` ${pc.dim(`(req ${rid})`)}` : ""
      }`
    );
  }

  switch (message.type) {
    case "lint:file": {
      const { filePath, requestId } = message;
      sendMessage(ws, {
        type: "lint:progress",
        filePath,
        requestId,
        phase: "Starting...",
      });

      const startedAt = Date.now();
      const resolved = resolveRequestedFilePath(filePath);
      if (!existsSync(resolved)) {
        const cwd = process.cwd();
        const wsRoot = findWorkspaceRoot(cwd);
        logWarning(
          [
            `${pc.dim("[ws]")} File not found for request`,
            `  filePath: ${pc.dim(filePath)}`,
            `  resolved: ${pc.dim(resolved)}`,
            `  cwd:      ${pc.dim(cwd)}`,
            `  wsRoot:   ${pc.dim(wsRoot)}`,
            `  hint: In monorepos, ensure paths like ${pc.dim(
              "app/page.tsx"
            )} exist under ${pc.dim("apps/*/")} or use absolute paths.`,
          ].join("\n")
        );
      }

      const issues = await lintFile(filePath, (phase) => {
        sendMessage(ws, { type: "lint:progress", filePath, requestId, phase });
      });

      const elapsed = Date.now() - startedAt;
      logInfo(
        `${pc.dim("[ws]")} lint:file done ${pc.dim(filePath)} → ${pc.bold(
          `${issues.length}`
        )} issue(s) ${pc.dim(`(${elapsed}ms)`)}`
      );

      sendMessage(ws, {
        type: "lint:progress",
        filePath,
        requestId,
        phase: `Done (${issues.length} issues, ${elapsed}ms)`,
      });
      sendMessage(ws, { type: "lint:result", filePath, requestId, issues });
      break;
    }

    case "lint:element": {
      const { filePath, dataLoc, requestId } = message;
      sendMessage(ws, {
        type: "lint:progress",
        filePath,
        requestId,
        phase: "Starting...",
      });

      const startedAt = Date.now();
      const issues = await lintFile(filePath, (phase) => {
        sendMessage(ws, { type: "lint:progress", filePath, requestId, phase });
      });

      // Filter to only issues matching the dataLoc
      const filteredIssues = issues.filter(
        (issue) => issue.dataLoc === dataLoc
      );

      const elapsed = Date.now() - startedAt;
      sendMessage(ws, {
        type: "lint:progress",
        filePath,
        requestId,
        phase: `Done (${filteredIssues.length} issues, ${elapsed}ms)`,
      });
      sendMessage(ws, {
        type: "lint:result",
        filePath,
        requestId,
        issues: filteredIssues,
      });
      break;
    }

    case "subscribe:file": {
      const { filePath } = message;
      const absolutePath = resolveRequestedFilePath(filePath);

      // Add to subscriptions
      let subscribers = subscriptions.get(absolutePath);
      if (!subscribers) {
        subscribers = new Set();
        subscriptions.set(absolutePath, subscribers);

        // Start watching this file
        if (fileWatcher) {
          fileWatcher.add(absolutePath);
        }
      }
      subscribers.add({ ws, clientFilePath: filePath });
      break;
    }

    case "cache:invalidate": {
      const { filePath } = message;
      if (filePath) {
        const absolutePath = resolveRequestedFilePath(filePath);
        cache.delete(absolutePath);
      } else {
        cache.clear();
      }
      break;
    }

    case "vision:analyze": {
      const {
        route,
        timestamp,
        screenshot,
        screenshotFile,
        manifest,
        requestId,
      } = message;
      logInfo(
        `${pc.dim("[ws]")} ${pc.bold("vision:analyze")} ${pc.dim(route)}${
          requestId ? ` ${pc.dim(`(req ${requestId})`)}` : ""
        }`
      );

      sendMessage(ws, {
        type: "vision:progress",
        route,
        requestId,
        phase: "Starting vision analysis...",
      });

      const startedAt = Date.now();
      const analyzer = getVisionAnalyzerInstance();

      try {
        const screenshotBytes =
          typeof screenshot === "string" ? Buffer.byteLength(screenshot) : 0;
        const analyzerModel =
          typeof (analyzer as any).getModel === "function"
            ? ((analyzer as any).getModel() as string)
            : undefined;
        const analyzerBaseUrl =
          typeof (analyzer as any).getBaseUrl === "function"
            ? ((analyzer as any).getBaseUrl() as string)
            : undefined;
        logInfo(
          [
            `${pc.dim("[ws]")} ${pc.dim("vision")} details`,
            `  route:        ${pc.dim(route)}`,
            `  requestId:    ${pc.dim(requestId ?? "(none)")}`,
            `  manifest:     ${pc.dim(String(manifest.length))} element(s)`,
            `  screenshot:   ${pc.dim(
              screenshot ? `${Math.round(screenshotBytes / 1024)}kb` : "none"
            )}`,
            `  screenshotFile: ${pc.dim(screenshotFile ?? "(none)")}`,
            `  ollamaUrl:    ${pc.dim(analyzerBaseUrl ?? "(default)")}`,
            `  visionModel:  ${pc.dim(analyzerModel ?? "(default)")}`,
          ].join("\n")
        );

        if (!screenshot) {
          sendMessage(ws, {
            type: "vision:result",
            route,
            issues: [],
            analysisTime: Date.now() - startedAt,
            error: "No screenshot provided for vision analysis",
            requestId,
          });
          break;
        }

        const result = await runVisionAnalysis({
          imageBase64: screenshot,
          manifest,
          projectPath: serverAppRootForVision,
          // In the overlay/server context, default to upward search from app root.
          baseUrl: analyzerBaseUrl,
          model: analyzerModel,
          analyzer: analyzer as any,
          onPhase: (phase) => {
            sendMessage(ws, {
              type: "vision:progress",
              route,
              requestId,
              phase,
            });
          },
        });

        // Write a markdown report alongside the saved screenshot (best-effort).
        if (typeof screenshotFile === "string" && screenshotFile.length > 0) {
          if (!isValidScreenshotFilename(screenshotFile)) {
            logWarning(
              `Skipping vision report write: invalid screenshotFile ${pc.dim(
                screenshotFile
              )}`
            );
          } else {
            const screenshotsDir = join(
              serverAppRootForVision,
              ".uilint",
              "screenshots"
            );
            const imagePath = join(screenshotsDir, screenshotFile);
            try {
              if (!existsSync(imagePath)) {
                logWarning(
                  `Skipping vision report write: screenshot file not found ${pc.dim(
                    imagePath
                  )}`
                );
              } else {
                const report = writeVisionMarkdownReport({
                  imagePath,
                  route,
                  timestamp,
                  visionModel: result.visionModel,
                  baseUrl: result.baseUrl,
                  analysisTimeMs: result.analysisTime,
                  prompt: result.prompt ?? null,
                  rawResponse: result.rawResponse ?? null,
                  metadata: {
                    screenshotFile: parse(imagePath).base,
                    appRoot: serverAppRootForVision,
                    manifestElements: manifest.length,
                    requestId: requestId ?? null,
                  },
                });
                logInfo(
                  `${pc.dim("[ws]")} wrote vision report ${pc.dim(
                    report.outPath
                  )}`
                );
              }
            } catch (e) {
              logWarning(
                `Failed to write vision report for ${pc.dim(screenshotFile)}: ${
                  e instanceof Error ? e.message : String(e)
                }`
              );
            }
          }
        }

        const elapsed = Date.now() - startedAt;
        logInfo(
          `${pc.dim("[ws]")} vision:analyze done ${pc.dim(route)} → ${pc.bold(
            `${result.issues.length}`
          )} issue(s) ${pc.dim(`(${elapsed}ms)`)}`
        );

        if (result.rawResponse) {
          logInfo(
            `${pc.dim("[ws]")} vision rawResponse ${pc.dim(
              `${result.rawResponse.length} chars`
            )}`
          );
        }

        sendMessage(ws, {
          type: "vision:result",
          route,
          issues: result.issues,
          analysisTime: result.analysisTime,
          requestId,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        logError(
          [
            `Vision analysis failed`,
            `  route:     ${route}`,
            `  requestId: ${requestId ?? "(none)"}`,
            `  error:     ${errorMessage}`,
            stack ? `  stack:\n${stack}` : "",
          ]
            .filter(Boolean)
            .join("\n")
        );

        sendMessage(ws, {
          type: "vision:result",
          route,
          issues: [],
          analysisTime: Date.now() - startedAt,
          error: errorMessage,
          requestId,
        });
      }
      break;
    }

    case "vision:check": {
      const { requestId } = message;
      logInfo(
        `${pc.dim("[ws]")} ${pc.bold("vision:check")}${requestId ? ` ${pc.dim(`(req ${requestId})`)}` : ""}`
      );

      try {
        const analyzer = getVisionAnalyzerInstance();
        const model =
          typeof (analyzer as any).getModel === "function"
            ? (analyzer as any).getModel()
            : undefined;

        sendMessage(ws, {
          type: "vision:status",
          available: true,
          model,
          requestId,
        });
      } catch (error) {
        sendMessage(ws, {
          type: "vision:status",
          available: false,
          requestId,
        });
      }
      break;
    }

    case "config:set": {
      const { key, value } = message;
      handleConfigSet(key, value);
      break;
    }

    case "rule:config:set": {
      const { ruleId, severity, options, requestId } = message;
      handleRuleConfigSet(ws, ruleId, severity, options, requestId);
      break;
    }

    case "source:fetch": {
      const { filePath, requestId } = message;
      const absolutePath = resolveRequestedFilePath(filePath);

      if (!existsSync(absolutePath)) {
        sendMessage(ws, {
          type: "source:error",
          filePath,
          error: "File not found",
          requestId,
        });
        break;
      }

      try {
        const content = readFileSync(absolutePath, "utf-8");
        const totalLines = content.split("\n").length;
        const relativePath = normalizeDataLocFilePath(absolutePath, serverAppRootForVision);

        sendMessage(ws, {
          type: "source:result",
          filePath,
          content,
          totalLines,
          relativePath,
          requestId,
        });
      } catch (error) {
        sendMessage(ws, {
          type: "source:error",
          filePath,
          error: error instanceof Error ? error.message : "Failed to read file",
          requestId,
        });
      }
      break;
    }

    case "coverage:request": {
      const { requestId } = message;
      try {
        const coveragePath = join(serverAppRootForVision, "coverage", "coverage-final.json");

        if (!existsSync(coveragePath)) {
          sendMessage(ws, {
            type: "coverage:error",
            error: "Coverage data not found. Run tests with coverage first (e.g., `vitest run --coverage`)",
            requestId,
          });
          break;
        }

        const coverageData = JSON.parse(readFileSync(coveragePath, "utf-8"));
        logInfo(`${pc.dim("[ws]")} coverage:result ${pc.dim(`${Object.keys(coverageData).length} files`)}`);

        sendMessage(ws, {
          type: "coverage:result",
          coverage: coverageData,
          timestamp: Date.now(),
          requestId,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError(`${pc.dim("[ws]")} coverage:error ${errorMessage}`);
        sendMessage(ws, {
          type: "coverage:error",
          error: errorMessage,
          requestId,
        });
      }
      break;
    }

    case "screenshot:save": {
      const { dataUrl, route, timestamp, requestId } = message;

      try {
        // Validate the dataUrl is a valid base64 PNG data URL
        if (!dataUrl || typeof dataUrl !== "string") {
          sendMessage(ws, {
            type: "screenshot:error",
            error: "Invalid dataUrl: must be a non-empty string",
            requestId,
          });
          break;
        }

        const dataUrlPattern = /^data:image\/png;base64,/;
        if (!dataUrlPattern.test(dataUrl)) {
          sendMessage(ws, {
            type: "screenshot:error",
            error: "Invalid dataUrl: must be a base64 PNG data URL (data:image/png;base64,...)",
            requestId,
          });
          break;
        }

        // Extract base64 data
        const base64Data = dataUrl.replace(dataUrlPattern, "");

        // Sanitize route for filename (replace / with -, remove special chars)
        const sanitizedRoute = route
          .replace(/^\//, "") // Remove leading slash
          .replace(/\//g, "-") // Replace slashes with dashes
          .replace(/[^a-zA-Z0-9_-]/g, "_") // Replace special chars with underscore
          || "root"; // Default to "root" for empty route

        // Generate filename
        const filename = `uilint-${timestamp}-${sanitizedRoute}.png`;

        // Validate generated filename
        if (!isValidScreenshotFilename(filename)) {
          sendMessage(ws, {
            type: "screenshot:error",
            error: `Generated filename is invalid: ${filename}`,
            requestId,
          });
          break;
        }

        // Create screenshots directory if needed
        const screenshotsDir = join(serverAppRootForVision, ".uilint", "screenshots");
        if (!existsSync(screenshotsDir)) {
          mkdirSync(screenshotsDir, { recursive: true });
        }

        // Write the image file
        const imagePath = join(screenshotsDir, filename);
        const imageBuffer = Buffer.from(base64Data, "base64");
        writeFileSync(imagePath, imageBuffer);

        // Write JSON sidecar with metadata
        const sidecarFilename = filename.replace(/\.png$/, ".json");
        const sidecarPath = join(screenshotsDir, sidecarFilename);
        const sidecarData = {
          route,
          timestamp,
          filename,
          savedAt: new Date().toISOString(),
        };
        writeFileSync(sidecarPath, JSON.stringify(sidecarData, null, 2));

        logInfo(
          `${pc.dim("[ws]")} screenshot:saved ${pc.dim(filename)} ${pc.dim(
            `(${Math.round(imageBuffer.length / 1024)}kb)`
          )}`
        );

        // Send success response
        sendMessage(ws, {
          type: "screenshot:saved",
          filename,
          path: imagePath,
          requestId,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError(`${pc.dim("[ws]")} screenshot:error ${errorMessage}`);
        sendMessage(ws, {
          type: "screenshot:error",
          error: errorMessage,
          requestId,
        });
      }
      break;
    }
  }
}

/**
 * Handle client disconnect
 */
function handleDisconnect(ws: WebSocket): void {
  // Remove from all subscriptions
  for (const [filePath, subscribers] of subscriptions.entries()) {
    for (const entry of subscribers) {
      if (entry.ws === ws) {
        subscribers.delete(entry);
      }
    }
    if (subscribers.size === 0) {
      subscriptions.delete(filePath);
      // Stop watching if no subscribers
      if (fileWatcher) {
        fileWatcher.unwatch(filePath);
      }
    }
  }
}

/**
 * Handle file change
 */
function handleFileChange(filePath: string): void {
  const subscribers = subscriptions.get(filePath);
  if (!subscribers || subscribers.size === 0) return;

  // Invalidate cache
  cache.delete(filePath);

  // Notify subscribers
  for (const { ws, clientFilePath } of subscribers) {
    sendMessage(ws, { type: "file:changed", filePath: clientFilePath });
  }
}

/**
 * Handle coverage-final.json file change - broadcast new coverage data to all clients
 */
function handleCoverageFileChange(filePath: string): void {
  try {
    const coverageData = JSON.parse(readFileSync(filePath, "utf-8"));
    logInfo(`${pc.dim("[ws]")} coverage:changed ${pc.dim(`${Object.keys(coverageData).length} files`)}`);

    broadcast({
      type: "coverage:result",
      coverage: coverageData,
      timestamp: Date.now(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError(`${pc.dim("[ws]")} Failed to read coverage data: ${errorMessage}`);
    broadcast({
      type: "coverage:error",
      error: `Failed to read coverage: ${errorMessage}`,
    });
  }
}

// In-memory config store (runtime only, for broadcasting to clients)
const configStore = new Map<string, unknown>();

// Track connected clients for broadcasting
let connectedClientsSet = new Set<WebSocket>();

/**
 * Broadcast config update to all connected clients
 */
function broadcastConfigUpdate(key: string, value: unknown): void {
  const message: ConfigUpdateMessage = { type: "config:update", key, value };
  for (const ws of connectedClientsSet) {
    sendMessage(ws, message);
  }
}

/**
 * Handle config:set message
 */
function handleConfigSet(key: string, value: unknown): void {
  configStore.set(key, value);
  logInfo(`${pc.dim("[ws]")} config:set ${pc.bold(key)} = ${pc.dim(JSON.stringify(value))}`);
  broadcastConfigUpdate(key, value);
}

/**
 * Broadcast rule config change to all connected clients
 */
function broadcastRuleConfigChange(
  ruleId: string,
  severity: "error" | "warn" | "off",
  options?: Record<string, unknown>
): void {
  const message: RuleConfigChangedMessage = {
    type: "rule:config:changed",
    ruleId,
    severity,
    options,
  };
  for (const ws of connectedClientsSet) {
    sendMessage(ws, message);
  }
}

/**
 * Broadcast a message to all connected clients
 */
function broadcast(message: ServerMessage): void {
  for (const ws of connectedClientsSet) {
    sendMessage(ws, message);
  }
}

// Duplicates indexing state
let isIndexing = false;
let reindexTimeout: NodeJS.Timeout | null = null;
const pendingIndexChanges = new Set<string>();

/**
 * Build or update the duplicates index
 * Runs incrementally - very fast if no files changed
 */
async function buildDuplicatesIndex(appRoot: string): Promise<void> {
  if (isIndexing) {
    // Already indexing, skip
    return;
  }

  isIndexing = true;
  logInfo(`${pc.blue("Building duplicates index...")}`);
  broadcast({ type: "duplicates:indexing:start" });

  try {
    const { indexDirectory } = await import("uilint-duplicates");
    const result = await indexDirectory(appRoot, {
      onProgress: (message, current, total) => {
        // Log to console
        if (current !== undefined && total !== undefined) {
          logInfo(`  ${message} (${current}/${total})`);
        } else {
          logInfo(`  ${message}`);
        }
        // Broadcast to connected clients
        broadcast({
          type: "duplicates:indexing:progress",
          message,
          current,
          total,
        });
      },
    });

    logSuccess(
      `${pc.green("Index complete:")} ${result.totalChunks} chunks (${result.added} added, ${result.modified} modified, ${result.deleted} deleted) in ${(result.duration / 1000).toFixed(1)}s`
    );
    broadcast({
      type: "duplicates:indexing:complete",
      added: result.added,
      modified: result.modified,
      deleted: result.deleted,
      totalChunks: result.totalChunks,
      duration: result.duration,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logError(`Index failed: ${msg}`);
    broadcast({ type: "duplicates:indexing:error", error: msg });
  } finally {
    isIndexing = false;
  }
}

/**
 * Schedule a debounced re-index when source files change
 */
function scheduleReindex(appRoot: string, filePath: string): void {
  // Only reindex for source files
  if (!/\.(tsx?|jsx?)$/.test(filePath)) return;

  pendingIndexChanges.add(filePath);

  if (reindexTimeout) clearTimeout(reindexTimeout);
  reindexTimeout = setTimeout(async () => {
    const count = pendingIndexChanges.size;
    pendingIndexChanges.clear();
    logInfo(`${pc.dim(`[index] ${count} file(s) changed, updating index...`)}`);
    await buildDuplicatesIndex(appRoot);
  }, 2000); // 2 second debounce
}

// Coverage preparation state
let isPreparingCoverage = false;

/**
 * Check if require-test-coverage rule is enabled in ESLint config
 */
function isCoverageRuleEnabled(appRoot: string): boolean {
  const eslintConfigPath = findEslintConfigFile(appRoot);
  if (!eslintConfigPath) return false;

  const ruleConfigs = readRuleConfigsFromConfig(eslintConfigPath);
  const coverageConfig = ruleConfigs.get("require-test-coverage");
  if (!coverageConfig) return false;

  // Rule is enabled if severity is not "off"
  return coverageConfig.severity !== "off";
}

/**
 * Prepare coverage data for require-test-coverage rule.
 * Runs only on startup:
 * - Installs @vitest/coverage-v8 if missing
 * - Adds coverage config to vitest.config.ts if missing
 * - Runs tests with coverage to generate coverage-final.json
 */
async function buildCoverageData(appRoot: string): Promise<void> {
  if (isPreparingCoverage) return;

  isPreparingCoverage = true;

  try {
    // Check if coverage rule is enabled
    if (!isCoverageRuleEnabled(appRoot)) {
      logInfo(`${pc.dim("Coverage rule not enabled, skipping preparation")}`);
      return;
    }

    // Detect current setup
    const setup = detectCoverageSetup(appRoot);

    // Check if preparation needed
    if (!needsCoveragePreparation(setup)) {
      logInfo(`${pc.dim("Coverage data is up-to-date")}`);
      return;
    }

    // Run preparation
    logInfo(`${pc.blue("Preparing coverage data...")}`);
    broadcast({ type: "coverage:setup:start" });

    // Check environment variables for skipping
    const skipPackageInstall = process.env.UILINT_SKIP_COVERAGE_INSTALL === "1";
    const skipTests = process.env.UILINT_SKIP_COVERAGE_TESTS === "1";

    const result = await prepareCoverage({
      appRoot,
      skipPackageInstall,
      skipTests,
      onProgress: (message, phase) => {
        logInfo(`  ${message}`);
        broadcast({ type: "coverage:setup:progress", message, phase });
      },
    });

    if (result.error) {
      // Continue with warning on test failures (don't block server startup)
      logWarning(`Coverage preparation completed with errors: ${result.error}`);
    } else {
      const parts = [];
      if (result.packageAdded) parts.push("package installed");
      if (result.configModified) parts.push("config modified");
      if (result.testsRan) parts.push("tests ran");
      if (result.coverageGenerated) parts.push("coverage generated");

      logSuccess(
        `${pc.green("Coverage prepared:")} ${parts.join(", ")} in ${(result.duration / 1000).toFixed(1)}s`
      );
    }

    broadcast({
      type: "coverage:setup:complete",
      ...result,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logError(`Coverage preparation failed: ${msg}`);
    broadcast({ type: "coverage:setup:error", error: msg });
  } finally {
    isPreparingCoverage = false;
  }
}

/**
 * Handle rule:config:set message
 * Updates the ESLint config file and broadcasts the change to all clients
 */
function handleRuleConfigSet(
  ws: WebSocket,
  ruleId: string,
  severity: "error" | "warn" | "off",
  options?: Record<string, unknown>,
  requestId?: string
): void {
  logInfo(
    `${pc.dim("[ws]")} rule:config:set ${pc.bold(ruleId)} -> ${pc.dim(severity)}${
      options ? ` with options` : ""
    }`
  );

  // Find the ESLint config file
  const configPath = findEslintConfigFile(serverAppRootForVision);
  if (!configPath) {
    const error = `No ESLint config file found in ${serverAppRootForVision}`;
    logError(`${pc.dim("[ws]")} ${error}`);
    sendMessage(ws, {
      type: "rule:config:result",
      ruleId,
      severity,
      options,
      success: false,
      error,
      requestId,
    });
    return;
  }

  // Update the config file
  let result;
  if (options && Object.keys(options).length > 0) {
    // Update severity AND options
    result = updateRuleConfigInConfig(configPath, ruleId, severity, options);
  } else {
    // Update severity only
    result = updateRuleSeverityInConfig(configPath, ruleId, severity);
  }

  if (result.success) {
    logSuccess(
      `${pc.dim("[ws]")} Updated ${pc.bold(`uilint/${ruleId}`)} -> ${pc.dim(severity)}`
    );

    // Clear ESLint instance cache to pick up the new config
    eslintInstances.clear();
    cache.clear();

    // Send success response to requesting client
    sendMessage(ws, {
      type: "rule:config:result",
      ruleId,
      severity,
      options,
      success: true,
      requestId,
    });

    // Broadcast change to all connected clients
    broadcastRuleConfigChange(ruleId, severity, options);
  } else {
    logError(`${pc.dim("[ws]")} Failed to update rule: ${result.error}`);
    sendMessage(ws, {
      type: "rule:config:result",
      ruleId,
      severity,
      options,
      success: false,
      error: result.error,
      requestId,
    });
  }
}

/**
 * Start the WebSocket server
 */
export async function serve(options: ServeOptions): Promise<void> {
  const port = options.port || 9234;

  const cwd = process.cwd();
  const wsRoot = findWorkspaceRoot(cwd);
  const appRoot = pickAppRoot({ cwd, workspaceRoot: wsRoot });
  serverAppRootForVision = appRoot;
  logInfo(`Workspace root: ${pc.dim(wsRoot)}`);
  logInfo(`App root:        ${pc.dim(appRoot)}`);
  logInfo(`Server cwd:     ${pc.dim(cwd)}`);

  // Create file watcher
  fileWatcher = watch([], {
    persistent: true,
    ignoreInitial: true,
  });

  fileWatcher.on("change", (path) => {
    const resolvedPath = resolve(path);

    // Check if coverage-final.json changed - broadcast to all clients
    if (resolvedPath.endsWith("coverage-final.json")) {
      handleCoverageFileChange(resolvedPath);
      return;
    }

    handleFileChange(resolvedPath);
    // Also schedule re-indexing for duplicates detection
    scheduleReindex(appRoot, resolvedPath);
  });

  // Watch coverage-final.json for changes
  const coveragePath = join(appRoot, "coverage", "coverage-final.json");
  if (existsSync(coveragePath)) {
    fileWatcher.add(coveragePath);
    logInfo(`Watching coverage: ${pc.dim(coveragePath)}`);
  }

  // Create WebSocket server
  const wss = new WebSocketServer({ port });

  // Start building the duplicates index in the background
  // This runs incrementally - very fast if nothing changed
  buildDuplicatesIndex(appRoot).catch((err) => {
    logError(`Failed to build duplicates index: ${err.message}`);
  });

  // Prepare coverage data for require-test-coverage rule (startup only)
  // This installs packages, modifies config, and runs tests if needed
  buildCoverageData(appRoot).catch((err) => {
    // Don't block server startup on coverage failures
    logWarning(`Failed to prepare coverage: ${err.message}`);
  });

  wss.on("connection", (ws) => {
    connectedClients += 1;
    connectedClientsSet.add(ws);
    logInfo(`Client connected (${connectedClients} total)`);

    // Send workspace info to client on connect
    sendMessage(ws, {
      type: "workspace:info",
      appRoot,
      workspaceRoot: wsRoot,
      serverCwd: cwd,
    });

    // Read current rule configs from ESLint config file
    const eslintConfigPath = findEslintConfigFile(appRoot);
    const currentRuleConfigs = eslintConfigPath
      ? readRuleConfigsFromConfig(eslintConfigPath)
      : new Map<string, { severity: "error" | "warn" | "off"; options?: Record<string, unknown> }>();

    // Send installed rules metadata (only rules that exist in the ESLint config)
    // Include current severities from the ESLint config so UI reflects saved state
    sendMessage(ws, {
      type: "rules:metadata",
      rules: ruleRegistry
        .filter((rule) => currentRuleConfigs.has(rule.id))
        .map((rule) => {
          const currentConfig = currentRuleConfigs.get(rule.id);
          return {
            id: rule.id,
            name: rule.name,
            description: rule.description,
            category: rule.category,
            defaultSeverity: rule.defaultSeverity,
            currentSeverity: currentConfig?.severity,
            currentOptions: currentConfig?.options,
            docs: rule.docs,
            optionSchema: rule.optionSchema,
            defaultOptions: rule.defaultOptions,
          };
        }),
    });

    // Send current config state to new client
    for (const [key, value] of configStore) {
      sendMessage(ws, { type: "config:update", key, value });
    }

    ws.on("message", (data) => {
      handleMessage(ws, data.toString());
    });

    ws.on("close", () => {
      connectedClients = Math.max(0, connectedClients - 1);
      connectedClientsSet.delete(ws);
      logInfo(`Client disconnected (${connectedClients} total)`);
      handleDisconnect(ws);
    });

    ws.on("error", (error) => {
      logError(`WebSocket error: ${error.message}`);
    });
  });

  wss.on("error", (error) => {
    logError(`Server error: ${error.message}`);
  });

  logSuccess(
    `UILint WebSocket server running on ${pc.cyan(`ws://localhost:${port}`)}`
  );
  logInfo("Press Ctrl+C to stop");

  // Keep the server running
  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      logInfo("Shutting down...");
      wss.close();
      fileWatcher?.close();
      resolve();
    });
  });
}
