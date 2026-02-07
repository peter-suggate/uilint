/**
 * Vision Plugin State
 *
 * State shape and initial state for the vision plugin.
 * No React - pure TypeScript.
 */

import type { StateDefinition } from "uilint-core";
import type {
  ScreenshotCapture,
  VisionIssue,
  VisionAutoScanSettings,
  VisionErrorInfo,
  CaptureMode,
  CaptureRegion,
} from "../types.js";
import { DEFAULT_VISION_AUTO_SCAN_SETTINGS } from "../types.js";

/**
 * Vision plugin state shape
 */
export interface VisionState {
  // === Availability ===
  /** Whether vision analysis is available (Ollama running with vision model) */
  visionAvailable: boolean;
  /** The vision model being used */
  visionModel: string | null;

  // === Analysis State ===
  /** Whether vision analysis is in progress */
  visionAnalyzing: boolean;
  /** Current phase of analysis (capture, manifest, analyzing, etc.) */
  visionProgressPhase: string | null;

  // === Capture State ===
  /** Current capture mode */
  captureMode: CaptureMode;
  /** Whether region selection is active */
  regionSelectionActive: boolean;
  /** Selected region bounds (if in region mode) */
  selectedRegion: CaptureRegion | null;

  // === Results ===
  /** Screenshot history keyed by ID */
  screenshotHistory: Map<string, ScreenshotCapture>;
  /** Vision issues keyed by route */
  visionIssuesCache: Map<string, VisionIssue[]>;

  // === Error State ===
  /** Last error that occurred */
  lastError: VisionErrorInfo | null;

  // === Settings ===
  /** Auto-scan settings */
  autoScanSettings: VisionAutoScanSettings;
}

/**
 * Initial state for the vision plugin
 */
export const visionInitialState: VisionState = {
  // Availability
  visionAvailable: false,
  visionModel: null,

  // Analysis state
  visionAnalyzing: false,
  visionProgressPhase: null,

  // Capture state
  captureMode: "full",
  regionSelectionActive: false,
  selectedRegion: null,

  // Results
  screenshotHistory: new Map(),
  visionIssuesCache: new Map(),

  // Error state
  lastError: null,

  // Settings
  autoScanSettings: DEFAULT_VISION_AUTO_SCAN_SETTINGS,
};

/**
 * State definition for the plugin system
 */
export const visionStateDefinition: StateDefinition<VisionState> = {
  initialState: visionInitialState,

  computed: {
    /** Whether there are any screenshots */
    hasScreenshots: (state) => state.screenshotHistory.size > 0,

    /** Total number of issues across all routes */
    totalIssues: (state) => {
      let count = 0;
      for (const issues of state.visionIssuesCache.values()) {
        count += issues.length;
      }
      return count;
    },

    /** Whether currently capturing */
    isCapturing: (state) =>
      state.visionAnalyzing && state.visionProgressPhase === "capture",

    /** Whether currently analyzing (after capture) */
    isAnalyzing: (state) =>
      state.visionAnalyzing && state.visionProgressPhase === "analyzing",

    /** All screenshots as an array (sorted by timestamp, newest first) */
    screenshotList: (state) =>
      Array.from(state.screenshotHistory.values()).sort(
        (a, b) => b.timestamp - a.timestamp
      ),
  },

  persist: {
    key: "uilint-vision",
    include: ["autoScanSettings"],
  },
};
