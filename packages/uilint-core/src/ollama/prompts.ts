/**
 * LLM prompt builders for UILint analysis
 */

/**
 * Builds a prompt for style analysis
 */
export function buildAnalysisPrompt(
  styleSummary: string,
  styleGuide: string | null
): string {
  const guideSection = styleGuide
    ? `## Current Style Guide\n${styleGuide}\n\n`
    : "## No Style Guide Found\nAnalyze the styles and identify inconsistencies.\n\n";

  return `You are a UI consistency analyzer. Analyze the following extracted styles and identify inconsistencies.

${guideSection}

${styleSummary}

Respond with a JSON object containing an "issues" array. Each issue should have:
- id: unique string identifier
- type: one of "color", "typography", "spacing", "component", "responsive", "accessibility"
- message: human-readable description of the issue
- currentValue: the problematic value found
- expectedValue: what it should be (if known from style guide)
- suggestion: how to fix it

Focus on:
1. Similar but not identical colors (e.g., #3B82F6 vs #3575E2)
2. Inconsistent font sizes or weights
3. Spacing values that don't follow a consistent scale (e.g., 4px base unit)
4. Mixed border-radius values
5. If utility/Tailwind classes are present in the summary, treat them as the styling surface area and flag inconsistent utility usage (e.g., mixing px-4 and px-5 for the same component type)

Be concise and actionable. Only report significant inconsistencies.

Example response:
{
  "issues": [
    {
      "id": "color-1",
      "type": "color",
      "message": "Found similar blue colors that should be consolidated",
      "currentValue": "#3575E2",
      "expectedValue": "#3B82F6",
      "suggestion": "Use the primary blue #3B82F6 consistently"
    }
  ]
}`;
}

/**
 * Builds a prompt for style guide generation
 */
export function buildStyleGuidePrompt(styleSummary: string): string {
  return `You are a design system expert. Based on the following detected styles, generate a clean, organized style guide in Markdown format.

${styleSummary}

Generate a style guide with these sections:
1. Colors - List the main colors with semantic names (Primary, Secondary, etc.)
2. Typography - Font families, sizes, and weights
3. Spacing - Base unit and common spacing values
4. Components - Common component patterns
5. Tailwind (if utility classes are present) - list commonly used utilities and any relevant theme tokens

Use this format:
# UI Style Guide

## Colors
- **Primary**: #HEXCODE (usage description)
- **Secondary**: #HEXCODE (usage description)
...

## Typography
- **Font Family**: FontName
- **Font Sizes**: list of sizes
- **Font Weights**: list of weights

## Spacing
- **Base unit**: Xpx
- **Common values**: list of values

## Components
- **Buttons**: styles
- **Cards**: styles
...

Be concise and focus on the most used values.`;
}
