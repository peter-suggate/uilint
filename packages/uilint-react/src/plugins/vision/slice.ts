/**
 * Vision Plugin State Slice
 *
 * Zustand state slice for vision analysis functionality.
 * Manages screenshot capture, vision analysis, and results display.
 */

import type {
  VisionIssue,
  ScreenshotCapture,
  VisionAutoScanSettings,
  VisionErrorInfo,
  VisionAnalysisResult,
  CaptureMode,
  CaptureRegion,
} from "./types";
import { DEFAULT_VISION_AUTO_SCAN_SETTINGS } from "./types";

/**
 * Vision plugin state
 */
export interface VisionSliceState {
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
  captureMode: CaptureMode;
  /** Whether region selection is currently active */
  regionSelectionActive: boolean;
  /** Selected region for capture (null if full page) */
  selectedRegion: CaptureRegion | null;
  /** Auto-scan settings for vision */
  autoScanSettings: VisionAutoScanSettings;
  /** Whether persisted screenshots are being loaded */
  loadingPersistedScreenshots: boolean;
  /** Whether persisted screenshots have been fetched (prevents re-fetching) */
  persistedScreenshotsFetched: boolean;
}

/**
 * Vision plugin actions
 */
export interface VisionSliceActions {
  /** Trigger vision analysis for current page */
  triggerVisionAnalysis: () => Promise<void>;
  /** Clear vision results */
  clearVisionResults: () => void;
  /** Clear last vision error */
  clearVisionLastError: () => void;
  /** Set highlighted vision element */
  setHighlightedVisionElementId: (id: string | null) => void;
  /** Set capture mode */
  setCaptureMode: (mode: CaptureMode) => void;
  /** Set region selection active state */
  setRegionSelectionActive: (active: boolean) => void;
  /** Set selected region for capture */
  setSelectedRegion: (region: CaptureRegion | null) => void;
  /** Set selected screenshot ID for gallery display */
  setSelectedScreenshotId: (id: string | null) => void;
  /** Fetch persisted screenshots from disk (via API) */
  fetchPersistedScreenshots: () => Promise<void>;
  /** Update vision auto-scan settings */
  updateVisionAutoScanSettings: (partial: Partial<VisionAutoScanSettings>) => void;
  /** Set vision analyzing state */
  setVisionAnalyzing: (analyzing: boolean) => void;
  /** Set vision progress phase */
  setVisionProgressPhase: (phase: string | null) => void;
  /** Set vision last error */
  setVisionLastError: (error: VisionErrorInfo | null) => void;
  /** Set vision result */
  setVisionResult: (result: VisionAnalysisResult | null) => void;
  /** Update vision issues cache */
  updateVisionIssuesCache: (route: string, issues: VisionIssue[]) => void;
  /** Add screenshot to history */
  addScreenshotToHistory: (capture: ScreenshotCapture) => void;
  /** Update screenshot in history (e.g., add issues after analysis) */
  updateScreenshotInHistory: (id: string, updates: Partial<ScreenshotCapture>) => void;
  /** Set vision current route */
  setVisionCurrentRoute: (route: string | null) => void;
}

/**
 * Combined vision slice type
 */
export type VisionSlice = VisionSliceState & VisionSliceActions;

/**
 * Default vision slice state
 */
export const defaultVisionState: VisionSliceState = {
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
  autoScanSettings: DEFAULT_VISION_AUTO_SCAN_SETTINGS,
  loadingPersistedScreenshots: false,
  persistedScreenshotsFetched: false,
};

/**
 * localStorage key for vision auto-scan settings
 */
const VISION_AUTO_SCAN_SETTINGS_KEY = "uilint:visionAutoScanSettings";

/**
 * Load vision auto-scan settings from localStorage
 */
export function loadVisionAutoScanSettings(): VisionAutoScanSettings {
  if (typeof window === "undefined") return DEFAULT_VISION_AUTO_SCAN_SETTINGS;
  try {
    const stored = localStorage.getItem(VISION_AUTO_SCAN_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_VISION_AUTO_SCAN_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn("[Vision Plugin] Failed to load auto-scan settings:", e);
  }
  return DEFAULT_VISION_AUTO_SCAN_SETTINGS;
}

/**
 * Save vision auto-scan settings to localStorage
 */
export function saveVisionAutoScanSettings(settings: VisionAutoScanSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VISION_AUTO_SCAN_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("[Vision Plugin] Failed to save auto-scan settings:", e);
  }
}

/**
 * Create vision slice actions factory
 *
 * This factory can be used with Zustand's create function to add vision
 * state and actions to a store.
 *
 * @param set - Zustand set function
 * @param get - Zustand get function
 */
export function createVisionSlice(
  set: <T>(
    partial: T | Partial<T> | ((state: T) => T | Partial<T>),
    replace?: boolean
  ) => void,
  get: () => VisionSlice
): VisionSlice {
  return {
    // State
    ...defaultVisionState,
    autoScanSettings: loadVisionAutoScanSettings(),

    // Actions
    triggerVisionAnalysis: async () => {
      // Implementation would be provided by the plugin when integrated with services
      console.warn("[Vision Plugin] triggerVisionAnalysis called without integration");
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
      } as Partial<VisionSlice>),

    clearVisionLastError: () => set({ visionLastError: null } as Partial<VisionSlice>),

    setHighlightedVisionElementId: (id) =>
      set({ highlightedVisionElementId: id } as Partial<VisionSlice>),

    setCaptureMode: (mode) => set({ captureMode: mode } as Partial<VisionSlice>),

    setRegionSelectionActive: (active) =>
      set({ regionSelectionActive: active } as Partial<VisionSlice>),

    setSelectedRegion: (region) => set({ selectedRegion: region } as Partial<VisionSlice>),

    setSelectedScreenshotId: (id) => {
      const state = get();
      if (!id) {
        set({ selectedScreenshotId: null } as Partial<VisionSlice>);
        return;
      }

      const capture = state.screenshotHistory.get(id);
      if (!capture) {
        set({ selectedScreenshotId: id } as Partial<VisionSlice>);
        return;
      }

      // If the capture has issues, update the cache for the route
      if (capture.issues && capture.issues.length > 0) {
        const issuesCache = new Map(state.visionIssuesCache);
        issuesCache.set(capture.route, capture.issues);
        set({
          selectedScreenshotId: id,
          visionIssuesCache: issuesCache,
        } as Partial<VisionSlice>);
      } else {
        set({ selectedScreenshotId: id } as Partial<VisionSlice>);
      }
    },

    fetchPersistedScreenshots: async () => {
      const state = get();
      if (state.loadingPersistedScreenshots || state.persistedScreenshotsFetched) return;

      set({ loadingPersistedScreenshots: true } as Partial<VisionSlice>);

      try {
        const response = await fetch("/api/.uilint/screenshots?list=true");
        if (!response.ok) {
          console.warn("[Vision Plugin] Failed to fetch screenshots:", response.statusText);
          return;
        }

        const data = await response.json();
        const { screenshots } = data;

        if (!screenshots || screenshots.length === 0) {
          return;
        }

        const persistedCaptures: ScreenshotCapture[] = [];

        for (const item of screenshots) {
          const { filename, metadata } = item;
          const id = `capture_${filename.replace(/\.[^.]+$/, "")}`;
          const route = metadata?.route || metadata?.analysisResult?.route || "/";
          const timestamp = metadata?.timestamp || Date.now();
          const issues = metadata?.issues || metadata?.analysisResult?.issues || [];

          const capture: ScreenshotCapture = {
            id,
            route,
            filename,
            timestamp,
            type: "full",
            persisted: true,
            issues: issues.length > 0 ? issues : undefined,
          };

          persistedCaptures.push(capture);
        }

        const currentState = get();
        const newHistory = new Map(currentState.screenshotHistory);
        const newVisionCache = new Map(currentState.visionIssuesCache);

        for (const capture of persistedCaptures) {
          const existing = newHistory.get(capture.id);
          if (!existing || !existing.dataUrl) {
            newHistory.set(capture.id, capture);
          }

          if (
            capture.issues &&
            capture.issues.length > 0 &&
            !newVisionCache.has(capture.route)
          ) {
            newVisionCache.set(capture.route, capture.issues);
          }
        }

        set({
          screenshotHistory: newHistory,
          visionIssuesCache: newVisionCache,
        } as Partial<VisionSlice>);
      } catch (error) {
        console.warn("[Vision Plugin] Error fetching persisted screenshots:", error);
      } finally {
        set({
          loadingPersistedScreenshots: false,
          persistedScreenshotsFetched: true,
        } as Partial<VisionSlice>);
      }
    },

    updateVisionAutoScanSettings: (partial) => {
      const state = get();
      const newSettings = { ...state.autoScanSettings, ...partial };
      saveVisionAutoScanSettings(newSettings);
      set({ autoScanSettings: newSettings } as Partial<VisionSlice>);
    },

    setVisionAnalyzing: (analyzing) =>
      set({ visionAnalyzing: analyzing } as Partial<VisionSlice>),

    setVisionProgressPhase: (phase) =>
      set({ visionProgressPhase: phase } as Partial<VisionSlice>),

    setVisionLastError: (error) =>
      set({ visionLastError: error } as Partial<VisionSlice>),

    setVisionResult: (result) =>
      set({ visionResult: result } as Partial<VisionSlice>),

    updateVisionIssuesCache: (route, issues) => {
      const state = get();
      const issuesCache = new Map(state.visionIssuesCache);
      issuesCache.set(route, issues);
      set({ visionIssuesCache: issuesCache } as Partial<VisionSlice>);
    },

    addScreenshotToHistory: (capture) => {
      const state = get();
      const history = new Map(state.screenshotHistory);
      history.set(capture.id, capture);
      set({
        screenshotHistory: history,
        selectedScreenshotId: capture.id,
      } as Partial<VisionSlice>);
    },

    updateScreenshotInHistory: (id, updates) => {
      const state = get();
      const history = new Map(state.screenshotHistory);
      const existing = history.get(id);
      if (existing) {
        history.set(id, { ...existing, ...updates });
        set({ screenshotHistory: history } as Partial<VisionSlice>);
      }
    },

    setVisionCurrentRoute: (route) =>
      set({ visionCurrentRoute: route } as Partial<VisionSlice>),
  };
}
