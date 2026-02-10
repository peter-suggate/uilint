/**
 * Styleguide Plugin Definition
 *
 * Complete plugin export - NO REACT.
 * This is the main plugin definition that gets registered with pluginRegistry.
 */

import type { PluginWithHandlers, IssueContribution } from "uilint-core";
import { pluginRegistry } from "uilint-core";

import { cliManifest } from "../cli-manifest.js";
import { styleguideStateDefinition, type StyleguideState } from "./state.js";
import { styleguideActionHandlers } from "./actions.js";
import { styleguideCommands } from "./commands.js";
import { styleguidePanelDefinitions } from "./panels.js";
import { styleguideRuleDefinitions } from "./rules.js";
import { styleguideMessageHandlers } from "./messages.js";

/**
 * Styleguide plugin definition
 *
 * Contains everything needed for styleguide checking EXCEPT React components.
 * The host (uilint-react) imports this and renders the appropriate UI.
 */
export const styleguidePlugin: PluginWithHandlers<StyleguideState> = {
  // === Metadata ===
  id: "styleguide",
  name: "Styleguide Checking",
  version: "1.0.0",
  description: "LLM-powered styleguide enforcement",
  icon: "book",

  // === CLI (derived from cli-manifest — single source of truth) ===
  cli: cliManifest,

  // === State ===
  state: styleguideStateDefinition,
  actions: styleguideActionHandlers,

  // === UI Contributions (Declarative) ===
  commands: styleguideCommands,
  panels: styleguidePanelDefinitions,

  // === Rules ===
  rules: styleguideRuleDefinitions,
  handlesRuleCategories: ["styleguide"],

  // === WebSocket ===
  messageHandlers: styleguideMessageHandlers,

  // === Issue Aggregation ===
  // Styleguide issues are reported by the semantic ESLint rule.
  // They don't come from plugin state, so we return empty.
  getIssues: (_state: StyleguideState): IssueContribution => {
    return { pluginId: "styleguide", issues: new Map() };
  },

  // === Browser Actions ===
  browserActions: [],

  // === Lifecycle ===
  onLoad: (ctx) => {
    // Check styleguide + model availability on load if connected
    if (ctx.websocket.isConnected) {
      ctx.websocket.send({ type: "styleguide:check" });
    }
  },
};

// Auto-register with plugin registry on import
pluginRegistry.register(styleguidePlugin);

// Export types for host apps
export type { StyleguideState } from "./state.js";

export default styleguidePlugin;
