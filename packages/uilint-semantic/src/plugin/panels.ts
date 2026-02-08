/**
 * Styleguide Plugin Panels
 *
 * Inspector panel definitions for the styleguide plugin.
 * Declarative - no React.
 */

import type { PanelDefinition } from "uilint-core";

/**
 * Styleguide status panel
 */
export const styleguideStatusPanelDefinition: PanelDefinition = {
  id: "styleguide-status",
  title: "Styleguide Status",
  priority: 5,

  layout: [
    // Styleguide loaded status
    {
      type: "badge",
      variant: "status",
      value: {
        condition: { binding: "styleguideLoaded" },
        true: "Styleguide Loaded",
        false: "No Styleguide",
      },
      centered: true,
    },

    // Styleguide path (when loaded)
    {
      type: "conditional",
      condition: { binding: "styleguideLoaded" },
      then: [
        {
          type: "text",
          content: { binding: "styleguidePath" },
          variant: "caption",
        },
      ],
      else: [
        {
          type: "text",
          content: "Create a styleguide at .uilint/styleguide.md to enable LLM-powered analysis.",
          variant: "body",
        },
      ],
    },

    { type: "divider", spacing: "small" },

    // Model availability
    {
      type: "badge",
      variant: "status",
      value: {
        condition: { binding: "modelAvailable" },
        true: "Model Ready",
        false: "Model Unavailable",
      },
      centered: true,
    },

    // Model name
    {
      type: "text",
      content: { binding: "modelName" },
      variant: "caption",
    },

    // Analysis progress (when analyzing)
    {
      type: "conditional",
      condition: { expression: "analysisStatus === 'analyzing'" },
      then: [
        {
          type: "progress",
          value: { binding: "progressPercent" },
          label: { binding: "analysisProgress.filePath" },
        },
      ],
    },

    // Error (when error)
    {
      type: "conditional",
      condition: { expression: "analysisStatus === 'error'" },
      then: [
        {
          type: "text",
          content: { binding: "lastAnalysisError" },
          variant: "error",
        },
      ],
    },

    // Stats (when analysis complete)
    {
      type: "conditional",
      condition: { expression: "analysisStatus === 'complete'" },
      then: [
        {
          type: "text",
          content: { binding: "analyzedFileCount" },
          variant: "body",
        },
      ],
    },

    { type: "divider" },

    // Actions
    {
      type: "actions",
      direction: "column",
      actions: [
        {
          id: "check-status",
          label: "Check Status",
          icon: "check-circle",
          variant: "secondary",
          action: { type: "check-styleguide-status" },
        },
        {
          id: "reload-styleguide",
          label: "Reload Styleguide",
          icon: "refresh",
          variant: "secondary",
          action: { type: "reload-styleguide" },
          disabled: { expression: "!styleguideLoaded" },
        },
      ],
    },
  ],
};

/**
 * All styleguide panel definitions
 */
export const styleguidePanelDefinitions: PanelDefinition[] = [
  styleguideStatusPanelDefinition,
];
