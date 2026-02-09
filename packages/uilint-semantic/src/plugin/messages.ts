/**
 * Styleguide Plugin Message Handlers
 *
 * WebSocket message handlers for the styleguide plugin.
 * Plain functions - no React.
 */

import type { MessageHandlers } from "uilint-core";
import { createOperationMessageHandlers } from "uilint-core";
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
 * Message handlers for the styleguide plugin.
 *
 * Uses the operation lifecycle framework for the standard
 * progress -> complete/error message flow.
 *
 * The styleguide:status message is handled separately via the
 * "handle-styleguide-status" action (plugin-specific, not operation lifecycle).
 */
export const styleguideMessageHandlers: MessageHandlers<StyleguideState> = {
  ...createOperationMessageHandlers<StyleguideState>({
    actionPrefix: "analysis",
    progressMessage: "styleguide:analysis:progress",
    completeMessage: "styleguide:analysis:complete",
    errorMessage: "styleguide:analysis:error",
    extractProgress: (msg) => {
      const m = msg as StyleguideAnalysisProgressMessage;
      return {
        current: m.current,
        total: m.total,
        message: m.filePath,
      };
    },
    extractStats: (msg) => {
      const m = msg as StyleguideAnalysisCompleteMessage;
      return {
        analyzedFileCount: m.analyzedFileCount,
        issueCount: m.issueCount,
      };
    },
  }),

  /**
   * Handle styleguide status response (plugin-specific, not operation lifecycle)
   */
  "styleguide:status": (ctx, message) => {
    const msg = message as StyleguideStatusMessage;
    ctx.dispatch("handle-styleguide-status", {
      styleguideLoaded: msg.styleguideLoaded,
      styleguidePath: msg.styleguidePath,
      modelAvailable: msg.modelAvailable,
      modelName: msg.modelName,
    });
  },
};
