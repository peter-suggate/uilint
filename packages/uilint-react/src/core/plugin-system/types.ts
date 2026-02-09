/**
 * Plugin System Types
 *
 * Core TypeScript interfaces for the UILint plugin architecture.
 * Plugins can contribute commands, inspector panels, analyzers, and custom rule UI.
 */

import type { ComponentType, ReactElement, ReactNode } from "react";

// ============================================================================
// Plugin Metadata
// ============================================================================

/**
 * Metadata describing a plugin
 */
export interface PluginMeta {
  /** Unique plugin identifier (e.g., "uilint-eslint", "uilint-vision") */
  id: string;
  /** Human-readable plugin name */
  name: string;
  /** Semantic version string */
  version: string;
  /** Short description of the plugin's purpose */
  description: string;
  /** Optional icon (React component or emoji string) */
  icon?: ReactNode;
  /** Plugin IDs this plugin depends on */
  dependencies?: string[];
}

// ============================================================================
// Plugin Services
// ============================================================================

/**
 * Services injected into plugins for accessing core functionality
 */
export interface PluginServices {
  /** WebSocket service for server communication */
  websocket: WebSocketService;
  /** DOM observer service for tracking element changes */
  domObserver: DOMObserverService;
  /** Get current state from the store */
  getState: <T = unknown>() => T;
  /** Update state in the store */
  setState: <T = unknown>(partial: Partial<T>) => void;
  /** Open the inspector sidebar with specific content */
  openInspector: (
    mode: string,
    data: Record<string, unknown>
  ) => void;
  /** Close the inspector sidebar */
  closeInspector: () => void;
  /** Close the command palette */
  closeCommandPalette: () => void;
  /** Invalidate a category's cache (triggers reload) */
  invalidateCategory: (categoryId?: string) => void;
}

// ============================================================================
// Palette Item Types
// ============================================================================

/**
 * An item that appears in the command palette.
 */
export interface PaletteItem {
  /** Unique item identifier */
  id: string;
  /** Display title */
  title: string;
  /** Optional subtitle for additional context */
  subtitle?: string;
  /** Optional icon (React component or emoji string) */
  icon?: ReactNode;
  /** Keywords for filtering (e.g., ["Lint", "no-unused-vars", "Button.tsx"]) */
  keywords: string[];
  /**
   * Execute when item is selected
   * @param services Plugin services for accessing core functionality
   */
  execute?: (services: PluginServices) => void | Promise<void>;
  /** Additional metadata for inspector, etc. */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Search Item Types (Two-Panel Command Palette)
// ============================================================================

/**
 * A search item contributed by a plugin for the two-panel command palette.
 * Unlike TileItem (which is visual/count-based), SearchItem is optimized
 * for text search with fuzzy matching and preview rendering.
 */
export interface SearchItem {
  /** Unique identifier (e.g., "eslint:rule:no-unused-vars") */
  id: string;
  /** Section this item belongs to (drives grouping in result list) */
  section: "rules" | "files" | "commands" | string;
  /** Primary label displayed in the result list row */
  label: string;
  /** Secondary text (description, path) */
  subtitle?: string;
  /** Icon (React component or emoji) */
  icon?: ReactNode;
  /** Severity counts for badge display */
  severityCounts?: TileSeverityCounts;
  /** Total issue count */
  count?: number;
  /** File count (for rule items) */
  fileCount?: number;
  /**
   * Searchable text fields for fuzzy matching.
   * Fuse.js indexes these keys with configurable weights.
   */
  searchFields: {
    label: string;
    subtitle?: string;
    keywords?: string[];
    /** Additional text to search (e.g., issue messages) */
    extra?: string[];
  };
  /** Execute action when item is confirmed (Enter or double-click) */
  execute?: (services: PluginServices) => void | Promise<void>;
  /** Opaque metadata for preview panel rendering */
  metadata?: Record<string, unknown>;
}

/**
 * Preview panel content returned by a plugin for a selected SearchItem.
 * The plugin creates a ReactElement via createElement (no JSX).
 */
export type PreviewPanelResult = {
  /** React element to render in the preview pane */
  element: ReactElement;
} | null;

/**
 * A tile provider that contributes tiles to the command palette.
 * Plugins register tile providers to expose browsable content.
 */
export interface CategoryProvider {
  /** Unique provider identifier (e.g., "eslint:issues") */
  id: string;
  /** Display label */
  label: string;
  /** Optional icon (React component or emoji string) */
  icon?: ReactNode;
  /** Parent plugin ID */
  parentId?: string;

  /**
   * Get items as tiles for the masonry grid view.
   * @param services Plugin services for accessing state
   * @param filters Currently active tile filters
   */
  getTileItems?: (
    services: PluginServices,
    filters: TileFilter[]
  ) => TileItem[] | Promise<TileItem[]>;

  /**
   * Create a filter from a clicked tile.
   * Called when user clicks a tile to drill down.
   * @param item The clicked tile item
   */
  createFilter?: (item: TileItem) => TileFilter;

  /**
   * Check if current filter state is terminal (no more drill-down).
   * When true, clicking a tile opens the inspector instead of adding a filter.
   * @param filters Currently active filters
   */
  isTerminal?: (filters: TileFilter[]) => boolean;

  /**
   * Get inspector data for a terminal tile click.
   * @param item The clicked tile item
   */
  getInspectorData?: (item: TileItem) => {
    panelId: string;
    data: Record<string, unknown>;
  };
}

// ============================================================================
// Command Bar Contributions
// ============================================================================

/**
 * A command that can be triggered from the command palette
 */
export interface Command {
  /** Unique command identifier */
  id: string;
  /** Display title in the command palette */
  title: string;
  /** Keywords for fuzzy search matching */
  keywords: string[];
  /** Category for grouping (e.g., "actions", "navigation", "settings") */
  category: string;
  /** Optional subtitle for additional context */
  subtitle?: string;
  /** Optional icon (React component or emoji string) */
  icon?: ReactNode;
  /** Optional keyboard shortcut (e.g., "Cmd+K", "Ctrl+Shift+P") */
  shortcut?: string;
  /**
   * Predicate to determine if the command is available in the current state
   * @param state Current application state
   * @returns true if the command should be shown
   */
  isAvailable?: (state: unknown) => boolean;
  /**
   * Hide this command from the "All" category in command palette.
   * When true, command only appears when its category is selected or when searching.
   * Use this for plugin-specific commands that should be accessed via sidebar.
   */
  hideFromAllCategory?: boolean;
  /**
   * Execute the command
   * @param services Plugin services for accessing core functionality
   * @returns Optional promise for async commands
   */
  execute: (services: PluginServices) => void | Promise<void>;
}

// ============================================================================
// Inspector Panel Contributions
// ============================================================================

/**
 * Props passed to inspector panel components
 */
export interface InspectorPanelProps {
  /** Optional data payload for the panel */
  data?: Record<string, unknown>;
  /** Plugin services for accessing core functionality */
  services: PluginServices;
}

/**
 * An inspector panel contributed by a plugin
 */
export interface InspectorPanel {
  /** Unique panel identifier */
  id: string;
  /** Panel title (string or function for dynamic titles) */
  title: string | ((props: InspectorPanelProps) => string);
  /** Optional icon (React component or emoji string) */
  icon?: ReactNode;
  /** React component to render the panel content */
  component: ComponentType<InspectorPanelProps>;
  /** Priority for ordering (higher = appears first, default: 0) */
  priority?: number;
}

// ============================================================================
// Analyzer Contributions
// ============================================================================

/**
 * Trigger conditions for when an analyzer should run
 */
export type AnalyzerTrigger =
  | "manual"
  | "page-load"
  | "route-change"
  | "file-change"
  | "dom-mutation";

/**
 * Context provided to analyzers during analysis
 */
export interface AnalysisContext {
  /** Current route/pathname */
  route: string;
  /** Scanned DOM elements with data-loc attributes */
  elements: ScannedElementInfo[];
  /** Send a message to the server via WebSocket */
  sendMessage: (message: unknown) => void;
  /** Get current application state */
  getState: <T = unknown>() => T;
}

/**
 * An analyzer that can scan the page for issues
 */
export interface Analyzer {
  /** Unique analyzer identifier */
  id: string;
  /** Human-readable analyzer name */
  name: string;
  /** When this analyzer should be triggered */
  triggers: AnalyzerTrigger[];
  /** Whether this analyzer requires a WebSocket connection to function */
  requiresConnection: boolean;
  /**
   * Run the analysis
   * @param context Analysis context with elements and services
   * @returns Array of discovered issues or a promise resolving to them
   */
  analyze: (context: AnalysisContext) => PluginIssue[] | Promise<PluginIssue[]>;
}

// ============================================================================
// Issue Types
// ============================================================================

/**
 * Severity level for issues
 */
export type IssueSeverity = "error" | "warning" | "info";

/**
 * A unified issue type for all plugin-reported problems
 */
export interface PluginIssue {
  /** Unique issue identifier */
  id: string;
  /** Human-readable issue message */
  message: string;
  /** Severity level */
  severity: IssueSeverity;
  /** data-loc attribute value linking to source location */
  dataLoc?: string;
  /** Source file path */
  filePath?: string;
  /** Line number in source file (1-indexed) */
  line?: number;
  /** Column number in source file (1-indexed) */
  column?: number;
  /** Rule ID that generated this issue */
  ruleId?: string;
  /** Additional metadata for the issue */
  metadata?: Record<string, unknown>;
}

/**
 * Issues contributed by a plugin for heatmap aggregation
 */
export interface IssueContribution {
  /** Plugin ID that contributed these issues */
  pluginId: string;
  /**
   * Map of dataLoc -> issues for that location
   * Multiple issues can exist at the same source location
   */
  issues: Map<string, PluginIssue[]>;
}

// ============================================================================
// Rule UI Contributions
// ============================================================================

/**
 * Custom UI contribution for a specific rule
 */
export interface RuleUIContribution {
  /** Rule ID this contribution applies to */
  ruleId: string;
  /** Custom inspector panel for this rule's issues */
  inspectorPanel?: ComponentType<InspectorPanelProps>;
  /** Custom icon for this rule */
  icon?: ReactNode;
  /** Additional commands specific to this rule */
  commands?: Command[];
  /** Custom heatmap color for this rule's issues (CSS color string) */
  heatmapColor?: string;
}

// ============================================================================
// Toolbar Action Contributions
// ============================================================================

/**
 * A toolbar action that appears in the floating toolbar
 */
export interface ToolbarAction {
  /** Unique action identifier */
  id: string;
  /** Icon to display (React component, emoji, or icon name string) */
  icon: ReactNode;
  /** Tooltip text shown on hover */
  tooltip: string;
  /** Optional keyboard shortcut hint */
  shortcut?: string;
  /** Priority for ordering (higher = appears first, default: 0) */
  priority?: number;
  /**
   * Predicate to determine if the action is visible
   * @param state Current application state
   * @returns true if the action should be shown
   */
  isVisible?: (state: unknown) => boolean;
  /**
   * Predicate to determine if the action is enabled
   * @param state Current application state
   * @returns true if the action can be clicked
   */
  isEnabled?: (state: unknown) => boolean;
  /**
   * Execute the action
   * @param services Plugin services
   */
  onClick: (services: PluginServices) => void | Promise<void>;
}

/**
 * A group of toolbar actions displayed as a single dropdown button
 * The group renders as one button with a chevron; clicking opens a menu
 * listing each child action with its label and shortcut.
 */
export interface ToolbarActionGroup {
  /** Unique group identifier */
  id: string;
  /** Icon to display on the collapsed button */
  icon: ReactNode;
  /** Tooltip text shown on hover of the collapsed button */
  tooltip: string;
  /** Priority for ordering relative to other toolbar items (higher = first, default: 0) */
  priority?: number;
  /**
   * Predicate to determine if the group is visible
   * @param state Current application state
   */
  isVisible?: (state: unknown) => boolean;
  /** The actions within this group */
  actions: ToolbarAction[];
}

/** A toolbar item is either a single action or a grouped dropdown */
export type ToolbarItem = ToolbarAction | ToolbarActionGroup;

/** Type guard to check if a toolbar item is a group */
export function isToolbarActionGroup(item: ToolbarItem): item is ToolbarActionGroup {
  return "actions" in item && Array.isArray((item as ToolbarActionGroup).actions);
}

// ============================================================================
// Complete Plugin Definition
// ============================================================================

/**
 * Rule metadata for handlesRules predicate
 */
export interface RuleMeta {
  /** Rule ID (e.g., "uilint/semantic") */
  id: string;
  /** Rule category */
  category?: string;
  /** Rule name */
  name?: string;
}

/**
 * Complete plugin definition with all contributions
 * @template TSlice Type of the plugin's state slice
 */
export interface Plugin<TSlice = unknown> {
  /** Plugin metadata (for structured access) */
  meta?: PluginMeta;

  // Top-level metadata properties (for registry compatibility)
  /** Unique plugin identifier (e.g., "uilint-eslint", "uilint-vision") */
  id: string;
  /** Human-readable plugin name */
  name: string;
  /** Semantic version string */
  version: string;
  /** Short description of the plugin's purpose */
  description?: string;
  /** Optional icon (React component or emoji string) */
  icon?: ReactNode;
  /** Plugin IDs this plugin depends on */
  dependencies?: string[];
  /** Rule categories this plugin handles (e.g., ["semantic", "static"]) */
  ruleCategories?: string[];

  /**
   * Create the plugin's state slice
   * @param services Plugin services for initialization
   * @returns Initial state slice for this plugin
   */
  createSlice?: (services: PluginServices) => TSlice;

  /** Commands contributed by this plugin */
  commands?: Command[];

  /**
   * Get items for the command palette.
   * @param services Plugin services for accessing state
   * @returns Array of palette items (can be async)
   */
  getPaletteItems?: (services: PluginServices) => PaletteItem[] | Promise<PaletteItem[]>;

  /**
   * Get searchable items for the two-panel command palette.
   * Called when the palette opens and re-called when issues change.
   * Items are indexed by the fuzzy search engine.
   */
  getSearchItems?: (services: PluginServices) => SearchItem[];

  /**
   * Get a preview panel element for a selected search item.
   * Called when the user highlights an item in the result list.
   * Return null for no preview (shows empty state).
   */
  getPreviewPanel?: (
    item: SearchItem,
    services: PluginServices
  ) => PreviewPanelResult;

  /** Inspector panels contributed by this plugin */
  inspectorPanels?: InspectorPanel[];

  /** Analyzers contributed by this plugin */
  analyzers?: Analyzer[];

  /** Toolbar actions contributed by this plugin (shown in floating icon) */
  toolbarActions?: ToolbarAction[];

  /** Toolbar action groups contributed by this plugin (shown as dropdown buttons) */
  toolbarActionGroups?: ToolbarActionGroup[];

  /** Per-rule UI contributions */
  ruleContributions?: RuleUIContribution[];

  /**
   * Predicate to determine if this plugin handles a specific rule
   * Used for routing issues to the correct plugin
   * @param ruleMeta Metadata about the rule
   * @returns true if this plugin should handle issues from this rule
   */
  handlesRules?: (ruleMeta: RuleMeta) => boolean;

  /**
   * Get issues from the plugin's state for heatmap display
   * @param state Current plugin state slice (typed as unknown to allow variance)
   * @returns Issue contribution for heatmap aggregation
   *
   * Note: The state parameter is typed as unknown to allow plugins with specific
   * slice types to be assigned to Plugin. Plugins should cast internally.
   */
  getIssues?(state: unknown): IssueContribution;

  /**
   * Initialize the plugin (called once on registration)
   * @param services Plugin services
   * @returns Optional cleanup function or promise
   */
  initialize?: (services: PluginServices) => void | (() => void) | Promise<void>;

  /**
   * Dispose the plugin (called on unregistration)
   * @param services Plugin services
   */
  dispose?: (services: PluginServices) => void | Promise<void>;

  /**
   * Get available rules from this plugin
   * @param services Plugin services for accessing state
   * @returns Array of rule definitions
   */
  getRules?: (services: PluginServices) => RuleDefinition[];

  /**
   * Set severity for a rule
   * @param ruleId Rule ID to configure
   * @param severity New severity level
   * @param services Plugin services
   */
  setRuleSeverity?: (
    ruleId: string,
    severity: "error" | "warning" | "off",
    services: PluginServices
  ) => void;

  /**
   * Get configuration options for a rule
   * @param ruleId Rule ID
   * @param services Plugin services
   * @returns Current rule configuration
   */
  getRuleConfig?: (
    ruleId: string,
    services: PluginServices
  ) => Record<string, unknown>;

  /**
   * Set configuration options for a rule
   * @param ruleId Rule ID
   * @param config New configuration
   * @param services Plugin services
   */
  setRuleConfig?: (
    ruleId: string,
    config: Record<string, unknown>,
    services: PluginServices
  ) => void;

  /**
   * Tile provider for generating tiles in the command palette grid.
   * Plugins that want to contribute tiles should implement this.
   */
  tileProvider?: {
    /**
     * Get tile items based on current filter state.
     * @param services Plugin services for state access
     * @param filters Currently active tile filters
     * @returns Array of tile items to display
     */
    getTileItems: (services: PluginServices, filters: TileFilter[]) => TileItem[];

    /**
     * Create a filter from a clicked tile (for drill-down navigation).
     * @param item The clicked tile item
     * @returns Filter to add to the active filters
     */
    createFilter?: (item: TileItem) => TileFilter;

    /**
     * Check if current filter state is terminal (no more drill-down).
     * When true, clicking a tile opens inspector instead of adding filter.
     * @param filters Currently active filters
     * @returns True if terminal state
     */
    isTerminal?: (filters: TileFilter[]) => boolean;

    /**
     * Get inspector data for opening when clicking a terminal tile.
     * @param item The clicked tile item
     * @returns Panel ID and data for the inspector
     */
    getInspectorData?: (item: TileItem) => {
      panelId: string;
      data: Record<string, unknown>;
    };

    /**
     * Get child items for an expanded tile (for expandable tile UI).
     * Called when a tile is expanded to fetch its children.
     * @param item The expanded tile item
     * @param services Plugin services for state access
     * @returns Array of child tile items, or undefined if not expandable
     */
    getChildItems?: (item: TileItem, services: PluginServices) => TileItem[] | undefined;

    /**
     * Check if a tile can be expanded (has children).
     * @param item The tile to check
     * @returns True if the tile can be expanded
     */
    canExpand?: (item: TileItem) => boolean;
  };
}

// ============================================================================
// Tile System Types
// ============================================================================

/**
 * Size bucket for tiles in the masonry grid.
 * Determined by normalized count relative to siblings.
 */
export type TileBucket = "xs" | "sm" | "md" | "lg" | "xl";

/**
 * Severity counts for visual breakdown in tiles.
 */
export interface TileSeverityCounts {
  error: number;
  warning: number;
  info: number;
}

/**
 * A tile item that can be displayed in the masonry grid.
 * Tiles represent aggregated data (rules, files, etc.) with drill-down capability.
 */
export interface TileItem {
  /** Unique identifier for this tile */
  id: string;
  /** Primary display label */
  label: string;
  /** Optional secondary text */
  subtitle?: string;
  /** Optional icon (React component or emoji) */
  icon?: ReactNode;
  /** Count for bucket sizing (e.g., number of issues) */
  count: number;
  /** Optional severity breakdown for visual indicator */
  severityCounts?: TileSeverityCounts;
  /**
   * Optional preview messages for large tiles (lg/xl buckets).
   * These are displayed as additional context when space permits.
   * @example ["Unused variable 'foo'", "Missing return type"]
   */
  previewMessages?: string[];
  /**
   * Optional file count for large tiles (lg/xl buckets).
   * Shows "X files" badge when present.
   */
  fileCount?: number;
  /** Additional metadata for filtering/identification */
  metadata?: Record<string, unknown>;
}

/**
 * Filter type for scoping tile views.
 * Used as chips in the search bar to narrow displayed tiles.
 */
export type TileFilterType = "scope" | "rule" | "file" | "severity" | "category" | "loc";

/**
 * A filter chip that scopes the tile view.
 */
export interface TileFilter {
  /** Filter type (determines color coding and behavior) */
  type: TileFilterType;
  /** Unique identifier for the filter target */
  id: string;
  /** Display label for the chip */
  label: string;
  /** Provider/plugin that owns this filter */
  providerId?: string;
}

// ============================================================================
// Expandable Tile System Types
// ============================================================================

/**
 * Expansion level in the tile hierarchy.
 * - 0: Root level (e.g., rules)
 * - 1: First expansion (e.g., files for a rule)
 * - 2: Second expansion (e.g., issues in a file)
 */
export type ExpansionLevel = 0 | 1 | 2;

/**
 * Represents an expanded tile in the expansion path.
 * Forms a stack that tracks the drill-down navigation.
 */
export interface ExpandedTile {
  /** The tile item that was expanded */
  item: TileItem;
  /** Provider ID for fetching children */
  providerId: string;
  /** Level in the expansion hierarchy (0 = root, 1 = first expansion, etc.) */
  level: ExpansionLevel;
  /** Cached children of this expanded tile */
  children: TileItem[];
  /** Siblings at the same level (for collapsed strip) */
  siblings: TileItem[];
}

/**
 * The expansion path represents the current drill-down state.
 * It's a stack where each entry is an expanded tile.
 * Empty array = root view (no expansion).
 */
export type ExpansionPath = ExpandedTile[];

/**
 * Visual state of a tile in the expandable grid.
 */
export type TileVisualState =
  | "normal"           // Standard tile in the grid
  | "expanded"         // Currently expanded (showing children)
  | "collapsed-sibling" // Sibling of an expanded tile (minimal view)
  | "child"            // Child tile within an expanded parent
  | "nested-expanded"; // Expanded tile within another expanded tile

// ============================================================================
// Rule Definitions
// ============================================================================

/**
 * Schema for a rule option (for dynamic forms)
 */
export interface RuleOptionSchema {
  /** Option name */
  name: string;
  /** Option type */
  type: "string" | "number" | "boolean" | "select" | "array";
  /** Human-readable label */
  label: string;
  /** Default value */
  defaultValue?: unknown;
  /** Options for select type */
  options?: Array<{ value: string; label: string }>;
  /** Description for the option */
  description?: string;
}

/**
 * Complete rule definition from a plugin
 */
export interface RuleDefinition {
  /** Rule ID (e.g., "uilint/semantic") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what the rule checks */
  description: string;
  /** Category (e.g., "style", "semantic", "accessibility") */
  category: string;
  /** Current severity level */
  severity: "error" | "warning" | "off";
  /** Whether this rule can auto-fix issues */
  fixable: boolean;
  /** Plugin ID that owns this rule */
  pluginId: string;
  /** Configuration options schema */
  options?: RuleOptionSchema[];
  /** Documentation URL or markdown */
  docs?: string;
}

// ============================================================================
// Service Interfaces
// ============================================================================

/**
 * Handler for WebSocket messages
 */
export type WebSocketMessageHandler = (message: unknown) => void;

/**
 * Handler for WebSocket connection state changes
 */
export type WebSocketConnectionHandler = (connected: boolean) => void;

/**
 * WebSocket service for server communication
 */
export interface WebSocketService {
  /** Whether the WebSocket is currently connected */
  readonly isConnected: boolean;
  /** Current WebSocket URL */
  readonly url: string;

  /**
   * Connect to the WebSocket server
   * @param url Optional URL to connect to (uses default if not provided)
   */
  connect: (url?: string) => void;

  /**
   * Disconnect from the WebSocket server
   */
  disconnect: () => void;

  /**
   * Send a message to the server
   * @param message Message to send (will be JSON stringified)
   */
  send: (message: unknown) => void;

  /**
   * Subscribe to messages of a specific type
   * @param type Message type to listen for
   * @param handler Handler function for messages of this type
   * @returns Unsubscribe function
   */
  on: (type: string, handler: WebSocketMessageHandler) => () => void;

  /**
   * Subscribe to connection state changes
   * @param handler Handler function for connection state changes
   * @returns Unsubscribe function
   */
  onConnectionChange: (handler: WebSocketConnectionHandler) => () => void;
}

/**
 * Handler for DOM element additions
 */
export type ElementsAddedHandler = (elements: ScannedElementInfo[]) => void;

/**
 * Handler for DOM element removals
 */
export type ElementsRemovedHandler = (elementIds: string[]) => void;

/**
 * DOM observer service for tracking element changes
 */
export interface DOMObserverService {
  /**
   * Start observing DOM changes
   */
  start: () => void;

  /**
   * Stop observing DOM changes
   */
  stop: () => void;

  /**
   * Subscribe to element additions
   * @param handler Handler function for added elements
   * @returns Unsubscribe function
   */
  onElementsAdded: (handler: ElementsAddedHandler) => () => void;

  /**
   * Subscribe to element removals
   * @param handler Handler function for removed element IDs
   * @returns Unsubscribe function
   */
  onElementsRemoved: (handler: ElementsRemovedHandler) => () => void;
}

// ============================================================================
// DOM Element Types
// ============================================================================

/**
 * Information about a scanned DOM element with data-loc attribute
 */
export interface ScannedElementInfo {
  /**
   * Unique element identifier
   * Format: "loc:path:line:column#occurrence"
   */
  id: string;
  /** data-loc attribute value (format: "path:line:column") */
  dataLoc: string;
  /** Reference to the DOM element */
  element: Element;
  /** HTML tag name (e.g., "div", "button") */
  tagName: string;
  /** Element's bounding rectangle */
  rect: DOMRect;
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type { ComponentType, ReactNode };
