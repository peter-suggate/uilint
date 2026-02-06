/**
 * Semantic Plugin State
 *
 * State shape and initial state for the semantic plugin.
 * No React - pure TypeScript.
 */

import type { StateDefinition } from "uilint-core";
import type { IndexStatus, IndexProgress, IndexStats } from "../types.js";

/**
 * Semantic plugin state shape
 */
export interface SemanticState {
  // === Index Status ===
  /** Current index status */
  indexStatus: IndexStatus;
  /** Indexing progress */
  indexProgress: IndexProgress | null;
  /** Index statistics from last build */
  indexStats: IndexStats | null;

  // === Error State ===
  /** Last indexing error */
  lastIndexError: string | null;

  // === UI State ===
  /** Currently selected duplicate for inspector */
  selectedDuplicate: {
    sourceDataLoc: string;
    targetDataLoc: string;
    similarity: number;
  } | null;
}

/**
 * Initial state for the semantic plugin
 */
export const semanticInitialState: SemanticState = {
  indexStatus: "idle",
  indexProgress: null,
  indexStats: null,
  lastIndexError: null,
  selectedDuplicate: null,
};

/**
 * State definition for the plugin system
 */
export const semanticStateDefinition: StateDefinition<SemanticState> = {
  initialState: semanticInitialState,

  computed: {
    /** Whether index is ready for queries */
    isIndexReady: (state) => state.indexStatus === "ready",

    /** Whether indexing is in progress */
    isIndexing: (state) => state.indexStatus === "indexing",

    /** Whether there was an error */
    hasError: (state) => state.indexStatus === "error" || state.lastIndexError !== null,

    /** Progress percentage (0-100) */
    progressPercent: (state) => {
      if (!state.indexProgress) return 0;
      if (state.indexProgress.total === 0) return 0;
      return Math.round((state.indexProgress.current / state.indexProgress.total) * 100);
    },
  },

  persist: {
    key: "uilint-semantic",
    include: [], // Don't persist anything for now
  },
};
