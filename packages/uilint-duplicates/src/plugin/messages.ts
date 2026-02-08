/**
 * Duplicates Plugin Message Handlers
 *
 * WebSocket message handlers for the duplicates plugin.
 * Plain functions - no React.
 */

import type { MessageHandlers, PluginContext } from "uilint-core";
import type { DuplicatesState } from "./state.js";

/**
 * WebSocket message types for duplicates indexing
 */
export interface DuplicatesIndexingStartMessage {
  type: "duplicates:indexing:start";
}

export interface DuplicatesIndexingProgressMessage {
  type: "duplicates:indexing:progress";
  message: string;
  current?: number;
  total?: number;
}

export interface DuplicatesIndexingCompleteMessage {
  type: "duplicates:indexing:complete";
  added: number;
  modified: number;
  deleted: number;
  totalChunks: number;
  duration: number;
}

export interface DuplicatesIndexingErrorMessage {
  type: "duplicates:indexing:error";
  error: string;
}

export type DuplicatesMessage =
  | DuplicatesIndexingStartMessage
  | DuplicatesIndexingProgressMessage
  | DuplicatesIndexingCompleteMessage
  | DuplicatesIndexingErrorMessage;

/**
 * Message handlers for the duplicates plugin
 */
export const duplicatesMessageHandlers: MessageHandlers<DuplicatesState> = {
  /**
   * Handle indexing started
   */
  "duplicates:indexing:start": (ctx: PluginContext<DuplicatesState>) => {
    ctx.dispatch("handle-indexing-start");
  },

  /**
   * Handle indexing progress
   */
  "duplicates:indexing:progress": (
    ctx: PluginContext<DuplicatesState>,
    message: unknown
  ) => {
    const msg = message as DuplicatesIndexingProgressMessage;
    ctx.dispatch("handle-indexing-progress", {
      message: msg.message,
      current: msg.current,
      total: msg.total,
    });
  },

  /**
   * Handle indexing complete
   */
  "duplicates:indexing:complete": (
    ctx: PluginContext<DuplicatesState>,
    message: unknown
  ) => {
    const msg = message as DuplicatesIndexingCompleteMessage;
    ctx.dispatch("handle-indexing-complete", {
      added: msg.added,
      modified: msg.modified,
      deleted: msg.deleted,
      totalChunks: msg.totalChunks,
      duration: msg.duration,
    });
  },

  /**
   * Handle indexing error
   */
  "duplicates:indexing:error": (
    ctx: PluginContext<DuplicatesState>,
    message: unknown
  ) => {
    const msg = message as DuplicatesIndexingErrorMessage;
    ctx.dispatch("handle-indexing-error", { error: msg.error });
  },
};
