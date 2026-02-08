/**
 * Duplicates Plugin Panels
 *
 * Inspector panel definitions for the duplicates plugin.
 * Declarative - no React.
 */

import type { PanelDefinition } from "uilint-core";

/**
 * Duplicates inspector panel
 */
export const duplicatesPanelDefinition: PanelDefinition = {
  id: "duplicates",
  title: "Duplicate Code",
  priority: 10,

  loading: {
    when: { binding: "isLoading" },
    message: "Loading code comparison...",
  },

  empty: {
    when: { expression: "!sourceCode && !targetCode" },
    message: "No duplicate information available.",
    icon: "search",
  },

  layout: [
    // Similarity badge
    {
      type: "badge",
      variant: "similarity",
      value: { binding: "similarity" },
      centered: true,
    },

    // Source code section
    {
      type: "code-viewer",
      label: "This Code",
      icon: "target",
      code: {
        fetch: {
          type: "source-code",
          params: {
            filePath: { binding: "sourceLocation.filePath" },
            line: { binding: "sourceLocation.startLine" },
            contextAbove: 10,
            contextBelow: 10,
          },
        },
      },
      location: { binding: "sourceLocation" },
      diffHighlighting: true,
      maxHeight: 250,
      onNavigate: {
        type: "open-editor",
        payloadBindings: { dataLoc: "sourceDataLoc" },
      },
    },

    // Target code section
    {
      type: "code-viewer",
      label: "Similar Code",
      icon: "link",
      code: {
        fetch: {
          type: "source-code",
          params: {
            filePath: { binding: "targetLocation.filePath" },
            line: { binding: "targetLocation.startLine" },
            contextAbove: 10,
            contextBelow: 10,
          },
        },
      },
      location: { binding: "targetLocation" },
      diffHighlighting: true,
      maxHeight: 250,
      onNavigate: {
        type: "open-editor",
        payloadBindings: { dataLoc: "targetDataLoc" },
      },
    },

    { type: "divider", spacing: "medium" },

    // Actions
    {
      type: "actions",
      direction: "row",
      actions: [
        {
          id: "toggle-heatmap",
          label: {
            condition: { binding: "heatmapFilterActive" },
            true: "Clear Heatmap Filter",
            false: "Focus in Heatmap",
          },
          icon: "filter",
          variant: "primary",
          action: {
            type: "toggle-heatmap-filter",
            payloadBindings: {
              sourceDataLoc: "sourceDataLoc",
              targetDataLoc: "targetDataLoc",
            },
          },
        },
      ],
    },
  ],
};

/**
 * Index status panel
 */
export const indexStatusPanelDefinition: PanelDefinition = {
  id: "duplicates-index-status",
  title: "Index Status",
  priority: 5,

  layout: [
    // Status badge
    {
      type: "badge",
      variant: "status",
      value: { binding: "indexStatus" },
      centered: true,
    },

    // Progress (when indexing)
    {
      type: "conditional",
      condition: { expression: "indexStatus === 'indexing'" },
      then: [
        {
          type: "progress",
          value: { binding: "progressPercent" },
          label: { binding: "indexProgress.message" },
        },
      ],
    },

    // Stats (when ready)
    {
      type: "conditional",
      condition: { expression: "indexStatus === 'ready' && indexStats" },
      then: [
        {
          type: "text",
          content: { binding: "indexStats.totalChunks" },
          variant: "body",
        },
      ],
    },

    // Error (when error)
    {
      type: "conditional",
      condition: { expression: "indexStatus === 'error'" },
      then: [
        {
          type: "text",
          content: { binding: "lastIndexError" },
          variant: "error",
        },
      ],
    },

    { type: "divider" },

    // Rebuild action
    {
      type: "actions",
      direction: "column",
      actions: [
        {
          id: "rebuild-index",
          label: "Rebuild Index",
          icon: "refresh",
          variant: "secondary",
          action: { type: "start-indexing" },
          disabled: { binding: "isIndexing" },
        },
      ],
    },
  ],
};

/**
 * All duplicates panel definitions
 */
export const duplicatesPanelDefinitions: PanelDefinition[] = [
  duplicatesPanelDefinition,
  indexStatusPanelDefinition,
];
