/**
 * Vision Plugin Definition
 *
 * Complete plugin export - NO REACT.
 * This is the main plugin definition that gets registered with pluginRegistry.
 */

import type { PluginWithHandlers, PluginIssue, IssueContribution } from "uilint-core";
import { pluginRegistry } from "uilint-core";

import { visionStateDefinition, type VisionState } from "./state.js";
import { visionActionHandlers } from "./actions.js";
import { visionCommands } from "./commands.js";
import { visionToolbarGroups } from "./toolbar.js";
import { visionPanelDefinitions } from "./panels.js";
import { visionRuleDefinitions } from "./rules.js";
import { visionMessageHandlers } from "./messages.js";

/**
 * Vision plugin definition
 *
 * Contains everything needed for the vision feature EXCEPT React components.
 * The host (uilint-react) imports this and renders the appropriate UI.
 */
export const visionPlugin: PluginWithHandlers<VisionState> = {
  // === Metadata ===
  id: "vision",
  name: "Vision Analysis",
  version: "1.0.0",
  description: "AI-powered visual UI consistency checking",
  icon: "eye",

  // === State ===
  state: visionStateDefinition,
  actions: visionActionHandlers,

  // === UI Contributions (Declarative) ===
  commands: visionCommands,
  toolbarGroups: visionToolbarGroups,
  panels: visionPanelDefinitions,

  // === Rules ===
  rules: visionRuleDefinitions,
  handlesRuleCategories: ["vision"],

  // === WebSocket ===
  messageHandlers: visionMessageHandlers,

  // === Issue Aggregation ===
  getIssues: (state: VisionState): IssueContribution => {
    const issues = new Map<string, PluginIssue[]>();

    for (const [route, visionIssues] of state.visionIssuesCache) {
      for (const issue of visionIssues) {
        if (issue.dataLoc) {
          const existing = issues.get(issue.dataLoc) || [];
          issues.set(issue.dataLoc, [
            ...existing,
            {
              id: `vision:${route}:${issue.elementText}:${Date.now()}`,
              message: issue.message,
              severity: issue.severity,
              ruleId: "semantic-vision",
              category: issue.category,
              data: {
                route,
                elementText: issue.elementText,
                suggestion: issue.suggestion,
              },
            },
          ]);
        }
      }
    }

    return { pluginId: "vision", issues };
  },

  // === Browser Actions ===
  browserActions: ["capture-screenshot", "collect-manifest"],

  // === Lifecycle ===
  onLoad: (ctx) => {
    // Check vision availability on load if connected
    if (ctx.websocket.isConnected) {
      ctx.websocket.send({ type: "vision:check" });
    }
  },
};

// Auto-register with plugin registry on import
pluginRegistry.register(visionPlugin);

export default visionPlugin;
