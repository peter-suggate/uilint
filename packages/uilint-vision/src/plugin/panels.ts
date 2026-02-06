/**
 * Vision Plugin Panels
 *
 * Inspector panel definitions for the vision plugin.
 * Declarative - no React.
 */

import type { PanelDefinition } from "uilint-core";

/**
 * Vision issue inspector panel
 */
export const visionIssuePanelDefinition: PanelDefinition = {
  id: "vision-issue",
  title: { binding: "issue.category" },
  priority: 10,

  empty: {
    when: { expression: "!issue" },
    message: "No vision issue selected.",
    icon: "eye",
  },

  layout: [
    // Header with message
    {
      type: "header",
      icon: "eye",
      text: { binding: "issue.message" },
      sticky: true,
    },

    // Severity badge
    {
      type: "badge",
      variant: "severity",
      value: { binding: "issue.severity" },
      centered: false,
    },

    // Category badge
    {
      type: "badge",
      variant: "category",
      value: { binding: "issue.category" },
      centered: false,
    },

    // Element text (if available)
    {
      type: "conditional",
      condition: { binding: "issue.elementText" },
      then: [
        {
          type: "text",
          content: { binding: "issue.elementText" },
          variant: "caption",
        },
      ],
    },

    // Suggestion (if available)
    {
      type: "conditional",
      condition: { binding: "issue.suggestion" },
      then: [
        { type: "divider", spacing: "small" },
        {
          type: "header",
          icon: "sparkles",
          text: "Suggestion",
        },
        {
          type: "text",
          content: { binding: "issue.suggestion" },
          variant: "body",
        },
      ],
    },

    { type: "divider", spacing: "medium" },

    // Actions
    {
      type: "actions",
      direction: "column",
      actions: [
        {
          id: "focus-heatmap",
          label: "Focus in Heatmap",
          icon: "filter",
          variant: "secondary",
          action: {
            type: "focus-heatmap",
            payloadBindings: { dataLoc: "issue.dataLoc" },
          },
          visible: { binding: "issue.dataLoc" },
        },
        {
          id: "open-editor",
          label: "Open in Editor",
          icon: "external-link",
          variant: "ghost",
          action: {
            type: "open-editor",
            payloadBindings: { dataLoc: "issue.dataLoc" },
          },
          visible: { binding: "issue.dataLoc" },
        },
      ],
    },
  ],
};

/**
 * Screenshot gallery panel
 */
export const screenshotGalleryPanelDefinition: PanelDefinition = {
  id: "vision-gallery",
  title: "Screenshots",
  priority: 5,

  empty: {
    when: { expression: "screenshots.length === 0" },
    message: "No screenshots captured yet.",
    submessage: "Use the capture button to take a screenshot.",
    icon: "camera",
  },

  layout: [
    {
      type: "list",
      items: { binding: "screenshots" },
      itemLayout: [
        {
          type: "card",
          thumbnail: { binding: "item.dataUrl" },
          title: { binding: "item.route" },
          subtitle: { binding: "item.timestamp" },
          badge: {
            variant: "count",
            value: { binding: "item.issues.length" },
            label: "issues",
          },
          onClick: {
            type: "select-capture",
            payloadBindings: { captureId: "item.id" },
          },
        },
      ],
    },
  ],
};

/**
 * All vision panel definitions
 */
export const visionPanelDefinitions: PanelDefinition[] = [
  visionIssuePanelDefinition,
  screenshotGalleryPanelDefinition,
];
