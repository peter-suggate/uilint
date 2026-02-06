/**
 * Plugin Adapter
 *
 * Adapts declarative PluginWithHandlers (from uilint-core) to imperative
 * Plugin (for uilint-react). This allows plugin packages to export pure
 * TypeScript definitions while the React host renders the appropriate UI.
 */

import React from "react";
import type {
  PluginWithHandlers,
  PluginContext,
  ActionReference,
  CommandDefinition,
  ToolbarGroupDefinition,
  ToolbarActionDefinition,
  DataBinding,
  ExpressionBinding,
} from "uilint-core";
import {
  isDataBinding,
  isExpressionBinding,
} from "uilint-core";
import type {
  Plugin,
  PluginServices,
  Command,
  ToolbarAction,
  ToolbarActionGroup,
  IssueContribution,
} from "./types";
import { getIcon } from "../../ui/components/Schema/icon-map";

// =============================================================================
// PLUGIN CONTEXT FACTORY
// =============================================================================

/**
 * Creates a PluginContext from PluginServices
 */
function createPluginContext<TState>(
  services: PluginServices,
  pluginId: string,
  actionHandlers: PluginWithHandlers<TState>["actions"]
): PluginContext<TState> {
  return {
    getState: () => {
      const fullState = services.getState<{
        plugins?: Record<string, TState>;
      }>();
      return fullState.plugins?.[pluginId] as TState;
    },
    setState: (partial: Partial<TState>) => {
      services.setState(partial);
    },
    dispatch: (actionType: string, payload?: unknown) => {
      if (actionHandlers && actionHandlers[actionType]) {
        const ctx = createPluginContext(services, pluginId, actionHandlers);
        return actionHandlers[actionType](ctx, payload);
      }
    },
    websocket: services.websocket,
    getCurrentRoute: () => {
      return window.location.pathname;
    },
    requestBrowserAction: async (type: string, payload?: unknown) => {
      // Browser actions are implemented by the host
      // For now, we'll implement the common ones inline
      if (type === "capture-screenshot") {
        const { captureScreenshot } = await import("uilint-vision");
        const dataUrl = await captureScreenshot();
        return { success: true, dataUrl };
      }
      if (type === "collect-manifest") {
        const { collectElementManifest } = await import("uilint-vision");
        const manifest = collectElementManifest(payload as { x: number; y: number; width: number; height: number } | undefined);
        return { success: true, manifest };
      }
      return { success: false, error: `Unknown browser action: ${type}` };
    },
    openInEditor: (dataLoc: string) => {
      // Parse dataLoc and open in editor
      const [filePath, line] = dataLoc.split(":");
      const url = `vscode://file/${filePath}:${line}`;
      window.open(url, "_self");
    },
    setHeatmapFilter: (dataLocs: string[], label?: string) => {
      const state = services.getState<{
        setHeatmapFilter?: (locs: string[], label?: string) => void;
      }>();
      state.setHeatmapFilter?.(dataLocs, label);
    },
    clearHeatmapFilter: () => {
      const state = services.getState<{
        clearHeatmapFilter?: () => void;
      }>();
      state.clearHeatmapFilter?.();
    },
    openInspector: (panelId: string, data?: Record<string, unknown>) => {
      // Map panel IDs to inspector modes
      const modeMap: Record<string, "rule" | "issue" | "element" | "fixes" | "capture"> = {
        "vision-capture": "capture",
        "vision-issue": "issue",
        "semantic-issue": "issue",
      };
      const mode = modeMap[panelId] || "issue";
      services.openInspector(mode, { ...data });
    },
    closeInspector: () => {
      services.closeInspector();
    },
  };
}

// =============================================================================
// CONDITION EVALUATION
// =============================================================================

/**
 * Evaluates a DataBinding or ExpressionBinding against state
 */
function evaluateCondition(
  condition: DataBinding | ExpressionBinding | undefined,
  state: unknown
): boolean {
  if (!condition) return true;

  if (isDataBinding(condition)) {
    // Navigate the binding path
    const parts = condition.binding.split(".");
    let value: unknown = state;
    for (const part of parts) {
      if (value && typeof value === "object") {
        value = (value as Record<string, unknown>)[part];
      } else {
        return false;
      }
    }
    return Boolean(value);
  }

  if (isExpressionBinding(condition)) {
    // Simple expression evaluation (for basic cases)
    // For security, we only support specific patterns
    const expr = condition.expression;

    // Handle "property === value" patterns
    const equalMatch = expr.match(/^(\w+(?:\.\w+)*)\s*===?\s*(.+)$/);
    if (equalMatch) {
      const [, path, expectedStr] = equalMatch;
      let value: unknown = state;
      for (const part of path.split(".")) {
        if (value && typeof value === "object") {
          value = (value as Record<string, unknown>)[part];
        } else {
          value = undefined;
          break;
        }
      }
      const expected = expectedStr.trim();
      if (expected === "true") return value === true;
      if (expected === "false") return value === false;
      if (expected === "null") return value === null;
      if (expected === "0") return value === 0;
      if (expected.startsWith('"') && expected.endsWith('"')) {
        return value === expected.slice(1, -1);
      }
      return String(value) === expected;
    }

    // Handle "property.length === 0" patterns
    const lengthMatch = expr.match(/^(\w+(?:\.\w+)*)\.length\s*===?\s*(\d+)$/);
    if (lengthMatch) {
      const [, path, expectedLength] = lengthMatch;
      let value: unknown = state;
      for (const part of path.split(".")) {
        if (value && typeof value === "object") {
          value = (value as Record<string, unknown>)[part];
        } else {
          value = undefined;
          break;
        }
      }
      if (Array.isArray(value) || typeof value === "string" || value instanceof Map) {
        const len = value instanceof Map ? value.size : (value as unknown[]).length;
        return len === parseInt(expectedLength, 10);
      }
      return false;
    }

    // Default to false for unsupported expressions
    return false;
  }

  return true;
}

// =============================================================================
// COMMAND ADAPTATION
// =============================================================================

/**
 * Adapts a declarative CommandDefinition to an imperative Command
 */
function adaptCommand<TState>(
  cmd: CommandDefinition,
  pluginId: string,
  actionHandlers: PluginWithHandlers<TState>["actions"]
): Command {
  return {
    id: cmd.id,
    title: cmd.title,
    keywords: cmd.keywords,
    category: cmd.category,
    subtitle: cmd.subtitle,
    icon: cmd.icon ? React.createElement(getIcon(cmd.icon), { size: 16 }) : undefined,
    shortcut: cmd.shortcut,
    hideFromAllCategory: cmd.hideFromAllCategory,
    isAvailable: cmd.isAvailable
      ? (state: unknown) => {
          const pluginState = (state as { plugins?: Record<string, TState> })?.plugins?.[pluginId];
          return evaluateCondition(cmd.isAvailable, pluginState);
        }
      : undefined,
    execute: (services: PluginServices) => {
      const ctx = createPluginContext(services, pluginId, actionHandlers);
      return executeAction(cmd.action, ctx, actionHandlers);
    },
  };
}

// =============================================================================
// TOOLBAR ADAPTATION
// =============================================================================

/**
 * Adapts a declarative ToolbarActionDefinition to an imperative ToolbarAction
 */
function adaptToolbarAction<TState>(
  action: ToolbarActionDefinition,
  pluginId: string,
  actionHandlers: PluginWithHandlers<TState>["actions"]
): ToolbarAction {
  return {
    id: action.id,
    icon: React.createElement(getIcon(action.icon), { size: 16 }),
    tooltip: action.tooltip,
    isVisible: action.isVisible
      ? (state: unknown) => {
          const pluginState = (state as { plugins?: Record<string, TState> })?.plugins?.[pluginId];
          return evaluateCondition(action.isVisible, pluginState);
        }
      : undefined,
    isEnabled: action.isEnabled
      ? (state: unknown) => {
          const pluginState = (state as { plugins?: Record<string, TState> })?.plugins?.[pluginId];
          return evaluateCondition(action.isEnabled, pluginState);
        }
      : undefined,
    onClick: (services: PluginServices) => {
      const ctx = createPluginContext(services, pluginId, actionHandlers);
      return executeAction(action.action, ctx, actionHandlers);
    },
  };
}

/**
 * Adapts a declarative ToolbarGroupDefinition to an imperative ToolbarActionGroup
 */
function adaptToolbarGroup<TState>(
  group: ToolbarGroupDefinition,
  pluginId: string,
  actionHandlers: PluginWithHandlers<TState>["actions"]
): ToolbarActionGroup {
  return {
    id: group.id,
    icon: React.createElement(getIcon(group.icon), { size: 16 }),
    tooltip: group.tooltip,
    priority: group.priority,
    isVisible: group.isVisible
      ? (state: unknown) => {
          const pluginState = (state as { plugins?: Record<string, TState> })?.plugins?.[pluginId];
          return evaluateCondition(group.isVisible, pluginState);
        }
      : undefined,
    actions: group.actions.map((action) =>
      adaptToolbarAction(action, pluginId, actionHandlers)
    ),
  };
}

// =============================================================================
// ACTION EXECUTION
// =============================================================================

/**
 * Executes an ActionReference using the plugin's action handlers
 */
function executeAction<TState>(
  action: ActionReference,
  ctx: PluginContext<TState>,
  actionHandlers: PluginWithHandlers<TState>["actions"]
): void | Promise<void> {
  if (!actionHandlers || !actionHandlers[action.type]) {
    console.warn(`No handler found for action: ${action.type}`);
    return;
  }

  // Build payload from static payload and bindings
  const payload: Record<string, unknown> = action.payload ? { ...action.payload } : {};

  if (action.payloadBindings) {
    const state = ctx.getState();
    for (const [key, binding] of Object.entries(action.payloadBindings)) {
      const parts = binding.split(".");
      let value: unknown = state;
      for (const part of parts) {
        if (value && typeof value === "object") {
          value = (value as Record<string, unknown>)[part];
        } else {
          value = undefined;
          break;
        }
      }
      payload[key] = value;
    }
  }

  return actionHandlers[action.type](ctx, payload);
}

// =============================================================================
// MAIN ADAPTER FUNCTION
// =============================================================================

/**
 * Adapts a declarative PluginWithHandlers to an imperative Plugin
 *
 * This is the main entry point for converting plugin definitions from
 * uilint-core's declarative format to uilint-react's imperative format.
 */
export function adaptPlugin<TState>(
  source: PluginWithHandlers<TState>
): Plugin<TState> {
  const pluginId = source.id;
  const actionHandlers = source.actions;

  // Build the adapted plugin
  const adapted: Plugin<TState> = {
    // Metadata
    id: source.id,
    name: source.name,
    version: source.version,
    description: source.description,
    icon: source.icon ? React.createElement(getIcon(source.icon), { size: 16 }) : undefined,
    dependencies: source.dependencies,

    // State slice
    createSlice: (services: PluginServices) => {
      // Create initial state with setters
      const initialState = source.state.initialState as Record<string, unknown>;

      // Add setter functions for each state property
      const stateWithSetters: Record<string, unknown> = { ...initialState };
      for (const key of Object.keys(initialState)) {
        const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        stateWithSetters[setterName] = (value: unknown) => {
          services.setState({ [key]: value } as Partial<TState>);
        };
      }

      return stateWithSetters as TState;
    },

    // Commands
    commands: source.commands?.map((cmd) =>
      adaptCommand(cmd, pluginId, actionHandlers)
    ),

    // Toolbar
    toolbarActionGroups: source.toolbarGroups?.map((group) =>
      adaptToolbarGroup(group, pluginId, actionHandlers)
    ),

    // Inspector panels (schema-based, rendered by SchemaPanel)
    inspectorPanels: source.panels?.map((panel) => ({
      id: panel.id,
      title: typeof panel.title === "string"
        ? panel.title
        : (panel.title as { binding: string }).binding,
      priority: panel.priority,
      component: React.lazy(() =>
        import("../../ui/components/Schema/SchemaPanel").then((m) => ({
          default: (props: { data?: Record<string, unknown>; services: PluginServices }) => {
            // Get plugin state from services
            const fullState = props.services.getState<{
              plugins?: Record<string, TState>;
            }>();
            const pluginState = (fullState.plugins?.[pluginId] ?? {}) as Record<string, unknown>;

            // Create action handler
            const onAction = (type: string, payload: Record<string, unknown>) => {
              const ctx = createPluginContext(props.services, pluginId, actionHandlers);
              executeAction({ type, payload }, ctx, actionHandlers);
            };

            const SchemaPanel = m.SchemaPanel;
            return React.createElement(SchemaPanel, {
              panel,
              data: props.data || {},
              state: pluginState,
              onAction,
            });
          },
        }))
      ),
    })),

    // Rule handling
    handlesRules: source.handlesRuleCategories
      ? (ruleMeta) =>
          Boolean(
            ruleMeta.category &&
              source.handlesRuleCategories?.includes(ruleMeta.category)
          )
      : undefined,

    // Issue aggregation
    getIssues: source.getIssues
      ? (state: unknown): IssueContribution => {
          const result = source.getIssues!(state as TState);
          return {
            pluginId: result.pluginId,
            issues: result.issues,
          };
        }
      : undefined,

    // Lifecycle
    initialize: (services: PluginServices): void | (() => void) => {
      const ctx = createPluginContext(services, pluginId, actionHandlers);
      const unsubscribes: (() => void)[] = [];

      // Set up WebSocket message handlers
      if (source.messageHandlers) {
        for (const [messageType, handler] of Object.entries(source.messageHandlers)) {
          const unsub = services.websocket.on(messageType, (message) => {
            handler(ctx, message);
          });
          unsubscribes.push(unsub);
        }

        // Handle connection changes for vision:check
        const unsubConnection = services.websocket.onConnectionChange((connected) => {
          if (connected && source.onLoad) {
            source.onLoad(ctx);
          }
        });
        unsubscribes.push(unsubConnection);
      }

      // Call onLoad if defined (synchronously - ignore async cleanup)
      if (source.onLoad) {
        source.onLoad(ctx);
      }

      // Return cleanup function if we have any subscriptions
      if (unsubscribes.length > 0) {
        return () => {
          unsubscribes.forEach((unsub) => unsub());
        };
      }
    },

    dispose: source.onUnload
      ? (services: PluginServices) => {
          const ctx = createPluginContext(services, pluginId, actionHandlers);
          return source.onUnload!(ctx);
        }
      : undefined,
  };

  return adapted;
}

/**
 * Adapts multiple plugins from the uilint-core registry
 */
export function adaptPlugins(
  sources: PluginWithHandlers[]
): Plugin[] {
  return sources.map((source) => adaptPlugin(source));
}
