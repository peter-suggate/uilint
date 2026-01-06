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
 * - Server -> Client: { type: 'lint:result', filePath: string, issues: Issue[], requestId?: string }
 * - Server -> Client: { type: 'lint:progress', filePath: string, phase: string, requestId?: string }
 * - Server -> Client: { type: 'file:changed', filePath: string }
 */

import { existsSync, statSync, readdirSync, readFileSync } from "fs";
import { createRequire } from "module";
import { dirname, resolve, relative, join } from "path";
import { WebSocketServer, WebSocket } from "ws";
import { watch, type FSWatcher } from "chokidar";
import { findWorkspaceRoot } from "uilint-core/node";
import {
  logInfo,
  logSuccess,
  logWarning,
  logError,
  pc,
} from "../utils/prompts.js";

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

type ClientMessage =
  | LintFileMessage
  | LintElementMessage
  | SubscribeFileMessage
  | CacheInvalidateMessage;

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

type ServerMessage =
  | LintResultMessage
  | LintProgressMessage
  | FileChangedMessage;

// Simple in-memory cache
interface CacheEntry {
  issues: LintIssue[];
  mtimeMs: number;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

// ESLint instances cached per detected project root
const eslintInstances = new Map<string, unknown>();

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

// Local require (from uilint-cli deps) for TSX parsing
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
 * Start the WebSocket server
 */
export async function serve(options: ServeOptions): Promise<void> {
  const port = options.port || 9234;

  const cwd = process.cwd();
  const wsRoot = findWorkspaceRoot(cwd);
  logInfo(`Workspace root: ${pc.dim(wsRoot)}`);
  logInfo(`Server cwd:     ${pc.dim(cwd)}`);

  // Create file watcher
  fileWatcher = watch([], {
    persistent: true,
    ignoreInitial: true,
  });

  fileWatcher.on("change", (path) => {
    handleFileChange(resolve(path));
  });

  // Create WebSocket server
  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws) => {
    connectedClients += 1;
    logInfo(`Client connected (${connectedClients} total)`);

    ws.on("message", (data) => {
      handleMessage(ws, data.toString());
    });

    ws.on("close", () => {
      connectedClients = Math.max(0, connectedClients - 1);
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
