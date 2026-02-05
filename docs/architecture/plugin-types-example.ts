/**
 * Plugin Types - Would live in packages/uilint-core/src/plugin/types.ts
 *
 * These types define the contract between analysis packages and uilint-react.
 * Analysis packages (vision, semantic) import these types and export configurations.
 * uilint-react imports the configurations and renders them.
 */

// =============================================================================
// DATA BINDING
// =============================================================================

/**
 * Reference to a value in the panel's data context
 * Uses dot notation: "issue.sourceLocation.filePath"
 */
export interface DataBinding {
  binding: string;
}

/**
 * Reference to a computed expression
 */
export interface ExpressionBinding {
  expression: string;
}

/**
 * Dynamic value that can be a static value or a binding
 */
export type DynamicValue<T> = T | DataBinding;

/**
 * Conditional value based on a binding
 */
export interface ConditionalValue<T> {
  condition: DataBinding;
  true: T;
  false: T;
}

// =============================================================================
// ICONS
// =============================================================================

/**
 * Icon identifiers - uilint-react maps these to actual icon components
 */
export type IconName =
  // UI
  | "target"
  | "link"
  | "external-link"
  | "chevron-right"
  | "chevron-down"
  | "x"
  | "check"
  | "alert-triangle"
  | "info"
  | "help-circle"
  // Analysis
  | "eye"
  | "camera"
  | "crop"
  | "scan"
  | "search"
  | "filter"
  | "brain"
  // Code
  | "code"
  | "file"
  | "folder"
  | "git-branch"
  | "copy"
  | "clipboard"
  // Actions
  | "play"
  | "pause"
  | "refresh"
  | "trash"
  | "edit"
  | "settings"
  // Status
  | "loading"
  | "error"
  | "success"
  | "warning";

// =============================================================================
// ACTIONS
// =============================================================================

/**
 * Reference to an action handler defined by the plugin
 */
export interface ActionReference {
  /** Action type - resolved by plugin's action handlers */
  type: string;
  /** Static payload */
  payload?: Record<string, unknown>;
  /** Dynamic payload from data bindings */
  payloadBindings?: Record<string, string>;
}

// =============================================================================
// PANEL SECTIONS
// =============================================================================

/**
 * Header section with optional icon
 */
export interface HeaderSection {
  type: "header";
  icon?: IconName;
  text: DynamicValue<string>;
  subtitle?: DynamicValue<string>;
  sticky?: boolean;
}

/**
 * Code viewer with syntax highlighting
 */
export interface CodeViewerSection {
  type: "code-viewer";
  label?: string;
  icon?: IconName;
  code: DataBinding | { fetch: FetchConfig };
  location?: DataBinding;
  startLine?: DynamicValue<number>;
  highlightLines?: DataBinding;
  diffHighlighting?: boolean;
  maxHeight?: number;
  onNavigate?: ActionReference;
}

/**
 * Side-by-side or stacked code comparison
 */
export interface CodeComparisonSection {
  type: "code-comparison";
  mode: "stacked" | "side-by-side";
  source: CodePanelConfig;
  target: CodePanelConfig;
  computeDiff?: boolean;
  maxHeight?: number;
}

interface CodePanelConfig {
  label: string;
  icon?: IconName;
  code: DataBinding | { fetch: FetchConfig };
  location?: DataBinding;
}

/**
 * Fetch configuration for dynamic data loading
 */
export interface FetchConfig {
  type: "source-code" | "file-content";
  params: {
    filePath?: DataBinding;
    line?: DataBinding;
    contextAbove?: number;
    contextBelow?: number;
  };
}

/**
 * Badge/pill display
 */
export interface BadgeSection {
  type: "badge";
  variant: "similarity" | "severity" | "status" | "category";
  value: DataBinding;
  label?: string;
  centered?: boolean;
}

/**
 * Plain text
 */
export interface TextSection {
  type: "text";
  content: DynamicValue<string>;
  variant?: "body" | "caption" | "muted" | "error";
}

/**
 * Action buttons
 */
export interface ActionsSection {
  type: "actions";
  direction?: "row" | "column";
  actions: ActionButton[];
}

export interface ActionButton {
  id: string;
  label: DynamicValue<string> | ConditionalValue<string>;
  icon?: IconName;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  action: ActionReference;
  disabled?: DataBinding;
  visible?: DataBinding;
}

/**
 * Visual divider
 */
export interface DividerSection {
  type: "divider";
  spacing?: "small" | "medium" | "large";
}

/**
 * Conditional rendering
 */
export interface ConditionalSection {
  type: "conditional";
  condition: DataBinding | ExpressionBinding;
  then: PanelSection[];
  else?: PanelSection[];
}

/**
 * List of items
 */
export interface ListSection {
  type: "list";
  items: DataBinding;
  itemLayout: PanelSection[];
  emptyMessage?: string;
}

/**
 * Image display
 */
export interface ImageSection {
  type: "image";
  src: DataBinding;
  alt?: string;
  maxHeight?: number;
  highlightRegion?: DataBinding;
}

/**
 * Card display (for list items)
 */
export interface CardSection {
  type: "card";
  thumbnail?: DataBinding;
  title: DynamicValue<string>;
  subtitle?: DynamicValue<string>;
  badge?: {
    variant: "severity" | "status";
    value: DataBinding;
    label?: string;
  };
  onClick?: ActionReference;
}

/**
 * Union of all section types
 */
export type PanelSection =
  | HeaderSection
  | CodeViewerSection
  | CodeComparisonSection
  | BadgeSection
  | TextSection
  | ActionsSection
  | DividerSection
  | ConditionalSection
  | ListSection
  | ImageSection
  | CardSection;

// =============================================================================
// PANEL DEFINITION
// =============================================================================

export interface LoadingConfig {
  when: DataBinding;
  message?: string;
  submessage?: string;
}

export interface EmptyConfig {
  when: DataBinding | ExpressionBinding;
  message: string;
  submessage?: string;
  icon?: IconName;
}

/**
 * Complete panel definition
 */
export interface PanelDefinition {
  id: string;
  title: DynamicValue<string>;
  priority?: number;
  layout: PanelSection[];
  loading?: LoadingConfig;
  empty?: EmptyConfig;
}

// =============================================================================
// COMMANDS
// =============================================================================

export interface CommandDefinition {
  id: string;
  title: string;
  keywords: string[];
  category: string;
  subtitle?: string;
  icon?: IconName;
  shortcut?: string;
  action: ActionReference;
  isAvailable?: DataBinding | ExpressionBinding;
  hideFromAllCategory?: boolean;
}

// =============================================================================
// TOOLBAR
// =============================================================================

export interface ToolbarActionDefinition {
  id: string;
  icon: IconName;
  tooltip: string;
  action: ActionReference;
  isVisible?: DataBinding | ExpressionBinding;
  isEnabled?: DataBinding | ExpressionBinding;
}

export interface ToolbarGroupDefinition {
  id: string;
  icon: IconName;
  tooltip: string;
  priority?: number;
  isVisible?: DataBinding | ExpressionBinding;
  actions: ToolbarActionDefinition[];
}

// =============================================================================
// RULES
// =============================================================================

export interface RuleDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: IconName;
  defaultSeverity: "error" | "warn" | "off";
  defaultEnabled: boolean;
  heatmapColor?: string;
  customInspectorPanel?: string;
  requirements?: Array<{
    type: "ollama" | "styleguide" | "semantic-index";
    description: string;
    setupHint: string;
  }>;
  defaultOptions?: Record<string, unknown>[];
  optionSchema?: RuleOptionSchema;
  docs?: string;
}

export interface RuleOptionSchema {
  fields: Array<{
    key: string;
    label: string;
    type: "text" | "number" | "boolean" | "select";
    defaultValue?: unknown;
    options?: Array<{ value: string; label: string }>;
    description?: string;
  }>;
}

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

/**
 * Plugin context provided to action handlers
 * This is the "services" object - framework agnostic
 */
export interface PluginContext<TState> {
  /** Get current plugin state */
  getState(): TState;

  /** Update plugin state (partial) */
  setState(partial: Partial<TState>): void;

  /** Dispatch an action by type */
  dispatch(actionType: string, payload?: unknown): void | Promise<void>;

  /** WebSocket access */
  websocket: {
    send(message: unknown): void;
    isConnected: boolean;
  };

  /** Get current route/path */
  getCurrentRoute(): string;

  /** Request browser-side action (capture, etc.) */
  requestBrowserAction(
    type: string,
    payload?: unknown
  ): Promise<{ success: boolean; error?: string; [key: string]: unknown }>;

  /** Open file in editor */
  openInEditor(dataLoc: string): void;

  /** Set heatmap filter */
  setHeatmapFilter(dataLocs: string[], label?: string): void;

  /** Clear heatmap filter */
  clearHeatmapFilter(): void;

  /** Open inspector panel */
  openInspector(panelId: string, data?: Record<string, unknown>): void;
}

/**
 * Action handler function signature
 */
export type ActionHandler<TState, TPayload = unknown> = (
  ctx: PluginContext<TState>,
  payload: TPayload
) => void | Promise<void>;

/**
 * Map of action type to handler
 */
export type ActionHandlers<TState> = Record<string, ActionHandler<TState, unknown>>;

/**
 * Message handler for WebSocket messages
 */
export type MessageHandler<TState> = (
  ctx: PluginContext<TState>,
  message: unknown
) => void;

/**
 * Map of message type to handler
 */
export type MessageHandlers<TState> = Record<string, MessageHandler<TState>>;

/**
 * State definition with initial state and computed values
 */
export interface StateDefinition<TState> {
  initialState: TState;
  computed?: Record<string, (state: TState) => unknown>;
  persist?: {
    key: string;
    include?: (keyof TState)[];
    exclude?: (keyof TState)[];
  };
}

// =============================================================================
// ISSUE AGGREGATION
// =============================================================================

export interface PluginIssue {
  id: string;
  message: string;
  severity: "error" | "warning" | "info";
  ruleId: string;
  category?: string;
  data?: Record<string, unknown>;
}

export interface IssueContribution {
  pluginId: string;
  issues: Map<string, PluginIssue[]>;
}

export type IssueAggregator<TState> = (state: TState) => IssueContribution;

// =============================================================================
// COMPLETE PLUGIN DEFINITION
// =============================================================================

/**
 * Complete plugin definition - NO REACT
 *
 * This is what analysis packages export.
 * uilint-react imports this and wires everything up.
 */
export interface PluginDefinition<TState> {
  // === Metadata ===
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: IconName;
  dependencies?: string[];

  // === State ===
  state: StateDefinition<TState>;
  actions: ActionHandlers<TState>;

  // === UI (Declarative) ===
  commands?: CommandDefinition[];
  toolbarGroups?: ToolbarGroupDefinition[];
  panels?: PanelDefinition[];

  // === Rules ===
  rules?: RuleDefinition[];
  handlesRuleCategories?: string[];

  // === WebSocket ===
  messageHandlers?: MessageHandlers<TState>;

  // === Issues ===
  getIssues?: IssueAggregator<TState>;

  // === Browser Actions ===
  /** Browser-side actions this plugin needs (registered by uilint-react) */
  browserActions?: string[];

  // === Lifecycle ===
  /** Called on plugin load (can return cleanup function) */
  onLoad?: (ctx: PluginContext<TState>) => void | (() => void);
  /** Called on plugin unload */
  onUnload?: (ctx: PluginContext<TState>) => void;
}

// =============================================================================
// EXAMPLE: Vision Plugin Definition (what uilint-vision would export)
// =============================================================================

/*
// packages/uilint-vision/src/plugin/index.ts

import type { PluginDefinition } from "uilint-core/plugin";

interface VisionState {
  visionAvailable: boolean;
  visionAnalyzing: boolean;
  screenshotHistory: Map<string, ScreenshotCapture>;
  visionIssuesCache: Map<string, VisionIssue[]>;
  // ... etc
}

export const visionPlugin: PluginDefinition<VisionState> = {
  id: "vision",
  name: "Vision Analysis",
  version: "1.0.0",
  icon: "eye",

  state: {
    initialState: { ... },
    computed: { ... },
    persist: { key: "uilint-vision", include: ["autoScanSettings"] },
  },

  actions: {
    "capture-full-page": async (ctx) => { ... },
    "enter-region-selection": (ctx) => { ... },
    // ...
  },

  commands: [ ... ],
  toolbarGroups: [ ... ],
  panels: [ ... ],
  rules: [ ... ],
  messageHandlers: { ... },
  getIssues: (state) => { ... },
  browserActions: ["capture-screenshot", "collect-manifest"],
};
*/
