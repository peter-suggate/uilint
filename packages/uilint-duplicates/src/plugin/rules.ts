/**
 * Duplicates Plugin Rules
 *
 * Rule definitions for the duplicates plugin.
 * Declarative - no React.
 */

import type { RuleDefinition } from "uilint-core";

/**
 * no-duplicates rule definition
 */
export const noDuplicatesRuleDefinition: RuleDefinition = {
  id: "no-duplicates",
  name: "No Duplicates",
  description: "Warns when code is semantically similar to existing code",
  category: "duplicates",
  icon: "copy",
  defaultSeverity: "warn",
  defaultEnabled: false,
  heatmapColor: "#f59e0b", // Amber
  customInspectorPanel: "duplicates",
  contentRenderer: "duplicate-comparison",
  requirements: [
    {
      type: "semantic-index",
      description: "Requires semantic index for duplicate detection",
      setupHint: "Run: uilint duplicates index",
    },
  ],
  defaultOptions: [
    {
      threshold: 0.75,
      indexPath: ".uilint/.duplicates-index",
      minLines: 3,
      confidenceLevel: "low",
      useStructuralBoost: true,
      includeSameFile: false,
      kind: "all",
    },
  ],
  optionSchema: {
    fields: [
      {
        key: "threshold",
        label: "Similarity Threshold",
        type: "number",
        defaultValue: 0.75,
        description: "Minimum similarity score (0-1) to report as duplicate.",
      },
      {
        key: "confidenceLevel",
        label: "Minimum Confidence",
        type: "select",
        defaultValue: "low",
        options: [
          { value: "high", label: "High (>90%) - Likely copy-paste" },
          { value: "medium", label: "Medium (>75%) - Semantically similar" },
          { value: "low", label: "Low (>60%) - Possibly related" },
        ],
        description: "Minimum confidence level for reported duplicates.",
      },
      {
        key: "kind",
        label: "Chunk Type",
        type: "select",
        defaultValue: "all",
        options: [
          { value: "all", label: "All" },
          { value: "component", label: "Components" },
          { value: "hook", label: "Hooks" },
          { value: "function", label: "Functions" },
        ],
        description: "Filter duplicates by code type.",
      },
      {
        key: "useStructuralBoost",
        label: "Use Structural Analysis",
        type: "boolean",
        defaultValue: true,
        description: "Include structural similarity (props, JSX, hooks) in scoring.",
      },
      {
        key: "includeSameFile",
        label: "Include Same-File Duplicates",
        type: "boolean",
        defaultValue: false,
        description: "Report duplicates within the same file.",
      },
      {
        key: "minLines",
        label: "Minimum Lines",
        type: "number",
        defaultValue: 3,
        description: "Minimum number of lines for a code chunk.",
      },
    ],
  },
  docs: `
## No Duplicates Rule

This rule detects code that is semantically similar to existing code in your codebase.

### How it Works

1. The codebase is indexed to extract "chunks" (components, hooks, functions)
2. Each chunk is embedded using an AI model to capture semantic meaning
3. During linting, chunks are compared against the index
4. Similar chunks above the threshold are reported

### Confidence Levels

- **High (>90%)**: Very likely copy-paste or near-identical code
- **Medium (>75%)**: Semantically similar, possibly refactorable
- **Low (>60%)**: Possibly related, worth reviewing

### Setup

1. Run \`uilint duplicates index\` to build the semantic index
2. Enable this rule in your ESLint config
3. The rule will report duplicates during linting

### Performance

The rule uses a pre-built index, so it's fast during linting.
Re-index periodically to keep the index up to date.
  `.trim(),
};

/**
 * All duplicates rule definitions
 */
export const duplicatesRuleDefinitions: RuleDefinition[] = [
  noDuplicatesRuleDefinition,
];
