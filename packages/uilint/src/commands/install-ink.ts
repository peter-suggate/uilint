#!/usr/bin/env node
/**
 * Ink-based installer entry point
 * 
 * This is a temporary wrapper to run the new Ink UI installer.
 * Usage: uilint install-ink [options]
 */

import { render } from "ink";
import React from "react";
import { InstallApp } from "./install/components/InstallApp.js";
import type { InstallItem } from "./install/types.js";

export interface InstallInkOptions {
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
 * Run the Ink-based installer
 */
export async function installInk(options: InstallInkOptions = {}): Promise<void> {
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
