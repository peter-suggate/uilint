/**
 * ESLint Plugin Commands
 *
 * Commands for the command palette related to ESLint functionality.
 */

import type { Command, PluginServices } from "../../core/plugin-system/types";
import type { ScanStatus } from "./slice";

/**
 * Toggle ESLint scanning on/off
 */
const toggleScanCommand: Command = {
  id: "eslint:toggle-scan",
  title: "Toggle ESLint Scan",
  keywords: ["eslint", "scan", "toggle", "enable", "disable", "start", "stop"],
  category: "eslint",
  subtitle: "Enable or disable real-time ESLint analysis",
  icon: undefined,
  execute: (services: PluginServices) => {
    const state = services.getState<{
      plugins: {
        eslint?: {
          scanStatus: ScanStatus;
          startScanning: () => void;
          stopScanning: () => void;
        };
      };
    }>();

    const eslint = state.plugins.eslint;
    if (!eslint) {
      console.warn("[ESLint Command] ESLint plugin slice not found");
      return;
    }

    if (eslint.scanStatus === "scanning") {
      eslint.stopScanning();
    } else {
      eslint.startScanning();
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
      plugins?: {
        eslint?: {
          scanStatus?: ScanStatus;
          issues?: Map<string, unknown[]>;
        };
      };
    };
    const eslint = s.plugins?.eslint;
    // Available when scanning and there are issues
    if (eslint?.scanStatus !== "scanning") return false;
    if (!eslint?.issues) return false;
    return eslint.issues.size > 0;
  },
};

/**
 * Start ESLint scan
 */
const startScanCommand: Command = {
  id: "eslint:start-scan",
  title: "Start ESLint Scan",
  keywords: ["eslint", "scan", "start", "analyze", "lint", "check"],
  category: "eslint",
  subtitle: "Scan all elements on the current page",
  execute: (services: PluginServices) => {
    const state = services.getState<{
      plugins: {
        eslint?: {
          scanStatus: ScanStatus;
          startScanning: () => void;
        };
      };
    }>();

    const eslint = state.plugins.eslint;
    if (!eslint) {
      console.warn("[ESLint Command] ESLint plugin slice not found");
      return;
    }

    if (eslint.scanStatus !== "scanning") {
      eslint.startScanning();
    }

    services.closeCommandPalette();
  },
  isAvailable: (state: unknown) => {
    const s = state as { wsConnected?: boolean; plugins?: { eslint?: { scanStatus?: ScanStatus } } };
    return s.wsConnected === true && s.plugins?.eslint?.scanStatus !== "scanning";
  },
};

/**
 * Stop ESLint scan
 */
const stopScanCommand: Command = {
  id: "eslint:stop-scan",
  title: "Stop ESLint Scan",
  keywords: ["eslint", "scan", "stop", "disable", "off"],
  category: "eslint",
  subtitle: "Stop scanning and clear results",
  execute: (services: PluginServices) => {
    const state = services.getState<{
      plugins: {
        eslint?: {
          stopScanning: () => void;
        };
      };
    }>();

    const eslint = state.plugins.eslint;
    if (!eslint) {
      console.warn("[ESLint Command] ESLint plugin slice not found");
      return;
    }

    eslint.stopScanning();
    services.closeCommandPalette();
  },
  isAvailable: (state: unknown) => {
    const s = state as { plugins?: { eslint?: { scanStatus?: ScanStatus } } };
    return s.plugins?.eslint?.scanStatus === "scanning";
  },
};

/**
 * Clear ESLint results and re-scan
 */
const clearAndRescanCommand: Command = {
  id: "eslint:clear-rescan",
  title: "Clear & Rescan",
  keywords: ["eslint", "cache", "clear", "refresh", "reset", "rescan"],
  category: "eslint",
  subtitle: "Clear cached results and re-scan all files",
  execute: (services: PluginServices) => {
    const state = services.getState<{
      plugins: {
        eslint?: {
          scanStatus: ScanStatus;
          clearIssues: () => void;
          startScanning: () => void;
        };
      };
    }>();

    const eslint = state.plugins.eslint;
    if (!eslint) {
      console.warn("[ESLint Command] ESLint plugin slice not found");
      return;
    }

    // Clear issues and restart scanning
    eslint.clearIssues();
    eslint.startScanning();

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
  toggleScanCommand,
  startScanCommand,
  stopScanCommand,
  openFixesInspectorCommand,
  clearAndRescanCommand,
];
