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
  CategoryProvider,
  CategoryItem,
  CategoryLoadingState,
  CategoryPriority,
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

// Category Registry
export {
  CategoryRegistry,
  categoryRegistry,
  createCategoryRegistry,
  type CategoryNode,
  type CategoryRegistryOptions,
} from "./category-registry";
