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
 * - Client -> Server: { type: 'config:set', key: string, value: any }
 * - Client -> Server: { type: 'rule:config:set', ruleId: string, severity: 'error'|'warn'|'off', options?: object, requestId?: string }
 * - Server -> Client: { type: 'lint:result', filePath: string, issues: Issue[], requestId?: string }
 * - Server -> Client: { type: 'lint:progress', filePath: string, phase: string, requestId?: string }
 * - Server -> Client: { type: 'file:changed', filePath: string }
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

import {
  existsSync,
  statSync,
  readdirSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
} from "fs";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { createRequire } from "module";
import { dirname, resolve, relative, join, parse } from "path";
import { URL } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { watch, type FSWatcher } from "chokidar";
import { findWorkspaceRoot } from "uilint-core/node";

// Vision analysis is dynamically imported from uilint-vision/node when needed.
// This removes the hard dependency on the vision plugin package.
import {
  detectNextAppRouter,
  findNextAppRouterProjects,
} from "../utils/next-detect.js";
import { resolvePathSpecifier } from "../utils/path-specifiers.js";
import { logWarning, pc } from "../utils/prompts.js";
import {
  enableDashboard,
  disableDashboard,
  isDashboardEnabled,
  logLint,
  logLintDone,
  logSubscribe,
  logCacheInvalidate,
  logVisionAnalyze,
  logVisionDone,
  logVisionCheck,
  logSemanticAnalyze,
  logSemanticDone,
  logSemanticSkipped,
  logConfigSet,
  logRuleConfigSet,
  logScreenshotSave,
  logScreenshotSaved,
  logCoverageResult,
  logClientConnect,
  logClientDisconnect,
  logServerError,
  logServerWarning,
  logServerInfo,
  logRuleInternalError,
  setWorkspaceInfo,
  setServerRunning,
  updateSubscriptionCount,
  updateCacheCount,
  startBackgroundTask,
  updateBackgroundTaskProgress,
  completeBackgroundTask,
  registerPlugin,
  setPluginStatus,
  updatePluginProgress,
  setPluginModel,
} from "./serve/dashboard/logger.js";
import type { PluginId } from "./serve/dashboard/types.js";
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
import { enrichIssuesWithScopeInfo } from "../utils/eslint-utils.js";
import {
  discoverPlugins,
  loadPluginESLintRules,
} from "../utils/plugin-loader.js";

// ---------------------------------------------------------------------------
// Sentinel issue detection (generic, driven by rule metadata)
// ---------------------------------------------------------------------------
// Rules with fallible backends (LLM, external services) can declare
// `sentinelMessageIds` in their metadata. Issues reported with those
// messageIds are internal error signals, not user-facing lint issues.
// The serve command logs them to the dashboard and filters them out.
//
// Built lazily so that dynamically registered plugin rules are included.
// ---------------------------------------------------------------------------

/** Lazily built set of "ruleId:messageId" keys for fast sentinel lookup */
let _sentinelKeys: Set<string> | null = null;

function getSentinelKeys(): Set<string> {
  if (!_sentinelKeys) {
    _sentinelKeys = new Set<string>();
    for (const rule of ruleRegistry) {
      if (rule.sentinelMessageIds) {
        for (const mid of rule.sentinelMessageIds) {
          _sentinelKeys.add(`uilint/${rule.id}:${mid}`);
        }
      }
    }
  }
  return _sentinelKeys;
}

/**
 * Check if a lint issue is a sentinel (internal error) that should be
 * filtered from client results and logged to the dashboard instead.
 */
function isSentinelIssue(issue: LintIssue): boolean {
  if (!issue.ruleId || !issue.messageId) return false;
  return getSentinelKeys().has(`${issue.ruleId}:${issue.messageId}`);
}

export interface ServeOptions {
  port?: number;
  /** Disable dashboard UI (use simple logging) */
  noDashboard?: boolean;
}

// ---------------------------------------------------------------------------
// Port discovery constants
// ---------------------------------------------------------------------------
export const DEFAULT_PORT = 9234;
export const PORT_RANGE_SIZE = 10;

/**
 * Try to listen on a port. Resolves true if available, false if in use.
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", () => {
      resolve(false);
    });
    srv.once("listening", () => {
      srv.close(() => resolve(true));
    });
    srv.listen(port, "127.0.0.1");
  });
}

/**
 * Find an available port starting from `preferred`, scanning up to
 * PORT_RANGE_SIZE ports.
 */
async function findAvailablePort(preferred: number): Promise<number> {
  for (let offset = 0; offset < PORT_RANGE_SIZE; offset++) {
    const port = preferred + offset;
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(
    `No available ports in range ${preferred}–${
      preferred + PORT_RANGE_SIZE - 1
    }`
  );
}

export interface LintIssue {
  line: number;
  column?: number;
  message: string;
  ruleId?: string;
  /** ESLint messageId (e.g. "semanticIssue", "analysisError") — used for sentinel detection */
  messageId?: string;
  dataLoc?: string;
  scopeInfo?: {
    enclosingScope: string | null;
    scopeType:
      | "function"
      | "arrow-function"
      | "component"
      | "hook"
      | "method"
      | "class"
      | "module";
    parentScope?: string;
    jsxElementType?: string;
  };
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
  manifest: Record<string, unknown>[];
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

interface WorkspaceCapabilitiesMessage {
  type: "workspace:capabilities";
  postToolUseHook: {
    enabled: boolean;
    provider: "claude" | "cursor" | null;
  };
}

interface VisionResultMessage {
  type: "vision:result";
  route: string;
  issues: Record<string, unknown>[];
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
    category: string;
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

// Generic plugin operation progress messages
interface PluginOperationStartMessage {
  type: "plugin:operation:start";
  pluginId: string;
  operationName: string;
  message?: string;
}

interface PluginOperationProgressMessage {
  type: "plugin:operation:progress";
  pluginId: string;
  operationName: string;
  current?: number;
  total?: number;
  message?: string;
}

interface PluginOperationCompleteMessage {
  type: "plugin:operation:complete";
  pluginId: string;
  operationName: string;
  message?: string;
}

interface PluginOperationErrorMessage {
  type: "plugin:operation:error";
  pluginId: string;
  operationName: string;
  error: string;
}

type ServerMessage =
  | LintResultMessage
  | LintProgressMessage
  | FileChangedMessage
  | WorkspaceInfoMessage
  | WorkspaceCapabilitiesMessage
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
  | ScreenshotErrorMessage
  | PluginOperationStartMessage
  | PluginOperationProgressMessage
  | PluginOperationCompleteMessage
  | PluginOperationErrorMessage;

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

/**
 * Detect if a post-tool-use hook is configured for Claude or Cursor.
 * These hooks can automatically run ESLint when files are edited.
 */
function detectPostToolUseHook(projectRoot: string): {
  enabled: boolean;
  provider: "claude" | "cursor" | null;
} {
  // Check Claude settings.json for PostToolUse hooks
  const claudeSettingsPath = join(projectRoot, ".claude", "settings.json");
  if (existsSync(claudeSettingsPath)) {
    try {
      const content = readFileSync(claudeSettingsPath, "utf-8");
      const settings = JSON.parse(content);
      const hooks = settings.hooks?.PostToolUse;
      if (Array.isArray(hooks)) {
        // Check if any hook matches Edit or Write tools
        const hasEditHook = hooks.some(
          (h: { matcher?: string }) =>
            h.matcher?.includes("Edit") || h.matcher?.includes("Write")
        );
        if (hasEditHook) {
          return { enabled: true, provider: "claude" };
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  // Check Cursor hooks.json
  const cursorHooksPath = join(projectRoot, ".cursor", "hooks.json");
  if (existsSync(cursorHooksPath)) {
    try {
      const content = readFileSync(cursorHooksPath, "utf-8");
      const hooks = JSON.parse(content);
      if (hooks.hooks?.afterFileEdit?.length > 0) {
        return { enabled: true, provider: "cursor" };
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  return { enabled: false, provider: null };
}

// Simple in-memory cache
interface CacheEntry {
  issues: LintIssue[];
  mtimeMs: number;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

// Separate caches for two-pass lint
const fastCache = new Map<string, CacheEntry>();
const semanticCache = new Map<string, CacheEntry>();

/** Minimal ESLint API surface used by the serve command. */
interface ESLintInstance {
  lintFiles(
    files: string[]
  ): Promise<Array<{ messages: Record<string, unknown>[] }>>;
}

// ESLint instances cached per detected project root
const eslintInstances = new Map<string, unknown>();

// ESLint instances with semantic rule disabled (for fast pass)
const eslintFastInstances = new Map<string, unknown>();

// Vision module is dynamically imported to avoid hard dependency on uilint-vision.
let visionModule: Record<string, unknown> | null = null;
let visionAnalyzer: unknown = null;

async function getVisionModule(): Promise<Record<string, unknown> | null> {
  if (visionModule) return visionModule;
  try {
    visionModule = await import("uilint-vision/node");
    return visionModule;
  } catch {
    return null;
  }
}

async function getVisionAnalyzerInstance(): Promise<unknown> {
  if (visionAnalyzer) return visionAnalyzer;
  const mod = await getVisionModule();
  if (!mod) return null;
  visionAnalyzer = (
    mod as Record<string, (...args: unknown[]) => unknown>
  ).getVisionAnalyzer();
  return visionAnalyzer;
}

// =============================================================================
// Ollama Mutex (tracked)
// =============================================================================
// Prevents concurrent Ollama model usage between plugins. Ollama needs to swap
// models in/out of VRAM, and concurrent requests cause contention and slowdowns.
// Tracks current holder and queue for dashboard display.

let ollamaMutexPromise: Promise<void> = Promise.resolve();
let ollamaMutexHolder: PluginId | null = null;
const ollamaMutexQueue: PluginId[] = [];

/**
 * Acquire exclusive access to Ollama. Returns a release function.
 * Tracks the requester for dashboard display.
 *
 * Usage:
 *   const release = await acquireOllamaMutex("semantic");
 *   try { ... } finally { release(); }
 */
function acquireOllamaMutex(pluginId: PluginId): Promise<() => void> {
  let release: () => void;
  const prev = ollamaMutexPromise;
  ollamaMutexPromise = new Promise<void>((resolve) => {
    release = resolve;
  });

  // Mark this plugin as waiting in the queue
  ollamaMutexQueue.push(pluginId);
  setPluginStatus(pluginId, "waiting-for-ollama", "Queued for Ollama...");

  return prev.then(() => {
    // Granted: remove from queue, mark as holder
    const idx = ollamaMutexQueue.indexOf(pluginId);
    if (idx !== -1) ollamaMutexQueue.splice(idx, 1);
    ollamaMutexHolder = pluginId;
    setPluginStatus(pluginId, "using-ollama", "Using Ollama...");

    return () => {
      // Release: clear holder tracking
      if (ollamaMutexHolder === pluginId) {
        ollamaMutexHolder = null;
      }
      release!();
    };
  });
}

// Semantic analysis batch progress tracking.
// Counts files that pass validation and commit to LLM analysis.
let semanticFilesRequested = 0;
let semanticFilesCompleted = 0;
let semanticIdleResetTimer: ReturnType<typeof setTimeout> | null = null;

/** Push current batch progress to the dashboard. */
function updateSemanticBatchProgress(message: string): void {
  const progress =
    semanticFilesRequested > 0
      ? Math.round((semanticFilesCompleted / semanticFilesRequested) * 100)
      : 0;
  updatePluginProgress(
    "semantic",
    progress,
    semanticFilesCompleted,
    semanticFilesRequested,
    message
  );
}

/**
 * Mark one semantic file as done (success or error).
 * If all queued files are finished, show terminal status and schedule idle reset.
 * Otherwise, update batch progress and stay active.
 */
function completeSemanticFile(
  terminalStatus: "complete" | "error",
  message: string
): void {
  semanticFilesCompleted++;

  if (semanticFilesCompleted >= semanticFilesRequested) {
    const summary =
      terminalStatus === "complete"
        ? `Done: ${semanticFilesCompleted} file(s) analyzed`
        : message;
    setPluginStatus("semantic", terminalStatus, summary);
    semanticIdleResetTimer = setTimeout(() => {
      setPluginStatus("semantic", "idle");
      semanticFilesRequested = 0;
      semanticFilesCompleted = 0;
      semanticIdleResetTimer = null;
    }, 3000);
  } else {
    updateSemanticBatchProgress(
      `${semanticFilesCompleted}/${semanticFilesRequested} files analyzed`
    );
  }
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
  const { parse } = localRequire("@typescript-eslint/typescript-estree") as {
    parse: (
      src: string,
      options: Record<string, unknown>
    ) => Record<string, unknown>;
  };

  const ast = parse(code, {
    loc: true,
    range: true,
    jsx: true,
    comment: false,
    errorOnUnknownASTType: false,
  });

  const spans: JsxElementSpan[] = [];

  function walk(node: Record<string, unknown>): void {
    if (!node || typeof node !== "object") return;

    // Prefer mapping to JSXElement range so we can capture nested ownership precisely.
    if (node.type === "JSXElement") {
      const range = node.range as [number, number] | undefined;
      const opening = node.openingElement as
        | Record<string, unknown>
        | undefined;
      const loc = (opening?.loc as Record<string, unknown> | undefined)
        ?.start as Record<string, unknown> | undefined;
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
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) walk(item as Record<string, unknown>);
      } else if (child && typeof child === "object") {
        walk(child as Record<string, unknown>);
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

async function getESLintForProject(projectCwd: string): Promise<unknown> {
  const cached = eslintInstances.get(projectCwd);
  if (cached) return cached;

  try {
    const req = createRequire(join(projectCwd, "package.json"));

    const mod = req("eslint") as Record<string, unknown>;
    const modDefault = mod?.default as Record<string, unknown> | undefined;
    const ESLintCtor = mod?.ESLint ?? modDefault?.ESLint ?? mod?.default ?? mod;
    if (!ESLintCtor) return null;

    const Ctor = ESLintCtor as new (opts: Record<string, unknown>) => unknown;
    const eslint = new Ctor({ cwd: projectCwd });
    eslintInstances.set(projectCwd, eslint);
    return eslint;
  } catch {
    return null;
  }
}

/**
 * Create an ESLint instance with rule overrides (for two-pass lint).
 * Uses ESLint 9 flat config's overrideConfig option.
 */
async function getESLintWithOverrides(
  projectCwd: string,
  overrideRules: Record<string, string>,
  instanceCache: Map<string, unknown>
): Promise<unknown> {
  const cacheKey = `${projectCwd}::${JSON.stringify(overrideRules)}`;
  const cached = instanceCache.get(cacheKey);
  if (cached) return cached;

  try {
    const req = createRequire(join(projectCwd, "package.json"));
    const mod = req("eslint") as Record<string, unknown>;
    const modDefault = mod?.default as Record<string, unknown> | undefined;
    const ESLintCtor = mod?.ESLint ?? modDefault?.ESLint ?? mod?.default ?? mod;
    if (!ESLintCtor) return null;

    const Ctor = ESLintCtor as new (opts: Record<string, unknown>) => unknown;
    const eslint = new Ctor({
      cwd: projectCwd,
      overrideConfig: { rules: overrideRules },
    });
    instanceCache.set(cacheKey, eslint);
    return eslint;
  } catch {
    return null;
  }
}

/**
 * Check if the semantic rule is enabled in the ESLint config.
 */
function isSemanticRuleEnabled(): boolean {
  const eslintConfigPath = findEslintConfigFile(serverAppRootForVision);
  if (!eslintConfigPath) return false;

  const ruleConfigs = readRuleConfigsFromConfig(eslintConfigPath);
  const semanticConfig = ruleConfigs.get("semantic");
  if (!semanticConfig) return false;

  return semanticConfig.severity !== "off";
}

/**
 * Process raw ESLint messages into LintIssue[] with JSX mapping and scope info.
 * Shared between fast and semantic passes.
 */
function processLintResults(
  absolutePath: string,
  projectCwd: string,
  messages: Record<string, unknown>[],
  onProgress: (phase: string) => void
): LintIssue[] {
  const dataLocFile = normalizeDataLocFilePath(absolutePath, projectCwd);
  let spans: JsxElementSpan[] = [];
  let lineStarts: number[] = [];
  let codeLength = 0;
  let fileCode: string | null = null;

  try {
    onProgress("Building JSX map...");
    fileCode = readFileSync(absolutePath, "utf-8");
    codeLength = fileCode.length;
    lineStarts = buildLineStarts(fileCode);
    spans = buildJsxElementSpans(fileCode, dataLocFile);
    onProgress(`JSX map: ${spans.length} element(s)`);
  } catch (e) {
    onProgress("JSX map failed (falling back to unmapped issues)");
    logServerError(
      "JSX map failed",
      e instanceof Error ? e.message : String(e)
    );
    spans = [];
    lineStarts = [];
    codeLength = 0;
    fileCode = null;
  }

  let issues: LintIssue[] = messages
    .filter((m: Record<string, unknown>) => typeof m?.message === "string")
    .map((m: Record<string, unknown>) => {
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
        message: m.message as string,
        ruleId: typeof m.ruleId === "string" ? m.ruleId : undefined,
        messageId: typeof m.messageId === "string" ? m.messageId : undefined,
        dataLoc: mappedDataLoc,
      } satisfies LintIssue;
    });

  const mappedCount = issues.filter((i) => Boolean(i.dataLoc)).length;
  if (issues.length > 0) {
    onProgress(
      `Mapped ${mappedCount}/${issues.length} issue(s) to JSX elements`
    );
  }

  // Enrich issues with scope information
  if (fileCode && issues.length > 0) {
    onProgress("Extracting scope info...");
    issues = enrichIssuesWithScopeInfo(issues, fileCode);
    const scopeCount = issues.filter((i) => Boolean(i.scopeInfo)).length;
    onProgress(
      `Enriched ${scopeCount}/${issues.length} issue(s) with scope info`
    );
  }

  return issues;
}

interface RuleProfileProgressRule {
  ruleId: string;
  totalMs: number;
}

interface RuleProfileProgressSession {
  rules: RuleProfileProgressRule[];
}

async function formatRuleProfileProgress(): Promise<string | null> {
  const profilerModule = (await import("uilint-eslint")) as unknown as {
    buildRuleProfileSession?: () => RuleProfileProgressSession;
  };
  if (typeof profilerModule.buildRuleProfileSession !== "function") {
    return null;
  }

  const session = profilerModule.buildRuleProfileSession();
  const slowest = session.rules
    .filter((rule) => rule.totalMs > 0)
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 3);

  if (slowest.length === 0) return null;

  const summary = slowest
    .map((rule) => `${rule.ruleId} ${rule.totalMs.toFixed(1)}ms`)
    .join(", ");
  return `Profile: ${summary}`;
}

/**
 * Fast lint pass: runs all rules EXCEPT semantic.
 * Non-blocking (no spawnSync calls).
 */
async function lintFileFast(
  filePath: string,
  onProgress: (phase: string) => void
): Promise<LintIssue[]> {
  const absolutePath = resolveRequestedFilePath(filePath);

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

  // Check fast-pass cache
  const cached = fastCache.get(absolutePath);
  if (cached && cached.mtimeMs === mtimeMs) {
    onProgress("Cache hit (unchanged)");
    return cached.issues;
  }

  const fileDir = dirname(absolutePath);
  const projectCwd = findESLintCwd(fileDir);

  onProgress(`Resolving ESLint project... ${pc.dim(projectCwd)}`);

  const eslint = await getESLintWithOverrides(
    projectCwd,
    { "uilint/semantic": "off" },
    eslintFastInstances
  );
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
    const results = await (eslint as ESLintInstance).lintFiles([absolutePath]);
    const messages =
      Array.isArray(results) && results.length > 0
        ? results[0].messages || []
        : [];

    const issues = processLintResults(
      absolutePath,
      projectCwd,
      messages,
      onProgress
    );

    fastCache.set(absolutePath, { issues, mtimeMs, timestamp: Date.now() });
    return issues;
  } catch (error) {
    logServerError(
      "ESLint fast pass failed",
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}

/**
 * Semantic lint pass: runs ALL ESLint rules then filters to only semantic results.
 * This blocks the event loop via spawnSync in the semantic rule, so it should
 * be called from a deferred context (setImmediate).
 */
async function _lintFileSemantic(
  filePath: string,
  onProgress: (phase: string) => void
): Promise<LintIssue[]> {
  const absolutePath = resolveRequestedFilePath(filePath);

  if (!existsSync(absolutePath)) return [];

  const mtimeMs = (() => {
    try {
      return statSync(absolutePath).mtimeMs;
    } catch {
      return 0;
    }
  })();

  // Check semantic-pass cache
  const cached = semanticCache.get(absolutePath);
  if (cached && cached.mtimeMs === mtimeMs) {
    onProgress("Semantic cache hit (unchanged)");
    return cached.issues;
  }

  const fileDir = dirname(absolutePath);
  const projectCwd = findESLintCwd(fileDir);

  // Use the default ESLint instance (all rules enabled including semantic)
  const eslint = await getESLintForProject(projectCwd);
  if (!eslint) return [];

  try {
    onProgress("Running semantic analysis...");
    const results = await (eslint as ESLintInstance).lintFiles([absolutePath]);
    const messages =
      Array.isArray(results) && results.length > 0
        ? results[0].messages || []
        : [];

    // Filter to only semantic rule results
    const semanticMessages = messages.filter(
      (m: Record<string, unknown>) => m.ruleId === "uilint/semantic"
    );

    if (semanticMessages.length === 0) return [];

    const issues = processLintResults(
      absolutePath,
      projectCwd,
      semanticMessages,
      onProgress
    );

    semanticCache.set(absolutePath, { issues, mtimeMs, timestamp: Date.now() });
    return issues;
  } catch (error) {
    logServerError(
      "Semantic pass failed",
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}

/**
 * Run semantic analysis asynchronously using OllamaClient.
 * Unlike _lintFileSemantic (which runs ESLint + spawnSync), this calls Ollama
 * directly via its HTTP API, writes results to the ESLint rule's disk cache,
 * and sends lint:result to the client. Completely non-blocking.
 */
async function runSemanticAnalysisAsync(
  filePath: string,
  ws: WebSocket,
  requestId?: string
): Promise<void> {
  const startTime = Date.now();
  logSemanticAnalyze(filePath, requestId);

  const absolutePath = resolveRequestedFilePath(filePath);
  if (!existsSync(absolutePath)) {
    logSemanticSkipped(filePath, "file not found");
    return;
  }

  // Read the semantic rule's config to get the model
  const eslintConfigPath = findEslintConfigFile(serverAppRootForVision);
  const ruleConfigs = eslintConfigPath
    ? readRuleConfigsFromConfig(eslintConfigPath)
    : new Map<
        string,
        {
          severity: "error" | "warn" | "off";
          options?: Record<string, unknown>;
        }
      >();
  const semanticConfig = ruleConfigs.get("semantic");
  const model =
    (semanticConfig?.options?.model as string) || "qwen3-vl:8b-instruct";
  const styleguidePath =
    (semanticConfig?.options?.styleguidePath as string) || undefined;
  setPluginModel("semantic", model);

  // Load styleguide
  const { getStyleguide, hashContentSync, setCacheEntry, getCacheEntry } =
    await import("uilint-eslint");
  const fileDir = dirname(absolutePath);
  const { content: styleguide } = getStyleguide(fileDir, styleguidePath);
  if (!styleguide) {
    logSemanticSkipped(filePath, "no styleguide found");
    return;
  }

  // Read and hash file contents
  let fileContent: string;
  try {
    fileContent = readFileSync(absolutePath, "utf-8");
  } catch {
    logSemanticSkipped(filePath, "file read error");
    return;
  }

  const fileHash = hashContentSync(fileContent);
  const styleguideHash = hashContentSync(styleguide);

  // Find project root for cache
  const projectRoot = findWorkspaceRoot(fileDir) || fileDir;
  const relativeFilePath = relative(projectRoot, absolutePath);

  // Check if cache is already fresh
  const cached = getCacheEntry(
    projectRoot,
    relativeFilePath,
    fileHash,
    styleguideHash
  );
  if (cached) {
    logSemanticSkipped(filePath, "cache fresh");
    // Send cached results to client (e.g. after server restart, the client
    // re-requests linting but the expensive LLM analysis is still valid)
    if (cached.issues.length > 0) {
      const projectCwd = findESLintCwd(fileDir);
      const dataLocFile = normalizeDataLocFilePath(absolutePath, projectCwd);
      const lintIssues: LintIssue[] = cached.issues.map((issue) => ({
        ruleId: issue.ruleId,
        severity: issue.severity,
        message: issue.message,
        line: issue.line,
        column: issue.column || 0,
        nodeType: null,
        source: null,
        dataLoc: `${dataLocFile}:${issue.line}:${issue.column || 0}`,
      }));
      sendMessage(ws, {
        type: "lint:result",
        filePath,
        requestId,
        issues: lintIssues,
      });
    }
    return;
  }

  // Track this file in the semantic batch progress
  if (semanticIdleResetTimer) {
    clearTimeout(semanticIdleResetTimer);
    semanticIdleResetTimer = null;
  }
  semanticFilesRequested++;
  updateSemanticBatchProgress(
    `Queued ${relative(serverAppRootForVision, absolutePath)}...`
  );

  // Report progress
  sendMessage(ws, {
    type: "lint:progress",
    filePath,
    requestId,
    phase: "Running semantic analysis (async)...",
  });

  startBackgroundTask(
    "semantic-analysis",
    "Semantic Analysis",
    `Analyzing ${filePath}...`
  );
  broadcast({
    type: "plugin:operation:start",
    pluginId: "semantic",
    operationName: "analysis",
    message: `Analyzing ${relative(serverAppRootForVision, absolutePath)}...`,
  });

  // Acquire mutex to avoid Ollama model contention
  const release = await acquireOllamaMutex("semantic");

  try {
    const { OllamaClient, buildSourceScanPrompt } = await import(
      "uilint-core/node"
    );
    const client = new OllamaClient({ model });

    const ok = await client.isAvailable();
    if (!ok) {
      logServerWarning("Semantic analysis: Ollama not available");
      updateBackgroundTaskProgress(
        "semantic-analysis",
        0,
        0,
        0,
        "Ollama not available"
      );
      completeBackgroundTask(
        "semantic-analysis",
        undefined,
        "Ollama not available"
      );
      broadcast({
        type: "plugin:operation:error",
        pluginId: "semantic",
        operationName: "analysis",
        error: "Ollama not available",
      });
      completeSemanticFile("error", "Ollama not available");
      return;
    }

    updateBackgroundTaskProgress(
      "semantic-analysis",
      50,
      0,
      0,
      "Waiting for LLM response..."
    );
    updateSemanticBatchProgress(
      `Analyzing ${relative(serverAppRootForVision, absolutePath)}...`
    );
    broadcast({
      type: "plugin:operation:progress",
      pluginId: "semantic",
      operationName: "analysis",
      message: "Waiting for LLM response...",
    });

    const prompt = buildSourceScanPrompt(fileContent, styleguide, {
      filePath: relative(serverAppRootForVision, absolutePath),
    });

    const responseText = await client.complete(prompt, { json: true });
    const parsed = JSON.parse(responseText) as {
      issues?: Array<{ line?: number; column?: number; message?: string }>;
    };

    const issues = (parsed.issues || []).map((issue) => ({
      line: issue.line || 1,
      column: issue.column,
      message: issue.message || "Semantic issue detected",
      ruleId: "uilint/semantic",
      severity: 1 as const,
    }));

    // Write to the ESLint rule's disk cache
    setCacheEntry(projectRoot, relativeFilePath, {
      fileHash,
      styleguideHash,
      issues,
      timestamp: Date.now(),
    });

    // Convert to LintIssue format for the WS result
    const fileDir2 = dirname(absolutePath);
    const projectCwd = findESLintCwd(fileDir2);
    const dataLocFile = normalizeDataLocFilePath(absolutePath, projectCwd);
    const lintIssues: LintIssue[] = issues.map((issue) => ({
      ruleId: "uilint/semantic",
      severity: issue.severity,
      message: issue.message,
      line: issue.line,
      column: issue.column || 0,
      nodeType: null,
      source: null,
      dataLoc: `${dataLocFile}:${issue.line}:${issue.column || 0}`,
    }));

    // Always send results (even if empty) so client knows analysis finished
    sendMessage(ws, {
      type: "lint:result",
      filePath,
      requestId,
      issues: lintIssues,
    });

    const elapsed = Date.now() - startTime;
    const msg = `${issues.length} issue(s) found`;
    logSemanticDone(filePath, issues.length, elapsed);
    completeBackgroundTask("semantic-analysis", msg);
    completeSemanticFile("complete", msg);
    broadcast({
      type: "plugin:operation:complete",
      pluginId: "semantic",
      operationName: "analysis",
      message: msg,
    });

    sendMessage(ws, {
      type: "lint:progress",
      filePath,
      requestId,
      phase: `Done (semantic: ${issues.length} issues)`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logServerError("Async semantic analysis failed", errorMessage);
    completeBackgroundTask("semantic-analysis", undefined, errorMessage);
    completeSemanticFile("error", errorMessage);
    broadcast({
      type: "plugin:operation:error",
      pluginId: "semantic",
      operationName: "analysis",
      error: errorMessage,
    });
  } finally {
    release();
  }
}

/**
 * Run vision analysis in the background (fire-and-forget).
 * Extracted from the vision:analyze handler to avoid blocking handleMessage.
 */
async function runVisionAnalysisInBackground(
  ws: WebSocket,
  message: VisionAnalyzeMessage
): Promise<void> {
  const { route, timestamp, screenshot, screenshotFile, manifest, requestId } =
    message;

  setPluginStatus("vision", "processing", `Analyzing ${route}...`);
  startBackgroundTask(
    "vision-analysis",
    "Vision Analysis",
    `Analyzing ${route}...`
  );
  broadcast({
    type: "plugin:operation:start",
    pluginId: "vision",
    operationName: "analysis",
    message: `Analyzing ${route}...`,
  });

  const visionMod = await getVisionModule();
  if (!visionMod) {
    sendMessage(ws, {
      type: "vision:result",
      route,
      issues: [],
      analysisTime: 0,
      error: "uilint-vision is not installed",
      requestId,
    });
    completeBackgroundTask(
      "vision-analysis",
      undefined,
      "uilint-vision not installed"
    );
    setPluginStatus("vision", "error", "uilint-vision not installed");
    setTimeout(() => setPluginStatus("vision", "idle"), 3000);
    broadcast({
      type: "plugin:operation:error",
      pluginId: "vision",
      operationName: "analysis",
      error: "uilint-vision not installed",
    });
    return;
  }

  sendMessage(ws, {
    type: "vision:progress",
    route,
    requestId,
    phase: "Starting vision analysis...",
  });

  const startedAt = Date.now();
  const analyzer = await getVisionAnalyzerInstance();

  updateBackgroundTaskProgress(
    "vision-analysis",
    10,
    0,
    0,
    "Waiting for Ollama..."
  );

  // Acquire exclusive access to Ollama to avoid model contention
  const releaseOllama = await acquireOllamaMutex("vision");

  try {
    const analyzerObj = analyzer as Record<string, unknown> | null;
    const analyzerModel =
      typeof analyzerObj?.getModel === "function"
        ? (analyzerObj.getModel as () => string)()
        : undefined;
    const analyzerBaseUrl =
      typeof analyzerObj?.getBaseUrl === "function"
        ? (analyzerObj.getBaseUrl as () => string)()
        : undefined;

    if (analyzerModel) {
      setPluginModel("vision", analyzerModel);
    }

    if (!screenshot) {
      sendMessage(ws, {
        type: "vision:result",
        route,
        issues: [],
        analysisTime: Date.now() - startedAt,
        error: "No screenshot provided for vision analysis",
        requestId,
      });
      completeBackgroundTask(
        "vision-analysis",
        undefined,
        "No screenshot provided"
      );
      setPluginStatus("vision", "error", "No screenshot provided");
      setTimeout(() => setPluginStatus("vision", "idle"), 3000);
      broadcast({
        type: "plugin:operation:error",
        pluginId: "vision",
        operationName: "analysis",
        error: "No screenshot provided",
      });
      return;
    }

    updateBackgroundTaskProgress(
      "vision-analysis",
      30,
      0,
      0,
      "Running vision analysis..."
    );
    broadcast({
      type: "plugin:operation:progress",
      pluginId: "vision",
      operationName: "analysis",
      message: "Running vision analysis...",
    });

    const result = (await (
      visionMod as Record<
        string,
        (...args: unknown[]) => Promise<Record<string, unknown>>
      >
    ).runVisionAnalysis({
      imageBase64: screenshot,
      manifest,
      projectPath: serverAppRootForVision,
      baseUrl: analyzerBaseUrl,
      model: analyzerModel,
      analyzer,
      onPhase: (phase: string) => {
        sendMessage(ws, {
          type: "vision:progress",
          route,
          requestId,
          phase,
        });
        updateBackgroundTaskProgress("vision-analysis", 50, 0, 0, phase);
      },
      pathResolver: resolvePathSpecifier,
    })) as Record<string, unknown>;

    // Write markdown report (best-effort)
    if (typeof screenshotFile === "string" && screenshotFile.length > 0) {
      if (isValidScreenshotFilename(screenshotFile)) {
        const screenshotsDir = join(
          serverAppRootForVision,
          ".uilint",
          "screenshots"
        );
        const imagePath = join(screenshotsDir, screenshotFile);
        try {
          if (existsSync(imagePath)) {
            const report = (
              visionMod as Record<
                string,
                (...args: unknown[]) => Record<string, unknown>
              >
            ).writeVisionMarkdownReport({
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
            logServerInfo(`Wrote vision report`, report.outPath as string);
          }
        } catch (e) {
          logServerWarning(
            `Failed to write vision report for ${screenshotFile}`,
            e instanceof Error ? e.message : String(e)
          );
        }
      }
    }

    const elapsed = Date.now() - startedAt;
    const resultIssues = result.issues as Record<string, unknown>[];
    logVisionDone(route, resultIssues.length, elapsed);

    sendMessage(ws, {
      type: "vision:result",
      route,
      issues: resultIssues,
      analysisTime: result.analysisTime as number,
      requestId,
    });

    const msg = `${resultIssues.length} issue(s) in ${(elapsed / 1000).toFixed(
      1
    )}s`;
    completeBackgroundTask("vision-analysis", msg);
    setPluginStatus("vision", "complete", msg);
    setTimeout(() => setPluginStatus("vision", "idle"), 3000);
    broadcast({
      type: "plugin:operation:complete",
      pluginId: "vision",
      operationName: "analysis",
      message: msg,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const elapsed = Date.now() - startedAt;
    logServerError(`Vision analysis failed for ${route}`, errorMessage);

    sendMessage(ws, {
      type: "vision:result",
      route,
      issues: [],
      analysisTime: elapsed,
      error: errorMessage,
      requestId,
    });
    completeBackgroundTask("vision-analysis", undefined, errorMessage);
    setPluginStatus("vision", "error", errorMessage);
    setTimeout(() => setPluginStatus("vision", "idle"), 3000);
    broadcast({
      type: "plugin:operation:error",
      pluginId: "vision",
      operationName: "analysis",
      error: errorMessage,
    });
  } finally {
    releaseOllama();
  }
}

/**
 * Lint a file and return issues (legacy single-pass, used for backwards compat)
 */
async function _lintFile(
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
    const results = await (eslint as ESLintInstance).lintFiles([absolutePath]);
    const messages =
      Array.isArray(results) && results.length > 0
        ? results[0].messages || []
        : [];

    const dataLocFile = normalizeDataLocFilePath(absolutePath, projectCwd);
    let spans: JsxElementSpan[] = [];
    let lineStarts: number[] = [];
    let codeLength = 0;
    let fileCode: string | null = null;

    try {
      onProgress("Building JSX map...");
      fileCode = readFileSync(absolutePath, "utf-8");
      codeLength = fileCode.length;
      lineStarts = buildLineStarts(fileCode);
      spans = buildJsxElementSpans(fileCode, dataLocFile);
      onProgress(`JSX map: ${spans.length} element(s)`);
    } catch (e) {
      // If parsing fails, we still return ESLint messages (unmapped).
      onProgress("JSX map failed (falling back to unmapped issues)");
      logServerError(
        "JSX map failed",
        e instanceof Error ? e.message : String(e)
      );
      spans = [];
      lineStarts = [];
      codeLength = 0;
      fileCode = null;
    }

    let issues: LintIssue[] = messages
      .filter((m: Record<string, unknown>) => typeof m?.message === "string")
      .map((m: Record<string, unknown>) => {
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
          message: m.message as string,
          ruleId: typeof m.ruleId === "string" ? m.ruleId : undefined,
          messageId: typeof m.messageId === "string" ? m.messageId : undefined,
          dataLoc: mappedDataLoc,
        } satisfies LintIssue;
      });

    const mappedCount = issues.filter((i) => Boolean(i.dataLoc)).length;
    if (issues.length > 0) {
      onProgress(
        `Mapped ${mappedCount}/${issues.length} issue(s) to JSX elements`
      );
    }

    // Enrich issues with scope information
    if (fileCode && issues.length > 0) {
      onProgress("Extracting scope info...");
      issues = enrichIssuesWithScopeInfo(issues, fileCode);
      const scopeCount = issues.filter((i) => Boolean(i.scopeInfo)).length;
      onProgress(
        `Enriched ${scopeCount}/${issues.length} issue(s) with scope info`
      );
    }

    cache.set(absolutePath, { issues, mtimeMs, timestamp: Date.now() });
    return issues;
  } catch (error) {
    logServerError(
      "ESLint failed",
      error instanceof Error ? error.message : String(error)
    );
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
    const fp = (message as LintFileMessage | LintElementMessage).filePath;
    const rid = (message as LintFileMessage | LintElementMessage).requestId;
    logLint(fp ?? "", rid);
  } else if (message.type === "subscribe:file") {
    logSubscribe(message.filePath);
  } else if (message.type === "cache:invalidate") {
    logCacheInvalidate(message.filePath);
  } else if (message.type === "vision:analyze") {
    // Logged in handler for more detailed output
  } else if (message.type === "vision:check") {
    // Logged in handler
  } else if (message.type === "config:set") {
    // Logged in handler
  } else if (message.type === "screenshot:save") {
    const rid = (message as ScreenshotSaveMessage).requestId;
    logScreenshotSave(message.route, rid);
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
        logServerWarning(
          `File not found: ${filePath}`,
          `resolved: ${resolved}, cwd: ${cwd}, wsRoot: ${wsRoot}`
        );
      }

      // === PASS 1: Fast rules (non-blocking, no spawnSync) ===
      const fastIssues = await lintFileFast(filePath, (phase) => {
        sendMessage(ws, { type: "lint:progress", filePath, requestId, phase });
      });

      const fastElapsed = Date.now() - startedAt;

      // Filter sentinel issues from fast results
      const fastSentinels = fastIssues.filter(isSentinelIssue);
      for (const se of fastSentinels) {
        logRuleInternalError(se.ruleId ?? "unknown", filePath, se.message);
      }
      const fastClientIssues = fastIssues.filter((i) => !isSentinelIssue(i));

      logLintDone(filePath, fastClientIssues.length, fastElapsed);
      updateCacheCount(fastCache.size + semanticCache.size);

      // Send fast results immediately
      sendMessage(ws, {
        type: "lint:result",
        filePath,
        requestId,
        issues: fastClientIssues,
      });

      // Send Done for fast pass immediately
      sendMessage(ws, {
        type: "lint:progress",
        filePath,
        requestId,
        phase: `Done (${fastClientIssues.length} issues, ${fastElapsed}ms)`,
      });

      {
        const profileSummary = await formatRuleProfileProgress();
        if (profileSummary) {
          sendMessage(ws, {
            type: "lint:progress",
            filePath,
            requestId,
            phase: profileSummary,
          });
        }
      }

      // === PASS 2: Semantic analysis (async, non-blocking) ===
      if (isSemanticRuleEnabled()) {
        runSemanticAnalysisAsync(filePath, ws, requestId).catch((err) => {
          logServerError(
            "Async semantic analysis failed",
            err instanceof Error ? err.message : String(err)
          );
        });
      } else {
        logSemanticSkipped(filePath, "rule not enabled");
      }
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

      // === PASS 1: Fast rules ===
      const fastIssues = await lintFileFast(filePath, (phase) => {
        sendMessage(ws, { type: "lint:progress", filePath, requestId, phase });
      });

      const fastSentinels = fastIssues.filter(isSentinelIssue);
      for (const se of fastSentinels) {
        logRuleInternalError(se.ruleId ?? "unknown", filePath, se.message);
      }

      const fastFiltered = fastIssues
        .filter((i) => !isSentinelIssue(i))
        .filter((issue) => issue.dataLoc === dataLoc);

      // Send fast results immediately
      sendMessage(ws, {
        type: "lint:result",
        filePath,
        requestId,
        issues: fastFiltered,
      });

      // Send Done for fast pass immediately
      {
        const elapsed = Date.now() - startedAt;
        sendMessage(ws, {
          type: "lint:progress",
          filePath,
          requestId,
          phase: `Done (${fastFiltered.length} issues, ${elapsed}ms)`,
        });
      }

      {
        const profileSummary = await formatRuleProfileProgress();
        if (profileSummary) {
          sendMessage(ws, {
            type: "lint:progress",
            filePath,
            requestId,
            phase: profileSummary,
          });
        }
      }

      // === PASS 2: Semantic analysis (async, non-blocking) ===
      if (isSemanticRuleEnabled()) {
        runSemanticAnalysisAsync(filePath, ws, requestId).catch((err) => {
          logServerError(
            "Async semantic analysis failed",
            err instanceof Error ? err.message : String(err)
          );
        });
      } else {
        logSemanticSkipped(filePath, "rule not enabled");
      }
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

      // Update subscription count in dashboard
      updateSubscriptionCount(subscriptions.size);
      break;
    }

    case "cache:invalidate": {
      const { filePath } = message;
      if (filePath) {
        const absolutePath = resolveRequestedFilePath(filePath);
        cache.delete(absolutePath);
        fastCache.delete(absolutePath);
        semanticCache.delete(absolutePath);
      } else {
        cache.clear();
        fastCache.clear();
        semanticCache.clear();
      }
      // Update cache count in dashboard
      updateCacheCount(cache.size + fastCache.size + semanticCache.size);
      break;
    }

    case "vision:analyze": {
      const visionMsg = message as VisionAnalyzeMessage;
      logVisionAnalyze(visionMsg.route, visionMsg.requestId);

      // Fire-and-forget: run vision analysis in background
      runVisionAnalysisInBackground(ws, visionMsg).catch((err) => {
        logServerError(
          "Vision analysis failed",
          err instanceof Error ? err.message : String(err)
        );
      });
      break;
    }

    case "vision:check": {
      const { requestId } = message as VisionCheckMessage;
      logVisionCheck(requestId);

      try {
        const analyzer = await getVisionAnalyzerInstance();
        if (!analyzer) {
          sendMessage(ws, {
            type: "vision:status",
            available: false,
            requestId,
          });
          break;
        }
        const analyzerObj = analyzer as Record<string, unknown>;
        const model =
          typeof analyzerObj.getModel === "function"
            ? (analyzerObj.getModel as () => string)()
            : undefined;
        sendMessage(ws, {
          type: "vision:status",
          available: true,
          model,
          requestId,
        });
      } catch {
        sendMessage(ws, { type: "vision:status", available: false, requestId });
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
        const relativePath = normalizeDataLocFilePath(
          absolutePath,
          serverAppRootForVision
        );

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
        const coveragePath = join(
          serverAppRootForVision,
          "coverage",
          "coverage-final.json"
        );

        if (!existsSync(coveragePath)) {
          sendMessage(ws, {
            type: "coverage:error",
            error:
              "Coverage data not found. Run tests with coverage first (e.g., `vitest run --coverage`)",
            requestId,
          });
          break;
        }

        const coverageData = JSON.parse(readFileSync(coveragePath, "utf-8"));
        logCoverageResult(Object.keys(coverageData).length);

        sendMessage(ws, {
          type: "coverage:result",
          coverage: coverageData,
          timestamp: Date.now(),
          requestId,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logServerError(`coverage:error`, errorMessage);
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
            error:
              "Invalid dataUrl: must be a base64 PNG data URL (data:image/png;base64,...)",
            requestId,
          });
          break;
        }

        // Extract base64 data
        const base64Data = dataUrl.replace(dataUrlPattern, "");

        // Sanitize route for filename (replace / with -, remove special chars)
        const sanitizedRoute =
          route
            .replace(/^\//, "") // Remove leading slash
            .replace(/\//g, "-") // Replace slashes with dashes
            .replace(/[^a-zA-Z0-9_-]/g, "_") || // Replace special chars with underscore
          "root"; // Default to "root" for empty route

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
        const screenshotsDir = join(
          serverAppRootForVision,
          ".uilint",
          "screenshots"
        );
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

        logScreenshotSaved(filename, Math.round(imageBuffer.length / 1024));

        // Send success response
        sendMessage(ws, {
          type: "screenshot:saved",
          filename,
          path: imagePath,
          requestId,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logServerError(`screenshot:error`, errorMessage);
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
  // Update subscription count in dashboard
  updateSubscriptionCount(subscriptions.size);
}

/**
 * Handle file change
 */
function handleFileChange(filePath: string): void {
  const subscribers = subscriptions.get(filePath);
  if (!subscribers || subscribers.size === 0) return;

  // Invalidate cache
  cache.delete(filePath);
  fastCache.delete(filePath);
  semanticCache.delete(filePath);

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
    logCoverageResult(Object.keys(coverageData).length);

    broadcast({
      type: "coverage:result",
      coverage: coverageData,
      timestamp: Date.now(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logServerError(`Failed to read coverage data`, errorMessage);
    broadcast({
      type: "coverage:error",
      error: `Failed to read coverage: ${errorMessage}`,
    });
  }
}

// In-memory config store (runtime only, for broadcasting to clients)
const configStore = new Map<string, unknown>();

// Track connected clients for broadcasting
const connectedClientsSet = new Set<WebSocket>();

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
  logConfigSet(key, value);
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
  setPluginStatus("duplicates", "processing", "Preparing index...");
  startBackgroundTask(
    "duplicates-index",
    "Duplicates Index",
    "Waiting for Ollama..."
  );

  // Acquire exclusive access to Ollama to avoid model contention
  const release = await acquireOllamaMutex("duplicates");

  broadcast({ type: "duplicates:indexing:start" });
  broadcast({
    type: "plugin:operation:start",
    pluginId: "duplicates",
    operationName: "indexing",
    message: "Building duplicates index...",
  });

  try {
    const { indexDirectory } = await import("uilint-duplicates");
    const result = await indexDirectory(appRoot, {
      onProgress: (message: string, current?: number, total?: number) => {
        // Update dashboard progress
        const progress =
          total && total > 0 ? Math.round(((current || 0) / total) * 100) : 0;
        updateBackgroundTaskProgress(
          "duplicates-index",
          progress,
          current,
          total,
          message
        );
        updatePluginProgress("duplicates", progress, current, total, message);
        // Broadcast to connected clients
        broadcast({
          type: "duplicates:indexing:progress",
          message,
          current,
          total,
        });
        broadcast({
          type: "plugin:operation:progress",
          pluginId: "duplicates",
          operationName: "indexing",
          current,
          total,
          message,
        });
      },
    });

    const successMsg = `${result.totalChunks} chunks (${result.added} added, ${
      result.modified
    } modified, ${result.deleted} deleted) in ${(
      result.duration / 1000
    ).toFixed(1)}s`;
    completeBackgroundTask("duplicates-index", `Index complete: ${successMsg}`);
    setPluginStatus("duplicates", "complete", successMsg);
    setTimeout(() => setPluginStatus("duplicates", "idle"), 3000);
    broadcast({
      type: "duplicates:indexing:complete",
      added: result.added,
      modified: result.modified,
      deleted: result.deleted,
      totalChunks: result.totalChunks,
      duration: result.duration,
    });
    broadcast({
      type: "plugin:operation:complete",
      pluginId: "duplicates",
      operationName: "indexing",
      message: successMsg,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    completeBackgroundTask("duplicates-index", undefined, msg);
    setPluginStatus("duplicates", "error", msg);
    setTimeout(() => setPluginStatus("duplicates", "idle"), 3000);
    broadcast({ type: "duplicates:indexing:error", error: msg });
    broadcast({
      type: "plugin:operation:error",
      pluginId: "duplicates",
      operationName: "indexing",
      error: msg,
    });
  } finally {
    release();
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
    logServerInfo(`${count} file(s) changed, updating index...`);
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
  setPluginStatus("coverage", "processing", "Checking coverage setup...");

  try {
    // Check if coverage rule is enabled
    if (!isCoverageRuleEnabled(appRoot)) {
      logServerInfo("Coverage rule not enabled, skipping preparation");
      setPluginStatus("coverage", "complete", "Rule not enabled");
      setTimeout(() => setPluginStatus("coverage", "idle"), 3000);
      return;
    }

    // Detect current setup
    const setup = detectCoverageSetup(appRoot);

    // Check if preparation needed
    if (!needsCoveragePreparation(setup)) {
      logServerInfo("Coverage data is up-to-date");
      setPluginStatus("coverage", "complete", "Coverage data up-to-date");
      setTimeout(() => setPluginStatus("coverage", "idle"), 3000);
      return;
    }

    // Run preparation
    startBackgroundTask("coverage-prep", "Coverage Prep", "Starting...");
    setPluginStatus("coverage", "processing", "Starting coverage preparation...");
    broadcast({ type: "coverage:setup:start" });

    // Check environment variables for skipping
    const skipPackageInstall = process.env.UILINT_SKIP_COVERAGE_INSTALL === "1";
    const skipTests = process.env.UILINT_SKIP_COVERAGE_TESTS === "1";

    const result = await prepareCoverage({
      appRoot,
      skipPackageInstall,
      skipTests,
      silent: isDashboardEnabled(),
      onProgress: (message, phase) => {
        updateBackgroundTaskProgress(
          "coverage-prep",
          50,
          undefined,
          undefined,
          message
        );
        setPluginStatus("coverage", "processing", message);
        broadcast({ type: "coverage:setup:progress", message, phase });
      },
    });

    if (result.error) {
      // Continue with warning on test failures (don't block server startup)
      completeBackgroundTask("coverage-prep", undefined, result.error);
      setPluginStatus("coverage", "error", result.error);
      setTimeout(() => setPluginStatus("coverage", "idle"), 3000);
    } else {
      const parts = [];
      if (result.packageAdded) parts.push("package installed");
      if (result.configModified) parts.push("config modified");
      if (result.testsRan) parts.push("tests ran");
      if (result.coverageGenerated) parts.push("coverage generated");

      const successMsg = `Coverage prepared: ${parts.join(", ")} in ${(
        result.duration / 1000
      ).toFixed(1)}s`;
      completeBackgroundTask("coverage-prep", successMsg);
      setPluginStatus("coverage", "complete", successMsg);
      setTimeout(() => setPluginStatus("coverage", "idle"), 3000);
    }

    broadcast({
      type: "coverage:setup:complete",
      ...result,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    completeBackgroundTask("coverage-prep", undefined, msg);
    setPluginStatus("coverage", "error", msg);
    setTimeout(() => setPluginStatus("coverage", "idle"), 3000);
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
  // Normalize ruleId - strip "uilint/" prefix if present since
  // updateRuleSeverityInConfig adds it internally
  const normalizedRuleId = ruleId.startsWith("uilint/")
    ? ruleId.slice("uilint/".length)
    : ruleId;

  logRuleConfigSet(normalizedRuleId, severity, !!options);

  // Find the ESLint config file
  const configPath = findEslintConfigFile(serverAppRootForVision);
  if (!configPath) {
    const error = `No ESLint config file found in ${serverAppRootForVision}`;
    logServerError(error);
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
    result = updateRuleConfigInConfig(
      configPath,
      normalizedRuleId,
      severity,
      options
    );
  } else {
    // Update severity only
    result = updateRuleSeverityInConfig(configPath, normalizedRuleId, severity);
  }

  if (result.success) {
    logServerInfo(`Updated uilint/${normalizedRuleId} -> ${severity}`);

    // Clear ESLint instance cache to pick up the new config
    eslintInstances.clear();
    eslintFastInstances.clear();
    cache.clear();
    fastCache.clear();
    semanticCache.clear();
    updateCacheCount(0);

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
    logServerError(`Failed to update rule: ${result.error}`);
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
  const preferredPort = options.port || DEFAULT_PORT;

  // Determine if we should use the dashboard UI
  // Enable dashboard if TTY and not explicitly disabled
  const useDashboardUI = process.stdout.isTTY && !options.noDashboard;

  if (useDashboardUI) {
    enableDashboard();
    // Register all Ollama-consuming plugins with the dashboard.
    // Model names are defaults; corrected lazily via setPluginModel() when each plugin runs.
    registerPlugin("semantic", "Semantic", "qwen3-vl:8b-instruct");
    registerPlugin("vision", "Vision", "qwen3-vl:8b-instruct");
    registerPlugin("duplicates", "Duplicates", "nomic-embed-text");
    registerPlugin("coverage", "Coverage", "vitest");
  } else {
    disableDashboard();
  }

  // Load plugin ESLint rules before anything accesses the registries.
  // This triggers auto-registration of plugin rules if installed.
  const pluginManifests = await discoverPlugins();
  await loadPluginESLintRules(pluginManifests);

  const cwd = process.cwd();
  const wsRoot = findWorkspaceRoot(cwd);
  const appRoot = pickAppRoot({ cwd, workspaceRoot: wsRoot });
  serverAppRootForVision = appRoot;

  // Set workspace info in dashboard
  setWorkspaceInfo(wsRoot, appRoot, cwd);

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
    logServerInfo(`Watching coverage`, coveragePath);
  }

  // Find an available port (auto-increment if preferred port is in use)
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    logServerInfo(`Port ${preferredPort} in use, using ${port}`);
  }

  // Create HTTP server with discovery endpoint and WebSocket upgrade
  const httpServer = createServer(
    (req: IncomingMessage, res: ServerResponse) => {
      // CORS preflight
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        });
        res.end();
        return;
      }

      const parsedUrl = new URL(req.url ?? "/", `http://localhost:${port}`);

      if (parsedUrl.pathname === "/_uilint/info") {
        const probePath = parsedUrl.searchParams.get("probe");
        let probeExists: boolean | undefined;
        if (probePath) {
          // Check if the probed file exists relative to appRoot
          const absolute = join(appRoot, probePath);
          probeExists = existsSync(absolute);
        }

        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(
          JSON.stringify({
            appRoot,
            workspaceRoot: wsRoot,
            serverCwd: cwd,
            port,
            pid: process.pid,
            ...(probeExists !== undefined && { probeExists }),
          })
        );
        return;
      }

      res.writeHead(404);
      res.end();
    }
  );

  // Create WebSocket server in noServer mode (HTTP server handles upgrade)
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  // Start listening
  httpServer.listen(port, "127.0.0.1");

  // Write port file so other tools can find this server
  const portFilePath = join(appRoot, ".uilint", "port");
  const uilintDir = join(appRoot, ".uilint");
  if (!existsSync(uilintDir)) mkdirSync(uilintDir, { recursive: true });
  writeFileSync(portFilePath, String(port), "utf-8");

  /** Clean up port file on shutdown */
  function removePortFile(): void {
    try {
      unlinkSync(portFilePath);
    } catch {
      // Ignore — file may already be gone
    }
  }

  // WebSocket keepalive: ping all clients every 30 seconds to detect stale connections
  const PING_INTERVAL = 30_000;
  const aliveClients = new WeakSet<WebSocket>();
  const pingInterval = setInterval(() => {
    for (const ws of connectedClientsSet) {
      if (!aliveClients.has(ws)) {
        ws.terminate();
        continue;
      }
      aliveClients.delete(ws);
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }
  }, PING_INTERVAL);

  // Start building the duplicates index in the background
  // This runs incrementally - very fast if nothing changed
  buildDuplicatesIndex(appRoot).catch((err) => {
    logServerError(`Failed to build duplicates index`, err.message);
  });

  // Prepare coverage data for require-test-coverage rule (startup only)
  // This installs packages, modifies config, and runs tests if needed
  buildCoverageData(appRoot).catch((err) => {
    // Don't block server startup on coverage failures
    logServerWarning(`Failed to prepare coverage`, err.message);
  });

  wss.on("connection", (ws) => {
    connectedClients += 1;
    connectedClientsSet.add(ws);
    aliveClients.add(ws);
    logClientConnect(connectedClients);

    // Track keepalive
    ws.on("pong", () => {
      aliveClients.add(ws);
    });

    // Send workspace info to client on connect
    sendMessage(ws, {
      type: "workspace:info",
      appRoot,
      workspaceRoot: wsRoot,
      serverCwd: cwd,
    });

    // Send workspace capabilities (hook availability, etc.)
    const hookInfo = detectPostToolUseHook(appRoot);
    sendMessage(ws, {
      type: "workspace:capabilities",
      postToolUseHook: hookInfo,
    });
    if (hookInfo.enabled) {
      logServerInfo(`Post-tool-use hook detected: ${hookInfo.provider}`);
    }

    // Read current rule configs from ESLint config file
    const eslintConfigPath = findEslintConfigFile(appRoot);
    const currentRuleConfigs = eslintConfigPath
      ? readRuleConfigsFromConfig(eslintConfigPath)
      : new Map<
          string,
          {
            severity: "error" | "warn" | "off";
            options?: Record<string, unknown>;
          }
        >();

    // Send installed rules metadata (only rules that exist in the ESLint config)
    // Include current severities from the ESLint config so UI reflects saved state
    // Use full rule IDs (uilint/...) for consistency with ESLint output
    sendMessage(ws, {
      type: "rules:metadata",
      rules: ruleRegistry
        .filter((rule) => currentRuleConfigs.has(rule.id))
        .map((rule) => {
          const currentConfig = currentRuleConfigs.get(rule.id);
          return {
            id: `uilint/${rule.id}`,
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
      logClientDisconnect(connectedClients);
      handleDisconnect(ws);
    });

    ws.on("error", (error) => {
      logServerError(`WebSocket error`, error.message);
    });
  });

  wss.on("error", (error) => {
    logServerError(`Server error`, error.message);
  });

  // Set server as running in dashboard
  setServerRunning(port);

  // Render dashboard or keep server running
  if (useDashboardUI) {
    // Dynamic import to avoid loading Ink in non-TTY environments
    const { renderDashboard } = await import("./serve/dashboard/render.js");
    const { waitUntilExit } = renderDashboard({
      onQuit: () => {
        clearInterval(pingInterval);
        wss.close();
        httpServer.close();
        fileWatcher?.close();
        removePortFile();
      },
      onRebuildIndex: () => {
        buildDuplicatesIndex(appRoot);
      },
      onClearCache: () => {
        // 1. In-memory lint caches
        cache.clear();
        fastCache.clear();
        semanticCache.clear();

        // 2. ESLint instance caches (forces fresh config parse)
        eslintInstances.clear();
        eslintFastInstances.clear();

        updateCacheCount(0);
        logCacheInvalidate();

        // 3. Disk-based plugin caches
        // Semantic + color suggestion caches (use wsRoot because
        // runSemanticAnalysisAsync resolves cache via findWorkspaceRoot)
        import("uilint-eslint").then(
          ({ clearCache, clearAllSuggestions }) => {
            clearCache(wsRoot);
            clearAllSuggestions(wsRoot);
            if (appRoot !== wsRoot) {
              clearCache(appRoot);
              clearAllSuggestions(appRoot);
            }
          }
        );

        // Coverage: clear in-memory cache + delete disk file + rebuild
        import("uilint-coverage").then(({ clearCoverageCache }) => {
          clearCoverageCache();
        });
        const coveragePath = join(appRoot, "coverage", "coverage-final.json");
        if (existsSync(coveragePath)) {
          unlinkSync(coveragePath);
        }
        buildCoverageData(appRoot);

        // Duplicates: clear indexer cache + rebuild index
        import("uilint-duplicates").then(({ clearIndexerCache }) => {
          clearIndexerCache(appRoot);
        });
        buildDuplicatesIndex(appRoot);
      },
    });

    // Wait for dashboard to exit
    await waitUntilExit();
  } else {
    // Keep the server running in non-TTY mode
    await new Promise<void>((resolve) => {
      process.on("SIGINT", () => {
        logServerInfo("Shutting down...");
        clearInterval(pingInterval);
        wss.close();
        httpServer.close();
        fileWatcher?.close();
        removePortFile();
        resolve();
      });
    });
  }
}
