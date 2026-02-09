/**
 * Styleguide Plugin Action Handlers
 *
 * Plain functions that handle plugin actions.
 * No React - uses PluginContext for state management.
 */

import type { ActionHandlers, PluginContext } from "uilint-core";
import { createOperationActions } from "uilint-core";
import type { StyleguideState, AnalysisStats } from "./state.js";

// Helper type for cleaner action handler definitions
type Handler<TPayload = void> = (
  ctx: PluginContext<StyleguideState>,
  payload: TPayload
) => void | Promise<void>;

// Cast helper for proper typing
const h = <TPayload = void>(fn: Handler<TPayload>): Handler<unknown> =>
  fn as Handler<unknown>;

/**
 * Generated lifecycle action handlers for the analysis operation.
 *
 * Provides: handle-analysis-start, handle-analysis-progress,
 *           handle-analysis-complete, handle-analysis-error
 */
const analysisActions = createOperationActions<StyleguideState, AnalysisStats>(
  "analysis",
  {
    getOp: (s) => s.analysis,
    setOp: (op) => ({ analysis: op }),
  }
);

/**
 * Action handlers for the styleguide plugin
 */
export const styleguideActionHandlers: ActionHandlers<StyleguideState> = {
  // Spread in generated lifecycle handlers
  ...analysisActions,

  /**
   * Check styleguide and model status
   */
  "check-styleguide-status": h((ctx) => {
    ctx.websocket.send({ type: "styleguide:check" });
  }),

  /**
   * Handle styleguide status response from server
   */
  "handle-styleguide-status": h<{
    styleguideLoaded: boolean;
    styleguidePath: string | null;
    modelAvailable: boolean;
    modelName: string;
  }>((ctx, payload) => {
    ctx.setState({
      styleguideLoaded: payload.styleguideLoaded,
      styleguidePath: payload.styleguidePath,
      modelAvailable: payload.modelAvailable,
      modelName: payload.modelName,
    });
  }),

  /**
   * Reload styleguide file from disk
   */
  "reload-styleguide": h((ctx) => {
    ctx.websocket.send({ type: "styleguide:reload" });
  }),

  /**
   * Open file in editor
   */
  "open-editor": h<{ dataLoc: string }>((ctx, payload) => {
    ctx.openInEditor(payload.dataLoc);
  }),
};
