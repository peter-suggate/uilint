"use client";

import React from "react";
import { UILintProvider } from "./components/ui-lint/UILintProvider";

export type DevToolProps = {
  enabled?: boolean;
};

/**
 * Main devtool React root.
 *
 * NOTE: UILintProvider is responsible for rendering the actual UI (toolbar, panels)
 * via portals, so this component renders no visible children itself.
 */
export function DevTool({ enabled = true }: DevToolProps) {
  return (
    <UILintProvider enabled={enabled}>
      <React.Fragment />
    </UILintProvider>
  );
}
