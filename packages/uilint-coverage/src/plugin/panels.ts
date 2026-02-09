import type { PanelDefinition } from "uilint-core";

export const coverageStatusPanelDefinition: PanelDefinition = {
  id: "coverage-status",
  title: "Coverage Status",
  priority: 5,
  layout: [
    {
      type: "badge",
      variant: "status",
      value: { binding: "preparation.status" },
      centered: true,
    },
    {
      type: "conditional",
      condition: { expression: "preparation.status === 'active'" },
      then: [
        {
          type: "progress",
          value: { binding: "progressPercent" },
          label: { binding: "preparation.progress.message" },
        },
      ],
    },
    {
      type: "conditional",
      condition: { expression: "preparation.status === 'complete'" },
      then: [
        {
          type: "text",
          content: { expression: "coverageAvailable ? fileCount + ' files covered' : 'No coverage data'" },
          variant: "body",
        },
      ],
    },
    {
      type: "conditional",
      condition: { expression: "preparation.status === 'error'" },
      then: [
        {
          type: "text",
          content: { binding: "preparation.lastError" },
          variant: "error",
        },
      ],
    },
    { type: "divider" },
    {
      type: "actions",
      direction: "column",
      actions: [
        {
          id: "regenerate-coverage",
          label: "Regenerate Coverage",
          icon: "refresh",
          variant: "secondary",
          action: { type: "start-preparation" },
          disabled: { binding: "isActive" },
        },
      ],
    },
  ],
};

export const coveragePanelDefinitions: PanelDefinition[] = [
  coverageStatusPanelDefinition,
];
