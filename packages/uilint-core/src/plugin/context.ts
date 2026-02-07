/**
 * Plugin Context
 *
 * The context object provided to plugin action handlers and lifecycle hooks.
 * This is the "services" interface - framework agnostic.
 */

import type { PluginDefinition } from "./types.js";

/**
 * WebSocket service interface for plugin communication.
 */
export interface WebSocketService {
  /** Whether currently connected */
  readonly isConnected: boolean;
  /** Send a message to the server */
  send(message: unknown): void;
}

/**
 * Result from a browser action request.
 */
export interface BrowserActionResult {
  /** Whether the action succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Additional data from the action */
  [key: string]: unknown;
}

/**
 * Plugin context provided to action handlers.
 *
 * This is the services object that plugins use to interact with the host.
 * It's framework-agnostic - no React dependencies.
 */
export interface PluginContext<TState = unknown> {
  // === State Access ===

  /** Get current plugin state */
  getState(): TState;

  /** Update plugin state (partial update) */
  setState(partial: Partial<TState>): void;

  // === Action Dispatch ===

  /** Dispatch an action by type */
  dispatch(actionType: string, payload?: unknown): void | Promise<void>;

  // === WebSocket ===

  /** WebSocket service for server communication */
  readonly websocket: WebSocketService;

  // === Navigation ===

  /** Get current route/path */
  getCurrentRoute(): string;

  // === Browser Actions ===

  /**
   * Request a browser-side action.
   * Plugins register handlers for their browser actions during onLoad.
   * The host dispatches to the registered handler.
   */
  requestBrowserAction(
    type: string,
    payload?: unknown
  ): Promise<BrowserActionResult>;

  /**
   * Register a browser action handler.
   * Called by plugins during onLoad to provide implementations
   * for the browser actions they declared in their definition.
   */
  registerBrowserAction(
    type: string,
    handler: (payload?: unknown) => Promise<BrowserActionResult>
  ): void;

  // === Editor Integration ===

  /** Open file at location in editor */
  openInEditor(dataLoc: string): void;

  // === Heatmap ===

  /** Set heatmap filter to highlight specific locations */
  setHeatmapFilter(dataLocs: string[], label?: string): void;

  /** Clear heatmap filter */
  clearHeatmapFilter(): void;

  // === Inspector ===

  /** Open inspector panel with data */
  openInspector(panelId: string, data?: Record<string, unknown>): void;

  /** Close inspector */
  closeInspector(): void;

  // === Overlay Interactions ===

  /**
   * Request an overlay interaction from the host.
   * The host renders the appropriate UI (e.g., region selector)
   * and resolves/rejects based on user action.
   */
  requestOverlayInteraction(
    type: "region-select",
    options?: Record<string, unknown>
  ): Promise<unknown>;
}

/**
 * Action handler function signature.
 */
export type ActionHandler<TState = unknown, TPayload = unknown> = (
  ctx: PluginContext<TState>,
  payload: TPayload
) => void | Promise<void>;

/**
 * Map of action type to handler.
 */
export type ActionHandlers<TState = unknown> = Record<
  string,
  ActionHandler<TState, unknown>
>;

/**
 * Message handler for WebSocket messages.
 */
export type MessageHandler<TState = unknown> = (
  ctx: PluginContext<TState>,
  message: unknown
) => void;

/**
 * Map of message type to handler.
 */
export type MessageHandlers<TState = unknown> = Record<
  string,
  MessageHandler<TState>
>;

/**
 * Issue aggregator function signature.
 */
export type IssueAggregator<TState = unknown> = (
  state: TState
) => import("./types.js").IssueContribution;

/**
 * Lifecycle hook for plugin initialization.
 * Can return a cleanup function.
 */
export type InitializeHook<TState = unknown> = (
  ctx: PluginContext<TState>
) => void | (() => void) | Promise<void | (() => void)>;

/**
 * Lifecycle hook for plugin disposal.
 */
export type DisposeHook<TState = unknown> = (
  ctx: PluginContext<TState>
) => void | Promise<void>;

/**
 * Extended plugin definition with runtime handlers.
 *
 * This extends PluginDefinition with the handler functions that
 * operate at runtime. Separated from types.ts to keep the type
 * definitions clean and serializable.
 */
export interface PluginWithHandlers<TState = unknown>
  extends PluginDefinition<TState> {
  /** Action handlers */
  actions?: ActionHandlers<TState>;

  /** WebSocket message handlers */
  messageHandlers?: MessageHandlers<TState>;

  /** Issue aggregation function */
  getIssues?: IssueAggregator<TState>;

  /** Called when plugin is loaded */
  onLoad?: InitializeHook<TState>;

  /** Called when plugin is unloaded */
  onUnload?: DisposeHook<TState>;
}
