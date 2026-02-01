/**
 * ESLint Plugin
 *
 * Real-time ESLint analysis with heatmap visualization.
 * Extracts ESLint-related state and functionality from the main store.
 */

import { devLog, devError } from "uilint-core";
import type {
  Plugin,
  PluginServices,
  RuleMeta,
  ScannedElementInfo,
  RuleDefinition,
  CategoryProvider,
  CategoryItem,
  TileItem,
  TileFilter,
  PaletteItem,
} from "../../core/plugin-system/types";
import { eslintCommands } from "./commands";
import {
  createESLintSlice,
  createESLintActions,
  type ESLintPluginSlice,
  type ESLintSlice,
} from "./slice";
import type { AvailableRule, RuleConfig, ESLintIssue } from "./types";
import { fromESLintIssue } from "../../ui/types";
import type { Issue } from "../../ui/types";
import { extractUniqueFilePaths } from "./scanner";
import { RulePanel } from "./panels";
import {
  isStaticMode,
  initializeStaticMode,
  configureStaticMode,
  clearStaticMode,
  getManifestMetadata,
} from "./static-handler";
import {
  getTileItems as getTileItemsHelper,
  createFilter as createFilterHelper,
  isTerminal as isTerminalHelper,
  getInspectorData as getInspectorDataHelper,
} from "./tile-provider";

/** WebSocket message types handled by ESLint plugin */
const ESLINT_WS_MESSAGE_TYPES = [
  "lint:result",
  "lint:progress",
  "file:changed",
  "workspace:info",
  "workspace:capabilities",
  "rules:metadata",
  "rule:config:result",
  "rule:config:changed",
] as const;

/**
 * ESLint Plugin Definition
 */
export const eslintPlugin: Plugin = {
  // Top-level metadata (required)
  id: "eslint",
  name: "ESLint Analysis",
  version: "1.0.0",
  description: "Real-time ESLint analysis with heatmap visualization",
  ruleCategories: ["static"],

  // Structured metadata (optional)
  meta: {
    id: "eslint",
    name: "ESLint Analysis",
    version: "1.0.0",
    description: "Real-time ESLint analysis with heatmap visualization",
  },

  /**
   * Create the plugin's state slice
   */
  createSlice: (services: PluginServices): ESLintPluginSlice => {
    const initialSlice = createESLintSlice(services);

    // Create a getter/setter for the slice
    // In practice, these would be connected to the actual store
    let slice: ESLintSlice = initialSlice;

    const getSlice = () => slice;
    const setSlice = (partial: Partial<ESLintSlice>) => {
      slice = { ...slice, ...partial };
      // In the real implementation, this would update the store
      services.setState(partial);
    };

    const actions = createESLintActions(services, getSlice, setSlice);

    return {
      ...initialSlice,
      ...actions,
    };
  },

  /**
   * Commands contributed by this plugin
   */
  commands: eslintCommands,

  /**
   * Category providers for command palette sidebar browsing
   */
  categoryProviders: createESLintCategoryProviders(),

  /**
   * Inspector panels contributed by this plugin
   */
  inspectorPanels: [
    {
      id: "eslint-rule",
      title: ({ data }) =>
        data?.ruleId ? `Rule: ${data.ruleId}` : "Rule Details",
      component: RulePanel,
      priority: 10,
    },
  ],

  /**
   * Determine which rules this plugin handles
   */
  handlesRules: (ruleMeta: RuleMeta): boolean => {
    // Handle all uilint/* rules and standard ESLint rules
    if (ruleMeta.id.startsWith("uilint/")) return true;
    if (ruleMeta.category === "static") return true;
    // Don't handle vision/semantic rules from the vision plugin
    if (ruleMeta.id === "uilint/semantic-vision") return false;
    return false;
  },

  /**
   * Get issues from the plugin's state for heatmap display
   */
  getIssues: (state: unknown) => {
    const eslintState = state as ESLintPluginSlice;

    // Convert unified Issue[] to PluginIssue[] format
    const pluginIssues = new Map<string, import("../../core/plugin-system/types").PluginIssue[]>();

    eslintState.issues.forEach((issues, dataLoc) => {
      const converted = issues.map((issue) => ({
        id: issue.id,
        message: issue.message,
        severity: issue.severity,
        dataLoc: issue.dataLoc,
        line: issue.line,
        column: issue.column,
        ruleId: issue.ruleId,
      }));

      if (converted.length > 0) {
        pluginIssues.set(dataLoc, converted);
      }
    });

    return {
      pluginId: "eslint",
      issues: pluginIssues,
    };
  },

  /**
   * Get palette items for the command palette (keyword-based system).
   * Returns both issues and commands as PaletteItems.
   */
  getPaletteItems: (services: PluginServices): PaletteItem[] => {
    const items: PaletteItem[] = [];

    // Get the full store state to check command availability and get issues
    const fullState = services.getState<{
      wsConnected?: boolean;
      plugins?: {
        eslint?: ESLintPluginSlice;
      };
    }>();

    const eslintState = fullState?.plugins?.eslint;

    // Add issues as palette items
    if (eslintState?.issues) {
      for (const [, issueList] of eslintState.issues) {
        for (const issue of issueList) {
          const fileName = issue.filePath.split("/").pop() || issue.filePath;
          const shortRuleId = issue.ruleId.includes("/")
            ? issue.ruleId.split("/").pop()!
            : issue.ruleId;

          items.push({
            id: `eslint:issue:${issue.id}`,
            title: issue.message,
            subtitle: `${fileName}:${issue.line}`,
            keywords: [
              "Lint",
              issue.ruleId,
              shortRuleId,
              fileName,
              issue.severity,
            ].filter((kw, i, arr) => arr.indexOf(kw) === i), // dedupe
            execute: (svc) => {
              svc.openInspector("issue", { issue });
              svc.closeCommandPalette();
            },
            metadata: { issue, providerId: "eslint" },
          });
        }
      }
    }

    // Add commands as palette items
    for (const cmd of eslintCommands) {
      // Check if command is available
      if (cmd.isAvailable && !cmd.isAvailable(fullState)) {
        continue;
      }

      items.push({
        id: cmd.id,
        title: cmd.title,
        subtitle: cmd.subtitle,
        keywords: ["Command", "ESLint", ...cmd.keywords],
        execute: cmd.execute,
        metadata: { isCommand: true },
      });
    }

    return items;
  },

  /**
   * Get available rules from this plugin
   */
  getRules: (services: PluginServices): RuleDefinition[] => {
    // services.getState() returns the plugin's scoped slice directly
    const state = services.getState<ESLintPluginSlice>();

    if (!state?.availableRules) {
      return [];
    }

    // Get current configs for severity lookup
    const configs = state.ruleConfigs ?? new Map<string, RuleConfig>();

    return state.availableRules.map((rule: AvailableRule): RuleDefinition => {
      const config = configs.get(rule.id);
      // Map "warn" to "warning" for the unified interface
      const severity = config?.severity ?? rule.currentSeverity ?? rule.defaultSeverity;
      const normalizedSeverity = severity === "warn" ? "warning" : severity;

      return {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        category: rule.category,
        severity: normalizedSeverity as "error" | "warning" | "off",
        fixable: false, // ESLint rules may be fixable, but we don't have this info from the server yet
        pluginId: "eslint",
        docs: rule.docs,
      };
    });
  },

  /**
   * Set severity for a rule
   */
  setRuleSeverity: (
    ruleId: string,
    severity: "error" | "warning" | "off",
    services: PluginServices
  ): void => {
    // Map "warning" back to "warn" for ESLint
    const eslintSeverity = severity === "warning" ? "warn" : severity;

    // Mark rule as updating
    const state = services.getState<{ ruleConfigUpdating: Map<string, boolean> }>();
    const updating = new Map(state.ruleConfigUpdating ?? new Map());
    updating.set(ruleId, true);
    services.setState({ ruleConfigUpdating: updating });

    // Send WebSocket message to update rule severity
    services.websocket.send({
      type: "rule:config:set",
      ruleId,
      severity: eslintSeverity,
      requestId: `rule-severity-${Date.now()}`,
    });

    devLog("[ESLint Plugin] Setting rule severity:", ruleId, "->", eslintSeverity);
  },

  /**
   * Get configuration options for a rule
   */
  getRuleConfig: (ruleId: string, services: PluginServices): Record<string, unknown> => {
    // services.getState() returns the plugin's scoped slice directly
    const state = services.getState<ESLintPluginSlice>();
    const configs = state?.ruleConfigs ?? new Map<string, RuleConfig>();
    const config = configs.get(ruleId);

    return config?.options ?? {};
  },

  /**
   * Set configuration options for a rule
   */
  setRuleConfig: (
    ruleId: string,
    config: Record<string, unknown>,
    services: PluginServices
  ): void => {
    // Mark rule as updating
    const state = services.getState<{ ruleConfigUpdating: Map<string, boolean> }>();
    const updating = new Map(state.ruleConfigUpdating ?? new Map());
    updating.set(ruleId, true);
    services.setState({ ruleConfigUpdating: updating });

    // Send WebSocket message to update rule options
    services.websocket.send({
      type: "rule:config:set",
      ruleId,
      options: config,
      requestId: `rule-config-${Date.now()}`,
    });

    devLog("[ESLint Plugin] Setting rule config:", ruleId, config);
  },

  /**
   * Initialize the plugin
   */
  initialize: (services: PluginServices) => {
    devLog("[ESLint Plugin] Initializing...");

    // Check if static mode is configured
    if (isStaticMode()) {
      devLog("[ESLint Plugin] Running in STATIC mode (manifest-based)");
      return initializeStaticMode(services);
    }

    // WebSocket mode (default)
    devLog("[ESLint Plugin] Running in WEBSOCKET mode");

    // Subscribe to WebSocket messages for lint results, rules metadata, etc.
    const unsubscribers: Array<() => void> = [];

    for (const messageType of ESLINT_WS_MESSAGE_TYPES) {
      const unsubscribe = services.websocket.on(messageType, (message) => {
        handleWebSocketMessage(services, message as WebSocketMessage);
      });
      unsubscribers.push(unsubscribe);
    }

    devLog("[ESLint Plugin] Subscribed to", ESLINT_WS_MESSAGE_TYPES.length, "message types");

    // Subscribe to DOM observer for element detection
    const unsubscribeDom = services.domObserver.onElementsAdded((elements: ScannedElementInfo[]) => {
      handleElementsAdded(services, elements);
    });
    unsubscribers.push(unsubscribeDom);

    devLog("[ESLint Plugin] Subscribed to DOM observer");

    // Return cleanup function
    return () => {
      devLog("[ESLint Plugin] Disposing...");
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  },

  /**
   * Dispose the plugin
   */
  dispose: (_services: PluginServices) => {
    devLog("[ESLint Plugin] Disposed");
  },
};

/**
 * Handle new elements detected by DOM observer
 *
 * Extracts unique file paths and sends lint:file requests for new files.
 */
function handleElementsAdded(
  services: PluginServices,
  elements: ScannedElementInfo[]
): void {
  // Get current state - services.getState() returns the plugin's scoped slice directly
  const state = services.getState<ESLintPluginSlice>();

  devLog("[ESLint Plugin] handleElementsAdded called with", elements.length, "elements");
  devLog("[ESLint Plugin] State check - scanStatus:", state?.scanStatus, "wsConnected:", services.websocket.isConnected);

  // Check if scanning is active
  if (state.scanStatus !== "scanning") {
    devLog("[ESLint Plugin] Scanning not active (status:", state.scanStatus, "), skipping lint requests");
    return;
  }

  // Check if WebSocket is connected
  if (!services.websocket.isConnected) {
    devLog("[ESLint Plugin] WebSocket not connected, skipping lint requests");
    return;
  }

  // Extract unique file paths from the detected elements
  const dataLocs = elements.map((el) => el.dataLoc);
  const filePaths = extractUniqueFilePaths(dataLocs);

  if (filePaths.size === 0) {
    devLog("[ESLint Plugin] No file paths extracted from", elements.length, "elements");
    return;
  }

  devLog("[ESLint Plugin] Detected", elements.length, "elements from", filePaths.size, "unique files:", Array.from(filePaths).slice(0, 3));

  // Get already-requested files from state
  const requestedFiles = state.requestedFiles ?? new Set<string>();

  // Send lint requests for new files only
  const newFiles: string[] = [];
  for (const filePath of filePaths) {
    if (!requestedFiles.has(filePath)) {
      newFiles.push(filePath);

      // Send lint:file request
      const requestId = `lint-${Date.now()}-${filePath.replace(/[^a-zA-Z0-9]/g, "-")}`;
      services.websocket.send({
        type: "lint:file",
        filePath,
        requestId,
      });

      devLog("[ESLint Plugin] Sent lint:file request for", filePath);
    }
  }

  // Update state with newly requested files
  if (newFiles.length > 0) {
    const updatedRequestedFiles = new Set(requestedFiles);
    for (const filePath of newFiles) {
      updatedRequestedFiles.add(filePath);
    }
    // Update the eslint slice state - need to use the full path
    services.setState({ requestedFiles: updatedRequestedFiles });
    devLog("[ESLint Plugin] Updated requestedFiles with", newFiles.length, "new files");
  } else {
    devLog("[ESLint Plugin] All files already requested, skipping");
  }
}

/**
 * WebSocket message handler types
 */
interface LintResultMessage {
  type: "lint:result";
  filePath: string;
  issues: ESLintIssue[];
  requestId?: string;
}

interface LintProgressMessage {
  type: "lint:progress";
  filePath: string;
  phase: string;
  requestId?: string;
}

interface FileChangedMessage {
  type: "file:changed";
  filePath: string;
}

interface WorkspaceInfoMessage {
  type: "workspace:info";
  appRoot: string;
  workspaceRoot: string;
  serverCwd: string;
}

interface WorkspaceCapabilitiesMessage {
  type: "workspace:capabilities";
  postToolUseHook: {
    enabled: boolean;
    provider: "claude" | "cursor" | null;
  };
}

interface RulesMetadataMessage {
  type: "rules:metadata";
  rules: AvailableRule[];
}

interface RuleConfigResultMessage {
  type: "rule:config:result";
  ruleId: string;
  severity: "error" | "warn" | "off";
  options?: Record<string, unknown>;
  success: boolean;
  error?: string;
  requestId?: string;
}

interface RuleConfigChangedMessage {
  type: "rule:config:changed";
  ruleId: string;
  severity: "error" | "warn" | "off";
  options?: Record<string, unknown>;
}

type WebSocketMessage =
  | LintResultMessage
  | LintProgressMessage
  | FileChangedMessage
  | WorkspaceInfoMessage
  | WorkspaceCapabilitiesMessage
  | RulesMetadataMessage
  | RuleConfigResultMessage
  | RuleConfigChangedMessage;

/**
 * Handle WebSocket messages
 */
function handleWebSocketMessage(
  services: PluginServices,
  message: WebSocketMessage
): void {
  switch (message.type) {
    case "lint:result": {
      const { filePath, issues: rawIssues } = message;
      devLog("[ESLint Plugin] Received lint result:", filePath, rawIssues.length, "issues");

      // Convert raw issues to unified Issue type
      const converted = rawIssues
        .map((raw) =>
          fromESLintIssue({
            ...raw,
            dataLoc: raw.dataLoc || `${filePath}:${raw.line}:${raw.column || 0}`,
          })
        )
        .filter((issue): issue is Issue => issue !== null);

      // Group issues by dataLoc
      const byDataLoc = new Map<string, Issue[]>();
      for (const issue of converted) {
        const existing = byDataLoc.get(issue.dataLoc) || [];
        byDataLoc.set(issue.dataLoc, [...existing, issue]);
      }

      // Get current state and batch all issue updates into a single setState call
      const state = services.getState<ESLintPluginSlice>();
      const mergedIssues = new Map(state.issues);
      for (const [dataLoc, issues] of byDataLoc) {
        mergedIssues.set(dataLoc, issues);
      }
      services.setState({ issues: mergedIssues });
      break;
    }

    case "lint:progress": {
      const { filePath, phase } = message;
      devLog("[ESLint Plugin] Lint progress:", filePath, phase);
      break;
    }

    case "file:changed": {
      const { filePath } = message;
      devLog("[ESLint Plugin] File changed:", filePath);

      // Invalidate cache for this file - remove all issues with matching filePath
      const state = services.getState<ESLintPluginSlice>();
      const newIssues = new Map(state.issues);
      for (const [dataLoc] of newIssues) {
        if (dataLoc.startsWith(filePath + ":")) {
          newIssues.delete(dataLoc);
        }
      }

      // Also clear from requestedFiles so it can be re-requested
      const newRequestedFiles = new Set(state.requestedFiles ?? new Set());
      newRequestedFiles.delete(filePath);

      services.setState({ issues: newIssues, requestedFiles: newRequestedFiles });
      break;
    }

    case "workspace:info": {
      const { appRoot, workspaceRoot, serverCwd } = message;
      devLog("[ESLint Plugin] Workspace info:", { appRoot, workspaceRoot, serverCwd });
      services.setState({ appRoot, workspaceRoot, serverCwd });
      break;
    }

    case "workspace:capabilities": {
      const { postToolUseHook } = message;
      devLog("[ESLint Plugin] Workspace capabilities:", { postToolUseHook });
      services.setState({ workspaceCapabilities: { postToolUseHook } });
      break;
    }

    case "rules:metadata": {
      const { rules } = message;
      devLog("[ESLint Plugin] Received rules metadata:", rules.length, "rules");

      // Initialize rule configs from current severities
      const configs = new Map<string, RuleConfig>();
      for (const rule of rules) {
        configs.set(rule.id, {
          severity: rule.currentSeverity ?? rule.defaultSeverity,
          options:
            rule.currentOptions ??
            (rule.defaultOptions && rule.defaultOptions.length > 0
              ? (rule.defaultOptions[0] as Record<string, unknown>)
              : undefined),
        });
      }

      services.setState({ availableRules: rules, ruleConfigs: configs });
      break;
    }

    case "rule:config:result": {
      const { ruleId, severity, options, success, error } = message;

      // Clear updating state
      const state = services.getState<{ ruleConfigUpdating: Map<string, boolean> }>();
      const updating = new Map(state.ruleConfigUpdating);
      updating.delete(ruleId);
      services.setState({ ruleConfigUpdating: updating });

      if (success) {
        // Update local config
        const configState = services.getState<{ ruleConfigs: Map<string, RuleConfig> }>();
        const configs = new Map(configState.ruleConfigs);
        configs.set(ruleId, { severity, options });
        services.setState({ ruleConfigs: configs });
        devLog("[ESLint Plugin] Rule config updated:", ruleId, "->", severity);
      } else {
        devError("[ESLint Plugin] Failed to update rule config:", error);
      }
      break;
    }

    case "rule:config:changed": {
      const { ruleId, severity, options } = message;

      // Update local config (broadcast from another client or CLI)
      const state = services.getState<{ ruleConfigs: Map<string, RuleConfig> }>();
      const configs = new Map(state.ruleConfigs);
      configs.set(ruleId, { severity, options });
      services.setState({ ruleConfigs: configs });
      devLog("[ESLint Plugin] Rule config changed (broadcast):", ruleId, "->", severity);
      break;
    }
  }
}

/**
 * Create category providers for the ESLint plugin.
 *
 * Provides two category types:
 * 1. A static "Commands" category that always shows ESLint commands
 * 2. A dynamic provider that generates categories for rules with issues
 */
function createESLintCategoryProviders(): CategoryProvider[] {
  return [
    // Static provider for ESLint commands - always visible
    {
      id: "eslint:commands",
      label: "Commands",
      priority: 1,
      parentId: "eslint",

      // Return ESLint commands as category items
      getItems: (services: PluginServices): CategoryItem[] => {
        // Get full state to check command availability
        const fullState = services.getState<{
          wsConnected?: boolean;
          plugins?: {
            eslint?: {
              scanStatus?: string;
              issues?: Map<string, unknown[]>;
            };
          };
        }>();

        // Convert commands to category items, filtering by availability
        return eslintCommands
          .filter((cmd) => !cmd.isAvailable || cmd.isAvailable(fullState))
          .map((cmd): CategoryItem => ({
            id: cmd.id,
            title: cmd.title,
            subtitle: cmd.subtitle,
            priority: 1,
            metadata: {
              category: cmd.category,
              keywords: cmd.keywords,
            },
            execute: (svc) => {
              cmd.execute(svc);
            },
          }));
      },

      getItemCount: (services: PluginServices): number => {
        // Get full state to check command availability
        const fullState = services.getState<{
          wsConnected?: boolean;
          plugins?: {
            eslint?: {
              scanStatus?: string;
              issues?: Map<string, unknown[]>;
            };
          };
        }>();

        return eslintCommands.filter(
          (cmd) => !cmd.isAvailable || cmd.isAvailable(fullState)
        ).length;
      },

      searchKeys: ["title", "subtitle"],
    },

    // Dynamic provider that generates a category for each rule with issues
    {
      id: "eslint:dynamic-rules",
      label: "Issues by Rule",
      priority: 2,
      isDynamic: true,
      parentId: "eslint",

      // Generate sub-categories for each rule that has issues
      getSubCategories: (services: PluginServices): CategoryProvider[] => {
        // Access the full store state and get the ESLint plugin slice
        const fullState = services.getState<{ plugins?: { eslint?: ESLintPluginSlice } }>();
        const state = fullState?.plugins?.eslint;
        if (!state?.issues) return [];

        // Group issues by rule
        const issuesByRule = new Map<string, Issue[]>();
        for (const issues of state.issues.values()) {
          for (const issue of issues) {
            const existing = issuesByRule.get(issue.ruleId) || [];
            issuesByRule.set(issue.ruleId, [...existing, issue]);
          }
        }

        // Create a category provider for each rule with issues
        const ruleProviders: CategoryProvider[] = [];
        for (const [ruleId, ruleIssues] of issuesByRule) {
          const errorCount = ruleIssues.filter((i) => i.severity === "error").length;
          const totalCount = ruleIssues.length;

          // Extract short rule name (e.g., "no-unused-vars" from "@typescript-eslint/no-unused-vars")
          const shortName = ruleId.includes("/") ? ruleId.split("/").pop()! : ruleId;

          ruleProviders.push({
            id: `eslint:rule:${ruleId}`,
            label: shortName,
            priority: errorCount > 0 ? 0 : 1,
            parentId: "eslint",

            // Return the issues for this rule
            getItems: (): CategoryItem[] => {
              return ruleIssues.map((issue): CategoryItem => ({
                id: `eslint:issue:${issue.id}`,
                title: issue.message,
                subtitle: `${issue.filePath}:${issue.line}`,
                priority: issue.severity === "error" ? 0 : 1,
                metadata: {
                  issueId: issue.id,
                  ruleId: issue.ruleId,
                  severity: issue.severity,
                  filePath: issue.filePath,
                  line: issue.line,
                },
                execute: (svc) => {
                  svc.openInspector("issue", { issue });
                  svc.closeCommandPalette();
                },
              }));
            },

            getItemCount: () => totalCount,

            searchKeys: ["title", "subtitle"],
          });
        }

        // Sort by severity (errors first) then by count
        ruleProviders.sort((a, b) => {
          // Priority 0 = errors, 1 = warnings
          if (a.priority !== b.priority) return a.priority - b.priority;
          // Then by count (need to call getItemCount)
          const aCount = a.getItemCount?.(services) ?? 0;
          const bCount = b.getItemCount?.(services) ?? 0;
          return (bCount as number) - (aCount as number);
        });

        return ruleProviders;
      },

      // This provider itself doesn't have items - it's just a container
      getItems: () => [],
      getItemCount: () => 0,

      // ============ Tile System Methods ============

      /**
       * Get tile items for the masonry grid view.
       * - No filters: return rules as tiles
       * - Has rule filter: return files for that rule as tiles
       * - Has rule + file filter: return empty (terminal state)
       */
      getTileItems: (
        services: PluginServices,
        filters: TileFilter[]
      ): TileItem[] => {
        return getTileItemsHelper(services, filters);
      },

      /**
       * Create a filter from a clicked tile.
       * Checks item.metadata to determine if it's a rule or file.
       */
      createFilter: (item: TileItem): TileFilter => {
        return createFilterHelper(item);
      },

      /**
       * Check if current filter state is terminal (no more drill-down).
       * Returns true if filters include both a rule AND a file.
       */
      isTerminal: (filters: TileFilter[]): boolean => {
        return isTerminalHelper(filters);
      },

      /**
       * Get inspector data for a terminal tile click.
       * Returns the panel ID and data needed to open the inspector.
       */
      getInspectorData: (item: TileItem): { panelId: string; data: Record<string, unknown> } => {
        return getInspectorDataHelper(item);
      },
    },
  ];
}

export default eslintPlugin;

// Re-export types for convenience
export * from "./types";
export * from "./slice";
export { eslintCommands } from "./commands";

// Static mode exports
export {
  configureStaticMode,
  isStaticMode,
  clearStaticMode,
  getManifestMetadata,
} from "./static-handler";

// Export for testing - allows direct testing of message handling logic
export { handleWebSocketMessage as _handleWebSocketMessageForTesting };

// Tile provider exports
export {
  aggregateByRule,
  aggregateByFile,
  countSeverities,
  getTileItems as getEslintTileItems,
  createFilter as createEslintTileFilter,
  isTerminal as isEslintTileTerminal,
  getInspectorData as getEslintInspectorData,
} from "./tile-provider";
