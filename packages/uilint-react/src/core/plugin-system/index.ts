/**
 * Plugin System - Core infrastructure for UILint plugin architecture
 */

// Types
export type {
  Plugin,
  PluginServices,
  Command,
  Analyzer,
  InspectorPanel,
  InspectorPanelProps,
  RuleUIContribution,
  RuleDetailProps,
  IssueInlineProps,
  FixSuggestion,
} from "./types";

// Registry
export {
  PluginRegistry,
  pluginRegistry,
  createPluginRegistry,
  sortByDependencies,
} from "./registry";

// Loader
export {
  loadPlugins,
  loadPlugin,
  getPluginManifest,
  BUILT_IN_PLUGINS,
  type PluginManifest,
} from "./loader";
