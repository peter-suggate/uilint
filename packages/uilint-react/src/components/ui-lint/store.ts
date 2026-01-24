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
  AutoScanState,
  ElementIssue,
  ScannedElement,
  SourceFile,
  ESLintIssue,
  AutoScanSettings,
  ScreenshotCapture,
  ScreenshotListResponse,
} from "./types";
import {
  DEFAULT_SETTINGS,
  DEFAULT_AUTO_SCAN_STATE,
  DEFAULT_AUTO_SCAN_SETTINGS,
  getDataLocFromSource,
} from "./types";
import {
  scanDOMForSources,
  groupBySourceFile,
  identifyTopLevelElements,
} from "./dom-utils";
import type { CommandPaletteFilter } from "./command-palette/types";
import type {
  VisionIssue,
  VisionAnalysisResult,
  ElementManifest,
} from "../../scanner/vision-capture";

type VisionStage = "capture" | "manifest" | "ws" | "vision";

/** Option field schema for rule configuration UI */
export interface OptionFieldSchema {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select" | "multiselect" | "array";
  defaultValue: unknown;
  placeholder?: string;
  options?: Array<{ value: string | number; label: string }>;
  description?: string;
}

/** Rule option schema for configuration */
export interface RuleOptionSchema {
  fields: OptionFieldSchema[];
}

/** Extended rule metadata with full configuration info */
export interface AvailableRule {
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
}

/** Current configuration state for a rule */
export interface RuleConfig {
  severity: "error" | "warn" | "off";
  options?: Record<string, unknown>;
}

export type VisionErrorInfo = {
  stage: VisionStage;
  message: string;
  route: string;
  timestamp: number;
};

/** Floating icon position (pixel coordinates) */
export type FloatingIconPosition = {
  x: number;
  y: number;
};

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

interface WorkspaceInfoMessage {
  type: "workspace:info";
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

type ServerMessage =
  | LintResultMessage
  | LintProgressMessage
  | FileChangedMessage
  | WorkspaceInfoMessage
  | VisionResultMessage
  | VisionProgressMessage
  | RulesMetadataMessage
  | ConfigUpdateMessage
  | RuleConfigResultMessage
  | RuleConfigChangedMessage
  | DuplicatesIndexingStartMessage
  | DuplicatesIndexingProgressMessage
  | DuplicatesIndexingCompleteMessage
  | DuplicatesIndexingErrorMessage;

/**
 * UILint Store State and Actions
 */
export interface UILintStore {
  // ============ Settings ============
  settings: UILintSettings;
  updateSettings: (partial: Partial<UILintSettings>) => void;

  // ============ Auto-Scan Settings ============
  /** Auto-scan settings (persisted to localStorage) */
  autoScanSettings: AutoScanSettings;
  /** Update auto-scan settings (persists to localStorage) */
  updateAutoScanSettings: (
    partial: Partial<{
      eslint: Partial<AutoScanSettings["eslint"]>;
      vision: Partial<AutoScanSettings["vision"]>;
    }>
  ) => void;

  // ============ Floating Icon Position ============
  /** Floating icon position (null = default top-center) */
  floatingIconPosition: FloatingIconPosition | null;
  /** Set floating icon position and persist to localStorage */
  setFloatingIconPosition: (position: FloatingIconPosition) => void;

  // ============ Locator Mode ============
  altKeyHeld: boolean;
  setAltKeyHeld: (held: boolean) => void;
  locatorTarget: LocatorTarget | null;
  setLocatorTarget: (target: LocatorTarget | null) => void;

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
  /** File-level issues (not mapped to specific DOM elements) */
  fileIssuesCache: Map<string, ESLintIssue[]>;
  scanLock: boolean;

  // Internal scan actions
  /** Update issue cache for a dataLoc key */
  updateElementIssue: (dataLoc: string, issue: ElementIssue) => void;
  updateFileIssues: (filePath: string, issues: ESLintIssue[]) => void;

  // ============ DOM Observer ============
  /** Remove scan results for dataLocs that no longer have elements in DOM */
  removeStaleResults: (dataLocs: string[]) => void;

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
  /** Workspace root path from the server (for building absolute file paths) */
  workspaceRoot: string | null;
  /** Next.js app root path from the server (preferred for building absolute file paths) */
  appRoot: string | null;
  /** Server working directory from the server */
  serverCwd: string | null;

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

  // ============ Vision Analysis ============
  /** Whether vision analysis is in progress */
  visionAnalyzing: boolean;
  /** Current vision analysis progress phase */
  visionProgressPhase: string | null;
  /** Last vision error (if any), with stage for user-friendly UI */
  visionLastError: VisionErrorInfo | null;
  /** Latest vision analysis result */
  visionResult: VisionAnalysisResult | null;
  /** Vision issues cache by route */
  visionIssuesCache: Map<string, VisionIssue[]>;
  /** Screenshot gallery - captures with unique IDs, supports both full-page and region */
  screenshotHistory: Map<string, ScreenshotCapture>;
  /** Currently selected screenshot ID for gallery display */
  selectedScreenshotId: string | null;
  /** Current route being analyzed or last analyzed */
  visionCurrentRoute: string | null;
  /** Highlighted vision issue element ID (for click-to-highlight) */
  highlightedVisionElementId: string | null;
  /** Capture mode: full page or region selection */
  captureMode: "full" | "region";
  /** Whether region selection is currently active */
  regionSelectionActive: boolean;
  /** Selected region for capture (null if full page) */
  selectedRegion: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;

  // ============ Results Panel ============
  /** Whether the results panel is visible */
  showResultsPanel: boolean;
  /** Active tab in the results panel */
  activeResultsTab: "eslint" | "vision";

  // Vision actions
  /** Trigger vision analysis for current page */
  triggerVisionAnalysis: () => Promise<void>;
  /** Clear last vision error */
  clearVisionLastError: () => void;
  /** Set highlighted vision element */
  setHighlightedVisionElementId: (id: string | null) => void;
  /** Set results panel visibility */
  setShowResultsPanel: (show: boolean) => void;
  /** Set active results tab */
  setActiveResultsTab: (tab: "eslint" | "vision") => void;
  /** Clear vision results */
  clearVisionResults: () => void;
  /** Set capture mode */
  setCaptureMode: (mode: "full" | "region") => void;
  /** Set region selection active state */
  setRegionSelectionActive: (active: boolean) => void;
  /** Set selected region for capture */
  setSelectedRegion: (
    region: { x: number; y: number; width: number; height: number } | null
  ) => void;
  /** Set selected screenshot ID for gallery display */
  setSelectedScreenshotId: (id: string | null) => void;
  /** Whether persisted screenshots are being loaded */
  loadingPersistedScreenshots: boolean;
  /** Whether persisted screenshots have been fetched (prevents re-fetching) */
  persistedScreenshotsFetched: boolean;
  /** Fetch persisted screenshots from disk (via API) */
  fetchPersistedScreenshots: () => Promise<void>;

  // ============ Duplicates Index ============
  /** Duplicates index status */
  duplicatesIndexStatus: "idle" | "indexing" | "ready" | "error";
  /** Current indexing progress message */
  duplicatesIndexMessage: string | null;
  /** Current indexing progress (current/total) */
  duplicatesIndexProgress: { current: number; total: number } | null;
  /** Last indexing error message */
  duplicatesIndexError: string | null;
  /** Last indexing result stats */
  duplicatesIndexStats: {
    totalChunks: number;
    added: number;
    modified: number;
    deleted: number;
    duration: number;
  } | null;

  // ============ Heatmap Display ============
  /** Map of file path -> top-level element ID for that file (used for file-level issue display) */
  topLevelElementsByFile: Map<string, string>;
  /** Merged issue counts: element issues + file-level issues for top-level elements */
  mergedIssueCounts: Map<string, number>;
  /** Compute top-level elements and merged issue counts for heatmap display */
  computeHeatmapData: () => void;

  // ============ Command Palette ============
  /** Whether command palette is open */
  commandPaletteOpen: boolean;
  /** Current search query */
  commandPaletteQuery: string;
  /** Selected index for keyboard navigation */
  commandPaletteSelectedIndex: number;
  /** ID of currently expanded item in the list (for rule details, file issues, etc.) */
  expandedItemId: string | null;
  /** Currently highlighted rule ID (for hover -> heatmap highlighting) */
  highlightedRuleId: string | null;
  /** Currently hovered item ID in command palette (for transient highlighting) */
  hoveredCommandPaletteItemId: string | null;
  /** Currently selected/pinned item ID (persists after click, shows heatmap) */
  selectedCommandPaletteItemId: string | null;
  /** Disabled rules (visual filtering only) */
  disabledRules: Set<string>;
  /** Available ESLint rules from server (includes docs, optionSchema, defaultOptions) */
  availableRules: AvailableRule[];
  /** Current rule configurations (severity + options) - synced with ESLint config */
  ruleConfigs: Map<string, RuleConfig>;
  /** Rule config update in progress */
  ruleConfigUpdating: Map<string, boolean>;
  /** Active filters for the command palette (shown as chips) */
  commandPaletteFilters: CommandPaletteFilter[];

  // Command Palette actions
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  setCommandPaletteQuery: (query: string) => void;
  setCommandPaletteSelectedIndex: (index: number) => void;
  setExpandedItemId: (id: string | null) => void;
  setHighlightedRuleId: (ruleId: string | null) => void;
  setHoveredCommandPaletteItemId: (id: string | null) => void;
  setSelectedCommandPaletteItemId: (id: string | null) => void;
  toggleRule: (ruleId: string) => void;
  /** Set rule severity and/or options via WebSocket (persists to ESLint config) */
  setRuleConfig: (
    ruleId: string,
    severity: "error" | "warn" | "off",
    options?: Record<string, unknown>
  ) => Promise<void>;
  /** Add a filter to the command palette */
  addCommandPaletteFilter: (filter: CommandPaletteFilter) => void;
  /** Remove a filter at the specified index */
  removeCommandPaletteFilter: (index: number) => void;
  /** Clear all command palette filters */
  clearCommandPaletteFilters: () => void;
  /** Open command palette with a specific filter applied */
  openCommandPaletteWithFilter: (filter: CommandPaletteFilter) => void;

  // ============ Inspector Sidebar ============
  /** Whether inspector sidebar is open */
  inspectorOpen: boolean;
  /** Current inspector mode */
  inspectorMode: "rule" | "issue" | "element" | null;
  /** Rule ID when showing rule details */
  inspectorRuleId: string | null;
  /** Issue data when showing issue details */
  inspectorIssue: { issue: ESLintIssue; elementId?: string; filePath: string } | null;
  /** Element ID when showing element details */
  inspectorElementId: string | null;
  /** Whether inspector is docked (participates in layout) or floating */
  inspectorDocked: boolean;
  /** Width when docked (resizable) */
  inspectorWidth: number;
  /** Position when floating */
  inspectorFloatingPosition: { x: number; y: number } | null;
  /** Size when floating */
  inspectorFloatingSize: { width: number; height: number } | null;

  // Inspector actions
  /** Open inspector with specific content */
  openInspector: (
    mode: "rule" | "issue" | "element",
    data: { ruleId?: string; issue?: ESLintIssue; elementId?: string; filePath?: string }
  ) => void;
  /** Close inspector sidebar */
  closeInspector: () => void;
  /** Set inspector to show rule details */
  setInspectorRule: (ruleId: string) => void;
  /** Set inspector to show issue details */
  setInspectorIssue: (issue: ESLintIssue, elementId?: string, filePath?: string) => void;
  /** Set inspector to show element details */
  setInspectorElement: (elementId: string) => void;
  /** Toggle between docked and floating mode */
  toggleInspectorDocked: () => void;
  /** Set inspector width (docked mode) */
  setInspectorWidth: (width: number) => void;
  /** Set inspector position (floating mode) */
  setInspectorFloatingPosition: (pos: { x: number; y: number }) => void;
  /** Set inspector size (floating mode) */
  setInspectorFloatingSize: (size: { width: number; height: number }) => void;

  // ============ Internal ============
  _setScanState: (state: Partial<AutoScanState>) => void;
  _runScanLoop: (elements: ScannedElement[]) => Promise<void>;
  _handleWsMessage: (data: ServerMessage) => void;
  _reconnectWebSocket: () => void;
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
 * Match ESLint issues to elements by dataLoc and update the cache.
 * Uses dataLoc (path:line:column) as the cache key, so multiple DOM elements
 * from the same source location share a single cache entry.
 */
function distributeIssuesToElements(
  issues: ESLintIssue[],
  elements: ScannedElement[],
  filePath: string,
  updateElementIssue: (dataLoc: string, issue: ElementIssue) => void,
  updateFileIssues: (filePath: string, issues: ESLintIssue[]) => void,
  hasError: boolean
): void {
  // Collect unique dataLocs from elements
  const knownDataLocs = new Set<string>();
  for (const el of elements) {
    const dataLoc = getDataLocFromSource(el.source);
    knownDataLocs.add(dataLoc);
  }

  // Group issues by dataLoc
  const issuesByDataLoc = new Map<string, ESLintIssue[]>();
  const unmappedIssues: ESLintIssue[] = [];

  for (const issue of issues) {
    if (issue.dataLoc && knownDataLocs.has(issue.dataLoc)) {
      const existing = issuesByDataLoc.get(issue.dataLoc) || [];
      existing.push(issue);
      issuesByDataLoc.set(issue.dataLoc, existing);
    } else {
      // Issue has no dataLoc or doesn't match any scanned element
      unmappedIssues.push(issue);
    }
  }

  // Update cache for each unique dataLoc
  for (const dataLoc of knownDataLocs) {
    const dataLocIssues = issuesByDataLoc.get(dataLoc) || [];
    updateElementIssue(dataLoc, {
      dataLoc,
      issues: dataLocIssues,
      status: hasError ? "error" : "complete",
    });
  }

  // Store unmapped issues for file-level display
  if (unmappedIssues.length > 0) {
    updateFileIssues(filePath, unmappedIssues);
  } else {
    // Clear file issues if there are none
    updateFileIssues(filePath, []);
  }
}

/** Default WebSocket URL */
const DEFAULT_WS_URL = "ws://localhost:9234";

/** localStorage key for auto-scan settings */
const AUTO_SCAN_SETTINGS_KEY = "uilint:autoScanSettings";

/** localStorage key for floating icon position */
const FLOATING_ICON_POSITION_KEY = "uilint:floatingIconPosition";

/**
 * Load auto-scan settings from localStorage
 */
function loadAutoScanSettings(): AutoScanSettings {
  if (typeof window === "undefined") return DEFAULT_AUTO_SCAN_SETTINGS;
  try {
    const stored = localStorage.getItem(AUTO_SCAN_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle missing keys from older versions
      return {
        eslint: { ...DEFAULT_AUTO_SCAN_SETTINGS.eslint, ...parsed.eslint },
        vision: { ...DEFAULT_AUTO_SCAN_SETTINGS.vision, ...parsed.vision },
      };
    }
  } catch (e) {
    console.warn("[UILint] Failed to load auto-scan settings:", e);
  }
  return DEFAULT_AUTO_SCAN_SETTINGS;
}

/**
 * Save auto-scan settings to localStorage
 */
function saveAutoScanSettings(settings: AutoScanSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUTO_SCAN_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("[UILint] Failed to save auto-scan settings:", e);
  }
}

/**
 * Load floating icon position from localStorage
 */
function loadFloatingIconPosition(): FloatingIconPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(FLOATING_ICON_POSITION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        return parsed as FloatingIconPosition;
      }
    }
  } catch (e) {
    console.warn("[UILint] Failed to load floating icon position:", e);
  }
  return null;
}

/**
 * Save floating icon position to localStorage
 */
function saveFloatingIconPosition(position: FloatingIconPosition): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FLOATING_ICON_POSITION_KEY, JSON.stringify(position));
  } catch (e) {
    console.warn("[UILint] Failed to save floating icon position:", e);
  }
}

/** Max reconnect attempts before giving up */
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Filter issues by disabled rules
 * Returns only issues whose ruleId is NOT in the disabled set
 */
function filterIssuesByDisabledRules(
  issues: ESLintIssue[],
  disabledRules: Set<string>
): ESLintIssue[] {
  if (disabledRules.size === 0) return issues;
  return issues.filter(
    (issue) => !issue.ruleId || !disabledRules.has(issue.ruleId)
  );
}

/** Reconnect delay in ms (exponential backoff) */
const RECONNECT_BASE_DELAY = 1000;

/** Pending requests waiting for WebSocket responses */
const pendingRequests = new Map<
  string,
  { resolve: (issues: ESLintIssue[]) => void; reject: (error: Error) => void }
>();

/** Pending vision requests waiting for WebSocket responses */
const pendingVisionRequests = new Map<
  string,
  {
    resolve: (result: VisionAnalysisResult) => void;
    reject: (error: Error) => void;
    route: string;
    filename: string;
    // Keep for debugging + sidecar write; type kept loose to avoid circular imports here.
    manifest: unknown;
  }
>();

function sanitizeForFilename(input: string): string {
  return input
    .replace(/\//g, "-")
    .replace(/^-+/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

async function postScreenshotToApi(payload: {
  filename: string;
  imageData?: string;
  manifest?: unknown;
  analysisResult?: unknown;
}): Promise<any> {
  const res = await fetch("/api/.uilint/screenshots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text().catch(() => "");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const details = json?.error || text || res.statusText;
    throw new Error(
      `Screenshot API failed: ${res.status} ${details} (POST /api/.uilint/screenshots)`
    );
  }

  return json;
}

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

  // ============ Auto-Scan Settings ============
  autoScanSettings: loadAutoScanSettings(),
  updateAutoScanSettings: (partial) =>
    set((state) => {
      const newSettings: AutoScanSettings = {
        eslint: { ...state.autoScanSettings.eslint, ...partial.eslint },
        vision: { ...state.autoScanSettings.vision, ...partial.vision },
      };
      saveAutoScanSettings(newSettings);
      return { autoScanSettings: newSettings };
    }),

  // ============ Floating Icon Position ============
  floatingIconPosition: loadFloatingIconPosition(),
  setFloatingIconPosition: (position) => {
    saveFloatingIconPosition(position);
    set({ floatingIconPosition: position });
  },

  // ============ Locator Mode ============
  altKeyHeld: false,
  setAltKeyHeld: (held) => set({ altKeyHeld: held }),
  locatorTarget: null,
  setLocatorTarget: (target) => set({ locatorTarget: target }),

  // ============ Live Scanning ============
  liveScanEnabled: false,
  autoScanState: DEFAULT_AUTO_SCAN_STATE,
  elementIssuesCache: new Map(),
  fileIssuesCache: new Map(),
  scanLock: false,

  // ============ Heatmap Display ============
  topLevelElementsByFile: new Map(),
  mergedIssueCounts: new Map(),

  computeHeatmapData: () => {
    const state = get();
    const elements = state.autoScanState.elements;
    const { disabledRules } = state;

    // Identify top-level elements per file
    const topLevelByFile = identifyTopLevelElements(elements);

    // Compute merged issue counts (filtered by disabled rules)
    // Still keyed by element ID for UI display, but lookup by dataLoc
    const mergedCounts = new Map<string, number>();

    for (const el of elements) {
      const dataLoc = getDataLocFromSource(el.source);
      const cached = state.elementIssuesCache.get(dataLoc);
      // Filter out issues from disabled rules
      const filteredIssues = cached
        ? filterIssuesByDisabledRules(cached.issues, disabledRules)
        : [];
      const elementIssueCount = filteredIssues.length;

      // Start with the element's own issues
      let totalCount = elementIssueCount;

      // If this is the top-level element for its file, add file-level issues
      const filePath = el.source.fileName;
      if (topLevelByFile.get(filePath) === el.id) {
        const fileIssues = state.fileIssuesCache.get(filePath) || [];
        // Also filter file-level issues by disabled rules
        const filteredFileIssues = filterIssuesByDisabledRules(
          fileIssues,
          disabledRules
        );
        totalCount += filteredFileIssues.length;
      }

      mergedCounts.set(el.id, totalCount);
    }

    set({
      topLevelElementsByFile: topLevelByFile,
      mergedIssueCounts: mergedCounts,
    });
  },

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

  updateFileIssues: (filePath, issues) =>
    set((state) => {
      const newCache = new Map(state.fileIssuesCache);
      if (issues.length > 0) {
        newCache.set(filePath, issues);
      } else {
        newCache.delete(filePath);
      }
      return { fileIssuesCache: newCache };
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

    // Initialize cache with pending status, keyed by dataLoc
    const initialCache = new Map<string, ElementIssue>();
    for (const el of elements) {
      const dataLoc = getDataLocFromSource(el.source);
      // Only add if not already present (multiple elements can share same dataLoc)
      if (!initialCache.has(dataLoc)) {
        initialCache.set(dataLoc, {
          dataLoc,
          issues: [],
          status: "pending",
        });
      }
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
      fileIssuesCache: new Map(),
      topLevelElementsByFile: new Map(),
      mergedIssueCounts: new Map(),
    });
  },

  scanNewElements: async (newElements) => {
    const state = get();

    // Only scan if live mode is enabled
    if (!state.liveScanEnabled) return;

    // Skip if no new elements
    if (newElements.length === 0) return;

    // Add new elements to cache with pending status, keyed by dataLoc
    set((s) => {
      const newCache = new Map(s.elementIssuesCache);
      for (const el of newElements) {
        const dataLoc = getDataLocFromSource(el.source);
        // Only add if not already present (multiple elements can share same dataLoc)
        if (!newCache.has(dataLoc)) {
          newCache.set(dataLoc, {
            dataLoc,
            issues: [],
            status: "pending",
          });
        }
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
      // Mark unique dataLocs as scanning
      const seenDataLocs = new Set<string>();
      for (const el of sourceFile.elements) {
        const dataLoc = getDataLocFromSource(el.source);
        if (!seenDataLocs.has(dataLoc)) {
          seenDataLocs.add(dataLoc);
          get().updateElementIssue(dataLoc, {
            dataLoc,
            issues: [],
            status: "scanning",
          });
        }
      }

      // Yield to browser
      await new Promise((resolve) => requestAnimationFrame(resolve));

      // Scan the file
      const { issues, error } = await scanFileForIssues(sourceFile, get());

      // Distribute issues to elements
      distributeIssuesToElements(
        issues,
        sourceFile.elements,
        sourceFile.path,
        get().updateElementIssue,
        get().updateFileIssues,
        error ?? false
      );

      // Subscribe for live updates
      if (get().wsConnected && get().wsConnection) {
        get().subscribeToFile(sourceFile.path);
      }

      // Yield to browser
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    // Recompute heatmap data after scanning new elements
    get().computeHeatmapData();
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

      // Mark all unique dataLocs in this file as scanning
      const seenDataLocs = new Set<string>();
      for (const el of sourceFile.elements) {
        const dataLoc = getDataLocFromSource(el.source);
        if (!seenDataLocs.has(dataLoc)) {
          seenDataLocs.add(dataLoc);
          get().updateElementIssue(dataLoc, {
            dataLoc,
            issues: [],
            status: "scanning",
          });
        }
      }

      // Yield to browser to show "scanning" state
      await new Promise((resolve) => requestAnimationFrame(resolve));

      // Scan the entire file once (pass store for WebSocket access)
      const { issues, error } = await scanFileForIssues(sourceFile, get());

      // Distribute issues to elements by matching dataLoc
      distributeIssuesToElements(
        issues,
        sourceFile.elements,
        sourceFile.path,
        get().updateElementIssue,
        get().updateFileIssues,
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

    // Compute heatmap data after scan completes
    get().computeHeatmapData();
  },

  // ============ DOM Observer ============
  removeStaleResults: (elementIds) =>
    set((state) => {
      // Remove elements by ID from autoScanState
      const removedIdSet = new Set(elementIds);
      const newElements = state.autoScanState.elements.filter(
        (el) => !removedIdSet.has(el.id)
      );

      // Find dataLocs that no longer have any elements
      const remainingDataLocs = new Set<string>();
      for (const el of newElements) {
        remainingDataLocs.add(getDataLocFromSource(el.source));
      }

      // Remove cache entries for dataLocs with no remaining elements
      const newCache = new Map(state.elementIssuesCache);
      for (const dataLoc of newCache.keys()) {
        if (!remainingDataLocs.has(dataLoc)) {
          newCache.delete(dataLoc);
        }
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
  workspaceRoot: null,
  appRoot: null,
  serverCwd: null,

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

  // ============ Vision Analysis ============
  visionAnalyzing: false,
  visionProgressPhase: null,
  visionLastError: null,
  visionResult: null,
  visionIssuesCache: new Map(),
  screenshotHistory: new Map(),
  selectedScreenshotId: null,
  visionCurrentRoute: null,
  highlightedVisionElementId: null,
  captureMode: "full",
  regionSelectionActive: false,
  selectedRegion: null,

  showResultsPanel: false,
  activeResultsTab: "eslint",

  triggerVisionAnalysis: async () => {
    const { wsConnection, wsConnected, selectedRegion, captureMode } = get();

    if (!wsConnected || !wsConnection) {
      console.warn("[UILint] WebSocket not connected for vision analysis");
      const route = window.location?.pathname || "/";
      set({
        visionLastError: {
          stage: "ws",
          message: "WebSocket not connected (start `uilint serve` and refresh)",
          route,
          timestamp: Date.now(),
        },
      });
      return;
    }

    // Import vision capture module dynamically
    const {
      collectElementManifest,
      captureScreenshot,
      captureScreenshotRegion,
      getCurrentRoute,
      generateTimestamp,
    } = await import("../../scanner/vision-capture");

    const route = getCurrentRoute();
    const timestampSlug = generateTimestamp();
    const routeSlug = sanitizeForFilename(route === "/" ? "home" : route);
    const filename = `uilint-${timestampSlug}-${routeSlug}.png`;
    set({
      visionAnalyzing: true,
      visionCurrentRoute: route,
      visionProgressPhase: "Capturing screenshot...",
      visionLastError: null,
      showResultsPanel: true,
      activeResultsTab: "vision",
    });

    try {
      // Capture screenshot (full or region)
      const screenshotDataUrl =
        captureMode === "region" && selectedRegion
          ? await captureScreenshotRegion(selectedRegion)
          : await captureScreenshot();

      set({ visionProgressPhase: "Collecting elements..." });

      // Collect element manifest (filtered to region if applicable)
      const manifest =
        captureMode === "region" && selectedRegion
          ? collectElementManifest(document.body, selectedRegion)
          : collectElementManifest();
      if (!manifest || manifest.length === 0) {
        throw new Error(
          "No elements found for vision analysis (no visible `[data-loc]` elements on the page)"
        );
      }

      set({
        visionProgressPhase: `Saving screenshot (${manifest.length} elements)...`,
      });

      // Persist screenshot + manifest to Next.js app's .uilint/screenshots via dev route.
      // This enables on-disk debugging and the ESLint semantic-vision rule.
      try {
        await postScreenshotToApi({
          filename,
          imageData: screenshotDataUrl,
          manifest,
        });
      } catch (e) {
        // Non-fatal: continue analysis even if saving fails.
        console.warn("[UILint] Failed to save screenshot to server:", e);
      }

      set({ visionProgressPhase: `Sending ${manifest.length} elements...` });

      // Store screenshot in gallery with unique ID based on filename for persistence tracking
      const captureId = `capture_${filename.replace(/\.[^.]+$/, "")}`;
      const captureTimestamp = Date.now();
      if (screenshotDataUrl) {
        const capture: ScreenshotCapture = {
          id: captureId,
          route,
          dataUrl: screenshotDataUrl,
          filename, // Store filename for persistence tracking
          timestamp: captureTimestamp,
          type: captureMode === "region" && selectedRegion ? "region" : "full",
          region:
            captureMode === "region" && selectedRegion
              ? selectedRegion
              : undefined,
        };
        set((state) => {
          const next = new Map(state.screenshotHistory);
          next.set(captureId, capture);
          return { screenshotHistory: next, selectedScreenshotId: captureId };
        });
      }

      // Send analysis request
      const requestId = makeRequestId();

      const message = {
        type: "vision:analyze" as const,
        route,
        timestamp: Date.now(),
        screenshot: screenshotDataUrl || undefined,
        screenshotFile: filename,
        manifest,
        requestId,
      };

      wsConnection.send(JSON.stringify(message));
      set({ visionProgressPhase: "Analyzing (server)..." });

      // Wait for result
      const result = await new Promise<VisionAnalysisResult>(
        (resolve, reject) => {
          pendingVisionRequests.set(requestId, {
            resolve,
            reject,
            route,
            filename,
            manifest,
          });

          // Timeout after 2 minutes
          setTimeout(() => {
            if (pendingVisionRequests.has(requestId)) {
              pendingVisionRequests.delete(requestId);
              reject(new Error("Vision analysis timed out"));
            }
          }, WS_REQUEST_TIMEOUT_MS);
        }
      );

      // Store result - issues go on the capture AND in cache (for badge display)
      set((state) => {
        const issuesCache = new Map(state.visionIssuesCache);
        issuesCache.set(route, result.issues);

        // Also store issues on the capture itself
        const screenshots = new Map(state.screenshotHistory);
        const capture = screenshots.get(captureId);
        if (capture) {
          screenshots.set(captureId, { ...capture, issues: result.issues });
        }

        const lastError = result.error
          ? ({
              stage: "vision",
              message: result.error,
              route,
              timestamp: Date.now(),
            } satisfies VisionErrorInfo)
          : null;
        return {
          visionResult: result,
          visionIssuesCache: issuesCache,
          screenshotHistory: screenshots,
          visionAnalyzing: false,
          visionProgressPhase: null,
          visionLastError: lastError,
          // Reset capture mode after analysis completes
          captureMode: "full" as const,
          selectedRegion: null,
        };
      });

      // Persist analysis result as a JSON sidecar (can be written without re-sending image bytes).
      try {
        await postScreenshotToApi({
          filename,
          analysisResult: {
            route,
            timestamp: result.timestamp,
            issues: result.issues,
            analysisTime: result.analysisTime,
            error: result.error,
          },
        });
      } catch (e) {
        console.warn("[UILint] Failed to save analysis result to server:", e);
      }
    } catch (error) {
      console.error("[UILint] Vision analysis failed:", error);
      const msg = error instanceof Error ? error.message : String(error);
      const stage: VisionStage =
        msg.includes("Screenshot") || msg.includes("html-to-image")
          ? "capture"
          : msg.includes("[data-loc]") || msg.includes("elements found")
          ? "manifest"
          : "vision";
      set({
        visionAnalyzing: false,
        visionProgressPhase: null,
        visionLastError: {
          stage,
          message: msg,
          route,
          timestamp: Date.now(),
        },
        visionResult: {
          route,
          timestamp: Date.now(),
          manifest: [],
          issues: [],
          analysisTime: 0,
          error: msg,
        },
        // Reset capture mode after error
        captureMode: "full",
        selectedRegion: null,
      });
    }
  },

  clearVisionLastError: () => set({ visionLastError: null }),

  setHighlightedVisionElementId: (id) =>
    set({ highlightedVisionElementId: id }),

  setShowResultsPanel: (show) => set({ showResultsPanel: show }),
  setActiveResultsTab: (tab) => set({ activeResultsTab: tab }),

  setCaptureMode: (mode) => set({ captureMode: mode }),
  setRegionSelectionActive: (active) => set({ regionSelectionActive: active }),
  setSelectedRegion: (region) => set({ selectedRegion: region }),
  setSelectedScreenshotId: (id) => {
    // When selecting a screenshot, sync its issues to visionIssuesCache for badge display
    set((state) => {
      if (!id) {
        return { selectedScreenshotId: null };
      }

      const capture = state.screenshotHistory.get(id);
      if (!capture) {
        return { selectedScreenshotId: id };
      }

      // If the capture has issues, update the cache for the route
      if (capture.issues && capture.issues.length > 0) {
        const issuesCache = new Map(state.visionIssuesCache);
        issuesCache.set(capture.route, capture.issues);
        return {
          selectedScreenshotId: id,
          visionIssuesCache: issuesCache,
        };
      }

      return { selectedScreenshotId: id };
    });
  },
  loadingPersistedScreenshots: false,
  persistedScreenshotsFetched: false,

  fetchPersistedScreenshots: async () => {
    // Avoid duplicate fetches - check both loading state and whether already fetched
    if (get().loadingPersistedScreenshots || get().persistedScreenshotsFetched)
      return;

    set({ loadingPersistedScreenshots: true });

    try {
      const response = await fetch("/api/.uilint/screenshots?list=true");
      if (!response.ok) {
        console.warn(
          "[UILint] Failed to fetch screenshots:",
          response.statusText
        );
        return;
      }

      const data: ScreenshotListResponse = await response.json();
      const { screenshots } = data;

      if (!screenshots || screenshots.length === 0) {
        return;
      }

      // Convert persisted screenshots to ScreenshotCapture format
      const persistedCaptures: ScreenshotCapture[] = [];

      for (const item of screenshots) {
        const { filename, metadata } = item;

        // Use consistent ID format: capture_{filename_without_extension}
        // This matches the ID format used when capturing new screenshots
        const id = `capture_${filename.replace(/\.[^.]+$/, "")}`;

        // Extract route from metadata
        const route = metadata?.route || metadata?.analysisResult?.route || "/";

        // Extract timestamp
        const timestamp = metadata?.timestamp || Date.now();

        // Extract issues for this capture (issues live on the capture now)
        const issues =
          metadata?.issues || metadata?.analysisResult?.issues || [];

        // Create the capture entry with issues
        const capture: ScreenshotCapture = {
          id,
          route,
          filename,
          timestamp,
          type: "full", // Default to full for persisted screenshots
          persisted: true,
          issues: issues.length > 0 ? issues : undefined,
        };

        persistedCaptures.push(capture);
      }

      // Sync with store: merge persisted screenshots with in-memory captures
      // In-memory captures with dataUrl take precedence (they're fresher)
      set((state) => {
        const newHistory = new Map(state.screenshotHistory);
        const newVisionCache = new Map(state.visionIssuesCache);

        for (const capture of persistedCaptures) {
          const existing = newHistory.get(capture.id);

          // If we already have this capture in memory with a dataUrl, keep it
          // Otherwise, use the persisted version (which will load from API)
          if (!existing || !existing.dataUrl) {
            newHistory.set(capture.id, capture);
          }

          // Also sync issues to cache if this capture has issues and cache doesn't have them for this route
          if (
            capture.issues &&
            capture.issues.length > 0 &&
            !newVisionCache.has(capture.route)
          ) {
            newVisionCache.set(capture.route, capture.issues);
          }
        }

        return {
          screenshotHistory: newHistory,
          visionIssuesCache: newVisionCache,
        };
      });
    } catch (error) {
      console.warn("[UILint] Error fetching persisted screenshots:", error);
    } finally {
      // Mark as fetched (even on error) to prevent retries, and clear loading state
      set({
        loadingPersistedScreenshots: false,
        persistedScreenshotsFetched: true,
      });
    }
  },

  clearVisionResults: () =>
    set({
      visionResult: null,
      visionIssuesCache: new Map(),
      screenshotHistory: new Map(),
      selectedScreenshotId: null,
      visionAnalyzing: false,
      visionProgressPhase: null,
      highlightedVisionElementId: null,
      visionLastError: null,
    }),

  // ============ Duplicates Index ============
  duplicatesIndexStatus: "idle",
  duplicatesIndexMessage: null,
  duplicatesIndexProgress: null,
  duplicatesIndexError: null,
  duplicatesIndexStats: null,

  // ============ Command Palette ============
  commandPaletteOpen: false,
  commandPaletteQuery: "",
  commandPaletteSelectedIndex: 0,
  expandedItemId: null,
  highlightedRuleId: null,
  hoveredCommandPaletteItemId: null,
  selectedCommandPaletteItemId: null,
  disabledRules: new Set(),
  availableRules: [],
  ruleConfigs: new Map(),
  ruleConfigUpdating: new Map(),
  commandPaletteFilters: [],

  openCommandPalette: () =>
    set({
      commandPaletteOpen: true,
      commandPaletteQuery: "",
      commandPaletteSelectedIndex: 0,
      expandedItemId: null,
    }),

  closeCommandPalette: () =>
    set({
      commandPaletteOpen: false,
      commandPaletteQuery: "",
      commandPaletteSelectedIndex: 0,
      expandedItemId: null,
      highlightedRuleId: null,
      commandPaletteFilters: [],
    }),

  setCommandPaletteQuery: (query) =>
    set({
      commandPaletteQuery: query,
      commandPaletteSelectedIndex: 0,
    }),

  setCommandPaletteSelectedIndex: (index) =>
    set({ commandPaletteSelectedIndex: index }),

  setExpandedItemId: (id) => set({ expandedItemId: id }),

  setHighlightedRuleId: (ruleId) => set({ highlightedRuleId: ruleId }),

  setHoveredCommandPaletteItemId: (id) =>
    set({ hoveredCommandPaletteItemId: id }),

  setSelectedCommandPaletteItemId: (id) =>
    set({ selectedCommandPaletteItemId: id }),

  toggleRule: (ruleId) => {
    set((state) => {
      const newDisabled = new Set(state.disabledRules);
      if (newDisabled.has(ruleId)) {
        newDisabled.delete(ruleId);
      } else {
        newDisabled.add(ruleId);
      }
      return { disabledRules: newDisabled };
    });
    // Recompute heatmap data to reflect the new disabled rules
    get().computeHeatmapData();
  },

  setRuleConfig: async (ruleId, severity, options) => {
    const { wsConnection, wsConnected } = get();

    if (!wsConnected || !wsConnection) {
      console.warn("[UILint] WebSocket not connected for rule config update");
      return;
    }

    // Mark as updating
    set((state) => {
      const next = new Map(state.ruleConfigUpdating);
      next.set(ruleId, true);
      return { ruleConfigUpdating: next };
    });

    const requestId = `rule_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 9)}`;

    // Send request via WebSocket
    wsConnection.send(
      JSON.stringify({
        type: "rule:config:set",
        ruleId,
        severity,
        options,
        requestId,
      })
    );

    // Result will be handled in _handleWsMessage
    // We don't await here - the store will be updated when the response arrives
  },

  addCommandPaletteFilter: (filter) =>
    set((state) => ({
      commandPaletteFilters: [...state.commandPaletteFilters, filter],
      commandPaletteSelectedIndex: 0,
    })),

  removeCommandPaletteFilter: (index) =>
    set((state) => ({
      commandPaletteFilters: state.commandPaletteFilters.filter(
        (_, i) => i !== index
      ),
      commandPaletteSelectedIndex: 0,
    })),

  clearCommandPaletteFilters: () =>
    set({
      commandPaletteFilters: [],
      commandPaletteSelectedIndex: 0,
    }),

  openCommandPaletteWithFilter: (filter) =>
    set({
      commandPaletteOpen: true,
      commandPaletteQuery: "",
      commandPaletteSelectedIndex: 0,
      expandedItemId: null,
      commandPaletteFilters: [filter],
    }),

  // ============ Inspector Sidebar ============
  inspectorOpen: false,
  inspectorMode: null,
  inspectorRuleId: null,
  inspectorIssue: null,
  inspectorElementId: null,
  inspectorDocked:
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("uilint:inspectorDocked") ?? "true")
      : true,
  inspectorWidth:
    typeof window !== "undefined"
      ? parseInt(localStorage.getItem("uilint:inspectorWidth") ?? "400", 10)
      : 400,
  inspectorFloatingPosition:
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("uilint:inspectorFloatingPosition") ?? "null")
      : null,
  inspectorFloatingSize:
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("uilint:inspectorFloatingSize") ?? "null")
      : null,

  openInspector: (mode, data) => {
    const state: Partial<UILintStore> = {
      inspectorOpen: true,
      inspectorMode: mode,
    };

    if (mode === "rule" && data.ruleId) {
      state.inspectorRuleId = data.ruleId;
      state.inspectorIssue = null;
      state.inspectorElementId = null;
    } else if (mode === "issue" && data.issue && data.filePath) {
      state.inspectorIssue = {
        issue: data.issue,
        elementId: data.elementId,
        filePath: data.filePath,
      };
      state.inspectorRuleId = null;
      state.inspectorElementId = null;
    } else if (mode === "element" && data.elementId) {
      state.inspectorElementId = data.elementId;
      state.inspectorRuleId = null;
      state.inspectorIssue = null;
    }

    set(state);
  },

  closeInspector: () =>
    set({
      inspectorOpen: false,
      inspectorMode: null,
      inspectorRuleId: null,
      inspectorIssue: null,
      inspectorElementId: null,
    }),

  setInspectorRule: (ruleId) =>
    set({
      inspectorOpen: true,
      inspectorMode: "rule",
      inspectorRuleId: ruleId,
      inspectorIssue: null,
      inspectorElementId: null,
    }),

  setInspectorIssue: (issue, elementId, filePath) =>
    set({
      inspectorOpen: true,
      inspectorMode: "issue",
      inspectorIssue: { issue, elementId, filePath: filePath ?? "" },
      inspectorRuleId: null,
      inspectorElementId: null,
    }),

  setInspectorElement: (elementId) =>
    set({
      inspectorOpen: true,
      inspectorMode: "element",
      inspectorElementId: elementId,
      inspectorRuleId: null,
      inspectorIssue: null,
    }),

  toggleInspectorDocked: () => {
    const newValue = !get().inspectorDocked;
    set({ inspectorDocked: newValue });
    if (typeof window !== "undefined") {
      localStorage.setItem("uilint:inspectorDocked", JSON.stringify(newValue));
    }
  },

  setInspectorWidth: (width) => {
    set({ inspectorWidth: width });
    if (typeof window !== "undefined") {
      localStorage.setItem("uilint:inspectorWidth", String(width));
    }
  },

  setInspectorFloatingPosition: (pos) => {
    set({ inspectorFloatingPosition: pos });
    if (typeof window !== "undefined") {
      localStorage.setItem("uilint:inspectorFloatingPosition", JSON.stringify(pos));
    }
  },

  setInspectorFloatingSize: (size) => {
    set({ inspectorFloatingSize: size });
    if (typeof window !== "undefined") {
      localStorage.setItem("uilint:inspectorFloatingSize", JSON.stringify(size));
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
              filePath,
              state.updateElementIssue,
              state.updateFileIssues,
              false
            );
          } else {
            // File has no scanned elements, but may have file-level issues
            // Store them directly
            const unmappedIssues = issues.filter((i) => !i.dataLoc);
            if (unmappedIssues.length > 0) {
              state.updateFileIssues(filePath, unmappedIssues);
            }
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
            // Mark unique dataLocs as scanning
            const seenDataLocs = new Set<string>();
            for (const el of sf.elements) {
              const dataLoc = getDataLocFromSource(el.source);
              if (!seenDataLocs.has(dataLoc)) {
                seenDataLocs.add(dataLoc);
                const existing = state.elementIssuesCache.get(dataLoc);
                state.updateElementIssue(dataLoc, {
                  dataLoc,
                  issues: existing?.issues || [],
                  status: "scanning",
                });
              }
            }

            // Fire-and-forget re-lint; updates will land via lint:result
            state.requestFileLint(filePath).catch(() => {
              // Mark dataLocs as error on failure
              const errorDataLocs = new Set<string>();
              for (const el of sf.elements) {
                const dataLoc = getDataLocFromSource(el.source);
                if (!errorDataLocs.has(dataLoc)) {
                  errorDataLocs.add(dataLoc);
                  const existing = state.elementIssuesCache.get(dataLoc);
                  state.updateElementIssue(dataLoc, {
                    dataLoc,
                    issues: existing?.issues || [],
                    status: "error",
                  });
                }
              }
            });
          }
        }
        break;
      }

      case "workspace:info": {
        const { appRoot, workspaceRoot, serverCwd } = data;
        console.log("[UILint] Received workspace info:", {
          appRoot,
          workspaceRoot,
          serverCwd,
        });
        set({ appRoot, workspaceRoot, serverCwd });
        break;
      }

      case "rules:metadata": {
        const { rules } = data;
        console.log("[UILint] Received rules metadata:", rules.length, "rules");
        // Initialize ruleConfigs from current severities (from ESLint config) or fall back to defaults
        const configs = new Map<string, RuleConfig>();
        for (const rule of rules) {
          configs.set(rule.id, {
            // Use currentSeverity from ESLint config if available, otherwise fall back to default
            severity: rule.currentSeverity ?? rule.defaultSeverity,
            // Use currentOptions from ESLint config if available, otherwise fall back to default
            options:
              rule.currentOptions ??
              (rule.defaultOptions && rule.defaultOptions.length > 0
                ? (rule.defaultOptions[0] as Record<string, unknown>)
                : undefined),
          });
        }
        set({ availableRules: rules, ruleConfigs: configs });
        break;
      }

      case "rule:config:result": {
        const { ruleId, severity, options, success, error } = data;

        // Clear updating state
        set((state) => {
          const next = new Map(state.ruleConfigUpdating);
          next.delete(ruleId);
          return { ruleConfigUpdating: next };
        });

        if (success) {
          // Update local state
          set((state) => {
            const next = new Map(state.ruleConfigs);
            next.set(ruleId, { severity, options });
            return { ruleConfigs: next };
          });
          console.log(`[UILint] Rule config updated: ${ruleId} -> ${severity}`);
        } else {
          console.error(`[UILint] Failed to update rule config: ${error}`);
        }
        break;
      }

      case "rule:config:changed": {
        const { ruleId, severity, options } = data;
        // Update local state (broadcast from another client or CLI)
        set((state) => {
          const next = new Map(state.ruleConfigs);
          next.set(ruleId, { severity, options });
          return { ruleConfigs: next };
        });
        console.log(
          `[UILint] Rule config changed (broadcast): ${ruleId} -> ${severity}`
        );

        // Trigger full re-scan if live scan is enabled
        const state = get();
        if (state.liveScanEnabled && !state.scanLock) {
          console.log(`[UILint] Triggering re-scan after rule config change`);

          // Clear all caches
          state.invalidateCache();

          // Clear element and file issues caches
          set({
            elementIssuesCache: new Map(),
            fileIssuesCache: new Map(),
          });

          // Re-run scan with existing elements if we have them
          const elements = state.autoScanState.elements;
          if (elements.length > 0) {
            // Re-initialize cache with pending status, keyed by dataLoc
            const initialCache = new Map<string, ElementIssue>();
            for (const el of elements) {
              const dataLoc = getDataLocFromSource(el.source);
              // Only add if not already present (multiple elements can share same dataLoc)
              if (!initialCache.has(dataLoc)) {
                initialCache.set(dataLoc, {
                  dataLoc,
                  issues: [],
                  status: "pending",
                });
              }
            }

            set({
              elementIssuesCache: initialCache,
              scanLock: true,
              autoScanState: {
                ...state.autoScanState,
                status: "scanning",
                currentIndex: 0,
              },
            });

            // Run the scan loop
            get()._runScanLoop(elements);
          }
        }
        break;
      }

      case "vision:result": {
        const { route, issues, analysisTime, error, requestId } = data;
        console.log("[UILint] Vision result:", {
          route,
          issues: issues.length,
          error,
        });

        // Update cache
        set((state) => {
          const next = new Map(state.visionIssuesCache);
          next.set(route, issues);
          return {
            visionIssuesCache: next,
            visionResult: {
              route,
              timestamp: Date.now(),
              manifest: [],
              issues,
              analysisTime,
              error,
            },
            visionAnalyzing: false,
            visionProgressPhase: null,
            visionLastError: error
              ? ({
                  stage: "vision",
                  message: error,
                  route,
                  timestamp: Date.now(),
                } satisfies VisionErrorInfo)
              : null,
          };
        });

        // Resolve pending request
        if (requestId) {
          const pending = pendingVisionRequests.get(requestId);
          if (pending) {
            // Fire-and-forget: persist sidecar even if the awaiting promise is ignored.
            postScreenshotToApi({
              filename: pending.filename,
              analysisResult: {
                route: pending.route,
                timestamp: Date.now(),
                issues,
                analysisTime,
                error,
              },
            }).catch((e) => {
              console.warn("[UILint] Failed to save vision result sidecar:", e);
            });

            pending.resolve({
              route,
              timestamp: Date.now(),
              manifest: Array.isArray(pending.manifest)
                ? (pending.manifest as any)
                : [],
              issues,
              analysisTime,
              error,
            });
            pendingVisionRequests.delete(requestId);
          }
        }
        break;
      }

      case "vision:progress": {
        const { phase } = data;
        set({ visionProgressPhase: phase });
        break;
      }

      // ============ Duplicates Index Messages ============
      case "duplicates:indexing:start": {
        set({
          duplicatesIndexStatus: "indexing",
          duplicatesIndexMessage: "Starting index...",
          duplicatesIndexProgress: null,
          duplicatesIndexError: null,
        });
        console.log("[UILint] Duplicates indexing started");
        break;
      }

      case "duplicates:indexing:progress": {
        const { message, current, total } =
          data as DuplicatesIndexingProgressMessage;
        set({
          duplicatesIndexStatus: "indexing",
          duplicatesIndexMessage: message,
          duplicatesIndexProgress:
            current !== undefined && total !== undefined
              ? { current, total }
              : null,
        });
        break;
      }

      case "duplicates:indexing:complete": {
        const { added, modified, deleted, totalChunks, duration } =
          data as DuplicatesIndexingCompleteMessage;
        set({
          duplicatesIndexStatus: "ready",
          duplicatesIndexMessage: null,
          duplicatesIndexProgress: null,
          duplicatesIndexStats: {
            totalChunks,
            added,
            modified,
            deleted,
            duration,
          },
        });
        console.log(
          `[UILint] Duplicates index ready: ${totalChunks} chunks (${added} added, ${modified} modified, ${deleted} deleted) in ${duration}ms`
        );
        break;
      }

      case "duplicates:indexing:error": {
        const { error } = data as DuplicatesIndexingErrorMessage;
        set({
          duplicatesIndexStatus: "error",
          duplicatesIndexMessage: null,
          duplicatesIndexProgress: null,
          duplicatesIndexError: error,
        });
        console.error("[UILint] Duplicates indexing error:", error);
        break;
      }

      case "config:update": {
        const { key, value } = data;
        console.log("[UILint] config:update", key, value);

        // Handle specific config keys
        if (key === "floatingIconPosition") {
          const pos = value as FloatingIconPosition | null;
          if (pos && typeof pos.x === "number" && typeof pos.y === "number") {
            // Update store and persist to localStorage
            saveFloatingIconPosition(pos);
            set({ floatingIconPosition: pos });
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
