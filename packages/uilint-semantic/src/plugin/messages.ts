/**
 * Styleguide Plugin Message Handlers
 *
 * WebSocket message handlers for the styleguide plugin.
 * Plain functions - no React.
 */

import type { MessageHandlers, PluginContext } from "uilint-core";
import type { StyleguideState } from "./state.js";

/**
 * WebSocket message types for styleguide
 */
export interface StyleguideStatusMessage {
  type: "styleguide:status";
  styleguideLoaded: boolean;
  styleguidePath: string | null;
  modelAvailable: boolean;
  modelName: string;
}

export interface StyleguideAnalysisProgressMessage {
  type: "styleguide:analysis:progress";
  filePath: string;
  current: number;
  total: number;
}

export interface StyleguideAnalysisCompleteMessage {
  type: "styleguide:analysis:complete";
  analyzedFileCount: number;
  issueCount: number;
}

export interface StyleguideAnalysisErrorMessage {
  type: "styleguide:analysis:error";
  error: string;
}

export type StyleguideMessage =
  | StyleguideStatusMessage
  | StyleguideAnalysisProgressMessage
  | StyleguideAnalysisCompleteMessage
  | StyleguideAnalysisErrorMessage;

/**
 * Message handlers for the styleguide plugin
 */
export const styleguideMessageHandlers: MessageHandlers<StyleguideState> = {
  /**
   * Handle styleguide status response
   */
  "styleguide:status": (
    ctx: PluginContext<StyleguideState>,
    message: unknown
  ) => {
    const msg = message as StyleguideStatusMessage;
    ctx.dispatch("handle-styleguide-status", {
      styleguideLoaded: msg.styleguideLoaded,
      styleguidePath: msg.styleguidePath,
      modelAvailable: msg.modelAvailable,
      modelName: msg.modelName,
    });
  },

  /**
   * Handle analysis progress
   */
  "styleguide:analysis:progress": (
    ctx: PluginContext<StyleguideState>,
    message: unknown
  ) => {
    const msg = message as StyleguideAnalysisProgressMessage;
    ctx.dispatch("handle-analysis-progress", {
      filePath: msg.filePath,
      current: msg.current,
      total: msg.total,
    });
  },

  /**
   * Handle analysis complete
   */
  "styleguide:analysis:complete": (
    ctx: PluginContext<StyleguideState>,
    message: unknown
  ) => {
    const msg = message as StyleguideAnalysisCompleteMessage;
    ctx.dispatch("handle-analysis-complete", {
      analyzedFileCount: msg.analyzedFileCount,
      issueCount: msg.issueCount,
    });
  },

  /**
   * Handle analysis error
   */
  "styleguide:analysis:error": (
    ctx: PluginContext<StyleguideState>,
    message: unknown
  ) => {
    const msg = message as StyleguideAnalysisErrorMessage;
    ctx.dispatch("handle-analysis-error", { error: msg.error });
  },
};
