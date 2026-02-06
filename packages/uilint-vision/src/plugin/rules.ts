/**
 * Vision Plugin Rules
 *
 * Rule definitions for the vision plugin.
 * Declarative - no React.
 */

import type { RuleDefinition } from "uilint-core";

/**
 * semantic-vision rule definition
 */
export const semanticVisionRuleDefinition: RuleDefinition = {
  id: "semantic-vision",
  name: "Vision Analysis",
  description: "AI-powered visual UI consistency checking",
  category: "vision",
  icon: "eye",
  defaultSeverity: "warn",
  defaultEnabled: false,
  heatmapColor: "#8b5cf6", // Purple
  customInspectorPanel: "vision-issue",
  requirements: [
    {
      type: "ollama",
      description: "Requires Ollama with a vision model",
      setupHint: "Run: ollama pull qwen3-vl:8b-instruct",
    },
    {
      type: "connection",
      description: "Requires connection to uilint server",
      setupHint: "Run: uilint serve",
    },
  ],
  docs: `
## Vision Analysis Rule

This rule analyzes screenshots of your UI for visual consistency issues using AI vision models.

### Categories of Issues

- **Spacing**: Inconsistent margins, padding, or gaps
- **Alignment**: Elements not properly aligned
- **Color**: Color inconsistencies or accessibility issues
- **Typography**: Font size, weight, or style inconsistencies
- **Layout**: Layout problems or broken layouts
- **Contrast**: Insufficient contrast for accessibility
- **Visual Hierarchy**: Issues with visual importance/hierarchy

### Requirements

1. Ollama must be running with a vision model (qwen3-vl recommended)
2. The UILint server must be connected

### Usage

Capture screenshots using the Vision toolbar or command palette, and issues will be reported automatically.
  `.trim(),
};

/**
 * All vision rule definitions
 */
export const visionRuleDefinitions: RuleDefinition[] = [semanticVisionRuleDefinition];
