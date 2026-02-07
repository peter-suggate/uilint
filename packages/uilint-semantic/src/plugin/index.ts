/**
 * Semantic Plugin Definition
 *
 * Complete plugin export - NO REACT.
 * This is the main plugin definition that gets registered with pluginRegistry.
 */

import type { PluginWithHandlers, IssueContribution } from "uilint-core";
import { pluginRegistry } from "uilint-core";

import { semanticStateDefinition, type SemanticState } from "./state.js";
import { semanticActionHandlers } from "./actions.js";
import { semanticCommands } from "./commands.js";
import { semanticPanelDefinitions } from "./panels.js";
import { semanticRuleDefinitions } from "./rules.js";
import { semanticMessageHandlers } from "./messages.js";

/**
 * Semantic plugin definition
 *
 * Contains everything needed for semantic analysis EXCEPT React components.
 * The host (uilint-react) imports this and renders the appropriate UI.
 */
export const semanticPlugin: PluginWithHandlers<SemanticState> = {
  // === Metadata ===
  id: "semantic",
  name: "Semantic Analysis",
  version: "1.0.0",
  description: "Semantic code analysis and duplicate detection",
  icon: "brain",

  // === State ===
  state: semanticStateDefinition,
  actions: semanticActionHandlers,

  // === UI Contributions (Declarative) ===
  commands: semanticCommands,
  panels: semanticPanelDefinitions,
  // No toolbar groups for semantic plugin

  // === Rules ===
  rules: semanticRuleDefinitions,
  handlesRuleCategories: ["semantic"],

  // === WebSocket ===
  messageHandlers: semanticMessageHandlers,

  // === Issue Aggregation ===
  // Note: Issues come from ESLint rule, not directly from plugin state
  // This is here for completeness but semantic issues flow through ESLint
  getIssues: (_state: SemanticState): IssueContribution => {
    // Semantic issues are reported by the no-semantic-duplicates ESLint rule
    // They don't come from plugin state, so we return empty
    return { pluginId: "semantic", issues: new Map() };
  },

  // === Browser Actions ===
  // Semantic plugin doesn't need browser actions
  browserActions: [],
};

// Auto-register with plugin registry on import
pluginRegistry.register(semanticPlugin);

// Export types for host apps
export type { SemanticState } from "./state.js";

export default semanticPlugin;
