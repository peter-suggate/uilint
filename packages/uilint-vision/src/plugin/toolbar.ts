/**
 * Vision Plugin Toolbar
 *
 * Toolbar action group definitions for the vision plugin.
 * Declarative - no React.
 */

import type { ToolbarGroupDefinition } from "uilint-core";

/**
 * Vision capture toolbar group
 */
export const visionToolbarGroup: ToolbarGroupDefinition = {
  id: "vision:capture",
  icon: "camera",
  tooltip: "Vision Capture",
  priority: 100,
  isVisible: { binding: "visionAvailable" },

  actions: [
    {
      id: "vision:capture-full",
      icon: "camera",
      tooltip: "Capture Full Page",
      action: { type: "capture-full-page" },
    },
    {
      id: "vision:capture-region",
      icon: "crop",
      tooltip: "Capture Region",
      action: { type: "enter-region-selection" },
    },
  ],
};

/**
 * All toolbar groups for the vision plugin
 */
export const visionToolbarGroups: ToolbarGroupDefinition[] = [visionToolbarGroup];
