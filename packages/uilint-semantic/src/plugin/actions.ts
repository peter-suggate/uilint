/**
 * Semantic Plugin Action Handlers
 *
 * Plain functions that handle plugin actions.
 * No React - uses PluginContext for state management.
 */

import type { ActionHandlers, PluginContext } from "uilint-core";
import type { SemanticState } from "./state.js";
import type { IndexStats } from "../types.js";

// Helper type for cleaner action handler definitions
type Handler<TPayload = void> = (
  ctx: PluginContext<SemanticState>,
  payload: TPayload
) => void | Promise<void>;

// Cast helper for proper typing - wraps typed handlers to satisfy ActionHandlers
const h = <TPayload = void>(fn: Handler<TPayload>): Handler<unknown> =>
  fn as Handler<unknown>;

/**
 * Action handlers for the semantic plugin
 */
export const semanticActionHandlers: ActionHandlers<SemanticState> = {
  /**
   * Start indexing
   */
  "start-indexing": h((ctx) => {
    ctx.setState({
      indexStatus: "indexing",
      indexProgress: { current: 0, total: 0 },
      lastIndexError: null,
    });

    // Request server to start indexing
    ctx.websocket.send({ type: "duplicates:index" });
  }),

  /**
   * Handle indexing started
   */
  "handle-indexing-start": h((ctx) => {
    ctx.setState({
      indexStatus: "indexing",
      indexProgress: { current: 0, total: 0, message: "Starting..." },
      lastIndexError: null,
    });
  }),

  /**
   * Handle indexing progress
   */
  "handle-indexing-progress": h<{ message: string; current?: number; total?: number }>(
    (ctx, payload) => {
      ctx.setState({
        indexProgress: {
          current: payload.current ?? 0,
          total: payload.total ?? 0,
          message: payload.message,
        },
      });
    }
  ),

  /**
   * Handle indexing complete
   */
  "handle-indexing-complete": h<IndexStats>((ctx, payload) => {
    ctx.setState({
      indexStatus: "ready",
      indexProgress: null,
      indexStats: payload,
      lastIndexError: null,
    });
  }),

  /**
   * Handle indexing error
   */
  "handle-indexing-error": h<{ error: string }>((ctx, payload) => {
    ctx.setState({
      indexStatus: "error",
      indexProgress: null,
      lastIndexError: payload.error,
    });
  }),

  /**
   * Select a duplicate for viewing in inspector
   */
  "select-duplicate": h<{ sourceDataLoc: string; targetDataLoc: string; similarity: number }>(
    (ctx, payload) => {
      ctx.setState({ selectedDuplicate: payload });
      ctx.openInspector("duplicates", payload);
    }
  ),

  /**
   * Clear selected duplicate
   */
  "clear-selected-duplicate": h((ctx) => {
    ctx.setState({ selectedDuplicate: null });
  }),

  /**
   * Toggle heatmap filter for duplicates
   */
  "toggle-heatmap-filter": h<{ sourceDataLoc: string; targetDataLoc: string }>(
    (ctx, payload) => {
      ctx.setHeatmapFilter(
        [payload.sourceDataLoc, payload.targetDataLoc],
        "Duplicate Code"
      );
    }
  ),

  /**
   * Clear heatmap filter
   */
  "clear-heatmap-filter": h((ctx) => {
    ctx.clearHeatmapFilter();
  }),

  /**
   * Open file in editor
   */
  "open-editor": h<{ dataLoc: string }>((ctx, payload) => {
    ctx.openInEditor(payload.dataLoc);
  }),
};
