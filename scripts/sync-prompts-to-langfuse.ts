#!/usr/bin/env npx tsx
/**
 * Sync UILint prompts to Langfuse for version tracking and analytics.
 *
 * This script reads the prompt templates from uilint-core and creates/updates
 * corresponding prompts in Langfuse. This allows you to:
 * - Track prompt versions over time
 * - Analyze which prompt versions produce better results
 * - Link traces to specific prompt versions
 *
 * Usage:
 *   pnpm langfuse:sync-prompts
 *
 * Environment variables required:
 *   LANGFUSE_PUBLIC_KEY
 *   LANGFUSE_SECRET_KEY
 *   LANGFUSE_BASE_URL (defaults to http://localhost:3333)
 */

import { LangfuseClient } from "@langfuse/client";

// Import the prompt builders from uilint-core
// Note: These are the source of truth - we're syncing TO Langfuse, not FROM
import {
  buildAnalysisPrompt,
  buildSourceAnalysisPrompt,
  buildSourceScanPrompt,
  buildStyleGuidePrompt,
} from "../packages/uilint-core/src/ollama/prompts.js";
import { buildConsistencyPrompt } from "../packages/uilint-core/src/consistency/prompts.js";

interface PromptDefinition {
  name: string;
  description: string;
  // Function to generate a sample prompt (used for uploading to Langfuse)
  getSamplePrompt: () => string;
  // Template with variables for Langfuse
  template: string;
  variables: string[];
}

// Define all prompts that should be synced to Langfuse
const PROMPTS: PromptDefinition[] = [
  {
    name: "uilint-style-analysis",
    description:
      "Analyzes extracted styles from DOM and identifies UI consistency violations",
    getSamplePrompt: () =>
      buildAnalysisPrompt(
        "Sample style summary with colors, fonts, etc.",
        "Sample style guide content"
      ),
    template: `You are a UI consistency analyzer. Analyze the following extracted styles and identify UI consistency violations.

## Current Style Guide
{{styleGuide}}

{{styleSummary}}

Respond with JSON ONLY. Return a single JSON object containing an "issues" array. Each issue should have:
- id: unique string identifier
- type: one of "color", "typography", "spacing", "component", "responsive", "accessibility"
- message: human-readable description of the issue
- currentValue: the problematic value found
- expectedValue: what it should be (if known from style guide)

IMPORTANT:
- Output ONLY violations. Do NOT include fix instructions, remediation steps, or "suggestions".
- Do NOT include extra top-level keys. Only return {"issues":[...]}.
- Keep messages short and neutral.

Focus on:
1. Similar but not identical colors (e.g., #3B82F6 vs #3575E2)
2. Inconsistent font sizes or weights
3. Spacing values that don't follow a consistent scale (e.g., 4px base unit)
4. Mixed border-radius values
5. If utility/Tailwind classes are present in the summary, treat them as the styling surface area and flag inconsistent utility usage (e.g., mixing px-4 and px-5 for the same component type)

Be minimal. Only report significant inconsistencies.`,
    variables: ["styleGuide", "styleSummary"],
  },
  {
    name: "uilint-source-analysis",
    description:
      "Analyzes raw source code (TSX/JSX) directly for UI consistency issues",
    getSamplePrompt: () =>
      buildSourceAnalysisPrompt(
        "const Button = () => <button>Click</button>",
        null
      ),
    template: `You are a UI consistency analyzer. Analyze the following UI source code and identify UI consistency violations.

{{styleGuideSection}}{{metaSection}}{{extraContext}}## Source Code (raw)
{{sourceCode}}

Respond with JSON ONLY. Return a single JSON object containing an "issues" array. Each issue should have:
- id: unique string identifier
- type: one of "color", "typography", "spacing", "component", "responsive", "accessibility"
- message: human-readable description of the issue
- currentValue: the problematic value found
- expectedValue: what it should be (if known from style guide)

IMPORTANT:
- Output ONLY violations. Do NOT include fix instructions, remediation steps, or "suggestions".
- Do NOT include extra top-level keys. Only return {"issues":[...]}.
- Keep messages short and neutral.

Focus on:
1. Inconsistent Tailwind/utility classes (e.g., mixing px-4 and px-5 for the same component type)
2. Inconsistent component variants (e.g., button sizes/radii/typography drift)
3. Hardcoded colors/spacing/typography that should use tokens/scale
4. Accessibility issues visible from code (e.g., missing labels, low-contrast combos if obvious)

Be minimal. Only report significant inconsistencies.`,
    variables: [
      "styleGuideSection",
      "metaSection",
      "extraContext",
      "sourceCode",
    ],
  },
  {
    name: "uilint-source-scan",
    description:
      "Scans source code for issues that can be mapped back to DOM via data-loc",
    getSamplePrompt: () =>
      buildSourceScanPrompt(
        "const Button = () => <button>Click</button>",
        null
      ),
    template: `You are a UI code reviewer. Analyze the following React/TypeScript UI code for style consistency issues.

{{styleGuideSection}}{{focusSection}}{{scopeText}}

{{dataLocSection}}## Source Code ({{fileLabel}})

\`\`\`tsx
{{sourceCode}}
\`\`\`

## Task

Identify any style inconsistencies, violations of best practices, or deviations from the style guide.
For each issue, provide:
- line: the line number in the source file
- message: a clear description of the issue
- dataLoc: the matching data-loc value from the list above (if applicable, to identify the specific element)

## Critical Requirements for dataLoc

- If "Element Locations (data-loc values)" are provided, ONLY report issues that correspond to one of those elements.
- When you include a dataLoc, it MUST be copied verbatim from the list (no shortening paths, no normalization).
- If you cannot match an issue to a provided dataLoc, omit that issue from the response.

Respond with JSON:
\`\`\`json
{
  "issues": [
    { "line": 12, "message": "Color #3575E2 should be #3B82F6 (primary blue from styleguide)", "dataLoc": "app/page.tsx:12:5" }
  ]
}
\`\`\`

If no issues are found, respond with:
\`\`\`json
{ "issues": [] }
\`\`\``,
    variables: [
      "styleGuideSection",
      "focusSection",
      "scopeText",
      "dataLocSection",
      "fileLabel",
      "sourceCode",
    ],
  },
  {
    name: "uilint-styleguide-generation",
    description: "Generates a style guide from detected styles",
    getSamplePrompt: () => buildStyleGuidePrompt("Sample style summary"),
    template: `You are a design system expert. Based on the following detected styles, generate a clean, organized style guide in Markdown format.

{{styleSummary}}

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

Be concise and focus on the most used values.`,
    variables: ["styleSummary"],
  },
  {
    name: "uilint-consistency",
    description:
      "Analyzes grouped UI elements for visual consistency violations",
    getSamplePrompt: () =>
      buildConsistencyPrompt({
        buttons: [],
        headings: [],
        cards: [],
        links: [],
        inputs: [],
        containers: [],
      }),
    template: `You are a UI consistency analyzer. Your task is to find visual inconsistencies between similar UI elements that SHOULD match but DON'T.

# Instructions

Analyze the following groups of UI elements. Within each group, elements should generally have consistent styling unless they're intentionally different (e.g., primary vs secondary buttons).

## What to FLAG (violations):
- Padding/spacing differences between similar elements (e.g., one button has 12px padding, another has 16px)
- Font size or weight inconsistencies within same element types
- Unintentional color variations (e.g., slightly different blues: #3B82F6 vs #3575E2)
- Border radius mismatches (e.g., one card has 8px radius, another has 12px)
- Shadow inconsistencies between similar components
- Heading hierarchy issues (h1 should be larger than h2, h2 larger than h3)

## What to NOT FLAG:
- Intentional variations (primary vs secondary buttons, different heading levels)
- Elements in different contexts that reasonably differ (header vs footer)
- Sub-2px differences (likely rounding or subpixel rendering)
- Different element types that shouldn't match

# Element Groups

{{elementGroups}}

# Response Format

Respond with JSON ONLY. Return a single JSON object with a "violations" array.

Each violation should have:
- elementIds: array of element IDs involved, e.g. ["el-3", "el-7"]
- category: one of "spacing", "color", "typography", "sizing", "borders", "shadows"
- severity: one of "error" (major inconsistency), "warning" (minor but noticeable), "info" (subtle)
- message: short human-readable description
- details: { property: the CSS property, values: array of differing values found, suggestion?: optional fix }

Be minimal. Only report significant inconsistencies. If no violations found, return {"violations": []}.`,
    variables: ["elementGroups"],
  },
];

async function main() {
  console.log("🔄 Syncing UILint prompts to Langfuse...\n");

  // Check for required environment variables
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL || "http://localhost:3333";

  if (!publicKey || !secretKey) {
    console.error("❌ Error: Missing required environment variables:");
    console.error("   LANGFUSE_PUBLIC_KEY");
    console.error("   LANGFUSE_SECRET_KEY");
    console.error(
      "\nMake sure Langfuse is running (pnpm langfuse:up) and you have API keys."
    );
    process.exit(1);
  }

  const langfuse = new LangfuseClient({
    publicKey,
    secretKey,
    baseUrl,
  });

  console.log(`📡 Connected to Langfuse at ${baseUrl}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const prompt of PROMPTS) {
    try {
      console.log(`  📝 Syncing: ${prompt.name}`);

      await langfuse.prompt.create({
        name: prompt.name,
        type: "text",
        prompt: prompt.template,
        config: {
          description: prompt.description,
          variables: prompt.variables,
          source: "uilint-core",
          syncedAt: new Date().toISOString(),
        },
        labels: ["synced-from-code"],
      });

      console.log(`     ✅ Created/updated: ${prompt.name}`);
      successCount++;
    } catch (error) {
      console.error(`     ❌ Failed: ${prompt.name}`);
      console.error(
        `        ${error instanceof Error ? error.message : String(error)}`
      );
      errorCount++;
    }
  }

  // Flush to ensure all requests are sent
  await langfuse.flush();

  console.log("\n" + "=".repeat(50));
  console.log(`✅ Synced: ${successCount} prompts`);
  if (errorCount > 0) {
    console.log(`❌ Failed: ${errorCount} prompts`);
  }
  console.log("=".repeat(50));

  if (errorCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
