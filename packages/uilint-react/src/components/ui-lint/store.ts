"use client";

/**
 * UILint Zustand Store
 *
 * Centralized state management for UILint with synchronous updates.
 * Solves the React 18 batching issue that causes scan results to chunk together.
 *
 * Includes WebSocket client for real-time communication with uilint serve.
 *
 * Uses data-loc attributes only (no React Fiber).
 */

import { create } from "zustand";
import type {
  UILintSettings,
  LocatorTarget,
  InspectedElement,
  AutoScanState,
  ElementIssue,
  ScannedElement,
  SourceFile,
  ESLintIssue,
} from "./types";
import { DEFAULT_SETTINGS, DEFAULT_AUTO_SCAN_STATE } from "./types";
import { scanDOMForSources, groupBySourceFile } from "./dom-utils";

/**
 * WebSocket message types (client -> server)
 */
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

/**
 * WebSocket message types (server -> client)
 */
interface LintResultMessage {
  type: "lint:result";
  filePath: string;
  issues: ESLintIssue[];
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

/**
 * UILint Store State and Actions
 */
export interface UILintStore {
  // ============ Settings ============
  settings: UILintSettings;
  updateSettings: (partial: Partial<UILintSettings>) => void;

  // ============ Locator Mode ============
  altKeyHeld: boolean;
  setAltKeyHeld: (held: boolean) => void;
  locatorTarget: LocatorTarget | null;
  setLocatorTarget: (target: LocatorTarget | null) => void;

  // ============ Inspection ============
  inspectedElement: InspectedElement | null;
  setInspectedElement: (el: InspectedElement | null) => void;

  // ============ Live Scanning ============
  /** Whether live scanning mode is enabled */
  liveScanEnabled: boolean;
  /** Enable live scanning and run initial scan */
  enableLiveScan: (hideNodeModules: boolean) => Promise<void>;
  /** Disable live scanning and clear all results */
  disableLiveScan: () => void;
  /** Scan newly-detected elements (called by DOM observer) */
  scanNewElements: (elements: ScannedElement[]) => Promise<void>;

  // ============ Auto-Scan State (internal) ============
  autoScanState: AutoScanState;
  elementIssuesCache: Map<string, ElementIssue>;
  scanLock: boolean;

  // Internal scan actions
  updateElementIssue: (id: string, issue: ElementIssue) => void;

  // ============ DOM Observer ============
  /** Remove scan results for elements that no longer exist in DOM */
  removeStaleResults: (elementIds: string[]) => void;

  // ============ File/Element Selection ============
  /** Currently hovered file path in scan results */
  hoveredFilePath: string | null;
  /** Currently selected file path in scan results */
  selectedFilePath: string | null;
  /** Currently selected element ID in elements panel */
  selectedElementId: string | null;
  /** Currently hovered element ID in scan results (for overlay highlighting) */
  hoveredElementId: string | null;
  setHoveredFilePath: (path: string | null) => void;
  setSelectedFilePath: (path: string | null) => void;
  setSelectedElementId: (id: string | null) => void;
  setHoveredElementId: (id: string | null) => void;

  // ============ WebSocket ============
  wsConnection: WebSocket | null;
  wsConnected: boolean;
  wsUrl: string;
  wsReconnectAttempts: number;
  eslintIssuesCache: Map<string, ESLintIssue[]>;
  wsProgressPhase: Map<string, string>;
  wsLastActivity: { filePath: string; phase: string; updatedAt: number } | null;
  wsRecentResults: Array<{
    filePath: string;
    issueCount: number;
    updatedAt: number;
  }>;

  // WebSocket actions
  connectWebSocket: (url?: string) => void;
  disconnectWebSocket: () => void;
  requestFileLint: (filePath: string) => Promise<ESLintIssue[]>;
  requestElementLint: (
    filePath: string,
    dataLoc: string
  ) => Promise<ESLintIssue[]>;
  subscribeToFile: (filePath: string) => void;
  invalidateCache: (filePath?: string) => void;

  // ============ Internal ============
  _setScanState: (state: Partial<AutoScanState>) => void;
  _runScanLoop: (elements: ScannedElement[]) => Promise<void>;
  _handleWsMessage: (data: ServerMessage) => void;
  _reconnectWebSocket: () => void;
}

/**
 * Extract data-loc value from an element's id
 * Element IDs are in format "loc:path:line:column" when they have data-loc
 */
function getDataLocFromId(id: string): string | null {
  if (id.startsWith("loc:")) {
    // Format:
    // - old: "loc:path:line:column"
    // - new: "loc:path:line:column#occurrence"
    const raw = id.slice(4); // Remove "loc:" prefix
    return raw.split("#")[0] || null;
  }
  return null;
}

/**
 * Scan an entire source file for issues via WebSocket
 * Returns ESLint issues (including semantic rule) with dataLoc values
 */
async function scanFileForIssues(
  sourceFile: SourceFile,
  store: UILintStore
): Promise<{
  issues: ESLintIssue[];
  error?: boolean;
}> {
  if (sourceFile.elements.length === 0) {
    return { issues: [] };
  }

  const filePath = sourceFile.path;
  let issues: ESLintIssue[] = [];

  // Use WebSocket for ESLint issues (includes semantic rule)
  if (store.wsConnected && store.wsConnection) {
    try {
      issues = await store.requestFileLint(filePath);
      console.log("[UILint] ESLint issues:", issues);
    } catch (err) {
      console.warn("[UILint] WebSocket lint failed:", err);
      return { issues: [], error: true };
    }
  } else {
    console.warn("[UILint] WebSocket not connected");
    return { issues: [], error: true };
  }

  return { issues };
}

/**
 * Match ESLint issues to elements by dataLoc and update the cache
 */
function distributeIssuesToElements(
  issues: ESLintIssue[],
  elements: ScannedElement[],
  updateElementIssue: (id: string, issue: ElementIssue) => void,
  hasError: boolean
): void {
  // Create a map from dataLoc to element IDs.
  // Multiple DOM elements can share the same dataLoc (e.g. list rendering),
  // so we must apply ESLint issues to all matching instances.
  const dataLocToElementIds = new Map<string, string[]>();
  for (const el of elements) {
    const dataLoc = getDataLocFromId(el.id);
    if (dataLoc) {
      const existing = dataLocToElementIds.get(dataLoc);
      if (existing) existing.push(el.id);
      else dataLocToElementIds.set(dataLoc, [el.id]);
    }
  }

  // Group ESLint issues by element
  const issuesByElement = new Map<string, ESLintIssue[]>();
  for (const issue of issues) {
    if (issue.dataLoc) {
      const elementIds = dataLocToElementIds.get(issue.dataLoc);
      if (elementIds) {
        for (const elementId of elementIds) {
          const existing = issuesByElement.get(elementId) || [];
          existing.push(issue);
          issuesByElement.set(elementId, existing);
        }
      }
    }
  }

  // Update each element with its issues
  for (const el of elements) {
    const elementIssues = issuesByElement.get(el.id) || [];
    updateElementIssue(el.id, {
      elementId: el.id,
      issues: elementIssues,
      status: hasError ? "error" : "complete",
    });
  }
}

/** Default WebSocket URL */
const DEFAULT_WS_URL = "ws://localhost:9234";

/** Max reconnect attempts before giving up */
const MAX_RECONNECT_ATTEMPTS = 5;

/** Reconnect delay in ms (exponential backoff) */
const RECONNECT_BASE_DELAY = 1000;

/** Pending requests waiting for WebSocket responses */
const pendingRequests = new Map<
  string,
  { resolve: (issues: ESLintIssue[]) => void; reject: (error: Error) => void }
>();

/** Timeout for WebSocket lint requests (in ms) */
const WS_REQUEST_TIMEOUT_MS = 120_000; // 2 minutes

function makeRequestId(): string {
  try {
    // Modern browsers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    // ignore
  }
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Create the UILint store
 */
export const useUILintStore = create<UILintStore>()((set, get) => ({
  // ============ Settings ============
  settings: DEFAULT_SETTINGS,
  updateSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
    })),

  // ============ Locator Mode ============
  altKeyHeld: false,
  setAltKeyHeld: (held) => set({ altKeyHeld: held }),
  locatorTarget: null,
  setLocatorTarget: (target) => set({ locatorTarget: target }),

  // ============ Inspection ============
  inspectedElement: null,
  setInspectedElement: (el) => set({ inspectedElement: el }),

  // ============ Live Scanning ============
  liveScanEnabled: false,
  autoScanState: DEFAULT_AUTO_SCAN_STATE,
  elementIssuesCache: new Map(),
  scanLock: false,

  _setScanState: (partial) =>
    set((state) => ({
      autoScanState: { ...state.autoScanState, ...partial },
    })),

  updateElementIssue: (id, issue) =>
    set((state) => {
      const newCache = new Map(state.elementIssuesCache);
      newCache.set(id, issue);
      return { elementIssuesCache: newCache };
    }),

  enableLiveScan: async (hideNodeModules) => {
    const state = get();

    // Prevent concurrent scans
    if (state.scanLock) {
      console.warn("UILint: Scan already in progress");
      return;
    }

    // Enable live scanning and acquire lock
    set({
      liveScanEnabled: true,
      scanLock: true,
    });

    // Get all scannable elements using data-loc
    const elements = scanDOMForSources(document.body, hideNodeModules);

    // Initialize cache with pending status
    const initialCache = new Map<string, ElementIssue>();
    for (const el of elements) {
      initialCache.set(el.id, {
        elementId: el.id,
        issues: [],
        status: "pending",
      });
    }

    // Set initial state synchronously
    set({
      elementIssuesCache: initialCache,
      autoScanState: {
        status: "scanning",
        currentIndex: 0,
        totalElements: elements.length,
        elements,
      },
    });

    // Run the scan
    await get()._runScanLoop(elements);
  },

  disableLiveScan: () => {
    set({
      liveScanEnabled: false,
      scanLock: false,
      autoScanState: DEFAULT_AUTO_SCAN_STATE,
      elementIssuesCache: new Map(),
    });
  },

  scanNewElements: async (newElements) => {
    const state = get();

    // Only scan if live mode is enabled
    if (!state.liveScanEnabled) return;

    // Skip if no new elements
    if (newElements.length === 0) return;

    // Add new elements to cache with pending status
    set((s) => {
      const newCache = new Map(s.elementIssuesCache);
      for (const el of newElements) {
        newCache.set(el.id, {
          elementId: el.id,
          issues: [],
          status: "pending",
        });
      }
      return {
        elementIssuesCache: newCache,
        autoScanState: {
          ...s.autoScanState,
          elements: [...s.autoScanState.elements, ...newElements],
          totalElements: s.autoScanState.totalElements + newElements.length,
        },
      };
    });

    // Scan the new elements (grouped by file)
    const sourceFiles = groupBySourceFile(newElements);

    for (const sourceFile of sourceFiles) {
      // Mark elements as scanning
      for (const el of sourceFile.elements) {
        get().updateElementIssue(el.id, {
          elementId: el.id,
          issues: [],
          status: "scanning",
        });
      }

      // Yield to browser
      await new Promise((resolve) => requestAnimationFrame(resolve));

      // Scan the file
      const { issues, error } = await scanFileForIssues(sourceFile, get());

      // Distribute issues to elements
      distributeIssuesToElements(
        issues,
        sourceFile.elements,
        get().updateElementIssue,
        error ?? false
      );

      // Subscribe for live updates
      if (get().wsConnected && get().wsConnection) {
        get().subscribeToFile(sourceFile.path);
      }

      // Yield to browser
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  },

  _runScanLoop: async (elements) => {
    // Group elements by source file for per-file scanning
    const sourceFiles = groupBySourceFile(elements);

    // Track progress
    let processedElements = 0;

    for (const sourceFile of sourceFiles) {
      // Check if live scan was disabled
      if (!get().liveScanEnabled) {
        set({
          scanLock: false,
          autoScanState: DEFAULT_AUTO_SCAN_STATE,
        });
        return;
      }

      // Update progress
      get()._setScanState({ currentIndex: processedElements });

      // Mark all elements in this file as scanning
      for (const el of sourceFile.elements) {
        get().updateElementIssue(el.id, {
          elementId: el.id,
          issues: [],
          status: "scanning",
        });
      }

      // Yield to browser to show "scanning" state
      await new Promise((resolve) => requestAnimationFrame(resolve));

      // Scan the entire file once (pass store for WebSocket access)
      const { issues, error } = await scanFileForIssues(sourceFile, get());

      // Distribute issues to elements by matching dataLoc
      distributeIssuesToElements(
        issues,
        sourceFile.elements,
        get().updateElementIssue,
        error ?? false
      );

      // Subscribe for live updates after first scan of this file
      if (get().wsConnected && get().wsConnection) {
        get().subscribeToFile(sourceFile.path);
      }

      processedElements += sourceFile.elements.length;

      // Yield to browser to render the badge updates
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    // Complete - release lock but keep live scan enabled
    set({
      scanLock: false,
      autoScanState: {
        ...get().autoScanState,
        status: "complete",
        currentIndex: elements.length,
      },
    });
  },

  // ============ DOM Observer ============
  removeStaleResults: (elementIds) =>
    set((state) => {
      const newCache = new Map(state.elementIssuesCache);
      const newElements = state.autoScanState.elements.filter(
        (el) => !elementIds.includes(el.id)
      );

      for (const id of elementIds) {
        newCache.delete(id);
      }

      return {
        elementIssuesCache: newCache,
        autoScanState: {
          ...state.autoScanState,
          elements: newElements,
          totalElements: newElements.length,
        },
      };
    }),

  // ============ File/Element Selection ============
  hoveredFilePath: null,
  selectedFilePath: null,
  selectedElementId: null,
  hoveredElementId: null,

  setHoveredFilePath: (path) => set({ hoveredFilePath: path }),
  setSelectedFilePath: (path) => set({ selectedFilePath: path }),
  setSelectedElementId: (id) => set({ selectedElementId: id }),
  setHoveredElementId: (id) => set({ hoveredElementId: id }),

  // ============ WebSocket ============
  wsConnection: null,
  wsConnected: false,
  wsUrl: DEFAULT_WS_URL,
  wsReconnectAttempts: 0,
  eslintIssuesCache: new Map(),
  wsProgressPhase: new Map(),
  wsLastActivity: null,
  wsRecentResults: [],

  connectWebSocket: (url?: string) => {
    const targetUrl = url || get().wsUrl;
    const existing = get().wsConnection;

    // Close existing connection if any
    if (existing && existing.readyState !== WebSocket.CLOSED) {
      existing.close();
    }

    // Check if we're in a browser environment
    if (typeof WebSocket === "undefined") {
      console.warn("[UILint] WebSocket not available in this environment");
      return;
    }

    try {
      const ws = new WebSocket(targetUrl);

      ws.onopen = () => {
        console.log("[UILint] WebSocket connected to", targetUrl);
        set({
          wsConnected: true,
          wsReconnectAttempts: 0,
          wsUrl: targetUrl,
        });
      };

      ws.onclose = () => {
        console.log("[UILint] WebSocket disconnected");
        set({ wsConnected: false, wsConnection: null });

        // Auto-reconnect with exponential backoff
        const attempts = get().wsReconnectAttempts;
        if (attempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_BASE_DELAY * Math.pow(2, attempts);
          console.log(
            `[UILint] Reconnecting in ${delay}ms (attempt ${attempts + 1})`
          );
          setTimeout(() => {
            set({ wsReconnectAttempts: attempts + 1 });
            get()._reconnectWebSocket();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error("[UILint] WebSocket error:", error);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ServerMessage;
          get()._handleWsMessage(data);
        } catch (err) {
          console.error("[UILint] Failed to parse WebSocket message:", err);
        }
      };

      set({ wsConnection: ws, wsUrl: targetUrl });
    } catch (err) {
      console.error("[UILint] Failed to create WebSocket:", err);
    }
  },

  disconnectWebSocket: () => {
    const ws = get().wsConnection;
    if (ws) {
      ws.close();
      set({
        wsConnection: null,
        wsConnected: false,
        wsReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
      });
    }
  },

  requestFileLint: async (filePath: string): Promise<ESLintIssue[]> => {
    const { wsConnection, wsConnected, eslintIssuesCache } = get();

    // Check cache first
    const cached = eslintIssuesCache.get(filePath);
    if (cached) {
      console.log("[UILint] using cached issues for", filePath);
      return cached;
    }

    // If not connected, try to connect and fall back to HTTP
    if (!wsConnected || !wsConnection) {
      console.log("[UILint] WebSocket not connected, using HTTP fallback");
      return [];
    }

    return new Promise((resolve, reject) => {
      const requestId = makeRequestId();
      pendingRequests.set(requestId, { resolve, reject });

      const message: LintFileMessage = {
        type: "lint:file",
        filePath,
        requestId,
      };
      wsConnection.send(JSON.stringify(message));

      // Timeout after 2 minutes
      setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId);
          reject(new Error("Request timed out"));
        }
      }, WS_REQUEST_TIMEOUT_MS);
    });
  },

  requestElementLint: async (
    filePath: string,
    dataLoc: string
  ): Promise<ESLintIssue[]> => {
    const { wsConnection, wsConnected } = get();

    if (!wsConnected || !wsConnection) {
      console.log("[UILint] WebSocket not connected, using HTTP fallback");
      return [];
    }

    return new Promise((resolve, reject) => {
      const requestId = makeRequestId();
      pendingRequests.set(requestId, { resolve, reject });

      const message: LintElementMessage = {
        type: "lint:element",
        filePath,
        dataLoc,
        requestId,
      };
      wsConnection.send(JSON.stringify(message));

      // Timeout after 2 minutes
      setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId);
          reject(new Error("Request timed out"));
        }
      }, WS_REQUEST_TIMEOUT_MS);
    });
  },

  subscribeToFile: (filePath: string) => {
    const { wsConnection, wsConnected } = get();
    if (!wsConnected || !wsConnection) return;

    const message: SubscribeFileMessage = { type: "subscribe:file", filePath };
    wsConnection.send(JSON.stringify(message));
  },

  invalidateCache: (filePath?: string) => {
    const { wsConnection, wsConnected } = get();

    // Clear local cache
    if (filePath) {
      set((state) => {
        const next = new Map(state.eslintIssuesCache);
        next.delete(filePath);
        return { eslintIssuesCache: next };
      });
    } else {
      set({ eslintIssuesCache: new Map() });
    }

    // Send to server if connected
    if (wsConnected && wsConnection) {
      const message: CacheInvalidateMessage = {
        type: "cache:invalidate",
        filePath,
      };
      wsConnection.send(JSON.stringify(message));
    }
  },

  _handleWsMessage: (data: ServerMessage) => {
    switch (data.type) {
      case "lint:result": {
        const { filePath, issues, requestId } = data;

        // Update cache
        set((state) => {
          const next = new Map(state.eslintIssuesCache);
          next.set(filePath, issues);
          return { eslintIssuesCache: next };
        });

        // If live scan is active, apply ESLint issues to elements in this file
        const state = get();
        if (state.liveScanEnabled) {
          const sourceFiles = groupBySourceFile(state.autoScanState.elements);
          const sf = sourceFiles.find((s) => s.path === filePath);
          if (sf) {
            distributeIssuesToElements(
              issues,
              sf.elements,
              state.updateElementIssue,
              false
            );
          }
        }

        // Clear progress
        set((state) => {
          const next = new Map(state.wsProgressPhase);
          next.delete(filePath);
          return { wsProgressPhase: next };
        });

        // Update recent results (for UI)
        set((state) => {
          const next = [
            { filePath, issueCount: issues.length, updatedAt: Date.now() },
            ...state.wsRecentResults.filter((r) => r.filePath !== filePath),
          ].slice(0, 8);
          return { wsRecentResults: next };
        });

        set({
          wsLastActivity: {
            filePath,
            phase: `Done (${issues.length} issues)`,
            updatedAt: Date.now(),
          },
        });

        // Resolve pending request (requestId-correlated)
        if (requestId) {
          const pending = pendingRequests.get(requestId);
          if (pending) {
            pending.resolve(issues);
            pendingRequests.delete(requestId);
          }
        }
        break;
      }

      case "lint:progress": {
        const { filePath, phase } = data;
        set((state) => {
          const next = new Map(state.wsProgressPhase);
          next.set(filePath, phase);
          return {
            wsProgressPhase: next,
            wsLastActivity: { filePath, phase, updatedAt: Date.now() },
          };
        });
        break;
      }

      case "file:changed": {
        const { filePath } = data;
        // Invalidate cache for this file
        set((state) => {
          const next = new Map(state.eslintIssuesCache);
          next.delete(filePath);
          return { eslintIssuesCache: next };
        });

        // If live scan is active, re-lint this file
        const state = get();
        if (state.liveScanEnabled) {
          const sourceFiles = groupBySourceFile(state.autoScanState.elements);
          const sf = sourceFiles.find((s) => s.path === filePath);
          if (sf) {
            // Mark elements as scanning
            for (const el of sf.elements) {
              const existing = state.elementIssuesCache.get(el.id);
              state.updateElementIssue(el.id, {
                elementId: el.id,
                issues: existing?.issues || [],
                status: "scanning",
              });
            }

            // Fire-and-forget re-lint; updates will land via lint:result
            state.requestFileLint(filePath).catch(() => {
              // Mark elements as error on failure
              for (const el of sf.elements) {
                const existing = state.elementIssuesCache.get(el.id);
                state.updateElementIssue(el.id, {
                  elementId: el.id,
                  issues: existing?.issues || [],
                  status: "error",
                });
              }
            });
          }
        }
        break;
      }
    }
  },

  _reconnectWebSocket: () => {
    const { wsUrl } = get();
    get().connectWebSocket(wsUrl);
  },
}));
