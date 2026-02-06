/**
 * Semantic Plugin Action Handlers
 *
 * Plain functions that handle plugin actions.
 * No React - uses PluginContext for state management.
 */

import type { ActionHandlers, PluginContext } from "uilint-core";
import type { SemanticState } from "./state.js";
import type { IndexStats } from "../types.js";

/**
 * Action handlers for the semantic plugin
 */
export const semanticActionHandlers: ActionHandlers<SemanticState> = {
  /**
   * Start indexing
   */
  "start-indexing": (ctx: PluginContext<SemanticState>) => {
    ctx.setState({
      indexStatus: "indexing",
      indexProgress: { current: 0, total: 0 },
      lastIndexError: null,
    });

    // Request server to start indexing
    ctx.websocket.send({ type: "duplicates:index" });
  },

  /**
   * Handle indexing started
   */
  "handle-indexing-start": (ctx: PluginContext<SemanticState>) => {
    ctx.setState({
      indexStatus: "indexing",
      indexProgress: { current: 0, total: 0, message: "Starting..." },
      lastIndexError: null,
    });
  },

  /**
   * Handle indexing progress
   */
  "handle-indexing-progress": (
    ctx: PluginContext<SemanticState>,
    payload: { message: string; current?: number; total?: number }
  ) => {
    ctx.setState({
      indexProgress: {
        current: payload.current ?? 0,
        total: payload.total ?? 0,
        message: payload.message,
      },
    });
  },

  /**
   * Handle indexing complete
   */
  "handle-indexing-complete": (
    ctx: PluginContext<SemanticState>,
    payload: IndexStats
  ) => {
    ctx.setState({
      indexStatus: "ready",
      indexProgress: null,
      indexStats: payload,
      lastIndexError: null,
    });
  },

  /**
   * Handle indexing error
   */
  "handle-indexing-error": (
    ctx: PluginContext<SemanticState>,
    payload: { error: string }
  ) => {
    ctx.setState({
      indexStatus: "error",
      indexProgress: null,
      lastIndexError: payload.error,
    });
  },

  /**
   * Select a duplicate for viewing in inspector
   */
  "select-duplicate": (
    ctx: PluginContext<SemanticState>,
    payload: { sourceDataLoc: string; targetDataLoc: string; similarity: number }
  ) => {
    ctx.setState({ selectedDuplicate: payload });
    ctx.openInspector("duplicates", payload);
  },

  /**
   * Clear selected duplicate
   */
  "clear-selected-duplicate": (ctx: PluginContext<SemanticState>) => {
    ctx.setState({ selectedDuplicate: null });
  },

  /**
   * Toggle heatmap filter for duplicates
   */
  "toggle-heatmap-filter": (
    ctx: PluginContext<SemanticState>,
    payload: { sourceDataLoc: string; targetDataLoc: string }
  ) => {
    ctx.setHeatmapFilter(
      [payload.sourceDataLoc, payload.targetDataLoc],
      "Duplicate Code"
    );
  },

  /**
   * Clear heatmap filter
   */
  "clear-heatmap-filter": (ctx: PluginContext<SemanticState>) => {
    ctx.clearHeatmapFilter();
  },

  /**
   * Open file in editor
   */
  "open-editor": (
    ctx: PluginContext<SemanticState>,
    payload: { dataLoc: string }
  ) => {
    ctx.openInEditor(payload.dataLoc);
  },
};
