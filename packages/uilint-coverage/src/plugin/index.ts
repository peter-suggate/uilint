/**
 * Coverage Plugin Definition
 *
 * Complete plugin export - NO REACT.
 */

import type { PluginWithHandlers, IssueContribution } from "uilint-core";
import { pluginRegistry } from "uilint-core";

import { coverageStateDefinition, type CoverageState } from "./state.js";
import { coverageActionHandlers } from "./actions.js";
import { coverageCommands } from "./commands.js";
import { coveragePanelDefinitions } from "./panels.js";
import { coverageRuleDefinitions } from "./rules.js";
import { coverageMessageHandlers } from "./messages.js";

export const coveragePlugin: PluginWithHandlers<CoverageState> = {
  id: "coverage",
  name: "Test Coverage",
  version: "1.0.0",
  description: "Test coverage analysis and threshold enforcement",
  icon: "test-tube",

  state: coverageStateDefinition,
  actions: coverageActionHandlers,

  commands: coverageCommands,
  panels: coveragePanelDefinitions,

  rules: coverageRuleDefinitions,
  handlesRuleCategories: ["coverage"],

  messageHandlers: coverageMessageHandlers,

  getIssues: (_state: CoverageState): IssueContribution => {
    return { pluginId: "coverage", issues: new Map() };
  },

  browserActions: [],
};

// Auto-register with plugin registry on import
pluginRegistry.register(coveragePlugin);

export type { CoverageState } from "./state.js";

export default coveragePlugin;
