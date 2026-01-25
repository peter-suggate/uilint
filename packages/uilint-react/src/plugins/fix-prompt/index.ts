/**
 * Fix Prompt Plugin
 *
 * Provides a toolbar action to generate a copyable prompt for fixing
 * all lint issues on the current page. The prompt can be provided to
 * Cursor or Claude Code to fix the issues.
 */

import React from "react";
import type { Plugin, PluginServices, ToolbarAction, InspectorPanel } from "../../core/plugin-system/types";
import type { Issue } from "../../ui/types";
import { FixPromptPanel } from "./FixPromptPanel";

// Clipboard/document icon for the toolbar
const FixPromptIcon = React.createElement(
  "svg",
  {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  },
  // Clipboard shape
  React.createElement("path", {
    d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
  }),
  // Clipboard tab
  React.createElement("rect", { x: "8", y: "2", width: "8", height: "4", rx: "1", ry: "1" }),
  // Wrench/fix indicator lines
  React.createElement("line", { x1: "8", y1: "12", x2: "16", y2: "12" }),
  React.createElement("line", { x1: "8", y1: "16", x2: "14", y2: "16" })
);

/**
 * Collect all issues and capabilities from the ESLint plugin state
 */
function collectAllIssues(services: PluginServices): {
  issues: Issue[];
  workspaceRoot: string | null;
  hookAvailable: boolean;
} {
  // Get the full state which includes plugin slices
  const state = services.getState<{
    plugins?: {
      eslint?: {
        issues: Map<string, Issue[]>;
        workspaceRoot: string | null;
        workspaceCapabilities?: {
          postToolUseHook?: {
            enabled: boolean;
          };
        };
      };
    };
  }>();

  const eslintState = state.plugins?.eslint;
  if (!eslintState?.issues) {
    return { issues: [], workspaceRoot: null, hookAvailable: false };
  }

  // Flatten all issues from all dataLocs
  const allIssues: Issue[] = [];
  for (const issues of eslintState.issues.values()) {
    allIssues.push(...issues);
  }

  // Check if post-tool-use hook is available
  const hookAvailable = eslintState.workspaceCapabilities?.postToolUseHook?.enabled ?? false;

  return {
    issues: allIssues,
    workspaceRoot: eslintState.workspaceRoot,
    hookAvailable,
  };
}

/**
 * Toolbar action for generating fix prompt
 */
const fixPromptToolbarAction: ToolbarAction = {
  id: "fix-prompt:generate",
  icon: FixPromptIcon,
  tooltip: "Generate Fix Prompt",
  priority: 50, // Lower than vision actions, higher than default
  isVisible: (state: unknown) => {
    // Always visible when there's at least one issue
    const s = state as {
      plugins?: {
        eslint?: {
          issues: Map<string, Issue[]>;
        };
      };
    };
    const issues = s.plugins?.eslint?.issues;
    if (!issues) return false;

    let count = 0;
    for (const arr of issues.values()) {
      count += arr.length;
      if (count > 0) return true;
    }
    return false;
  },
  onClick: (services: PluginServices) => {
    const { issues, workspaceRoot, hookAvailable } = collectAllIssues(services);

    // Open the inspector with the fix-prompt panel
    const state = services.getState<{
      inspector: {
        open: boolean;
        panelId: string | null;
        data: Record<string, unknown> | null;
        docked: boolean;
        width: number;
        floatingPosition: { x: number; y: number } | null;
        floatingSize: { width: number; height: number } | null;
      };
    }>();

    services.setState({
      inspector: {
        ...state.inspector,
        open: true,
        panelId: "fix-prompt",
        data: { issues, workspaceRoot, hookAvailable },
      },
    });
  },
};

/**
 * Inspector panel for displaying the fix prompt
 */
const fixPromptInspectorPanel: InspectorPanel = {
  id: "fix-prompt",
  title: "Fix Prompt",
  icon: FixPromptIcon,
  component: FixPromptPanel,
  priority: 10,
};

/**
 * Fix Prompt plugin definition
 */
export const fixPromptPlugin: Plugin = {
  id: "fix-prompt",
  name: "Fix Prompt Generator",
  version: "1.0.0",
  description: "Generate copyable prompts for AI assistants to fix lint issues",

  meta: {
    id: "fix-prompt",
    name: "Fix Prompt Generator",
    version: "1.0.0",
    description: "Generate copyable prompts for AI assistants to fix lint issues",
    icon: FixPromptIcon,
  },

  /**
   * Toolbar actions contributed by this plugin
   */
  toolbarActions: [fixPromptToolbarAction],

  /**
   * Inspector panels contributed by this plugin
   */
  inspectorPanels: [fixPromptInspectorPanel],

  /**
   * No custom state slice needed - this plugin only reads from ESLint plugin state
   */
  createSlice: undefined,

  /**
   * No initialization needed
   */
  initialize: undefined,
};

export default fixPromptPlugin;
