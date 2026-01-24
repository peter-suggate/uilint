#!/usr/bin/env node
/**
 * Ink-based init entry point
 *
 * This is a temporary wrapper to run the Ink UI init flow.
 * Usage: uilint init-ink [options]
 */

import { render } from "ink";
import React from "react";
import { InstallApp } from "./init/components/InstallApp.js";
import type { InstallItem } from "./init/types.js";

export interface InitInkOptions {
  force?: boolean;
  genstyleguide?: boolean;
  eslint?: boolean;
  skill?: boolean;
  routes?: boolean;
  react?: boolean;
  json?: boolean;
  nonInteractive?: boolean;
}

/**
 * Run the Ink-based init flow
 */
export async function initInk(options: InitInkOptions = {}): Promise<void> {
  const projectPath = process.cwd();

  // Build preselected items based on flags
  const preselected: InstallItem[] = [];
  if (options.genstyleguide) preselected.push("genstyleguide");
  if (options.eslint) preselected.push("eslint");
  if (options.skill) preselected.push("skill");
  if (options.routes || options.react) preselected.push("next-overlay");

  return new Promise((resolve, reject) => {
    const { waitUntilExit } = render(
      React.createElement(InstallApp, {
        projectPath,
        preselected,
        onComplete: (result) => {
          waitUntilExit().then(() => {
            if (result.success) {
              resolve();
            } else {
              reject(new Error("Installation completed with errors"));
            }
          });
        },
        onError: (error) => {
          waitUntilExit().then(() => reject(error));
        },
        exitOnComplete: true,
      })
    );
  });
}
