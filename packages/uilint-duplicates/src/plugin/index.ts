/**
 * Duplicates Plugin Definition
 *
 * Complete plugin export - NO REACT.
 * This is the main plugin definition that gets registered with pluginRegistry.
 */

import type { PluginWithHandlers, IssueContribution } from "uilint-core";
import { pluginRegistry } from "uilint-core";

import { cliManifest } from "../cli-manifest.js";
import { duplicatesStateDefinition, type DuplicatesState } from "./state.js";
import { duplicatesActionHandlers } from "./actions.js";
import { duplicatesCommands } from "./commands.js";
import { duplicatesPanelDefinitions } from "./panels.js";
import { duplicatesRuleDefinitions } from "./rules.js";
import { duplicatesMessageHandlers } from "./messages.js";

/**
 * Duplicates plugin definition
 *
 * Contains everything needed for duplicate detection EXCEPT React components.
 * The host (uilint-react) imports this and renders the appropriate UI.
 */
export const duplicatesPlugin: PluginWithHandlers<DuplicatesState> = {
  // === Metadata ===
  id: "duplicates",
  name: "Duplicate Detection",
  version: "1.0.0",
  description: "Embedding-based semantic code duplicate detection",
  icon: "copy",

  // === CLI (derived from cli-manifest — single source of truth) ===
  cli: cliManifest,

  // === State ===
  state: duplicatesStateDefinition,
  actions: duplicatesActionHandlers,

  // === UI Contributions (Declarative) ===
  commands: duplicatesCommands,
  panels: duplicatesPanelDefinitions,

  // === Rules ===
  rules: duplicatesRuleDefinitions,
  handlesRuleCategories: ["duplicates"],

  // === WebSocket ===
  messageHandlers: duplicatesMessageHandlers,

  // === Issue Aggregation ===
  // Duplicate issues are reported by the no-duplicates ESLint rule.
  // They don't come from plugin state, so we return empty.
  getIssues: (_state: DuplicatesState): IssueContribution => {
    return { pluginId: "duplicates", issues: new Map() };
  },

  // === Browser Actions ===
  browserActions: [],
};

// Auto-register with plugin registry on import
pluginRegistry.register(duplicatesPlugin);

// Export types for host apps
export type { DuplicatesState } from "./state.js";

export default duplicatesPlugin;
