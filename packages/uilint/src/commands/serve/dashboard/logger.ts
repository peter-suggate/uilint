/**
 * Dashboard logger adapter
 *
 * Provides logging functions that either update the dashboard store
 * or fall back to console logging for non-TTY environments.
 */

import { getDashboardStore } from "./store.js";
import type { ActivityType, ActivityCategory, PluginId, PluginLifecycle } from "./types.js";
import pc from "picocolors";

/**
 * Derive a coarse category from an activity type for log filtering.
 */
function deriveCategory(
  type: ActivityType,
  isError?: boolean
): ActivityCategory {
  if (isError || type === "error") return "errors";
  if (type === "warning") return "errors";
  if (type.startsWith("vision:")) return "vision";
  if (type.startsWith("semantic:")) return "semantic";
  if (type.startsWith("lint:")) return "lint";
  return "system";
}

// Simple console logging functions that work in any environment (including non-TTY)
// These use direct console.log instead of @clack/prompts which can suppress output
function consoleInfo(message: string): void {
  console.log(pc.blue("i") + " " + message);
}

function consoleSuccess(message: string): void {
  console.log(pc.green("\u2713") + " " + message);
}

function consoleWarning(message: string): void {
  console.log(pc.yellow("\u26A0") + " " + message);
}

function consoleError(message: string): void {
  console.log(pc.red("\u2717") + " " + message);
}

let useDashboard = false;

/**
 * Enable dashboard mode (disables console logging)
 */
export function enableDashboard(): void {
  useDashboard = true;
}

/**
 * Disable dashboard mode (enables console logging)
 */
export function disableDashboard(): void {
  useDashboard = false;
}

/**
 * Check if dashboard mode is enabled
 */
export function isDashboardEnabled(): boolean {
  return useDashboard;
}

/**
 * Log an activity to the dashboard or console
 */
export function logActivity(
  type: ActivityType,
  message: string,
  detail?: string,
  isError?: boolean,
  isWarning?: boolean
): void {
  if (useDashboard) {
    const store = getDashboardStore();
    const category = deriveCategory(type, isError);
    store.addActivity({ type, message, detail, isError, isWarning, category });
  } else {
    // Fall back to console logging
    const prefix = `${pc.dim("[ws]")} `;
    if (isError) {
      consoleError(prefix + message + (detail ? `\n  ${detail}` : ""));
    } else if (isWarning) {
      consoleWarning(prefix + message + (detail ? `\n  ${detail}` : ""));
    } else {
      consoleInfo(prefix + message + (detail ? `\n  ${detail}` : ""));
    }
  }
}

/**
 * Log a lint operation
 */
export function logLint(filePath: string, requestId?: string): void {
  const msg = filePath + (requestId ? ` (req ${requestId})` : "");
  logActivity("lint:file", msg);
}

/**
 * Log a lint completion
 */
export function logLintDone(
  filePath: string,
  issueCount: number,
  elapsedMs: number
): void {
  logActivity(
    "lint:done",
    `${filePath} \u2192 ${issueCount} issue(s) (${elapsedMs}ms)`
  );
}

/**
 * Log a file subscription
 */
export function logSubscribe(filePath: string): void {
  logActivity("subscribe", filePath);
}

/**
 * Log a cache invalidation
 */
export function logCacheInvalidate(filePath?: string): void {
  logActivity("cache:invalidate", filePath ?? "(all)");
}

/**
 * Log a vision analysis start
 */
export function logVisionAnalyze(route: string, requestId?: string): void {
  const msg = route + (requestId ? ` (req ${requestId})` : "");
  logActivity("vision:analyze", msg);
}

/**
 * Log a vision analysis completion
 */
export function logVisionDone(
  route: string,
  issueCount: number,
  elapsedMs: number
): void {
  logActivity(
    "vision:done",
    `${route} \u2192 ${issueCount} issue(s) (${elapsedMs}ms)`
  );
}

/**
 * Log a vision check
 */
export function logVisionCheck(requestId?: string): void {
  logActivity("vision:check", requestId ? `(req ${requestId})` : "");
}

/**
 * Log a semantic analysis start
 */
export function logSemanticAnalyze(
  filePath: string,
  requestId?: string
): void {
  const msg = filePath + (requestId ? ` (req ${requestId})` : "");
  logActivity("semantic:analyze", msg);
}

/**
 * Log a semantic analysis completion
 */
export function logSemanticDone(
  filePath: string,
  issueCount: number,
  elapsedMs: number
): void {
  logActivity(
    "semantic:done",
    `${filePath} \u2192 ${issueCount} issue(s) (${elapsedMs}ms)`
  );
}

/**
 * Log a semantic analysis skip (cache hit, rule disabled, missing styleguide, etc.)
 */
export function logSemanticSkipped(filePath: string, reason: string): void {
  logActivity("semantic:skip", `${filePath} \u2014 ${reason}`);
}

/**
 * Log a config set operation
 */
export function logConfigSet(key: string, value: unknown): void {
  logActivity("config:set", `${key} = ${JSON.stringify(value)}`);
}

/**
 * Log a rule config set operation
 */
export function logRuleConfigSet(
  ruleId: string,
  severity: string,
  hasOptions: boolean
): void {
  logActivity(
    "rule:config:set",
    `${ruleId} \u2192 ${severity}${hasOptions ? " (with options)" : ""}`
  );
}

/**
 * Log a screenshot save
 */
export function logScreenshotSave(route: string, requestId?: string): void {
  const msg = route + (requestId ? ` (req ${requestId})` : "");
  logActivity("screenshot:save", msg);
}

/**
 * Log a screenshot saved
 */
export function logScreenshotSaved(filename: string, sizeKb: number): void {
  logActivity("screenshot:saved", `${filename} (${sizeKb}kb)`);
}

/**
 * Log a coverage request
 */
export function logCoverageRequest(): void {
  logActivity("coverage:request", "");
}

/**
 * Log a coverage result
 */
export function logCoverageResult(fileCount: number): void {
  logActivity("coverage:result", `${fileCount} files`);
}

/**
 * Log a file change notification
 */
export function logFileChanged(filePath: string): void {
  logActivity("file:changed", filePath);
}

/**
 * Log a client connection
 */
export function logClientConnect(totalClients: number): void {
  if (useDashboard) {
    const store = getDashboardStore();
    store.incrementClients();
    store.addActivity({
      type: "client:connect",
      message: `(${totalClients} total)`,
    });
  } else {
    consoleInfo(`Client connected (${totalClients} total)`);
  }
}

/**
 * Log a client disconnection
 */
export function logClientDisconnect(totalClients: number): void {
  if (useDashboard) {
    const store = getDashboardStore();
    store.decrementClients();
    store.addActivity({
      type: "client:disconnect",
      message: `(${totalClients} total)`,
    });
  } else {
    consoleInfo(`Client disconnected (${totalClients} total)`);
  }
}

/**
 * Log an error
 */
export function logServerError(message: string, detail?: string): void {
  logActivity("error", message, detail, true);
}

/**
 * Log a warning
 */
export function logServerWarning(message: string, detail?: string): void {
  logActivity("warning", message, detail, false, true);
}

/**
 * Log an info message
 */
export function logServerInfo(message: string, detail?: string): void {
  logActivity("info", message, detail);
}

/**
 * Set workspace info in dashboard
 */
export function setWorkspaceInfo(
  workspaceRoot: string,
  appRoot: string,
  serverCwd: string
): void {
  if (useDashboard) {
    const store = getDashboardStore();
    store.setWorkspace({ workspaceRoot, appRoot, serverCwd });
  } else {
    consoleInfo(`Workspace root: ${pc.dim(workspaceRoot)}`);
    consoleInfo(`App root:       ${pc.dim(appRoot)}`);
    consoleInfo(`Server cwd:     ${pc.dim(serverCwd)}`);
  }
}

/**
 * Set server as running
 */
export function setServerRunning(port: number): void {
  if (useDashboard) {
    const store = getDashboardStore();
    store.setPort(port);
    store.setRunning(true);
  } else {
    consoleSuccess(
      `UILint WebSocket server running on ${pc.cyan(`ws://localhost:${port}`)}`
    );
    consoleInfo("Press Ctrl+C to stop");
  }
}

/**
 * Update subscription count
 */
export function updateSubscriptionCount(count: number): void {
  if (useDashboard) {
    const store = getDashboardStore();
    store.updateStats({ subscriptions: count });
  }
}

/**
 * Update cache entry count
 */
export function updateCacheCount(count: number): void {
  if (useDashboard) {
    const store = getDashboardStore();
    store.setCacheEntries(count);
  }
}

/**
 * Background task management
 */
export function startBackgroundTask(
  id: string,
  name: string,
  message?: string
): void {
  if (useDashboard) {
    const store = getDashboardStore();
    store.setBackgroundTask({
      id,
      name,
      status: "running",
      progress: 0,
      message,
    });
  } else {
    consoleInfo(`${pc.blue(name)}...`);
  }
}

export function updateBackgroundTaskProgress(
  id: string,
  progress: number,
  current?: number,
  total?: number,
  message?: string
): void {
  if (useDashboard) {
    const store = getDashboardStore();
    store.updateBackgroundTaskProgress(id, progress, current, total, message);
  } else if (message) {
    if (current !== undefined && total !== undefined) {
      consoleInfo(`  ${message} (${current}/${total})`);
    } else {
      consoleInfo(`  ${message}`);
    }
  }
}

export function completeBackgroundTask(
  id: string,
  successMessage?: string,
  error?: string
): void {
  if (useDashboard) {
    const store = getDashboardStore();
    store.completeBackgroundTask(id, error);
  } else {
    if (error) {
      consoleError(`Failed: ${error}`);
    } else if (successMessage) {
      consoleSuccess(successMessage);
    }
  }
}

/**
 * Log a rule internal/sentinel error.
 *
 * Sentinel errors are internal failures from rules with fallible backends
 * (e.g. LLM unavailable, index not built). They are filtered from client
 * results and only shown in the dashboard/server logs.
 */
export function logRuleInternalError(
  ruleId: string,
  filePath: string,
  detail: string
): void {
  logActivity("error", `Rule error [${ruleId}] ${filePath}`, detail, true);
}

// ============================================================================
// Plugin status (Ollama-consuming plugins)
// ============================================================================

/**
 * Register a plugin with the dashboard. Call once during server startup.
 */
export function registerPlugin(
  id: PluginId,
  name: string,
  model: string
): void {
  if (useDashboard) {
    const store = getDashboardStore();
    store.registerPlugin(id, name, model);
  } else {
    consoleInfo(`Plugin registered: ${name} (${model})`);
  }
}

/**
 * Update a plugin's lifecycle status in the dashboard.
 */
export function setPluginStatus(
  id: PluginId,
  status: PluginLifecycle,
  message?: string
): void {
  if (useDashboard) {
    const store = getDashboardStore();
    store.setPluginState(id, {
      status,
      message,
      error: status === "error" ? message : undefined,
      // Clear progress on terminal states
      ...(status === "idle" || status === "complete" || status === "error"
        ? { progress: undefined, current: undefined, total: undefined }
        : {}),
    });
  } else if (status === "error") {
    consoleError(`Plugin ${id}: ${message}`);
  }
}

/**
 * Update a plugin's progress during an operation.
 */
export function updatePluginProgress(
  id: PluginId,
  progress: number,
  current?: number,
  total?: number,
  message?: string
): void {
  if (useDashboard) {
    const store = getDashboardStore();
    store.setPluginState(id, { progress, current, total, message });
  }
}

/**
 * Update a plugin's model name (useful when determined lazily at runtime).
 */
export function setPluginModel(id: PluginId, model: string): void {
  if (useDashboard) {
    const store = getDashboardStore();
    store.setPluginState(id, { model });
  }
}
