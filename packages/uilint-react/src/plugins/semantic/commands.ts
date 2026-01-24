/**
 * Semantic Plugin Commands
 *
 * Command palette commands for semantic analysis and duplicates detection.
 */

import type { Command } from "../../core/plugin-system/types";

/**
 * Run semantic analysis on the current file
 */
const runSemanticAnalysisCommand: Command = {
  id: "semantic:run-analysis",
  title: "Run Semantic Analysis",
  keywords: ["semantic", "llm", "analyze", "styleguide", "ai"],
  category: "semantic",
  subtitle: "Analyze current file with LLM",
  icon: "\uD83E\uDDE0", // brain emoji
  execute: async (services) => {
    console.log("[SemanticPlugin] Running semantic analysis...");

    // Send message to server to trigger semantic analysis
    services.websocket.send({
      type: "semantic:run",
      // Current file context will be determined by the server
    });

    // Close command palette after execution
    services.closeCommandPalette();
  },
};

/**
 * Rebuild the duplicates index
 */
const rebuildDuplicatesIndexCommand: Command = {
  id: "semantic:rebuild-duplicates-index",
  title: "Rebuild Duplicates Index",
  keywords: ["duplicates", "index", "rebuild", "semantic", "similarity"],
  category: "semantic",
  subtitle: "Re-index codebase for duplicate detection",
  icon: "\uD83D\uDD0D", // magnifying glass emoji
  execute: async (services) => {
    console.log("[SemanticPlugin] Rebuilding duplicates index...");

    // Send message to server to rebuild the duplicates index
    services.websocket.send({
      type: "duplicates:rebuild-index",
    });

    // Close command palette after execution
    services.closeCommandPalette();
  },
};

/**
 * Show duplicates index status
 */
const showDuplicatesIndexStatusCommand: Command = {
  id: "semantic:show-duplicates-status",
  title: "Show Duplicates Index Status",
  keywords: ["duplicates", "index", "status", "info"],
  category: "semantic",
  subtitle: "View current index status and stats",
  icon: "\u2139\uFE0F", // info emoji
  execute: async (services) => {
    const state = services.getState<{
      duplicatesIndexStatus: string;
      duplicatesIndexStats: {
        totalChunks: number;
        added: number;
        modified: number;
        deleted: number;
        duration: number;
      } | null;
      duplicatesIndexError: string | null;
    }>();

    const { duplicatesIndexStatus, duplicatesIndexStats, duplicatesIndexError } = state;

    if (duplicatesIndexStatus === "error" && duplicatesIndexError) {
      console.log(`[SemanticPlugin] Duplicates index error: ${duplicatesIndexError}`);
    } else if (duplicatesIndexStatus === "ready" && duplicatesIndexStats) {
      console.log(
        `[SemanticPlugin] Duplicates index ready: ${duplicatesIndexStats.totalChunks} chunks, ` +
          `last updated in ${duplicatesIndexStats.duration}ms`
      );
    } else if (duplicatesIndexStatus === "indexing") {
      console.log("[SemanticPlugin] Duplicates index is currently building...");
    } else {
      console.log("[SemanticPlugin] Duplicates index is idle (not built)");
    }

    // Close command palette after execution
    services.closeCommandPalette();
  },
};

/**
 * Find similar code to current selection
 */
const findSimilarCodeCommand: Command = {
  id: "semantic:find-similar",
  title: "Find Similar Code",
  keywords: ["similar", "duplicates", "find", "search", "code"],
  category: "semantic",
  subtitle: "Search for semantically similar code",
  icon: "\uD83D\uDD0E", // magnifying glass right emoji
  isAvailable: (state) => {
    // Only available when duplicates index is ready
    const s = state as { duplicatesIndexStatus: string };
    return s.duplicatesIndexStatus === "ready";
  },
  execute: async (services) => {
    console.log("[SemanticPlugin] Finding similar code...");

    // Send message to server to find similar code
    services.websocket.send({
      type: "duplicates:find-similar",
    });

    // Close command palette after execution
    services.closeCommandPalette();
  },
};

/**
 * Clear semantic analysis cache
 */
const clearSemanticCacheCommand: Command = {
  id: "semantic:clear-cache",
  title: "Clear Semantic Cache",
  keywords: ["clear", "cache", "semantic", "reset"],
  category: "semantic",
  subtitle: "Clear cached LLM analysis results",
  icon: "\uD83D\uDDD1\uFE0F", // wastebasket emoji
  execute: async (services) => {
    console.log("[SemanticPlugin] Clearing semantic cache...");

    // Send message to server to clear the semantic cache
    services.websocket.send({
      type: "semantic:clear-cache",
    });

    // Close command palette after execution
    services.closeCommandPalette();
  },
};

/**
 * All commands contributed by the semantic plugin
 */
export const semanticCommands: Command[] = [
  runSemanticAnalysisCommand,
  rebuildDuplicatesIndexCommand,
  showDuplicatesIndexStatusCommand,
  findSimilarCodeCommand,
  clearSemanticCacheCommand,
];
