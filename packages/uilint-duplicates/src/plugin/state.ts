/**
 * Duplicates Plugin State
 *
 * State shape and initial state for the duplicates detection plugin.
 * No React - pure TypeScript.
 */

import type { StateDefinition, OperationState } from "uilint-core";
import { createOperationInitialState, createOperationComputed } from "uilint-core";

/**
 * Index statistics
 */
export interface IndexStats {
  totalChunks: number;
  added: number;
  modified: number;
  deleted: number;
  duration: number;
}

/**
 * Duplicates plugin state shape
 */
export interface DuplicatesState {
  // === Index Operation ===
  /** Indexing operation lifecycle state */
  indexing: OperationState<IndexStats>;

  // === UI State ===
  /** Currently selected duplicate for inspector */
  selectedDuplicate: {
    sourceDataLoc: string;
    targetDataLoc: string;
    similarity: number;
  } | null;
}

/**
 * Initial state for the duplicates plugin
 */
export const duplicatesInitialState: DuplicatesState = {
  indexing: createOperationInitialState<IndexStats>(),
  selectedDuplicate: null,
};

const opComputed = createOperationComputed<DuplicatesState>((s) => s.indexing);

/**
 * State definition for the plugin system
 */
export const duplicatesStateDefinition: StateDefinition<DuplicatesState> = {
  initialState: duplicatesInitialState,

  computed: {
    /** Whether index is ready for queries */
    isIndexReady: opComputed.isReady,

    /** Whether indexing is in progress */
    isIndexing: opComputed.isActive,

    /** Whether there was an error */
    hasError: opComputed.hasError,

    /** Progress percentage (0-100) */
    progressPercent: opComputed.progressPercent,
  },

  persist: {
    key: "uilint-duplicates",
    include: [],
  },
};
