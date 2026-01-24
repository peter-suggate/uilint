/**
 * Semantic Plugin State Slice
 *
 * State management for the semantic analysis plugin.
 * Handles duplicates indexing status and semantic analysis state.
 */

import type {
  SemanticPluginState,
  DuplicatesIndexStatus,
  DuplicatesIndexProgress,
  DuplicatesIndexStats,
  DuplicatesIndexingProgressMessage,
  DuplicatesIndexingCompleteMessage,
  DuplicatesIndexingErrorMessage,
} from "./types";
import type { PluginServices } from "../../core/plugin-system/types";

/**
 * Actions for updating the semantic plugin state
 */
export interface SemanticPluginActions {
  /** Set the duplicates index status */
  setDuplicatesIndexStatus: (status: DuplicatesIndexStatus) => void;
  /** Set the current indexing message */
  setDuplicatesIndexMessage: (message: string | null) => void;
  /** Set the current indexing progress */
  setDuplicatesIndexProgress: (progress: DuplicatesIndexProgress | null) => void;
  /** Set the indexing error */
  setDuplicatesIndexError: (error: string | null) => void;
  /** Set the indexing stats */
  setDuplicatesIndexStats: (stats: DuplicatesIndexStats | null) => void;
  /** Handle duplicates indexing start */
  handleDuplicatesIndexingStart: () => void;
  /** Handle duplicates indexing progress */
  handleDuplicatesIndexingProgress: (data: DuplicatesIndexingProgressMessage) => void;
  /** Handle duplicates indexing complete */
  handleDuplicatesIndexingComplete: (data: DuplicatesIndexingCompleteMessage) => void;
  /** Handle duplicates indexing error */
  handleDuplicatesIndexingError: (data: DuplicatesIndexingErrorMessage) => void;
  /** Reset the duplicates index state */
  resetDuplicatesIndexState: () => void;
}

/**
 * Combined state and actions for the semantic plugin slice
 */
export type SemanticPluginSlice = SemanticPluginState & SemanticPluginActions;

/**
 * Initial state for the semantic plugin
 */
export const initialSemanticPluginState: SemanticPluginState = {
  duplicatesIndexStatus: "idle",
  duplicatesIndexMessage: null,
  duplicatesIndexProgress: null,
  duplicatesIndexError: null,
  duplicatesIndexStats: null,
};

/**
 * Create the semantic plugin state slice
 *
 * @param set - Zustand set function
 * @param get - Zustand get function
 * @returns The semantic plugin slice with state and actions
 */
export function createSemanticPluginSlice(
  set: <T>(partial: Partial<T>) => void,
  get: () => SemanticPluginState
): SemanticPluginSlice {
  return {
    // Initial state
    ...initialSemanticPluginState,

    // Actions
    setDuplicatesIndexStatus: (status) =>
      set({ duplicatesIndexStatus: status }),

    setDuplicatesIndexMessage: (message) =>
      set({ duplicatesIndexMessage: message }),

    setDuplicatesIndexProgress: (progress) =>
      set({ duplicatesIndexProgress: progress }),

    setDuplicatesIndexError: (error) =>
      set({ duplicatesIndexError: error }),

    setDuplicatesIndexStats: (stats) =>
      set({ duplicatesIndexStats: stats }),

    handleDuplicatesIndexingStart: () => {
      set({
        duplicatesIndexStatus: "indexing" as DuplicatesIndexStatus,
        duplicatesIndexMessage: "Starting index...",
        duplicatesIndexProgress: null,
        duplicatesIndexError: null,
      });
      console.log("[SemanticPlugin] Duplicates indexing started");
    },

    handleDuplicatesIndexingProgress: (data) => {
      const { message, current, total } = data;
      set({
        duplicatesIndexStatus: "indexing" as DuplicatesIndexStatus,
        duplicatesIndexMessage: message,
        duplicatesIndexProgress:
          current !== undefined && total !== undefined
            ? { current, total }
            : null,
      });
    },

    handleDuplicatesIndexingComplete: (data) => {
      const { added, modified, deleted, totalChunks, duration } = data;
      set({
        duplicatesIndexStatus: "ready" as DuplicatesIndexStatus,
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
        `[SemanticPlugin] Duplicates index ready: ${totalChunks} chunks ` +
          `(${added} added, ${modified} modified, ${deleted} deleted) in ${duration}ms`
      );
    },

    handleDuplicatesIndexingError: (data) => {
      const { error } = data;
      set({
        duplicatesIndexStatus: "error" as DuplicatesIndexStatus,
        duplicatesIndexMessage: null,
        duplicatesIndexProgress: null,
        duplicatesIndexError: error,
      });
      console.error("[SemanticPlugin] Duplicates indexing error:", error);
    },

    resetDuplicatesIndexState: () => {
      set({
        ...initialSemanticPluginState,
      });
    },
  };
}

/**
 * Subscribe to duplicates indexing WebSocket messages
 *
 * @param services - Plugin services for WebSocket access
 * @param slice - The semantic plugin slice to update
 * @returns Cleanup function to unsubscribe
 */
export function subscribeToDuplicatesIndexingMessages(
  services: PluginServices,
  slice: SemanticPluginSlice
): () => void {
  const unsubStart = services.websocket.on(
    "duplicates:indexing:start",
    () => slice.handleDuplicatesIndexingStart()
  );

  const unsubProgress = services.websocket.on(
    "duplicates:indexing:progress",
    (data) => slice.handleDuplicatesIndexingProgress(data as DuplicatesIndexingProgressMessage)
  );

  const unsubComplete = services.websocket.on(
    "duplicates:indexing:complete",
    (data) => slice.handleDuplicatesIndexingComplete(data as DuplicatesIndexingCompleteMessage)
  );

  const unsubError = services.websocket.on(
    "duplicates:indexing:error",
    (data) => slice.handleDuplicatesIndexingError(data as DuplicatesIndexingErrorMessage)
  );

  // Return cleanup function
  return () => {
    unsubStart();
    unsubProgress();
    unsubComplete();
    unsubError();
  };
}
