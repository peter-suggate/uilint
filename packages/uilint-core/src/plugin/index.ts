/**
 * Plugin System
 *
 * Public API for the UILint plugin system.
 *
 * Plugins import from here:
 * ```typescript
 * import { pluginRegistry, type PluginWithHandlers } from "uilint-core/plugin";
 * ```
 */

// === Registry ===
export {
  PluginRegistry,
  PluginRegistrationError,
  pluginRegistry,
  type PluginRegistryEvent,
  type PluginRegistryListener,
} from "./registry.js";

// === Context & Handlers ===
export type {
  PluginContext,
  WebSocketService,
  BrowserActionResult,
  ActionHandler,
  ActionHandlers,
  MessageHandler,
  MessageHandlers,
  IssueAggregator,
  InitializeHook,
  DisposeHook,
  PluginWithHandlers,
} from "./context.js";

// === Types ===
export type {
  // Data binding
  DataBinding,
  ExpressionBinding,
  DynamicValue,
  ConditionalValue,
  // Icons
  IconName,
  // Actions
  ActionReference,
  // Fetch
  FetchConfig,
  // Panel sections
  HeaderSection,
  CodeViewerSection,
  CodePanelConfig,
  CodeComparisonSection,
  BadgeSection,
  TextSection,
  ActionButton,
  ActionsSection,
  DividerSection,
  ConditionalSection,
  ListSection,
  ImageSection,
  CardSection,
  ProgressSection,
  PanelSection,
  // Panel definition
  LoadingConfig,
  EmptyConfig,
  PanelDefinition,
  // Commands
  CommandDefinition,
  // Toolbar
  ToolbarActionDefinition,
  ToolbarGroupDefinition,
  // Rules
  RuleOptionField,
  RuleOptionSchema,
  RuleRequirement,
  RuleDefinition,
  // Issues
  PluginIssue,
  IssueContribution,
  // State
  ComputedValue,
  PersistConfig,
  StateDefinition,
  // Plugin definition
  PluginDefinition,
} from "./types.js";

// === Type guards ===
export {
  isDataBinding,
  isExpressionBinding,
  isConditionalValue,
} from "./types.js";

// === Operation Lifecycle ===
export {
  createOperationInitialState,
  createOperationComputed,
  createOperationActions,
  createOperationMessageHandlers,
} from "./operation.js";

export type {
  OperationStatus,
  OperationProgress,
  OperationState,
  OperationActionConfig,
  OperationMessageConfig,
} from "./operation.js";
