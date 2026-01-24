/**
 * ESLint Plugin State Slice
 *
 * State management for ESLint-related functionality extracted from the main store.
 * This slice manages live scanning, issue caching, rule configuration, and heatmap data.
 */

import type { PluginServices } from "../../core/plugin-system/types";
import type {
  ESLintIssue,
  ElementIssue,
  AvailableRule,
  RuleConfig,
  AutoScanSettings,
  ScannedElement,
  ScanStatus,
} from "./types";
import { DEFAULT_AUTO_SCAN_SETTINGS } from "./types";

/**
 * ESLint plugin state slice
 */
export interface ESLintSlice {
  // ============ Live Scanning ============
  /** Whether live scanning mode is enabled */
  liveScanEnabled: boolean;
  /** Current scan status */
  scanStatus: ScanStatus;
  /** Elements currently being scanned */
  scannedElements: ScannedElement[];
  /** Whether a scan is in progress (lock to prevent concurrent scans) */
  scanLock: boolean;

  // ============ Issue Caches ============
  /** Element-level issues keyed by dataLoc */
  elementIssuesCache: Map<string, ElementIssue>;
  /** File-level issues not mapped to specific elements */
  fileIssuesCache: Map<string, ESLintIssue[]>;
  /** Raw ESLint issues from WebSocket keyed by file path */
  eslintIssuesCache: Map<string, ESLintIssue[]>;

  // ============ Rule Configuration ============
  /** Available ESLint rules from server */
  availableRules: AvailableRule[];
  /** Current rule configurations (severity + options) */
  ruleConfigs: Map<string, RuleConfig>;
  /** Rule config update in progress */
  ruleConfigUpdating: Map<string, boolean>;
  /** Disabled rules (visual filtering only) */
  disabledRules: Set<string>;

  // ============ Auto-Scan Settings ============
  /** Auto-scan settings (persisted to localStorage) */
  autoScanSettings: AutoScanSettings;

  // ============ Workspace Info ============
  /** Workspace root path from the server */
  workspaceRoot: string | null;
  /** Next.js app root path from the server */
  appRoot: string | null;
  /** Server working directory */
  serverCwd: string | null;

  // ============ Heatmap Display ============
  /** Map of file path -> top-level element ID for that file */
  topLevelElementsByFile: Map<string, string>;
  /** Merged issue counts: element issues + file-level issues for top-level elements */
  mergedIssueCounts: Map<string, number>;

  // ============ Scan Progress ============
  /** Current scan index */
  currentScanIndex: number;
  /** Total elements to scan */
  totalElements: number;
}

/**
 * ESLint plugin actions
 */
export interface ESLintActions {
  // ============ Live Scanning ============
  /** Enable live scanning and run initial scan */
  enableLiveScan: (hideNodeModules: boolean) => Promise<void>;
  /** Disable live scanning and clear all results */
  disableLiveScan: () => void;
  /** Scan newly-detected elements (called by DOM observer) */
  scanNewElements: (elements: ScannedElement[]) => Promise<void>;

  // ============ Issue Management ============
  /** Update issue cache for a dataLoc key */
  updateElementIssue: (dataLoc: string, issue: ElementIssue) => void;
  /** Update file-level issues */
  updateFileIssues: (filePath: string, issues: ESLintIssue[]) => void;
  /** Remove stale results for elements no longer in DOM */
  removeStaleResults: (elementIds: string[]) => void;

  // ============ Rule Configuration ============
  /** Toggle a rule on/off (visual filtering) */
  toggleRule: (ruleId: string) => void;
  /** Set rule severity and/or options via WebSocket */
  setRuleConfig: (
    ruleId: string,
    severity: "error" | "warn" | "off",
    options?: Record<string, unknown>
  ) => Promise<void>;

  // ============ Heatmap ============
  /** Compute top-level elements and merged issue counts for heatmap display */
  computeHeatmapData: () => void;

  // ============ Auto-Scan Settings ============
  /** Update auto-scan settings */
  updateAutoScanSettings: (
    partial: Partial<{
      eslint: Partial<AutoScanSettings["eslint"]>;
      vision: Partial<AutoScanSettings["vision"]>;
    }>
  ) => void;

  // ============ Cache Management ============
  /** Invalidate cache for a file or all files */
  invalidateCache: (filePath?: string) => void;
}

/**
 * Combined slice type
 */
export type ESLintPluginSlice = ESLintSlice & ESLintActions;

/** localStorage key for auto-scan settings */
const AUTO_SCAN_SETTINGS_KEY = "uilint:autoScanSettings";

/**
 * Load auto-scan settings from localStorage
 */
function loadAutoScanSettings(): AutoScanSettings {
  if (typeof window === "undefined") return DEFAULT_AUTO_SCAN_SETTINGS;
  try {
    const stored = localStorage.getItem(AUTO_SCAN_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        eslint: { ...DEFAULT_AUTO_SCAN_SETTINGS.eslint, ...parsed.eslint },
        vision: { ...DEFAULT_AUTO_SCAN_SETTINGS.vision, ...parsed.vision },
      };
    }
  } catch (e) {
    console.warn("[ESLint Plugin] Failed to load auto-scan settings:", e);
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
    console.warn("[ESLint Plugin] Failed to save auto-scan settings:", e);
  }
}

/**
 * Filter issues by disabled rules
 */
export function filterIssuesByDisabledRules(
  issues: ESLintIssue[],
  disabledRules: Set<string>
): ESLintIssue[] {
  if (disabledRules.size === 0) return issues;
  return issues.filter(
    (issue) => !issue.ruleId || !disabledRules.has(issue.ruleId)
  );
}

/**
 * Create the initial ESLint slice state
 */
export function createESLintSlice(_services: PluginServices): ESLintSlice {
  return {
    // Live Scanning
    liveScanEnabled: false,
    scanStatus: "idle",
    scannedElements: [],
    scanLock: false,

    // Issue Caches
    elementIssuesCache: new Map(),
    fileIssuesCache: new Map(),
    eslintIssuesCache: new Map(),

    // Rule Configuration
    availableRules: [],
    ruleConfigs: new Map(),
    ruleConfigUpdating: new Map(),
    disabledRules: new Set(),

    // Auto-Scan Settings
    autoScanSettings: loadAutoScanSettings(),

    // Workspace Info
    workspaceRoot: null,
    appRoot: null,
    serverCwd: null,

    // Heatmap Display
    topLevelElementsByFile: new Map(),
    mergedIssueCounts: new Map(),

    // Scan Progress
    currentScanIndex: 0,
    totalElements: 0,
  };
}

/**
 * Create ESLint slice actions
 * These actions interact with the main store through services
 */
export function createESLintActions(
  services: PluginServices,
  getSlice: () => ESLintSlice,
  setSlice: (partial: Partial<ESLintSlice>) => void
): ESLintActions {
  return {
    enableLiveScan: async (hideNodeModules: boolean) => {
      const slice = getSlice();

      // Prevent concurrent scans
      if (slice.scanLock) {
        console.warn("[ESLint Plugin] Scan already in progress");
        return;
      }

      setSlice({
        liveScanEnabled: true,
        scanLock: true,
        scanStatus: "scanning",
      });

      // The actual scanning is handled by the main store
      // This is a coordination point - we'll need to integrate with the main store's scan logic
      console.log("[ESLint Plugin] Live scan enabled, hideNodeModules:", hideNodeModules);
    },

    disableLiveScan: () => {
      setSlice({
        liveScanEnabled: false,
        scanLock: false,
        scanStatus: "idle",
        scannedElements: [],
        elementIssuesCache: new Map(),
        fileIssuesCache: new Map(),
        topLevelElementsByFile: new Map(),
        mergedIssueCounts: new Map(),
        currentScanIndex: 0,
        totalElements: 0,
      });
    },

    scanNewElements: async (elements: ScannedElement[]) => {
      const slice = getSlice();

      if (!slice.liveScanEnabled) return;
      if (elements.length === 0) return;

      // Add new elements to the scanned list
      setSlice({
        scannedElements: [...slice.scannedElements, ...elements],
        totalElements: slice.totalElements + elements.length,
      });

      console.log("[ESLint Plugin] Scanning new elements:", elements.length);
    },

    updateElementIssue: (dataLoc: string, issue: ElementIssue) => {
      const slice = getSlice();
      const newCache = new Map(slice.elementIssuesCache);
      newCache.set(dataLoc, issue);
      setSlice({ elementIssuesCache: newCache });
    },

    updateFileIssues: (filePath: string, issues: ESLintIssue[]) => {
      const slice = getSlice();
      const newCache = new Map(slice.fileIssuesCache);
      if (issues.length > 0) {
        newCache.set(filePath, issues);
      } else {
        newCache.delete(filePath);
      }
      setSlice({ fileIssuesCache: newCache });
    },

    removeStaleResults: (elementIds: string[]) => {
      const slice = getSlice();
      const removedIdSet = new Set(elementIds);

      // Remove elements by ID
      const newElements = slice.scannedElements.filter(
        (el) => !removedIdSet.has(el.id)
      );

      // Find dataLocs that no longer have any elements
      const remainingDataLocs = new Set<string>();
      for (const el of newElements) {
        const dataLoc = `${el.source.fileName}:${el.source.lineNumber}:${el.source.columnNumber ?? 0}`;
        remainingDataLocs.add(dataLoc);
      }

      // Remove cache entries for dataLocs with no remaining elements
      const newCache = new Map(slice.elementIssuesCache);
      for (const dataLoc of newCache.keys()) {
        if (!remainingDataLocs.has(dataLoc)) {
          newCache.delete(dataLoc);
        }
      }

      setSlice({
        elementIssuesCache: newCache,
        scannedElements: newElements,
        totalElements: newElements.length,
      });
    },

    toggleRule: (ruleId: string) => {
      const slice = getSlice();
      const newDisabled = new Set(slice.disabledRules);

      if (newDisabled.has(ruleId)) {
        newDisabled.delete(ruleId);
      } else {
        newDisabled.add(ruleId);
      }

      setSlice({ disabledRules: newDisabled });

      // Recompute heatmap data after toggling
      // This would call computeHeatmapData but we need access to the action
    },

    setRuleConfig: async (
      ruleId: string,
      severity: "error" | "warn" | "off",
      options?: Record<string, unknown>
    ) => {
      const slice = getSlice();

      // Mark as updating
      const updating = new Map(slice.ruleConfigUpdating);
      updating.set(ruleId, true);
      setSlice({ ruleConfigUpdating: updating });

      // Send via WebSocket through services
      services.websocket.send({
        type: "rule:config:set",
        ruleId,
        severity,
        options,
        requestId: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      });

      // Result will be handled by WebSocket message handler
    },

    computeHeatmapData: () => {
      const slice = getSlice();
      const elements = slice.scannedElements;
      const { disabledRules, elementIssuesCache, fileIssuesCache } = slice;

      // Identify top-level elements per file
      const topLevelByFile = new Map<string, string>();
      const fileElementCounts = new Map<string, number>();

      for (const el of elements) {
        const filePath = el.source.fileName;
        const count = (fileElementCounts.get(filePath) || 0) + 1;
        fileElementCounts.set(filePath, count);

        // First element for each file is considered top-level
        if (!topLevelByFile.has(filePath)) {
          topLevelByFile.set(filePath, el.id);
        }
      }

      // Compute merged issue counts
      const mergedCounts = new Map<string, number>();

      for (const el of elements) {
        const dataLoc = `${el.source.fileName}:${el.source.lineNumber}:${el.source.columnNumber ?? 0}`;
        const cached = elementIssuesCache.get(dataLoc);

        // Filter out issues from disabled rules
        const filteredIssues = cached
          ? filterIssuesByDisabledRules(cached.issues, disabledRules)
          : [];
        let totalCount = filteredIssues.length;

        // If this is the top-level element for its file, add file-level issues
        const filePath = el.source.fileName;
        if (topLevelByFile.get(filePath) === el.id) {
          const fileIssues = fileIssuesCache.get(filePath) || [];
          const filteredFileIssues = filterIssuesByDisabledRules(
            fileIssues,
            disabledRules
          );
          totalCount += filteredFileIssues.length;
        }

        mergedCounts.set(el.id, totalCount);
      }

      setSlice({
        topLevelElementsByFile: topLevelByFile,
        mergedIssueCounts: mergedCounts,
      });
    },

    updateAutoScanSettings: (partial) => {
      const slice = getSlice();
      const newSettings: AutoScanSettings = {
        eslint: { ...slice.autoScanSettings.eslint, ...partial.eslint },
        vision: { ...slice.autoScanSettings.vision, ...partial.vision },
      };
      saveAutoScanSettings(newSettings);
      setSlice({ autoScanSettings: newSettings });
    },

    invalidateCache: (filePath?: string) => {
      const slice = getSlice();

      if (filePath) {
        const next = new Map(slice.eslintIssuesCache);
        next.delete(filePath);
        setSlice({ eslintIssuesCache: next });
      } else {
        setSlice({ eslintIssuesCache: new Map() });
      }

      // Send to server via WebSocket
      services.websocket.send({
        type: "cache:invalidate",
        filePath,
      });
    },
  };
}

/**
 * WebSocket message types handled by this slice
 */
export const ESLINT_WS_MESSAGE_TYPES = [
  "lint:result",
  "lint:progress",
  "file:changed",
  "workspace:info",
  "rules:metadata",
  "rule:config:result",
  "rule:config:changed",
] as const;

export type ESLintWSMessageType = (typeof ESLINT_WS_MESSAGE_TYPES)[number];
