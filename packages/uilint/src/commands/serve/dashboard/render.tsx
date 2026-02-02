/**
 * Render the dashboard using Ink
 */

import React from "react";
import { render } from "ink";
import { ServeDashboard } from "./ServeDashboard.js";

export interface RenderOptions {
  onQuit?: () => void;
  onRebuildIndex?: () => void;
}

/**
 * Render the dashboard and return cleanup function
 */
export function renderDashboard(options: RenderOptions = {}): {
  unmount: () => void;
  waitUntilExit: () => Promise<void>;
} {
  const { unmount, waitUntilExit } = render(
    <ServeDashboard
      onQuit={options.onQuit}
      onRebuildIndex={options.onRebuildIndex}
    />
  );

  return { unmount, waitUntilExit };
}
