/**
 * Semantic Plugin
 *
 * LLM-powered semantic code analysis plugin for UILint.
 * Handles the semantic rule and duplicates detection.
 */

import type { Plugin } from "../../core/plugin-system/types";
import { semanticCommands } from "./commands";
import {
  createSemanticPluginSlice,
  subscribeToDuplicatesIndexingMessages,
  type SemanticPluginSlice,
} from "./slice";

/**
 * Semantic analysis plugin
 *
 * Provides LLM-powered code analysis including:
 * - Semantic rule: Analyzes code against project styleguide
 * - Duplicates detection: Finds semantically similar code
 */
export const semanticPlugin: Plugin<SemanticPluginSlice> = {
  // Plugin metadata
  id: "semantic",
  name: "Semantic Analysis",
  version: "1.0.0",
  description: "LLM-powered semantic code analysis",

  // Rule categories this plugin handles
  ruleCategories: ["semantic"],

  // Contributed commands
  commands: semanticCommands,

  // Inspector panels (none for now)
  inspectorPanels: [],

  // Per-rule UI contributions
  ruleContributions: [
    {
      ruleId: "semantic",
      // Custom inspector for semantic issues
      // inspectorPanel: SemanticIssueInspector,
      heatmapColor: "#8b5cf6", // Purple for semantic issues
    },
    {
      ruleId: "no-semantic-duplicates",
      // Custom inspector for duplicates
      // inspectorPanel: DuplicatesInspector,
      heatmapColor: "#f59e0b", // Amber for duplicates
    },
  ],

  /**
   * Create the plugin's state slice
   */
  createSlice: (services) => {
    // Create a simple state container
    let state = {
      duplicatesIndexStatus: "idle" as const,
      duplicatesIndexMessage: null as string | null,
      duplicatesIndexProgress: null as { current: number; total: number } | null,
      duplicatesIndexError: null as string | null,
      duplicatesIndexStats: null as {
        totalChunks: number;
        added: number;
        modified: number;
        deleted: number;
        duration: number;
      } | null,
    };

    const set = <T>(partial: Partial<T>) => {
      state = { ...state, ...partial };
      // In a real implementation, this would update the Zustand store
      services.setState(state);
    };

    const get = () => state;

    return createSemanticPluginSlice(set, get);
  },

  /**
   * Check if this plugin handles a specific rule
   */
  handlesRules: (ruleMeta) => {
    // Handle rules in the semantic category
    if (ruleMeta.category === "semantic") {
      return true;
    }
    // Handle specific rule IDs
    if (
      ruleMeta.id === "uilint/semantic" ||
      ruleMeta.id === "uilint/no-semantic-duplicates" ||
      ruleMeta.id === "semantic" ||
      ruleMeta.id === "no-semantic-duplicates"
    ) {
      return true;
    }
    return false;
  },

  /**
   * Initialize the plugin
   */
  initialize: (services) => {
    console.log("[SemanticPlugin] Initializing...");

    // Subscribe to duplicates:indexing:* messages
    const unsubscribeStart = services.websocket.on(
      "duplicates:indexing:start",
      () => {
        services.setState({
          duplicatesIndexStatus: "indexing",
          duplicatesIndexMessage: "Starting index...",
          duplicatesIndexProgress: null,
          duplicatesIndexError: null,
        });
        console.log("[SemanticPlugin] Duplicates indexing started");
      }
    );

    const unsubscribeProgress = services.websocket.on(
      "duplicates:indexing:progress",
      (data: unknown) => {
        const msg = data as {
          message: string;
          current?: number;
          total?: number;
        };
        services.setState({
          duplicatesIndexStatus: "indexing",
          duplicatesIndexMessage: msg.message,
          duplicatesIndexProgress:
            msg.current !== undefined && msg.total !== undefined
              ? { current: msg.current, total: msg.total }
              : null,
        });
      }
    );

    const unsubscribeComplete = services.websocket.on(
      "duplicates:indexing:complete",
      (data: unknown) => {
        const msg = data as {
          added: number;
          modified: number;
          deleted: number;
          totalChunks: number;
          duration: number;
        };
        services.setState({
          duplicatesIndexStatus: "ready",
          duplicatesIndexMessage: null,
          duplicatesIndexProgress: null,
          duplicatesIndexStats: {
            totalChunks: msg.totalChunks,
            added: msg.added,
            modified: msg.modified,
            deleted: msg.deleted,
            duration: msg.duration,
          },
        });
        console.log(
          `[SemanticPlugin] Duplicates index ready: ${msg.totalChunks} chunks ` +
            `(${msg.added} added, ${msg.modified} modified, ${msg.deleted} deleted) ` +
            `in ${msg.duration}ms`
        );
      }
    );

    const unsubscribeError = services.websocket.on(
      "duplicates:indexing:error",
      (data: unknown) => {
        const msg = data as { error: string };
        services.setState({
          duplicatesIndexStatus: "error",
          duplicatesIndexMessage: null,
          duplicatesIndexProgress: null,
          duplicatesIndexError: msg.error,
        });
        console.error("[SemanticPlugin] Duplicates indexing error:", msg.error);
      }
    );

    console.log("[SemanticPlugin] Initialized successfully");

    // Return cleanup function
    return () => {
      unsubscribeStart();
      unsubscribeProgress();
      unsubscribeComplete();
      unsubscribeError();
      console.log("[SemanticPlugin] Disposed");
    };
  },
};

export default semanticPlugin;

// Re-export types and utilities
export * from "./types";
export * from "./slice";
export * from "./commands";
