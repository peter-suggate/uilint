/**
 * Vision Plugin Message Handlers
 *
 * WebSocket message handlers for the vision plugin.
 * Plain functions - no React.
 */

import type { MessageHandlers, PluginContext } from "uilint-core";
import type { VisionState } from "./state.js";
import type {
  VisionStatusMessage,
  VisionProgressMessage,
  VisionResultMessage,
} from "../types.js";

/**
 * Message handlers for the vision plugin
 */
export const visionMessageHandlers: MessageHandlers<VisionState> = {
  /**
   * Handle vision availability status
   */
  "vision:status": (
    ctx: PluginContext<VisionState>,
    message: unknown
  ) => {
    const msg = message as VisionStatusMessage;
    ctx.dispatch("set-vision-available", {
      available: msg.available,
      model: msg.model,
    });
  },

  /**
   * Handle vision analysis progress
   */
  "vision:progress": (
    ctx: PluginContext<VisionState>,
    message: unknown
  ) => {
    const msg = message as VisionProgressMessage;
    ctx.dispatch("handle-vision-progress", { phase: msg.phase });
  },

  /**
   * Handle vision analysis result
   */
  "vision:result": (
    ctx: PluginContext<VisionState>,
    message: unknown
  ) => {
    const msg = message as VisionResultMessage;
    ctx.dispatch("handle-vision-result", {
      route: msg.route,
      issues: msg.issues,
      analysisTime: msg.analysisTime,
      error: msg.error,
    });
  },
};
