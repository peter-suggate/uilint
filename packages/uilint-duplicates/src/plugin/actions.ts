/**
 * Duplicates Plugin Action Handlers
 *
 * Plain functions that handle plugin actions.
 * No React - uses PluginContext for state management.
 */

import type { ActionHandlers, PluginContext } from "uilint-core";
import { createOperationActions } from "uilint-core";
import type { DuplicatesState, IndexStats } from "./state.js";

// Helper type for cleaner action handler definitions
type Handler<TPayload = void> = (
  ctx: PluginContext<DuplicatesState>,
  payload: TPayload
) => void | Promise<void>;

// Cast helper for proper typing
const h = <TPayload = void>(fn: Handler<TPayload>): Handler<unknown> =>
  fn as Handler<unknown>;

/**
 * Generated lifecycle action handlers for the indexing operation.
 *
 * Provides: handle-indexing-start, handle-indexing-progress,
 *           handle-indexing-complete, handle-indexing-error
 */
const indexingActions = createOperationActions<DuplicatesState, IndexStats>(
  "indexing",
  {
    getOp: (s) => s.indexing,
    setOp: (op) => ({ indexing: op }),
  }
);

/**
 * Action handlers for the duplicates plugin
 */
export const duplicatesActionHandlers: ActionHandlers<DuplicatesState> = {
  // Spread in generated lifecycle handlers
  ...indexingActions,

  /**
   * Start indexing
   */
  "start-indexing": h((ctx) => {
    ctx.dispatch("handle-indexing-start");
    ctx.websocket.send({ type: "duplicates:index" });
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
