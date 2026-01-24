/**
 * ESLint Plugin Commands
 *
 * Commands for the command palette related to ESLint functionality.
 */

import type { Command, PluginServices } from "../../core/plugin-system/types";

/**
 * Toggle live ESLint scanning on/off
 */
const toggleLiveScanCommand: Command = {
  id: "eslint:toggle-live-scan",
  title: "Toggle Live Scan",
  keywords: ["eslint", "live", "scan", "toggle", "enable", "disable", "start", "stop"],
  category: "eslint",
  subtitle: "Enable or disable real-time ESLint analysis",
  icon: undefined, // Will be set dynamically based on state
  execute: async (services: PluginServices) => {
    const state = services.getState<{
      liveScanEnabled: boolean;
      enableLiveScan: (hideNodeModules: boolean) => Promise<void>;
      disableLiveScan: () => void;
      settings: { hideNodeModules: boolean };
    }>();

    if (state.liveScanEnabled) {
      state.disableLiveScan();
    } else {
      await state.enableLiveScan(state.settings.hideNodeModules);
    }

    services.closeCommandPalette();
  },
  isAvailable: (state: unknown) => {
    const s = state as { wsConnected?: boolean };
    return s.wsConnected === true;
  },
};

/**
 * Open the fixes inspector to show all fixable issues
 */
const openFixesInspectorCommand: Command = {
  id: "eslint:open-fixes",
  title: "Fix All Issues",
  keywords: ["eslint", "fix", "fixes", "autofix", "repair", "issues"],
  category: "eslint",
  subtitle: "Open the fixes inspector panel",
  execute: (services: PluginServices) => {
    services.openInspector("fixes", {});
    services.closeCommandPalette();
  },
  isAvailable: (state: unknown) => {
    const s = state as {
      liveScanEnabled?: boolean;
      elementIssuesCache?: Map<string, { issues: unknown[] }>;
    };
    // Available when live scan is enabled and there are issues
    if (!s.liveScanEnabled) return false;
    if (!s.elementIssuesCache) return false;

    let hasIssues = false;
    s.elementIssuesCache.forEach((cached) => {
      if (cached.issues && cached.issues.length > 0) {
        hasIssues = true;
      }
    });

    return hasIssues;
  },
};

/**
 * Start a fresh ESLint scan of the current page
 */
const startScanCommand: Command = {
  id: "eslint:start-scan",
  title: "Start ESLint Scan",
  keywords: ["eslint", "scan", "start", "analyze", "lint", "check"],
  category: "eslint",
  subtitle: "Scan all elements on the current page",
  execute: async (services: PluginServices) => {
    const state = services.getState<{
      liveScanEnabled: boolean;
      enableLiveScan: (hideNodeModules: boolean) => Promise<void>;
      settings: { hideNodeModules: boolean };
    }>();

    if (!state.liveScanEnabled) {
      await state.enableLiveScan(state.settings.hideNodeModules);
    }

    services.closeCommandPalette();
  },
  isAvailable: (state: unknown) => {
    const s = state as { wsConnected?: boolean; liveScanEnabled?: boolean };
    return s.wsConnected === true && !s.liveScanEnabled;
  },
};

/**
 * Stop the current ESLint scan
 */
const stopScanCommand: Command = {
  id: "eslint:stop-scan",
  title: "Stop ESLint Scan",
  keywords: ["eslint", "scan", "stop", "disable", "off"],
  category: "eslint",
  subtitle: "Stop live scanning and clear results",
  execute: (services: PluginServices) => {
    const state = services.getState<{
      disableLiveScan: () => void;
    }>();

    state.disableLiveScan();
    services.closeCommandPalette();
  },
  isAvailable: (state: unknown) => {
    const s = state as { liveScanEnabled?: boolean };
    return s.liveScanEnabled === true;
  },
};

/**
 * Clear the ESLint cache and re-scan
 */
const clearCacheCommand: Command = {
  id: "eslint:clear-cache",
  title: "Clear ESLint Cache",
  keywords: ["eslint", "cache", "clear", "refresh", "reset"],
  category: "eslint",
  subtitle: "Clear cached results and re-scan",
  execute: async (services: PluginServices) => {
    const state = services.getState<{
      invalidateCache: () => void;
      liveScanEnabled: boolean;
      enableLiveScan: (hideNodeModules: boolean) => Promise<void>;
      disableLiveScan: () => void;
      settings: { hideNodeModules: boolean };
    }>();

    // Invalidate server cache
    state.invalidateCache();

    // If live scan is enabled, restart it
    if (state.liveScanEnabled) {
      state.disableLiveScan();
      await state.enableLiveScan(state.settings.hideNodeModules);
    }

    services.closeCommandPalette();
  },
  isAvailable: (state: unknown) => {
    const s = state as { wsConnected?: boolean };
    return s.wsConnected === true;
  },
};

/**
 * All ESLint commands exported for the plugin
 */
export const eslintCommands: Command[] = [
  toggleLiveScanCommand,
  startScanCommand,
  stopScanCommand,
  openFixesInspectorCommand,
  clearCacheCommand,
];
