/**
 * Plugin System Types
 *
 * Core TypeScript interfaces for the UILint plugin architecture.
 * Plugins can contribute commands, inspector panels, analyzers, and custom rule UI.
 */

import type { ComponentType, ReactNode } from "react";

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
    mode: "rule" | "issue" | "element" | "fixes",
    data: {
      ruleId?: string;
      issue?: unknown;
      elementId?: string;
      filePath?: string;
    }
  ) => void;
  /** Close the command palette */
  closeCommandPalette: () => void;
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

  /** Inspector panels contributed by this plugin */
  inspectorPanels?: InspectorPanel[];

  /** Analyzers contributed by this plugin */
  analyzers?: Analyzer[];

  /** Toolbar actions contributed by this plugin (shown in floating icon) */
  toolbarActions?: ToolbarAction[];

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
}

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
