/**
 * Dashboard state types for the WebSocket server CLI
 */

export type ActivityType =
  | "lint:file"
  | "lint:element"
  | "lint:done"
  | "subscribe"
  | "cache:invalidate"
  | "vision:analyze"
  | "vision:done"
  | "vision:check"
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
  | "info";

export interface ActivityEntry {
  id: string;
  timestamp: Date;
  type: ActivityType;
  message: string;
  detail?: string;
  isError?: boolean;
  isWarning?: boolean;
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

export interface DashboardState {
  // Server status
  isRunning: boolean;
  port: number;
  workspace: WorkspaceInfo | null;

  // Stats
  stats: ServerStats;

  // Background tasks
  backgroundTasks: Map<string, BackgroundTask>;

  // Activity log (most recent first)
  activities: ActivityEntry[];
  maxActivities: number;

  // Display options
  verbose: boolean;
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
}

export type DashboardStore = DashboardState & DashboardActions;
