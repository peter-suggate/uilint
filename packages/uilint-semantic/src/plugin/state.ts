/**
 * Styleguide Plugin State
 *
 * State shape and initial state for the styleguide checking plugin.
 * No React - pure TypeScript.
 */

import type { StateDefinition, OperationState } from "uilint-core";
import { createOperationInitialState, createOperationComputed } from "uilint-core";

/**
 * Analysis completion statistics
 */
export interface AnalysisStats {
  analyzedFileCount: number;
  issueCount: number;
}

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

  // === Analysis Operation ===
  /** Analysis operation lifecycle state */
  analysis: OperationState<AnalysisStats>;
}

/**
 * Initial state for the styleguide plugin
 */
export const styleguideInitialState: StyleguideState = {
  styleguideLoaded: false,
  styleguidePath: null,
  modelAvailable: false,
  modelName: "qwen3-vl:8b-instruct",
  analysis: createOperationInitialState<AnalysisStats>(),
};

const opComputed = createOperationComputed<StyleguideState>((s) => s.analysis);

/**
 * State definition for the plugin system
 */
export const styleguideStateDefinition: StateDefinition<StyleguideState> = {
  initialState: styleguideInitialState,

  computed: {
    /** Whether the plugin is ready to analyze (styleguide loaded + model available) */
    isReady: (state) => state.styleguideLoaded && state.modelAvailable,

    /** Whether analysis is currently running */
    isAnalyzing: opComputed.isActive,

    /** Whether there was an error */
    hasError: opComputed.hasError,

    /** Progress percentage (0-100) */
    progressPercent: opComputed.progressPercent,
  },

  persist: {
    key: "uilint-styleguide",
    include: [],
  },
};
