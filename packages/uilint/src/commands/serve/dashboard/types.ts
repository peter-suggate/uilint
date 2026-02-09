/**
 * Dashboard state types for the WebSocket server CLI
 */

/**
 * Activity types for the dashboard log.
 * Core types are listed here. Plugins can use any string as an activity type.
 */
export type ActivityType =
  | "lint:file"
  | "lint:element"
  | "lint:done"
  | "subscribe"
  | "cache:invalidate"
  | "config:set"
  | "rule:config:set"
  | "screenshot:save"
  | "screenshot:saved"
  | "coverage:request"
  | "coverage:result"
  | "file:changed"
  | "client:connect"
  | "client:disconnect"
  | "error"
  | "warning"
  | "info"
  | (string & {});

/**
 * Coarse category for activity log filtering.
 * Plugins can register their own categories via string extension.
 */
export type ActivityCategory = "all" | "errors" | "lint" | "system" | (string & {});

export interface ActivityEntry {
  id: string;
  timestamp: Date;
  type: ActivityType;
  message: string;
  detail?: string;
  isError?: boolean;
  isWarning?: boolean;
  category?: ActivityCategory;
}

export type BackgroundTaskStatus = "idle" | "running" | "complete" | "error";

export interface BackgroundTask {
  id: string;
  name: string;
  status: BackgroundTaskStatus;
  progress?: number; // 0-100
  current?: number;
  total?: number;
  message?: string;
  error?: string;
}

// ============================================================================
// Plugin Status (Ollama-consuming plugins)
// ============================================================================

/** Known plugin identifiers that use the Ollama mutex. */
export type PluginId = "semantic" | "vision" | "duplicates";

/**
 * Lifecycle states for an Ollama-consuming plugin.
 *
 * idle              → Not doing anything (default resting state)
 * waiting-for-ollama → Called acquireOllamaMutex(), queued behind another plugin
 * using-ollama      → Holds the mutex, actively calling Ollama
 * processing        → Released the mutex, doing post-processing (writing cache, etc.)
 * complete          → Finished successfully (transient — auto-resets to idle)
 * error             → Finished with error (transient — auto-resets to idle)
 */
export type PluginLifecycle =
  | "idle"
  | "waiting-for-ollama"
  | "using-ollama"
  | "processing"
  | "complete"
  | "error";

/** Persistent state for a single plugin shown in the dashboard. */
export interface PluginState {
  id: PluginId;
  /** Human-readable short name (e.g. "Semantic") */
  name: string;
  /** Ollama model this plugin uses (e.g. "qwen3-vl:8b-instruct") */
  model: string;
  /** Current lifecycle status */
  status: PluginLifecycle;
  /** Short description of current activity */
  message?: string;
  /** Progress 0-100 */
  progress?: number;
  /** Numerator for progress display */
  current?: number;
  /** Denominator for progress display */
  total?: number;
  /** Error message when status is "error" */
  error?: string;
}

export interface ServerStats {
  connectedClients: number;
  subscriptions: number;
  cacheEntries: number;
  startTime: Date;
}

export interface WorkspaceInfo {
  workspaceRoot: string;
  appRoot: string;
  serverCwd: string;
}

export type OllamaStatusState = "checking" | "connected" | "offline" | "error";

export interface OllamaStatus {
  status: OllamaStatusState;
  model?: string;
  lastChecked?: Date;
}

export interface DashboardState {
  // Server status
  isRunning: boolean;
  port: number;
  workspace: WorkspaceInfo | null;

  // Stats
  stats: ServerStats;

  // Ollama status
  ollamaStatus: OllamaStatus;

  // Background tasks
  backgroundTasks: Map<string, BackgroundTask>;

  // Plugin states (Ollama-consuming plugins)
  pluginStates: Map<PluginId, PluginState>;

  // Activity log (most recent first)
  activities: ActivityEntry[];
  maxActivities: number;

  // Display options
  verbose: boolean;

  // Activity filter
  activeFilter: ActivityCategory;
}

export interface DashboardActions {
  // Server lifecycle
  setRunning: (running: boolean) => void;
  setPort: (port: number) => void;
  setWorkspace: (info: WorkspaceInfo) => void;

  // Stats updates
  updateStats: (partial: Partial<ServerStats>) => void;
  incrementClients: () => void;
  decrementClients: () => void;
  incrementSubscriptions: () => void;
  decrementSubscriptions: () => void;
  setCacheEntries: (count: number) => void;

  // Background tasks
  setBackgroundTask: (task: BackgroundTask) => void;
  updateBackgroundTaskProgress: (
    id: string,
    progress: number,
    current?: number,
    total?: number,
    message?: string
  ) => void;
  completeBackgroundTask: (id: string, error?: string) => void;

  // Activity logging
  addActivity: (entry: Omit<ActivityEntry, "id" | "timestamp">) => void;
  clearActivities: () => void;

  // Display options
  toggleVerbose: () => void;

  // Activity filter
  cycleFilter: () => void;

  // Ollama status
  setOllamaStatus: (status: OllamaStatus) => void;

  // Plugin states
  registerPlugin: (id: PluginId, name: string, model: string) => void;
  setPluginState: (id: PluginId, update: Partial<PluginState>) => void;
}

export type DashboardStore = DashboardState & DashboardActions;
