/**
 * Duplicates Plugin Message Handlers
 *
 * WebSocket message handlers for the duplicates plugin.
 * Plain functions - no React.
 */

import type { MessageHandlers } from "uilint-core";
import { createOperationMessageHandlers } from "uilint-core";
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
 * Message handlers for the duplicates plugin.
 *
 * Uses the operation lifecycle framework for the standard
 * start -> progress -> complete/error message flow.
 */
export const duplicatesMessageHandlers: MessageHandlers<DuplicatesState> = {
  ...createOperationMessageHandlers<DuplicatesState>({
    actionPrefix: "indexing",
    startMessage: "duplicates:indexing:start",
    progressMessage: "duplicates:indexing:progress",
    completeMessage: "duplicates:indexing:complete",
    errorMessage: "duplicates:indexing:error",
    extractProgress: (msg) => {
      const m = msg as DuplicatesIndexingProgressMessage;
      return {
        current: m.current ?? 0,
        total: m.total ?? 0,
        message: m.message,
      };
    },
    extractStats: (msg) => {
      const m = msg as DuplicatesIndexingCompleteMessage;
      return {
        added: m.added,
        modified: m.modified,
        deleted: m.deleted,
        totalChunks: m.totalChunks,
        duration: m.duration,
      };
    },
  }),
};
