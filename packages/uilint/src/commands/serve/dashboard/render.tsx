/**
 * Render the dashboard using Ink
 */

import React from "react";
import { render } from "ink";
import { ServeDashboard } from "./ServeDashboard.js";
import { getDashboardStore } from "./store.js";

export interface RenderOptions {
  onQuit?: () => void;
  onRebuildIndex?: () => void;
}

/**
 * Intercept console.log/error/warn so stray output from ESLint rules,
 * child processes, etc. is routed to the dashboard activity log instead
 * of corrupting the Ink terminal UI.  Returns a restore function.
 */
function interceptConsole(): () => void {
  const origLog = console.log;
  const origError = console.error;
  const origWarn = console.warn;

  const route = (type: "info" | "error" | "warning", args: unknown[]) => {
    const message = args.map(String).join(" ");
    if (!message.trim()) return;
    getDashboardStore().addActivity({
      type,
      message,
      isError: type === "error",
      isWarning: type === "warning",
    });
  };

  console.log = (...args: unknown[]) => route("info", args);
  console.error = (...args: unknown[]) => route("error", args);
  console.warn = (...args: unknown[]) => route("warning", args);

  return () => {
    console.log = origLog;
    console.error = origError;
    console.warn = origWarn;
  };
}

/**
 * Render the dashboard and return cleanup function
 */
export function renderDashboard(options: RenderOptions = {}): {
  unmount: () => void;
  waitUntilExit: () => Promise<void>;
} {
  // Clear the terminal so prior output doesn't mix with the Ink dashboard
  process.stdout.write("\x1B[2J\x1B[H");

  // Intercept console methods so stray output goes to the activity log
  const restoreConsole = interceptConsole();

  const { unmount: inkUnmount, waitUntilExit: inkWaitUntilExit } = render(
    <ServeDashboard
      onQuit={options.onQuit}
      onRebuildIndex={options.onRebuildIndex}
    />
  );

  return {
    unmount: () => {
      restoreConsole();
      inkUnmount();
    },
    waitUntilExit: () => inkWaitUntilExit().finally(restoreConsole),
  };
}
