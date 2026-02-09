/**
 * Styleguide Plugin Action Handlers
 *
 * Plain functions that handle plugin actions.
 * No React - uses PluginContext for state management.
 */

import type { ActionHandlers, PluginContext } from "uilint-core";
import type { StyleguideState } from "./state.js";

// Helper type for cleaner action handler definitions
type Handler<TPayload = void> = (
  ctx: PluginContext<StyleguideState>,
  payload: TPayload
) => void | Promise<void>;

// Cast helper for proper typing
const h = <TPayload = void>(fn: Handler<TPayload>): Handler<unknown> =>
  fn as Handler<unknown>;

/**
 * Action handlers for the styleguide plugin
 */
export const styleguideActionHandlers: ActionHandlers<StyleguideState> = {
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
   * Handle analysis progress
   */
  "handle-analysis-progress": h<{
    filePath: string;
    current: number;
    total: number;
  }>((ctx, payload) => {
    ctx.setState({
      analysisStatus: "analyzing",
      analysisProgress: payload,
    });
  }),

  /**
   * Handle analysis complete
   */
  "handle-analysis-complete": h<{
    analyzedFileCount: number;
    issueCount: number;
  }>((ctx, payload) => {
    ctx.setState({
      analysisStatus: "complete",
      analysisProgress: null,
      analyzedFileCount: payload.analyzedFileCount,
      issueCount: payload.issueCount,
      lastAnalysisError: null,
    });
  }),

  /**
   * Handle analysis error
   */
  "handle-analysis-error": h<{ error: string }>((ctx, payload) => {
    ctx.setState({
      analysisStatus: "error",
      analysisProgress: null,
      lastAnalysisError: payload.error,
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
