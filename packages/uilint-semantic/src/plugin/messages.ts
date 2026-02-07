/**
 * Semantic Plugin Message Handlers
 *
 * WebSocket message handlers for the semantic plugin.
 * Plain functions - no React.
 */

import type { MessageHandlers, PluginContext } from "uilint-core";
import type { SemanticState } from "./state.js";
import type {
  DuplicatesIndexingProgressMessage,
  DuplicatesIndexingCompleteMessage,
  DuplicatesIndexingErrorMessage,
} from "../types.js";

/**
 * Message handlers for the semantic plugin
 */
export const semanticMessageHandlers: MessageHandlers<SemanticState> = {
  /**
   * Handle indexing started
   */
  "duplicates:indexing:start": (ctx: PluginContext<SemanticState>) => {
    ctx.dispatch("handle-indexing-start");
  },

  /**
   * Handle indexing progress
   */
  "duplicates:indexing:progress": (
    ctx: PluginContext<SemanticState>,
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
    ctx: PluginContext<SemanticState>,
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
    ctx: PluginContext<SemanticState>,
    message: unknown
  ) => {
    const msg = message as DuplicatesIndexingErrorMessage;
    ctx.dispatch("handle-indexing-error", { error: msg.error });
  },
};
