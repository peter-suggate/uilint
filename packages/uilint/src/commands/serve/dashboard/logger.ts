/**
 * Dashboard logger adapter
 *
 * Provides logging functions that either update the dashboard store
 * or fall back to console logging for non-TTY environments.
 */

import { getDashboardStore } from "./store.js";
import type { ActivityType } from "./types.js";
import pc from "picocolors";

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
    store.addActivity({ type, message, detail, isError, isWarning });
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
  logActivity("lint:done", `${filePath} \u2192 ${issueCount} issue(s) (${elapsedMs}ms)`);
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
  logActivity("vision:done", `${route} \u2192 ${issueCount} issue(s) (${elapsedMs}ms)`);
}

/**
 * Log a vision check
 */
export function logVisionCheck(requestId?: string): void {
  logActivity("vision:check", requestId ? `(req ${requestId})` : "");
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
    store.addActivity({ type: "client:connect", message: `(${totalClients} total)` });
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
    store.addActivity({ type: "client:disconnect", message: `(${totalClients} total)` });
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
