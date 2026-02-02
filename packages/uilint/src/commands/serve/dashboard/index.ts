/**
 * Dashboard module exports
 */

export { ServeDashboard, type ServeDashboardProps } from "./ServeDashboard.js";
export { getDashboardStore, createDashboardStore, resetDashboardStore } from "./store.js";
export type {
  DashboardState,
  DashboardStore,
  DashboardActions,
  ActivityEntry,
  ActivityType,
  BackgroundTask,
  BackgroundTaskStatus,
  ServerStats,
  WorkspaceInfo,
} from "./types.js";
