/**
 * Styleguide Plugin Rules
 *
 * Rule definitions for the styleguide plugin.
 * Declarative - no React.
 */

import type { RuleDefinition } from "uilint-core";

/**
 * semantic rule definition (styleguide checking via LLM)
 */
export const semanticRuleDefinition: RuleDefinition = {
  id: "semantic",
  name: "Semantic Analysis",
  description: "LLM-powered semantic UI analysis using your styleguide",
  category: "styleguide",
  icon: "brain",
  defaultSeverity: "warn",
  defaultEnabled: false,
  heatmapColor: "#8b5cf6", // Purple
  customInspectorPanel: "semantic-issue",
  requirements: [
    {
      type: "ollama",
      description: "Requires Ollama running locally",
      setupHint: "Run: ollama serve && ollama pull qwen3-vl:8b-instruct",
    },
    {
      type: "styleguide",
      description: "Requires a styleguide file",
      setupHint: "Run: uilint genstyleguide",
    },
  ],
  defaultOptions: [
    {
      model: "qwen3-vl:8b-instruct",
      styleguidePath: ".uilint/styleguide.md",
    },
  ],
  optionSchema: {
    fields: [
      {
        key: "model",
        label: "Ollama Model",
        type: "text",
        defaultValue: "qwen3-vl:8b-instruct",
        description: "The Ollama model name for semantic analysis.",
      },
      {
        key: "styleguidePath",
        label: "Styleguide Path",
        type: "text",
        defaultValue: ".uilint/styleguide.md",
        description: "Relative path to the styleguide markdown file.",
      },
    ],
  },
  docs: `
## Semantic Analysis Rule

Uses a local LLM (via Ollama) to analyze your React components against your project's
styleguide. It catches semantic issues that pattern-based rules can't detect.

### How it Works

1. Your styleguide at \`.uilint/styleguide.md\` defines your conventions
2. The LLM analyzes each component against those conventions
3. Issues like incorrect spacing, inconsistent styles, and missing patterns are reported

### Prerequisites

1. **Ollama installed**: \`brew install ollama\` or from ollama.ai
2. **Model pulled**: \`ollama pull qwen3-vl:8b-instruct\`
3. **Styleguide created**: Create \`.uilint/styleguide.md\` describing your conventions

### Performance

- Results are cached based on file content and styleguide hash
- First run may be slow as the model loads; subsequent runs use cache
- Set to "off" in CI to avoid slow builds
  `.trim(),
};

/**
 * All styleguide rule definitions
 */
export const styleguideRuleDefinitions: RuleDefinition[] = [
  semanticRuleDefinition,
];
