/**
 * Vision Plugin Commands
 *
 * Command palette commands for the vision plugin.
 * Declarative - no React.
 */

import type { CommandDefinition } from "uilint-core";

/**
 * Vision plugin commands
 */
export const visionCommands: CommandDefinition[] = [
  {
    id: "vision:capture-full-page",
    title: "Capture Full Page",
    keywords: ["vision", "screenshot", "capture", "full", "page", "analyze"],
    category: "Vision",
    subtitle: "Capture and analyze the entire visible page",
    icon: "camera",
    shortcut: "Cmd+Shift+C",
    action: { type: "capture-full-page" },
    isAvailable: { binding: "visionAvailable" },
  },
  {
    id: "vision:capture-region",
    title: "Capture Region",
    keywords: ["vision", "screenshot", "capture", "region", "area", "select"],
    category: "Vision",
    subtitle: "Select a region of the page to capture and analyze",
    icon: "crop",
    shortcut: "Cmd+Shift+R",
    action: { type: "enter-region-selection" },
    isAvailable: { binding: "visionAvailable" },
  },
  {
    id: "vision:clear-screenshots",
    title: "Clear Screenshots",
    keywords: ["vision", "clear", "delete", "screenshots", "history"],
    category: "Vision",
    subtitle: "Clear all captured screenshots and cached results",
    icon: "trash",
    action: { type: "clear-screenshots" },
    isAvailable: { expression: "screenshotHistory.size > 0" },
  },
  {
    id: "vision:toggle-auto-scan-route",
    title: "Toggle Auto-Scan on Route Change",
    keywords: ["vision", "auto", "scan", "route", "change", "automatic"],
    category: "Vision",
    subtitle: "Automatically capture and analyze on route change",
    icon: "refresh",
    action: {
      type: "update-auto-scan-settings",
      payloadBindings: { onRouteChange: "!autoScanSettings.onRouteChange" },
    },
    isAvailable: { binding: "visionAvailable" },
  },
];
