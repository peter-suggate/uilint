/**
 * Rule: prefer-tailwind
 *
 * Encourages using Tailwind className over inline style attributes.
 * - Detects files with a high ratio of inline `style` vs `className` usage
 * - Warns at each element using style without className when ratio exceeds threshold
 * - When preferSemanticColors is enabled, warns against hard-coded colors
 * - When useLlmSuggestions is enabled, uses Ollama to suggest semantic replacements
 */

import { readFileSync } from "fs";
import { dirname } from "path";
import { createRule, defineRuleMeta } from "../../utils/create-rule.js";
import type { TSESTree } from "@typescript-eslint/utils";
import {
  getColorSuggestions,
  formatSuggestionsForMessage,
} from "./lib/color-suggester.js";

type MessageIds =
  | "preferTailwind"
  | "preferSemanticColors"
  | "preferSemanticColorsWithSuggestion"
  | "preferSemanticClassGroups"
  | "semanticOpacityModifier";
type Options = [
  {
    /** Minimum ratio of style-only elements before warnings trigger (0-1). Default: 0.3 */
    styleRatioThreshold?: number;
    /** Don't warn if file has fewer than N JSX elements with styling. Default: 3 */
    minElementsForAnalysis?: number;
    /** Style properties to ignore (e.g., ["transform", "animation"] for dynamic values). Default: [] */
    allowedStyleProperties?: string[];
    /** Component names to skip (e.g., ["motion.div", "animated.View"]). Default: [] */
    ignoreComponents?: string[];
    /** Prefer semantic colors (bg-destructive) over hard-coded (bg-red-500). Default: true */
    preferSemanticColors?: boolean;
    /** Hard-coded color names to allow when preferSemanticColors is enabled. Default: [] */
    allowedHardCodedColors?: string[];
    /** Use LLM (Ollama) to suggest semantic color replacements. Default: false */
    useLlmSuggestions?: boolean;
    /** Prefer semantic component classes over dense visual utility clusters. Default: true */
    preferSemanticClassGroups?: boolean;
    /** Number of visual utilities on one element/class string before warning. Default: 4 */
    visualUtilityThreshold?: number;
    /** Minimum distinct visual utility groups before warning. Default: 2 */
    visualUtilityMinGroups?: number;
    /** Disallow opacity modifiers on semantic color tokens. Default: true */
    disallowSemanticOpacityModifiers?: boolean;
    /** Exact classes to allow even when they use semantic opacity modifiers. Default: [] */
    allowedOpacityModifierClasses?: string[];
    /** Exact classes to allow in visual utility cluster detection. Default: [] */
    allowedVisualUtilityClasses?: string[];
  }?
];

/**
 * Rule metadata - colocated with implementation for maintainability
 */
export const meta = defineRuleMeta({
  id: "prefer-tailwind",
  version: "1.2.0",
  name: "Prefer Tailwind",
  description: "Encourage Tailwind className over inline style attributes",
  defaultSeverity: "warn",
  category: "static",
  icon: "🎨",
  hint: "Prefers className over inline styles",
  defaultEnabled: true,
  isDirectoryBased: true,
  defaultOptions: [
    {
      styleRatioThreshold: 0.3,
      minElementsForAnalysis: 3,
      allowedStyleProperties: [],
      ignoreComponents: [],
      preferSemanticColors: true,
      allowedHardCodedColors: [],
      useLlmSuggestions: false,
      preferSemanticClassGroups: true,
      visualUtilityThreshold: 4,
      visualUtilityMinGroups: 2,
      disallowSemanticOpacityModifiers: true,
      allowedOpacityModifierClasses: [],
      allowedVisualUtilityClasses: [],
    },
  ],
  optionSchema: {
    fields: [
      {
        key: "styleRatioThreshold",
        label: "Style ratio threshold",
        type: "number",
        defaultValue: 0.3,
        description:
          "Minimum ratio (0-1) of style-only elements before warnings trigger",
      },
      {
        key: "minElementsForAnalysis",
        label: "Minimum elements",
        type: "number",
        defaultValue: 3,
        description: "Don't warn if file has fewer styled elements than this",
      },
      {
        key: "allowedStyleProperties",
        label: "Allowed style properties",
        type: "text",
        defaultValue: "",
        description:
          "Comma-separated list of style properties to allow (e.g., transform,animation)",
      },
      {
        key: "ignoreComponents",
        label: "Ignored components",
        type: "text",
        defaultValue: "",
        description:
          "Comma-separated component names to skip (e.g., motion.div,animated.View)",
      },
      {
        key: "preferSemanticColors",
        label: "Prefer semantic colors",
        type: "boolean",
        defaultValue: true,
        description:
          "Warn against hard-coded colors (bg-red-500) in favor of semantic theme colors (bg-destructive)",
      },
      {
        key: "allowedHardCodedColors",
        label: "Allowed hard-coded colors",
        type: "text",
        defaultValue: "",
        description:
          "Comma-separated color names to allow when preferSemanticColors is enabled (e.g., gray,slate)",
      },
      {
        key: "useLlmSuggestions",
        label: "Use LLM suggestions",
        type: "boolean",
        defaultValue: false,
        description:
          "When enabled, uses Ollama to suggest semantic color replacements based on your project's theme",
      },
      {
        key: "preferSemanticClassGroups",
        label: "Prefer semantic class groups",
        type: "boolean",
        defaultValue: true,
        description:
          "Warn when one element uses many low-level visual utilities that should be captured by a semantic class",
      },
      {
        key: "visualUtilityThreshold",
        label: "Visual utility threshold",
        type: "number",
        defaultValue: 4,
        description:
          "Minimum number of visual utilities in one class string before warning",
      },
      {
        key: "visualUtilityMinGroups",
        label: "Visual utility group threshold",
        type: "number",
        defaultValue: 2,
        description:
          "Minimum number of distinct visual utility groups before warning",
      },
      {
        key: "disallowSemanticOpacityModifiers",
        label: "Disallow semantic opacity modifiers",
        type: "boolean",
        defaultValue: true,
        description:
          "Warn on token opacity like text-foreground/80 or border-border/40",
      },
      {
        key: "allowedOpacityModifierClasses",
        label: "Allowed opacity modifier classes",
        type: "text",
        defaultValue: "",
        description:
          "Comma-separated exact classes to allow with semantic opacity modifiers",
      },
      {
        key: "allowedVisualUtilityClasses",
        label: "Allowed visual utility classes",
        type: "text",
        defaultValue: "",
        description:
          "Comma-separated exact visual utility classes to ignore in cluster detection",
      },
    ],
  },
  docs: `
## What it does

Detects files with a high ratio of inline \`style\` attributes versus \`className\` usage
in JSX elements. Reports warnings on elements that use \`style\` without \`className\`,
but only when the file exceeds a configurable threshold ratio.

## Why it's useful

- **Consistency**: Encourages using Tailwind's utility classes for styling
- **Maintainability**: Tailwind classes are easier to read and maintain than inline styles
- **Performance**: Tailwind generates optimized CSS; inline styles can't be deduplicated
- **Theming**: Tailwind classes work with dark mode and responsive variants

## Examples

### ❌ Incorrect (when file exceeds threshold)

\`\`\`tsx
// Many elements using style without className
<div style={{ color: 'red' }}>Red text</div>
<span style={{ marginTop: '10px' }}>Spaced</span>
<p style={{ fontSize: '16px' }}>Paragraph</p>
\`\`\`

### ✅ Correct

\`\`\`tsx
// Using Tailwind className
<div className="text-red-500">Red text</div>
<span className="mt-2">Spaced</span>
<p className="text-base">Paragraph</p>

// Both style and className (acceptable for dynamic values)
<div className="p-4" style={{ backgroundColor: dynamicColor }}>Mixed</div>
\`\`\`

## Configuration

\`\`\`js
// eslint.config.js
"uilint/prefer-tailwind": ["warn", {
  styleRatioThreshold: 0.3,      // Warn when >30% of elements are style-only
  minElementsForAnalysis: 3,     // Need at least 3 styled elements to analyze
  allowedStyleProperties: ["transform", "animation"],  // Skip these properties
  ignoreComponents: ["motion.div", "animated.View"],   // Skip animation libraries
  preferSemanticColors: true,    // Warn on hard-coded colors like bg-red-500
  allowedHardCodedColors: ["gray", "slate"],  // Allow specific color palettes
  preferSemanticClassGroups: true,
  visualUtilityThreshold: 4,
  visualUtilityMinGroups: 2,
  disallowSemanticOpacityModifiers: true
}]
\`\`\`

## Semantic Colors

When \`preferSemanticColors\` is enabled, the rule warns against hard-coded Tailwind color classes
in favor of semantic theme colors:

### ❌ Hard-coded colors (when enabled)

\`\`\`tsx
<div className="bg-red-500 text-white">Error</div>
<button className="hover:bg-blue-600">Click</button>
\`\`\`

### ✅ Semantic colors (preferred)

\`\`\`tsx
<div className="bg-destructive text-destructive-foreground">Error</div>
<button className="hover:bg-primary">Click</button>
\`\`\`

Semantic colors like \`bg-background\`, \`text-foreground\`, \`bg-primary\`, \`bg-destructive\`,
\`bg-muted\`, etc. work better with theming and dark mode.

Colors that are always allowed: \`white\`, \`black\`, \`transparent\`, \`inherit\`, \`current\`.

## Semantic Class Groups

When \`preferSemanticClassGroups\` is enabled, the rule warns when a single
class string combines many low-level visual utilities such as background,
border, radius, shadow, gradient, ring/outline, blur, and decoration classes.
This catches generated component styling that should usually become a semantic
project class such as \`brand-panel\`, \`ui-cell\`, or \`surface-card\`.

### ❌ Dense visual utility cluster

\`\`\`tsx
<section className="bg-card rounded-2xl shadow-md border border-border/40" />
\`\`\`

### ✅ Semantic class

\`\`\`tsx
<section className="brand-panel" />
\`\`\`

## Semantic Opacity Modifiers

When \`disallowSemanticOpacityModifiers\` is enabled, semantic color tokens with
opacity suffixes are reported:

\`\`\`tsx
<p className="text-foreground/80" />
<div className="border-border/40 hover:bg-accent/50" />
\`\`\`

Prefer a fully semantic token such as \`text-muted-foreground\`, or define a new
theme token/class when the opacity represents a reusable state.

## LLM-Powered Suggestions

When \`useLlmSuggestions\` is enabled and Ollama is running locally, the rule will:
1. Auto-discover your project's semantic colors from \`globals.css\` and \`tailwind.config.*\`
2. Use the LLM to suggest appropriate semantic replacements for hard-coded colors
3. Include suggestions in the error message (e.g., "Hard-coded colors: bg-red-500. Try: bg-destructive")

Suggestions are cached based on file content and config files, so subsequent runs are fast.

\`\`\`js
// eslint.config.js - Enable LLM suggestions
"uilint/prefer-tailwind": ["warn", {
  preferSemanticColors: true,
  useLlmSuggestions: true  // Requires Ollama running locally
}]
\`\`\`

## Notes

- Elements with BOTH \`style\` and \`className\` are considered acceptable
- Files with few styled elements are not analyzed (prevents false positives)
- The rule uses a ratio-based approach to catch systematic patterns, not isolated cases
- Use \`allowedStyleProperties\` for dynamic values that can't use Tailwind
- Use \`ignoreComponents\` for animation libraries that require inline styles
`,
});

/**
 * Get the component name from a JSX opening element
 */
function getComponentName(node: TSESTree.JSXOpeningElement): string {
  const name = node.name;

  if (name.type === "JSXIdentifier") {
    return name.name;
  }

  if (name.type === "JSXMemberExpression") {
    // Handle motion.div, animated.View, etc.
    const parts: string[] = [];
    let current: TSESTree.JSXMemberExpression | TSESTree.JSXIdentifier = name;

    while (current.type === "JSXMemberExpression") {
      if (current.property.type === "JSXIdentifier") {
        parts.unshift(current.property.name);
      }
      current = current.object as
        | TSESTree.JSXMemberExpression
        | TSESTree.JSXIdentifier;
    }

    if (current.type === "JSXIdentifier") {
      parts.unshift(current.name);
    }

    return parts.join(".");
  }

  return "";
}

/**
 * Extract property names from a style object expression
 */
function getStylePropertyNames(
  value: TSESTree.JSXExpressionContainer
): string[] {
  const expr = value.expression;

  // Handle style={{ prop: value }}
  if (expr.type === "ObjectExpression") {
    return expr.properties
      .filter((prop): prop is TSESTree.Property => prop.type === "Property")
      .map((prop) => {
        if (prop.key.type === "Identifier") {
          return prop.key.name;
        }
        if (prop.key.type === "Literal" && typeof prop.key.value === "string") {
          return prop.key.value;
        }
        return "";
      })
      .filter(Boolean);
  }

  // For style={variable} or style={{...spread}}, we can't determine properties
  return [];
}

/**
 * Check if all style properties are in the allowed list
 */
function hasOnlyAllowedProperties(
  styleProperties: string[],
  allowedProperties: string[]
): boolean {
  if (allowedProperties.length === 0 || styleProperties.length === 0) {
    return false;
  }

  return styleProperties.every((prop) => allowedProperties.includes(prop));
}

interface ElementInfo {
  node: TSESTree.JSXOpeningElement;
  hasStyle: boolean;
  hasClassName: boolean;
  styleProperties: string[];
}

/**
 * Tailwind color names that should use semantic alternatives
 * Excludes neutral colors that are often acceptable
 */
const HARD_CODED_COLOR_NAMES = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
];

/**
 * Regex to match hard-coded Tailwind color classes
 * Matches patterns like: bg-red-500, text-blue-600/50, hover:bg-green-400, dark:text-slate-100
 * Color utilities: bg, text, border, ring, outline, decoration, accent, fill, stroke,
 *                  from, via, to (gradients), divide, placeholder, caret, shadow
 */
function createHardCodedColorRegex(colorNames: string[]): RegExp {
  const colorPattern = colorNames.join("|");
  // Match color utilities with color-shade pattern, optional opacity, with optional variant prefixes
  return new RegExp(
    `(?:^|\\s)(?:[a-z-]+:)*(?:bg|text|border|ring|outline|decoration|accent|fill|stroke|from|via|to|divide|placeholder|caret|shadow)-(${colorPattern})-\\d{1,3}(?:/\\d{1,3})?(?=\\s|$)`,
    "g"
  );
}

/**
 * Check if a className string contains hard-coded color classes
 */
function findHardCodedColors(
  className: string,
  allowedColors: string[]
): string[] {
  const disallowedColorNames = HARD_CODED_COLOR_NAMES.filter(
    (c) => !allowedColors.includes(c)
  );

  if (disallowedColorNames.length === 0) return [];

  const regex = createHardCodedColorRegex(disallowedColorNames);
  const matches: string[] = [];
  let match;

  while ((match = regex.exec(className)) !== null) {
    matches.push(match[0].trim());
  }

  return matches;
}

const CLASS_COMBINER_NAMES = new Set([
  "cn",
  "clsx",
  "classnames",
  "cva",
  "twMerge",
]);

type VisualUtilityGroup =
  | "surface"
  | "border"
  | "radius"
  | "shadow"
  | "gradient"
  | "ring"
  | "blur"
  | "decoration";

const COLOR_UTILITY_PREFIXES = [
  "bg",
  "text",
  "border",
  "border-t",
  "border-r",
  "border-b",
  "border-l",
  "border-x",
  "border-y",
  "ring",
  "ring-offset",
  "outline",
  "decoration",
  "accent",
  "fill",
  "stroke",
  "from",
  "via",
  "to",
  "divide",
  "placeholder",
  "caret",
];

const NON_SEMANTIC_COLOR_VALUES = new Set([
  "black",
  "white",
  "transparent",
  "inherit",
  "current",
  "currentColor",
]);

const TEXT_SIZE_VALUES = new Set([
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl",
]);

const BORDER_WIDTH_VALUES = new Set(["0", "2", "4", "8"]);
const SHADOW_SIZE_VALUES = new Set([
  "2xs",
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "inner",
  "none",
]);

interface ClassToken {
  original: string;
  base: string;
}

interface VisualMatch {
  token: string;
  group: VisualUtilityGroup;
}

function stripImportant(value: string): string {
  return value.replace(/^!/, "").replace(/!$/, "");
}

function getBaseClass(token: string): string {
  let bracketDepth = 0;
  let lastVariantColon = -1;

  for (let i = 0; i < token.length; i++) {
    const char = token[i];
    if (char === "[") {
      bracketDepth++;
    } else if (char === "]" && bracketDepth > 0) {
      bracketDepth--;
    } else if (char === ":" && bracketDepth === 0) {
      lastVariantColon = i;
    }
  }

  return stripImportant(token.slice(lastVariantColon + 1));
}

function extractClassTokens(className: string): ClassToken[] {
  return className
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => ({
      original: token,
      base: getBaseClass(token),
    }));
}

function classIsAllowed(token: ClassToken, allowedClasses: string[]): boolean {
  return (
    allowedClasses.includes(token.original) || allowedClasses.includes(token.base)
  );
}

function getColorUtilityPrefix(baseClass: string): string | null {
  for (const prefix of COLOR_UTILITY_PREFIXES) {
    if (baseClass === prefix || baseClass.startsWith(`${prefix}-`)) {
      return prefix;
    }
  }

  return null;
}

function getUtilityValue(baseClass: string, prefix: string): string {
  if (baseClass === prefix) return "";
  return baseClass.slice(prefix.length + 1);
}

function isBracketColorValue(value: string): boolean {
  return (
    value.startsWith("[") &&
    (value.includes("var(") ||
      value.startsWith("[color:") ||
      value.startsWith("[--") ||
      value.includes("oklch(") ||
      value.includes("rgb(") ||
      value.includes("hsl("))
  );
}

function isHardCodedTailwindColorValue(value: string): boolean {
  const [name, shade] = value.split("-");
  return HARD_CODED_COLOR_NAMES.includes(name) && /^\d{1,3}$/.test(shade ?? "");
}

function isSemanticColorValue(value: string, prefix: string): boolean {
  if (!value) return false;
  if (NON_SEMANTIC_COLOR_VALUES.has(value)) return false;
  if (prefix === "text" && TEXT_SIZE_VALUES.has(value)) return false;
  if (prefix.startsWith("border") && BORDER_WIDTH_VALUES.has(value)) return false;
  if (prefix === "shadow" && SHADOW_SIZE_VALUES.has(value)) return false;
  if (isHardCodedTailwindColorValue(value)) return false;
  if (value.startsWith("[")) return isBracketColorValue(value);
  return true;
}

function getVisualUtilityGroup(baseClass: string): VisualUtilityGroup | null {
  if (
    baseClass === "border" ||
    baseClass.startsWith("border-") ||
    baseClass.startsWith("divide-")
  ) {
    return "border";
  }

  if (baseClass === "rounded" || baseClass.startsWith("rounded-")) {
    return "radius";
  }

  if (
    baseClass === "shadow" ||
    baseClass.startsWith("shadow-") ||
    baseClass === "drop-shadow" ||
    baseClass.startsWith("drop-shadow-")
  ) {
    return "shadow";
  }

  if (
    baseClass.startsWith("bg-gradient-") ||
    baseClass.startsWith("from-") ||
    baseClass.startsWith("via-") ||
    baseClass.startsWith("to-")
  ) {
    return "gradient";
  }

  if (
    baseClass === "ring" ||
    baseClass.startsWith("ring-") ||
    baseClass === "outline" ||
    baseClass.startsWith("outline-")
  ) {
    return "ring";
  }

  if (
    baseClass === "blur" ||
    baseClass.startsWith("blur-") ||
    baseClass === "backdrop-blur" ||
    baseClass.startsWith("backdrop-blur-")
  ) {
    return "blur";
  }

  if (
    baseClass.startsWith("decoration-") ||
    baseClass.startsWith("accent-") ||
    baseClass.startsWith("fill-") ||
    baseClass.startsWith("stroke-")
  ) {
    return "decoration";
  }

  if (baseClass.startsWith("bg-")) {
    return "surface";
  }

  const prefix = getColorUtilityPrefix(baseClass);
  if (prefix) {
    const value = getUtilityValue(baseClass, prefix).split("/")[0] ?? "";
    if (isSemanticColorValue(value, prefix) || isBracketColorValue(value)) {
      return "surface";
    }
  }

  return null;
}

function findVisualUtilityCluster(
  className: string,
  threshold: number,
  minGroups: number,
  allowedClasses: string[]
): string[] {
  const matches: VisualMatch[] = [];

  for (const token of extractClassTokens(className)) {
    if (classIsAllowed(token, allowedClasses)) {
      continue;
    }

    const group = getVisualUtilityGroup(token.base);
    if (group) {
      matches.push({ token: token.original, group });
    }
  }

  const groups = new Set(matches.map((match) => match.group));
  if (matches.length >= threshold && groups.size >= minGroups) {
    return matches.map((match) => match.token);
  }

  return [];
}

function findSemanticOpacityModifiers(
  className: string,
  allowedClasses: string[]
): string[] {
  const matches: string[] = [];

  for (const token of extractClassTokens(className)) {
    if (classIsAllowed(token, allowedClasses)) {
      continue;
    }

    const opacityMatch = token.base.match(/^(.*)\/(\d{1,3})$/);
    if (!opacityMatch) {
      continue;
    }

    const baseWithoutOpacity = opacityMatch[1];
    const opacityValue = Number(opacityMatch[2]);
    if (opacityValue < 0 || opacityValue > 100) {
      continue;
    }

    const prefix = getColorUtilityPrefix(baseWithoutOpacity);
    if (!prefix) {
      continue;
    }

    const value = getUtilityValue(baseWithoutOpacity, prefix);
    if (isSemanticColorValue(value, prefix) || isBracketColorValue(value)) {
      matches.push(token.original);
    }
  }

  return matches;
}

export default createRule<Options, MessageIds>({
  name: "prefer-tailwind",
  meta: {
    type: "suggestion",
    docs: {
      description: "Encourage Tailwind className over inline style attributes",
    },
    messages: {
      preferTailwind:
        "Prefer Tailwind className over inline style. This element uses style attribute without className.",
      preferSemanticColors:
        "Hard-coded colors: {{colors}}. Use semantic classes instead.",
      preferSemanticColorsWithSuggestion:
        "Hard-coded colors: {{colors}}. {{suggestion}}",
      preferSemanticClassGroups:
        "Dense visual utility cluster: {{classes}}. Move repeated panel/card styling into a semantic class.",
      semanticOpacityModifier:
        "Semantic color opacity modifiers: {{classes}}. Use fully semantic classes or tokens instead.",
    },
    schema: [
      {
        type: "object",
        properties: {
          styleRatioThreshold: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description:
              "Minimum ratio of style-only elements to trigger warnings",
          },
          minElementsForAnalysis: {
            type: "number",
            minimum: 1,
            description: "Minimum styled elements required for analysis",
          },
          allowedStyleProperties: {
            type: "array",
            items: { type: "string" },
            description: "Style properties to ignore",
          },
          ignoreComponents: {
            type: "array",
            items: { type: "string" },
            description: "Component names to skip",
          },
          preferSemanticColors: {
            type: "boolean",
            description:
              "Warn against hard-coded colors in favor of semantic theme colors",
          },
          allowedHardCodedColors: {
            type: "array",
            items: { type: "string" },
            description:
              "Hard-coded color names to allow when preferSemanticColors is enabled",
          },
          useLlmSuggestions: {
            type: "boolean",
            description:
              "Use Ollama LLM to suggest semantic color replacements",
          },
          preferSemanticClassGroups: {
            type: "boolean",
            description:
              "Warn when one class string contains many low-level visual utilities",
          },
          visualUtilityThreshold: {
            type: "number",
            minimum: 1,
            description:
              "Minimum visual utility count in one class string before warning",
          },
          visualUtilityMinGroups: {
            type: "number",
            minimum: 1,
            description:
              "Minimum distinct visual utility groups before warning",
          },
          disallowSemanticOpacityModifiers: {
            type: "boolean",
            description:
              "Warn on semantic color opacity modifiers like text-foreground/80",
          },
          allowedOpacityModifierClasses: {
            type: "array",
            items: { type: "string" },
            description:
              "Exact classes to allow with semantic opacity modifiers",
          },
          allowedVisualUtilityClasses: {
            type: "array",
            items: { type: "string" },
            description:
              "Exact visual utility classes to ignore in cluster detection",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [
    {
      styleRatioThreshold: 0.3,
      minElementsForAnalysis: 3,
      allowedStyleProperties: [],
      ignoreComponents: [],
      preferSemanticColors: true,
      allowedHardCodedColors: [],
      useLlmSuggestions: false,
      preferSemanticClassGroups: true,
      visualUtilityThreshold: 4,
      visualUtilityMinGroups: 2,
      disallowSemanticOpacityModifiers: true,
      allowedOpacityModifierClasses: [],
      allowedVisualUtilityClasses: [],
    },
  ],
  create(context) {
    const options = context.options[0] || {};
    const styleRatioThreshold = options.styleRatioThreshold ?? 0.3;
    const minElementsForAnalysis = options.minElementsForAnalysis ?? 3;
    const allowedStyleProperties = options.allowedStyleProperties ?? [];
    const ignoreComponents = options.ignoreComponents ?? [];
    const preferSemanticColors = options.preferSemanticColors ?? true;
    const allowedHardCodedColors = options.allowedHardCodedColors ?? [];
    const useLlmSuggestions = options.useLlmSuggestions ?? false;
    const preferSemanticClassGroups =
      options.preferSemanticClassGroups ?? true;
    const visualUtilityThreshold = options.visualUtilityThreshold ?? 4;
    const visualUtilityMinGroups = options.visualUtilityMinGroups ?? 2;
    const disallowSemanticOpacityModifiers =
      options.disallowSemanticOpacityModifiers ?? true;
    const allowedOpacityModifierClasses =
      options.allowedOpacityModifierClasses ?? [];
    const allowedVisualUtilityClasses =
      options.allowedVisualUtilityClasses ?? [];

    // Cache file content for LLM suggestions (read lazily)
    let fileContent: string | null = null;
    const filePath = context.filename;
    const fileDir = dirname(filePath);

    function getFileContent(): string {
      if (fileContent === null) {
        try {
          fileContent = readFileSync(filePath, "utf-8");
        } catch {
          fileContent = "";
        }
      }
      return fileContent;
    }

    // Tracking state for file-level analysis
    const styledElements: ElementInfo[] = [];

    /**
     * Check if a JSXAttribute is a style attribute with an expression
     */
    function isStyleAttribute(attr: TSESTree.JSXAttribute): boolean {
      return (
        attr.name.type === "JSXIdentifier" &&
        attr.name.name === "style" &&
        attr.value?.type === "JSXExpressionContainer"
      );
    }

    /**
     * Check if a JSXAttribute is a className attribute
     */
    function isClassNameAttribute(attr: TSESTree.JSXAttribute): boolean {
      return (
        attr.name.type === "JSXIdentifier" &&
        (attr.name.name === "className" || attr.name.name === "class")
      );
    }

    function checkClassString(node: TSESTree.Node, className: string): void {
      if (preferSemanticColors) {
        const hardCodedColors = findHardCodedColors(
          className,
          allowedHardCodedColors
        );
        if (hardCodedColors.length > 0) {
          const colorsStr = hardCodedColors.join(", ");

          // Try to get LLM suggestions if enabled
          if (useLlmSuggestions) {
            const { suggestions } = getColorSuggestions(
              hardCodedColors,
              fileDir,
              getFileContent()
            );
            const suggestionStr = formatSuggestionsForMessage(suggestions);

            if (suggestionStr) {
              context.report({
                node,
                messageId: "preferSemanticColorsWithSuggestion",
                data: { colors: colorsStr, suggestion: suggestionStr },
              });
            } else {
              context.report({
                node,
                messageId: "preferSemanticColors",
                data: { colors: colorsStr },
              });
            }
          } else {
            context.report({
              node,
              messageId: "preferSemanticColors",
              data: { colors: colorsStr },
            });
          }
        }
      }

      if (preferSemanticClassGroups) {
        const visualUtilities = findVisualUtilityCluster(
          className,
          visualUtilityThreshold,
          visualUtilityMinGroups,
          allowedVisualUtilityClasses
        );

        if (visualUtilities.length > 0) {
          context.report({
            node,
            messageId: "preferSemanticClassGroups",
            data: { classes: visualUtilities.join(", ") },
          });
        }
      }

      if (disallowSemanticOpacityModifiers) {
        const opacityClasses = findSemanticOpacityModifiers(
          className,
          allowedOpacityModifierClasses
        );

        if (opacityClasses.length > 0) {
          context.report({
            node,
            messageId: "semanticOpacityModifier",
            data: { classes: opacityClasses.join(", ") },
          });
        }
      }
    }

    function processTemplateLiteral(node: TSESTree.TemplateLiteral): void {
      for (const quasi of node.quasis) {
        checkClassString(quasi, quasi.value.raw);
      }
    }

    function processClassAttribute(attr: TSESTree.JSXAttribute): void {
      const value = attr.value;

      if (value?.type === "Literal" && typeof value.value === "string") {
        checkClassString(value, value.value);
      }

      if (value?.type === "JSXExpressionContainer") {
        const expr = value.expression;

        if (expr.type === "Literal" && typeof expr.value === "string") {
          checkClassString(expr, expr.value);
        }

        if (expr.type === "TemplateLiteral") {
          processTemplateLiteral(expr);
        }
      }
    }

    return {
      JSXOpeningElement(node) {
        // Check if component should be ignored
        const componentName = getComponentName(node);
        if (ignoreComponents.includes(componentName)) {
          return;
        }

        let hasStyle = false;
        let hasClassName = false;
        let styleProperties: string[] = [];

        for (const attr of node.attributes) {
          if (attr.type === "JSXAttribute") {
            if (isStyleAttribute(attr)) {
              hasStyle = true;
              styleProperties = getStylePropertyNames(
                attr.value as TSESTree.JSXExpressionContainer
              );
            }
            if (isClassNameAttribute(attr)) {
              hasClassName = true;
              processClassAttribute(attr);
            }
          }
        }

        // Only track elements that have style OR className (or both)
        if (hasStyle || hasClassName) {
          styledElements.push({
            node,
            hasStyle,
            hasClassName,
            styleProperties,
          });
        }
      },

      "Program:exit"() {
        // Don't analyze if not enough styled elements
        if (styledElements.length < minElementsForAnalysis) {
          return;
        }

        // Filter out elements where all style properties are allowed
        const styleOnlyElements = styledElements.filter((el) => {
          if (!el.hasStyle || el.hasClassName) {
            return false;
          }

          // If all style properties are in the allowed list, don't count this element
          if (
            hasOnlyAllowedProperties(el.styleProperties, allowedStyleProperties)
          ) {
            return false;
          }

          return true;
        });

        const ratio = styleOnlyElements.length / styledElements.length;

        // Only report if ratio exceeds threshold
        if (ratio > styleRatioThreshold) {
          for (const element of styleOnlyElements) {
            context.report({
              node: element.node,
              messageId: "preferTailwind",
            });
          }
        }
      },

      CallExpression(node) {
        if (node.callee.type !== "Identifier") {
          return;
        }

        if (!CLASS_COMBINER_NAMES.has(node.callee.name)) {
          return;
        }

        for (const arg of node.arguments) {
          if (arg.type === "Literal" && typeof arg.value === "string") {
            checkClassString(arg, arg.value);
          }

          if (arg.type === "TemplateLiteral") {
            processTemplateLiteral(arg);
          }

          if (arg.type === "ArrayExpression") {
            for (const element of arg.elements) {
              if (
                element?.type === "Literal" &&
                typeof element.value === "string"
              ) {
                checkClassString(element, element.value);
              }

              if (element?.type === "TemplateLiteral") {
                processTemplateLiteral(element);
              }
            }
          }
        }
      },
    };
  },
});
