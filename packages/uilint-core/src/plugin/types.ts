/**
 * Plugin System Types
 *
 * These types define the contract between plugin packages and the host
 * (uilint-react, uilint CLI). Plugin packages export PluginDefinitions,
 * hosts interpret and render them.
 *
 * NO REACT CODE - This is pure TypeScript.
 */

// =============================================================================
// DATA BINDING
// =============================================================================

/**
 * Reference to a value in the panel's data context.
 * Uses dot notation: "issue.sourceLocation.filePath"
 */
export interface DataBinding {
  binding: string;
}

/**
 * Reference to a computed expression.
 * Evaluated at runtime: "screenshots.length === 0"
 */
export interface ExpressionBinding {
  expression: string;
}

/**
 * Type guard for DataBinding
 */
export function isDataBinding(value: unknown): value is DataBinding {
  return (
    typeof value === "object" &&
    value !== null &&
    "binding" in value &&
    typeof (value as DataBinding).binding === "string"
  );
}

/**
 * Type guard for ExpressionBinding
 */
export function isExpressionBinding(value: unknown): value is ExpressionBinding {
  return (
    typeof value === "object" &&
    value !== null &&
    "expression" in value &&
    typeof (value as ExpressionBinding).expression === "string"
  );
}

/**
 * Dynamic value that can be a static value or a binding.
 */
export type DynamicValue<T> = T | DataBinding;

/**
 * Conditional value based on a binding.
 */
export interface ConditionalValue<T> {
  condition: DataBinding;
  true: T;
  false: T;
}

/**
 * Type guard for ConditionalValue
 */
export function isConditionalValue<T>(value: unknown): value is ConditionalValue<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "condition" in value &&
    "true" in value &&
    "false" in value
  );
}

// =============================================================================
// ICONS
// =============================================================================

/**
 * Icon identifiers - the host maps these to actual icon components.
 * Any lucide-react icon name is accepted; the listed names provide autocompletion.
 */
export type IconName =
  // UI Navigation
  | "target"
  | "link"
  | "external-link"
  | "chevron-right"
  | "chevron-down"
  | "chevron-up"
  | "x"
  | "check"
  | "alert-triangle"
  | "alert-circle"
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
  | "sparkles"
  // Code
  | "code"
  | "file"
  | "file-code"
  | "folder"
  | "git-branch"
  | "copy"
  | "clipboard"
  // Content
  | "book"
  | "book-open"
  | "bookmark"
  // Actions
  | "play"
  | "pause"
  | "refresh"
  | "trash"
  | "edit"
  | "settings"
  | "plus"
  | "minus"
  // Status
  | "loader"
  | "check-circle"
  | "x-circle"
  | "clock"
  // Allow any string for forward compatibility with lucide-react icons
  | (string & {});

// =============================================================================
// ACTIONS
// =============================================================================

/**
 * Reference to an action handler defined by the plugin.
 */
export interface ActionReference {
  /** Action type - resolved by plugin's action handlers */
  type: string;
  /** Static payload to pass to the handler */
  payload?: Record<string, unknown>;
  /** Dynamic payload from data bindings (binding path -> payload key) */
  payloadBindings?: Record<string, string>;
}

// =============================================================================
// FETCH CONFIGURATION
// =============================================================================

/**
 * Configuration for fetching dynamic data.
 */
export interface FetchConfig {
  /** Type of fetch operation */
  type: "source-code" | "file-content";
  /** Parameters for the fetch */
  params: {
    /** File path (can be a binding) */
    filePath?: DataBinding;
    /** Line number to center on */
    line?: DataBinding;
    /** Lines of context above the target */
    contextAbove?: number;
    /** Lines of context below the target */
    contextBelow?: number;
  };
}

// =============================================================================
// PANEL SECTIONS
// =============================================================================

/**
 * Header section with optional icon.
 */
export interface HeaderSection {
  type: "header";
  /** Icon to display */
  icon?: IconName;
  /** Header text (static or bound) */
  text: DynamicValue<string>;
  /** Subtitle text */
  subtitle?: DynamicValue<string>;
  /** Whether header sticks to top when scrolling */
  sticky?: boolean;
}

/**
 * Code viewer with syntax highlighting.
 */
export interface CodeViewerSection {
  type: "code-viewer";
  /** Section label */
  label?: string;
  /** Icon for the section header */
  icon?: IconName;
  /** Code content (binding or fetch config) */
  code: DataBinding | { fetch: FetchConfig };
  /** Location information for navigation */
  location?: DataBinding;
  /** Starting line number */
  startLine?: DynamicValue<number>;
  /** Lines to highlight (array of line numbers) */
  highlightLines?: DataBinding;
  /** Enable diff-style highlighting */
  diffHighlighting?: boolean;
  /** Max height before scrolling (px) */
  maxHeight?: number;
  /** Action to execute on code navigation */
  onNavigate?: ActionReference;
}

/**
 * Configuration for one side of a code comparison.
 */
export interface CodePanelConfig {
  /** Panel label */
  label: string;
  /** Icon for the panel */
  icon?: IconName;
  /** Code content */
  code: DataBinding | { fetch: FetchConfig };
  /** Location information */
  location?: DataBinding;
}

/**
 * Side-by-side or stacked code comparison.
 */
export interface CodeComparisonSection {
  type: "code-comparison";
  /** Layout mode */
  mode: "stacked" | "side-by-side";
  /** Source code panel (left/top) */
  source: CodePanelConfig;
  /** Target code panel (right/bottom) */
  target: CodePanelConfig;
  /** Whether to compute and show diff highlighting */
  computeDiff?: boolean;
  /** Max height for each panel (px) */
  maxHeight?: number;
}

/**
 * Badge/pill display for status, severity, etc.
 */
export interface BadgeSection {
  type: "badge";
  /** Badge variant determines styling. Plugins can define custom variants. */
  variant: string;
  /** Value to display */
  value: DataBinding;
  /** Optional label before value */
  label?: string;
  /** Center the badge horizontally */
  centered?: boolean;
}

/**
 * Plain text content.
 */
export interface TextSection {
  type: "text";
  /** Text content */
  content: DynamicValue<string>;
  /** Text variant for styling */
  variant?: "body" | "caption" | "muted" | "error" | "success";
}

/**
 * Action button configuration.
 */
export interface ActionButton {
  /** Unique button ID */
  id: string;
  /** Button label (static, bound, or conditional) */
  label: DynamicValue<string> | ConditionalValue<string>;
  /** Button icon */
  icon?: IconName;
  /** Button variant for styling */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** Action to execute on click */
  action: ActionReference;
  /** Disabled state (binding to boolean) */
  disabled?: DataBinding;
  /** Visibility (binding to boolean) */
  visible?: DataBinding;
}

/**
 * Action buttons section.
 */
export interface ActionsSection {
  type: "actions";
  /** Layout direction */
  direction?: "row" | "column";
  /** Buttons to render */
  actions: ActionButton[];
}

/**
 * Visual divider.
 */
export interface DividerSection {
  type: "divider";
  /** Spacing around divider */
  spacing?: "small" | "medium" | "large";
}

/**
 * Conditional rendering section.
 */
export interface ConditionalSection {
  type: "conditional";
  /** Condition to evaluate */
  condition: DataBinding | ExpressionBinding;
  /** Sections to render when condition is true */
  then: PanelSection[];
  /** Sections to render when condition is false */
  else?: PanelSection[];
}

/**
 * List section for rendering arrays of items.
 */
export interface ListSection {
  type: "list";
  /** Binding to array of items */
  items: DataBinding;
  /** Layout for each item (uses "item" prefix for bindings) */
  itemLayout: PanelSection[];
  /** Message when list is empty */
  emptyMessage?: string;
}

/**
 * Image display section.
 */
export interface ImageSection {
  type: "image";
  /** Image source (data URL or URL) */
  src: DataBinding;
  /** Alt text for accessibility */
  alt?: string;
  /** Max height (px) */
  maxHeight?: number;
  /** Region to highlight on the image */
  highlightRegion?: DataBinding;
}

/**
 * Card display for list items.
 */
export interface CardSection {
  type: "card";
  /** Thumbnail image source */
  thumbnail?: DataBinding;
  /** Card title */
  title: DynamicValue<string>;
  /** Card subtitle */
  subtitle?: DynamicValue<string>;
  /** Badge to display on card */
  badge?: {
    variant: "severity" | "status" | "count";
    value: DataBinding;
    label?: string;
  };
  /** Action on card click */
  onClick?: ActionReference;
}

/**
 * Progress indicator section.
 */
export interface ProgressSection {
  type: "progress";
  /** Current value (0-100 or binding) */
  value: DynamicValue<number>;
  /** Label to show */
  label?: DynamicValue<string>;
  /** Whether progress is indeterminate */
  indeterminate?: boolean;
}

/**
 * Union of all section types.
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
  | CardSection
  | ProgressSection;

// =============================================================================
// PANEL DEFINITION
// =============================================================================

/**
 * Loading state configuration.
 */
export interface LoadingConfig {
  /** Condition that indicates loading */
  when: DataBinding;
  /** Message to show while loading */
  message?: string;
  /** Sub-message for additional context */
  submessage?: string;
}

/**
 * Empty state configuration.
 */
export interface EmptyConfig {
  /** Condition that indicates empty state */
  when: DataBinding | ExpressionBinding;
  /** Message to show */
  message: string;
  /** Sub-message for additional context */
  submessage?: string;
  /** Icon to display */
  icon?: IconName;
}

/**
 * Complete panel definition.
 */
export interface PanelDefinition {
  /** Unique panel ID */
  id: string;
  /** Panel title (static or bound) */
  title: DynamicValue<string>;
  /** Priority for ordering (higher = earlier) */
  priority?: number;
  /** Panel layout - array of sections */
  layout: PanelSection[];
  /** Loading state configuration */
  loading?: LoadingConfig;
  /** Empty state configuration */
  empty?: EmptyConfig;
}

// =============================================================================
// COMMANDS
// =============================================================================

/**
 * Command palette command definition.
 */
export interface CommandDefinition {
  /** Unique command ID (convention: "pluginId:action-name") */
  id: string;
  /** Command title shown in palette */
  title: string;
  /** Keywords for search */
  keywords: string[];
  /** Category for grouping */
  category: string;
  /** Subtitle/description */
  subtitle?: string;
  /** Icon to display */
  icon?: IconName;
  /** Keyboard shortcut (e.g., "Cmd+Shift+C") */
  shortcut?: string;
  /** Action to execute */
  action: ActionReference;
  /** Availability condition */
  isAvailable?: DataBinding | ExpressionBinding;
  /** Hide from "All" category (only show in plugin's category) */
  hideFromAllCategory?: boolean;
}

// =============================================================================
// TOOLBAR
// =============================================================================

/**
 * Single toolbar action.
 */
export interface ToolbarActionDefinition {
  /** Unique action ID */
  id: string;
  /** Icon to display */
  icon: IconName;
  /** Tooltip text */
  tooltip: string;
  /** Action to execute */
  action: ActionReference;
  /** Visibility condition */
  isVisible?: DataBinding | ExpressionBinding;
  /** Enabled condition */
  isEnabled?: DataBinding | ExpressionBinding;
}

/**
 * Toolbar action group (dropdown).
 */
export interface ToolbarGroupDefinition {
  /** Unique group ID */
  id: string;
  /** Icon for the group button */
  icon: IconName;
  /** Tooltip for the group */
  tooltip: string;
  /** Priority for ordering (higher = earlier) */
  priority?: number;
  /** Group visibility condition */
  isVisible?: DataBinding | ExpressionBinding;
  /** Actions in this group */
  actions: ToolbarActionDefinition[];
}

// =============================================================================
// RULES
// =============================================================================

/**
 * Rule option field schema for UI generation.
 */
export interface RuleOptionField {
  /** Option key */
  key: string;
  /** Display label */
  label: string;
  /** Field type */
  type: "text" | "number" | "boolean" | "select";
  /** Default value */
  defaultValue?: unknown;
  /** Options for select type */
  options?: Array<{ value: string; label: string }>;
  /** Field description */
  description?: string;
  /** Placeholder text */
  placeholder?: string;
}

/**
 * Rule option schema for generating settings UI.
 */
export interface RuleOptionSchema {
  fields: RuleOptionField[];
}

/**
 * Requirement for a rule to function.
 */
export interface RuleRequirement {
  /** Type of requirement. Plugins define their own requirement types. */
  type: string;
  /** Human-readable description */
  description: string;
  /** Hint for how to set up */
  setupHint: string;
}

/**
 * ESLint rule definition with UI metadata.
 */
export interface RuleDefinition {
  /** Rule ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description */
  description: string;
  /** Category for grouping */
  category: string;
  /** Icon */
  icon?: IconName;
  /** Default severity */
  defaultSeverity: "error" | "warn" | "off";
  /** Whether enabled by default */
  defaultEnabled: boolean;
  /** Heatmap color for this rule's issues */
  heatmapColor?: string;
  /** Custom inspector panel ID to open for this rule's issues */
  customInspectorPanel?: string;
  /** Requirements for the rule to work */
  requirements?: RuleRequirement[];
  /** Default options */
  defaultOptions?: Record<string, unknown>[];
  /** Option schema for settings UI */
  optionSchema?: RuleOptionSchema;
  /** Documentation (markdown) */
  docs?: string;
}

// =============================================================================
// ISSUE AGGREGATION
// =============================================================================

/**
 * Issue contributed by a plugin.
 */
export interface PluginIssue {
  /** Unique issue ID */
  id: string;
  /** Issue message */
  message: string;
  /** Severity level */
  severity: "error" | "warning" | "info";
  /** Associated rule ID */
  ruleId: string;
  /** Issue category */
  category?: string;
  /** Additional data for inspector */
  data?: Record<string, unknown>;
}

/**
 * Issue contribution from a plugin.
 */
export interface IssueContribution {
  /** Plugin that contributed these issues */
  pluginId: string;
  /** Issues keyed by dataLoc */
  issues: Map<string, PluginIssue[]>;
}

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

/**
 * Computed value definition.
 */
export type ComputedValue<TState, TResult> = (state: TState) => TResult;

/**
 * Persistence configuration for plugin state.
 */
export interface PersistConfig<TState> {
  /** Storage key */
  key: string;
  /** Keys to include (if specified, only these are persisted) */
  include?: (keyof TState)[];
  /** Keys to exclude from persistence */
  exclude?: (keyof TState)[];
}

/**
 * State definition for a plugin.
 */
export interface StateDefinition<TState> {
  /** Initial state */
  initialState: TState;
  /** Computed values derived from state */
  computed?: Record<string, ComputedValue<TState, unknown>>;
  /** Persistence configuration */
  persist?: PersistConfig<TState>;
}

// =============================================================================
// PLUGIN DEFINITION
// =============================================================================

/**
 * Complete plugin definition.
 *
 * This is what analysis packages export. The host (uilint-react, CLI)
 * imports these and wires everything up.
 *
 * NO REACT - Pure TypeScript configuration.
 */
export interface PluginDefinition<TState = unknown> {
  // === Metadata ===
  /** Unique plugin ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semantic version */
  version: string;
  /** Description */
  description?: string;
  /** Icon */
  icon?: IconName;
  /** Plugin IDs this depends on */
  dependencies?: string[];

  // === State ===
  /** State definition */
  state: StateDefinition<TState>;

  // === UI Contributions (Declarative) ===
  /** Command palette commands */
  commands?: CommandDefinition[];
  /** Toolbar action groups */
  toolbarGroups?: ToolbarGroupDefinition[];
  /** Inspector panels */
  panels?: PanelDefinition[];

  // === Rules ===
  /** Rule definitions */
  rules?: RuleDefinition[];
  /** Rule categories this plugin handles */
  handlesRuleCategories?: string[];

  // === Browser Actions ===
  /** Browser-side actions this plugin needs. Plugins register handlers for these. */
  browserActions?: string[];
}
