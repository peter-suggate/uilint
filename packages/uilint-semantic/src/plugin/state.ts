/**
 * Styleguide Plugin State
 *
 * State shape and initial state for the styleguide checking plugin.
 * No React - pure TypeScript.
 */

import type { StateDefinition } from "uilint-core";

/**
 * Styleguide plugin state shape
 */
export interface StyleguideState {
  // === Styleguide Loading ===
  /** Whether a styleguide file was found */
  styleguideLoaded: boolean;
  /** Resolved path to the styleguide file */
  styleguidePath: string | null;

  // === Model Availability ===
  /** Whether the required Ollama model is available */
  modelAvailable: boolean;
  /** Name of the configured model */
  modelName: string;

  // === Analysis State ===
  /** Current analysis status */
  analysisStatus: "idle" | "analyzing" | "complete" | "error";
  /** Analysis progress */
  analysisProgress: {
    filePath: string;
    current: number;
    total: number;
  } | null;
  /** Last analysis error */
  lastAnalysisError: string | null;

  // === Stats ===
  /** Number of files analyzed */
  analyzedFileCount: number;
  /** Number of issues found */
  issueCount: number;
}

/**
 * Initial state for the styleguide plugin
 */
export const styleguideInitialState: StyleguideState = {
  styleguideLoaded: false,
  styleguidePath: null,
  modelAvailable: false,
  modelName: "qwen3-vl:8b-instruct",
  analysisStatus: "idle",
  analysisProgress: null,
  lastAnalysisError: null,
  analyzedFileCount: 0,
  issueCount: 0,
};

/**
 * State definition for the plugin system
 */
export const styleguideStateDefinition: StateDefinition<StyleguideState> = {
  initialState: styleguideInitialState,

  computed: {
    /** Whether the plugin is ready to analyze (styleguide loaded + model available) */
    isReady: (state) => state.styleguideLoaded && state.modelAvailable,

    /** Whether analysis is currently running */
    isAnalyzing: (state) => state.analysisStatus === "analyzing",

    /** Whether there was an error */
    hasError: (state) => state.analysisStatus === "error" || state.lastAnalysisError !== null,

    /** Progress percentage (0-100) */
    progressPercent: (state) => {
      if (!state.analysisProgress) return 0;
      if (state.analysisProgress.total === 0) return 0;
      return Math.round((state.analysisProgress.current / state.analysisProgress.total) * 100);
    },
  },

  persist: {
    key: "uilint-styleguide",
    include: [],
  },
};
