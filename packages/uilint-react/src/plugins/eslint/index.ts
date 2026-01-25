/**
 * ESLint Plugin
 *
 * Real-time ESLint analysis with heatmap visualization.
 * Extracts ESLint-related state and functionality from the main store.
 */

import type { Plugin, PluginServices, RuleMeta, ScannedElementInfo } from "../../core/plugin-system/types";
import { eslintCommands } from "./commands";
import {
  createESLintSlice,
  createESLintActions,
  type ESLintPluginSlice,
  type ESLintSlice,
} from "./slice";
import type { AvailableRule, RuleConfig, ESLintIssue } from "./types";
import { fromESLintIssue, type Issue } from "../../ui/types";
import { extractUniqueFilePaths } from "./scanner";

/** WebSocket message types handled by ESLint plugin */
const ESLINT_WS_MESSAGE_TYPES = [
  "lint:result",
  "lint:progress",
  "file:changed",
  "workspace:info",
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
   * Inspector panels contributed by this plugin
   */
  inspectorPanels: [
    // TODO: Import from ./panels/ when created
    // { id: "eslint-issues", title: "Issues", component: IssuesPanel },
    // { id: "eslint-rules", title: "Rules", component: RulesPanel },
    // { id: "eslint-fixes", title: "Fixes", component: FixesPanel },
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
   * Initialize the plugin
   */
  initialize: (services: PluginServices) => {
    console.log("[ESLint Plugin] Initializing...");

    // Subscribe to WebSocket messages for lint results, rules metadata, etc.
    const unsubscribers: Array<() => void> = [];

    for (const messageType of ESLINT_WS_MESSAGE_TYPES) {
      const unsubscribe = services.websocket.on(messageType, (message) => {
        handleWebSocketMessage(services, message as WebSocketMessage);
      });
      unsubscribers.push(unsubscribe);
    }

    console.log("[ESLint Plugin] Subscribed to", ESLINT_WS_MESSAGE_TYPES.length, "message types");

    // Subscribe to DOM observer for element detection
    const unsubscribeDom = services.domObserver.onElementsAdded((elements: ScannedElementInfo[]) => {
      handleElementsAdded(services, elements);
    });
    unsubscribers.push(unsubscribeDom);

    console.log("[ESLint Plugin] Subscribed to DOM observer");

    // Return cleanup function
    return () => {
      console.log("[ESLint Plugin] Disposing...");
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  },

  /**
   * Dispose the plugin
   */
  dispose: (services: PluginServices) => {
    console.log("[ESLint Plugin] Disposed");
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
  // Get current state
  const state = services.getState<ESLintPluginSlice>();

  // Check if live scan is enabled
  if (!state.liveScanEnabled) {
    console.log("[ESLint Plugin] Live scan disabled, skipping lint requests");
    return;
  }

  // Check if WebSocket is connected
  if (!services.websocket.isConnected) {
    console.log("[ESLint Plugin] WebSocket not connected, skipping lint requests");
    return;
  }

  // Extract unique file paths from the detected elements
  const dataLocs = elements.map((el) => el.dataLoc);
  const filePaths = extractUniqueFilePaths(dataLocs);

  if (filePaths.size === 0) {
    return;
  }

  console.log("[ESLint Plugin] Detected", elements.length, "elements from", filePaths.size, "unique files");

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

      console.log("[ESLint Plugin] Sent lint:file request for", filePath);
    }
  }

  // Update state with newly requested files
  if (newFiles.length > 0) {
    const updatedRequestedFiles = new Set(requestedFiles);
    for (const filePath of newFiles) {
      updatedRequestedFiles.add(filePath);
    }
    services.setState({ requestedFiles: updatedRequestedFiles });
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
      console.log("[ESLint Plugin] Received lint result:", filePath, rawIssues.length, "issues");

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

      // Get current state and update issues for each dataLoc
      const state = services.getState<ESLintPluginSlice>();
      for (const [dataLoc, issues] of byDataLoc) {
        // Merge with the main issues Map
        const currentIssues = new Map(state.issues);
        currentIssues.set(dataLoc, issues);
        services.setState({ issues: currentIssues });
      }
      break;
    }

    case "lint:progress": {
      const { filePath, phase } = message;
      console.log("[ESLint Plugin] Lint progress:", filePath, phase);
      break;
    }

    case "file:changed": {
      const { filePath } = message;
      console.log("[ESLint Plugin] File changed:", filePath);

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
      console.log("[ESLint Plugin] Workspace info:", { appRoot, workspaceRoot, serverCwd });
      services.setState({ appRoot, workspaceRoot, serverCwd });
      break;
    }

    case "rules:metadata": {
      const { rules } = message;
      console.log("[ESLint Plugin] Received rules metadata:", rules.length, "rules");

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
        console.log("[ESLint Plugin] Rule config updated:", ruleId, "->", severity);
      } else {
        console.error("[ESLint Plugin] Failed to update rule config:", error);
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
      console.log("[ESLint Plugin] Rule config changed (broadcast):", ruleId, "->", severity);
      break;
    }
  }
}

export default eslintPlugin;

// Re-export types for convenience
export * from "./types";
export * from "./slice";
export { eslintCommands } from "./commands";
