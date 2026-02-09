/**
 * Operation Lifecycle Framework
 *
 * Shared types and factory functions for plugins that perform long-running
 * server-mediated operations (indexing, analysis, etc.).
 *
 * Plugins compose these into their own state/actions/messages rather than
 * inheriting from a base class.
 *
 * NO REACT CODE - Pure TypeScript.
 */

import type { ActionHandlers, MessageHandlers, PluginContext } from "./context.js";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Status lifecycle for a long-running plugin operation.
 *
 * - "idle"     -- nothing has run yet (initial state)
 * - "active"   -- operation is in progress
 * - "complete" -- finished successfully
 * - "error"    -- finished with an error
 */
export type OperationStatus = "idle" | "active" | "complete" | "error";

/**
 * Progress tracking for a long-running operation.
 */
export interface OperationProgress {
  current: number;
  total: number;
  /** Optional human-readable context (e.g., file path, phase name) */
  message?: string;
}

/**
 * State shape for a long-running operation.
 *
 * Plugins embed this inside their own state interface:
 * ```typescript
 * interface MyPluginState {
 *   indexing: OperationState<IndexStats>;
 *   // ...other plugin-specific fields
 * }
 * ```
 *
 * @template TStats Type of the completion payload (e.g., IndexStats)
 */
export interface OperationState<TStats = unknown> {
  /** Current operation status */
  status: OperationStatus;
  /** Progress info (null when idle or complete) */
  progress: OperationProgress | null;
  /** Completion stats from the last successful run */
  stats: TStats | null;
  /** Error message from the last failed run */
  lastError: string | null;
}

// =============================================================================
// INITIAL STATE FACTORY
// =============================================================================

/**
 * Creates default initial state for an operation.
 *
 * @example
 * ```typescript
 * const initialState: MyState = {
 *   indexing: createOperationInitialState<IndexStats>(),
 * };
 * ```
 */
export function createOperationInitialState<
  TStats = unknown,
>(): OperationState<TStats> {
  return {
    status: "idle",
    progress: null,
    stats: null,
    lastError: null,
  };
}

// =============================================================================
// COMPUTED VALUES FACTORY
// =============================================================================

/**
 * Creates standard computed values for an operation.
 *
 * Returns four computed selectors that can be spread (and optionally renamed)
 * into a plugin's `StateDefinition.computed`:
 *
 * - `isReady`  -- status is "complete"
 * - `isActive` -- status is "active"
 * - `hasError` -- status is "error" or lastError is non-null
 * - `progressPercent` -- 0-100 number derived from progress
 *
 * @param getOp Extracts the OperationState from the full plugin state
 *
 * @example
 * ```typescript
 * const opComputed = createOperationComputed<MyState>((s) => s.indexing);
 * const stateDefinition = {
 *   computed: {
 *     isIndexReady: opComputed.isReady,
 *     isIndexing: opComputed.isActive,
 *     hasError: opComputed.hasError,
 *     progressPercent: opComputed.progressPercent,
 *   },
 * };
 * ```
 */
export function createOperationComputed<TState>(
  getOp: (state: TState) => OperationState
) {
  return {
    isReady: (state: TState) => getOp(state).status === "complete",
    isActive: (state: TState) => getOp(state).status === "active",
    hasError: (state: TState) => {
      const op = getOp(state);
      return op.status === "error" || op.lastError !== null;
    },
    progressPercent: (state: TState) => {
      const op = getOp(state);
      if (!op.progress) return 0;
      if (op.progress.total === 0) return 0;
      return Math.round(
        (op.progress.current / op.progress.total) * 100
      );
    },
  };
}

// =============================================================================
// ACTION HANDLERS FACTORY
// =============================================================================

/**
 * Configuration for creating operation action handlers.
 */
export interface OperationActionConfig<TState, TStats> {
  /** Extract the OperationState from the full plugin state */
  getOp: (state: TState) => OperationState<TStats>;
  /** Produce a partial state update that sets the operation state */
  setOp: (op: OperationState<TStats>) => Partial<TState>;
}

/**
 * Creates the four standard lifecycle action handlers for an operation.
 *
 * Returns handlers keyed as:
 * - `"handle-{prefix}-start"`
 * - `"handle-{prefix}-progress"`
 * - `"handle-{prefix}-complete"`
 * - `"handle-{prefix}-error"`
 *
 * These can be spread into a plugin's `ActionHandlers` alongside
 * any plugin-specific actions.
 *
 * @param prefix Action name prefix (e.g., "indexing", "analysis")
 * @param config How to read/write the operation state from plugin state
 *
 * @example
 * ```typescript
 * export const myActions: ActionHandlers<MyState> = {
 *   ...createOperationActions<MyState, IndexStats>("indexing", {
 *     getOp: (s) => s.indexing,
 *     setOp: (op) => ({ indexing: op }),
 *   }),
 *   // plugin-specific actions
 *   "start-indexing": (ctx) => { ... },
 * };
 * ```
 */
export function createOperationActions<TState, TStats>(
  prefix: string,
  config: OperationActionConfig<TState, TStats>
): ActionHandlers<TState> {
  const { getOp, setOp } = config;

  return {
    [`handle-${prefix}-start`]: (ctx: PluginContext<TState>) => {
      const current = getOp(ctx.getState());
      ctx.setState(
        setOp({
          ...current,
          status: "active",
          progress: { current: 0, total: 0 },
          lastError: null,
        })
      );
    },

    [`handle-${prefix}-progress`]: (
      ctx: PluginContext<TState>,
      payload: unknown
    ) => {
      const current = getOp(ctx.getState());
      ctx.setState(
        setOp({
          ...current,
          status: "active",
          progress: payload as OperationProgress,
        })
      );
    },

    [`handle-${prefix}-complete`]: (
      ctx: PluginContext<TState>,
      payload: unknown
    ) => {
      const current = getOp(ctx.getState());
      ctx.setState(
        setOp({
          ...current,
          status: "complete",
          progress: null,
          stats: payload as TStats,
          lastError: null,
        })
      );
    },

    [`handle-${prefix}-error`]: (
      ctx: PluginContext<TState>,
      payload: unknown
    ) => {
      const current = getOp(ctx.getState());
      const { error } = payload as { error: string };
      ctx.setState(
        setOp({
          ...current,
          status: "error",
          progress: null,
          lastError: error,
        })
      );
    },
  };
}

// =============================================================================
// MESSAGE HANDLERS FACTORY
// =============================================================================

/**
 * Configuration for mapping WebSocket messages to operation actions.
 */
export interface OperationMessageConfig {
  /** Prefix for action dispatch (e.g., "indexing", "analysis") */
  actionPrefix: string;
  /** WS message type for start (optional -- some operations don't have one) */
  startMessage?: string;
  /** WS message type for progress */
  progressMessage: string;
  /** WS message type for completion */
  completeMessage: string;
  /** WS message type for error */
  errorMessage: string;
  /** Extract progress payload from the raw WS message */
  extractProgress?: (message: unknown) => OperationProgress;
  /** Extract completion stats from the raw WS message */
  extractStats?: (message: unknown) => unknown;
  /** Extract error string from the raw WS message */
  extractError?: (message: unknown) => string;
}

/**
 * Creates WebSocket message handlers for a standard operation lifecycle.
 *
 * Each handler dispatches to the corresponding `handle-{prefix}-*` action.
 *
 * @example
 * ```typescript
 * export const myMessages: MessageHandlers<MyState> = {
 *   ...createOperationMessageHandlers<MyState>({
 *     actionPrefix: "indexing",
 *     startMessage: "duplicates:indexing:start",
 *     progressMessage: "duplicates:indexing:progress",
 *     completeMessage: "duplicates:indexing:complete",
 *     errorMessage: "duplicates:indexing:error",
 *     extractProgress: (msg) => ({
 *       current: (msg as any).current ?? 0,
 *       total: (msg as any).total ?? 0,
 *       message: (msg as any).message,
 *     }),
 *   }),
 * };
 * ```
 */
export function createOperationMessageHandlers<TState>(
  config: OperationMessageConfig
): MessageHandlers<TState> {
  const handlers: MessageHandlers<TState> = {};
  const { actionPrefix } = config;

  if (config.startMessage) {
    handlers[config.startMessage] = (ctx: PluginContext<TState>) => {
      ctx.dispatch(`handle-${actionPrefix}-start`);
    };
  }

  handlers[config.progressMessage] = (
    ctx: PluginContext<TState>,
    message: unknown
  ) => {
    const progress = config.extractProgress
      ? config.extractProgress(message)
      : (message as OperationProgress);
    ctx.dispatch(`handle-${actionPrefix}-progress`, progress);
  };

  handlers[config.completeMessage] = (
    ctx: PluginContext<TState>,
    message: unknown
  ) => {
    const stats = config.extractStats
      ? config.extractStats(message)
      : message;
    ctx.dispatch(`handle-${actionPrefix}-complete`, stats);
  };

  handlers[config.errorMessage] = (
    ctx: PluginContext<TState>,
    message: unknown
  ) => {
    const error = config.extractError
      ? config.extractError(message)
      : (message as { error: string }).error;
    ctx.dispatch(`handle-${actionPrefix}-error`, { error });
  };

  return handlers;
}
