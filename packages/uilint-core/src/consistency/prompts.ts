/**
 * LLM prompt builders for UI consistency analysis
 */

import type {
  ElementSnapshot,
  GroupedSnapshot,
  ElementRole,
} from "./types.js";

/**
 * Formats an element for inclusion in the prompt (minimal data for LLM)
 */
function formatElement(el: ElementSnapshot): string {
  const parts = [
    `id: ${el.id}`,
    `text: "${el.text}"`,
    el.component ? `component: ${el.component}` : null,
    `context: ${el.context || "root"}`,
  ].filter(Boolean);

  // Only include non-empty style values
  const styleEntries = Object.entries(el.styles).filter(
    ([, v]) => v && v !== "0px" && v !== "none" && v !== "normal"
  );
  if (styleEntries.length > 0) {
    const styleStr = styleEntries.map(([k, v]) => `${k}: ${v}`).join(", ");
    parts.push(`styles: { ${styleStr} }`);
  }

  if (el.rect.width > 0 || el.rect.height > 0) {
    parts.push(`size: ${Math.round(el.rect.width)}x${Math.round(el.rect.height)}`);
  }

  return `  { ${parts.join(", ")} }`;
}

/**
 * Formats a group of elements for the prompt
 */
function formatGroup(
  groupName: string,
  elements: ElementSnapshot[]
): string | null {
  if (elements.length < 2) return null;

  const lines = [`## ${groupName} (${elements.length} elements)`];
  elements.forEach((el) => {
    lines.push(formatElement(el));
  });
  return lines.join("\n");
}

/**
 * Builds a single prompt for analyzing ALL element groups
 * This reduces LLM calls to 1 for better performance
 */
export function buildConsistencyPrompt(snapshot: GroupedSnapshot): string {
  const groupSections: string[] = [];

  // Format each group that has 2+ elements
  const groups: Array<{ name: string; key: keyof GroupedSnapshot }> = [
    { name: "Buttons", key: "buttons" },
    { name: "Headings", key: "headings" },
    { name: "Cards", key: "cards" },
    { name: "Links", key: "links" },
    { name: "Inputs", key: "inputs" },
    { name: "Containers", key: "containers" },
  ];

  for (const { name, key } of groups) {
    const section = formatGroup(name, snapshot[key]);
    if (section) {
      groupSections.push(section);
    }
  }

  if (groupSections.length === 0) {
    return "No element groups with 2+ elements found for consistency analysis.";
  }

  return `You are a UI consistency analyzer. Your task is to find visual inconsistencies between similar UI elements that SHOULD match but DON'T.

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

${groupSections.join("\n\n")}

# Response Format

Respond with JSON ONLY. Return a single JSON object with a "violations" array.

Each violation should have:
- elementIds: array of element IDs involved, e.g. ["el-3", "el-7"]
- category: one of "spacing", "color", "typography", "sizing", "borders", "shadows"
- severity: one of "error" (major inconsistency), "warning" (minor but noticeable), "info" (subtle)
- message: short human-readable description
- details: { property: the CSS property, values: array of differing values found, suggestion?: optional fix }

Example response:
{
  "violations": [
    {
      "elementIds": ["el-3", "el-7"],
      "category": "spacing",
      "severity": "warning",
      "message": "Inconsistent padding on buttons",
      "details": {
        "property": "padding",
        "values": ["12px 24px", "16px 32px"],
        "suggestion": "Use consistent padding of 12px 24px"
      }
    }
  ]
}

Be minimal. Only report significant inconsistencies. If no violations found, return {"violations": []}.`;
}

/**
 * Counts total elements across all groups
 */
export function countElements(snapshot: GroupedSnapshot): number {
  return (
    snapshot.buttons.length +
    snapshot.headings.length +
    snapshot.cards.length +
    snapshot.links.length +
    snapshot.inputs.length +
    snapshot.containers.length
  );
}

/**
 * Checks if a snapshot has any groups worth analyzing (2+ elements)
 */
export function hasAnalyzableGroups(snapshot: GroupedSnapshot): boolean {
  return (
    snapshot.buttons.length >= 2 ||
    snapshot.headings.length >= 2 ||
    snapshot.cards.length >= 2 ||
    snapshot.links.length >= 2 ||
    snapshot.inputs.length >= 2 ||
    snapshot.containers.length >= 2
  );
}
