/**
 * Dashboard state store - simple event-based state management
 */

import type {
  DashboardState,
  DashboardStore,
  ActivityEntry,
  BackgroundTask,
  WorkspaceInfo,
  ServerStats,
  OllamaStatus,
} from "./types.js";

type Listener = () => void;

let activityIdCounter = 0;

function createInitialState(): DashboardState {
  return {
    isRunning: false,
    port: 9234,
    workspace: null,
    stats: {
      connectedClients: 0,
      subscriptions: 0,
      cacheEntries: 0,
      startTime: new Date(),
    },
    ollamaStatus: {
      status: "checking",
    },
    backgroundTasks: new Map(),
    activities: [],
    maxActivities: 50,
    verbose: false,
  };
}

/**
 * Create a dashboard store instance
 */
export function createDashboardStore(): DashboardStore & {
  subscribe: (listener: Listener) => () => void;
  getState: () => DashboardState;
} {
  let state = createInitialState();
  const listeners = new Set<Listener>();

  function notify() {
    for (const listener of listeners) {
      listener();
    }
  }

  const store: DashboardStore & {
    subscribe: (listener: Listener) => () => void;
    getState: () => DashboardState;
  } = {
    // State getters
    get isRunning() {
      return state.isRunning;
    },
    get port() {
      return state.port;
    },
    get workspace() {
      return state.workspace;
    },
    get stats() {
      return state.stats;
    },
    get backgroundTasks() {
      return state.backgroundTasks;
    },
    get activities() {
      return state.activities;
    },
    get maxActivities() {
      return state.maxActivities;
    },
    get verbose() {
      return state.verbose;
    },
    get ollamaStatus() {
      return state.ollamaStatus;
    },

    // Server lifecycle
    setRunning(running: boolean) {
      state = { ...state, isRunning: running };
      if (running) {
        state.stats = { ...state.stats, startTime: new Date() };
      }
      notify();
    },

    setPort(port: number) {
      state = { ...state, port };
      notify();
    },

    setWorkspace(info: WorkspaceInfo) {
      state = { ...state, workspace: info };
      notify();
    },

    // Stats updates
    updateStats(partial: Partial<ServerStats>) {
      state = { ...state, stats: { ...state.stats, ...partial } };
      notify();
    },

    incrementClients() {
      state = {
        ...state,
        stats: {
          ...state.stats,
          connectedClients: state.stats.connectedClients + 1,
        },
      };
      notify();
    },

    decrementClients() {
      state = {
        ...state,
        stats: {
          ...state.stats,
          connectedClients: Math.max(0, state.stats.connectedClients - 1),
        },
      };
      notify();
    },

    incrementSubscriptions() {
      state = {
        ...state,
        stats: {
          ...state.stats,
          subscriptions: state.stats.subscriptions + 1,
        },
      };
      notify();
    },

    decrementSubscriptions() {
      state = {
        ...state,
        stats: {
          ...state.stats,
          subscriptions: Math.max(0, state.stats.subscriptions - 1),
        },
      };
      notify();
    },

    setCacheEntries(count: number) {
      state = {
        ...state,
        stats: { ...state.stats, cacheEntries: count },
      };
      notify();
    },

    // Background tasks
    setBackgroundTask(task: BackgroundTask) {
      const newTasks = new Map(state.backgroundTasks);
      newTasks.set(task.id, task);
      state = { ...state, backgroundTasks: newTasks };
      notify();
    },

    updateBackgroundTaskProgress(
      id: string,
      progress: number,
      current?: number,
      total?: number,
      message?: string
    ) {
      const task = state.backgroundTasks.get(id);
      if (task) {
        const newTasks = new Map(state.backgroundTasks);
        newTasks.set(id, {
          ...task,
          progress,
          current,
          total,
          message,
          status: "running",
        });
        state = { ...state, backgroundTasks: newTasks };
        notify();
      }
    },

    completeBackgroundTask(id: string, error?: string) {
      const task = state.backgroundTasks.get(id);
      if (task) {
        const newTasks = new Map(state.backgroundTasks);
        newTasks.set(id, {
          ...task,
          status: error ? "error" : "complete",
          progress: error ? task.progress : 100,
          error,
        });
        state = { ...state, backgroundTasks: newTasks };
        notify();
      }
    },

    // Activity logging
    addActivity(entry: Omit<ActivityEntry, "id" | "timestamp">) {
      const newEntry: ActivityEntry = {
        ...entry,
        id: `activity-${++activityIdCounter}`,
        timestamp: new Date(),
      };

      // Prepend new entry, trim to max
      const activities = [newEntry, ...state.activities].slice(
        0,
        state.maxActivities
      );
      state = { ...state, activities };
      notify();
    },

    clearActivities() {
      state = { ...state, activities: [] };
      notify();
    },

    // Display options
    toggleVerbose() {
      state = { ...state, verbose: !state.verbose };
      notify();
    },

    // Ollama status
    setOllamaStatus(status: OllamaStatus) {
      state = { ...state, ollamaStatus: status };
      notify();
    },

    // Subscription
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getState() {
      return state;
    },
  };

  return store;
}

// Singleton store instance for use across the application
let globalStore: ReturnType<typeof createDashboardStore> | null = null;

export function getDashboardStore(): ReturnType<typeof createDashboardStore> {
  if (!globalStore) {
    globalStore = createDashboardStore();
  }
  return globalStore;
}

// Reset store (useful for testing)
export function resetDashboardStore(): void {
  globalStore = null;
}
