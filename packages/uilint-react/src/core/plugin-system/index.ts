/**
 * Plugin System - Core infrastructure for UILint plugin architecture
 */

// Types
// Note: WebSocketService, DOMObserverService, and ScannedElementInfo are
// exported from ../services - don't re-export here to avoid ambiguity
export type {
  Plugin,
  PluginServices,
  Command,
  Analyzer,
  InspectorPanel,
  InspectorPanelProps,
  RuleUIContribution,
  PluginIssue,
  IssueContribution,
  IssueSeverity,
  RuleMeta,
  PluginMeta,
  ToolbarAction,
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
