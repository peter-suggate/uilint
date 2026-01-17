/**
 * Rule: consistent-dark-mode
 *
 * Ensures consistent dark mode theming in Tailwind CSS classes.
 * - Error: When some color classes have dark: variants but others don't within the same element
 * - Warning: When Tailwind color classes are used in a file but no dark: theming exists
 */

import { createRule, defineRuleMeta } from "../utils/create-rule.js";
import type { TSESTree } from "@typescript-eslint/utils";

type MessageIds = "inconsistentDarkMode" | "missingDarkMode";
type Options = [
  {
    /** Whether to warn when no dark mode classes are found in a file that uses Tailwind colors. Default: true */
    warnOnMissingDarkMode?: boolean;
  }?
];

/**
 * Rule metadata - colocated with implementation for maintainability
 */
export const meta = defineRuleMeta({
  id: "consistent-dark-mode",
  name: "Consistent Dark Mode",
  description: "Ensure consistent dark: theming (error on mix, warn on missing)",
  defaultSeverity: "error",
  category: "static",
  defaultOptions: [{ warnOnMissingDarkMode: true }],
  optionSchema: {
    fields: [
      {
        key: "warnOnMissingDarkMode",
        label: "Warn when elements lack dark: variant",
        type: "boolean",
        defaultValue: true,
        description: "Enable warnings for elements missing dark mode variants",
      },
    ],
  },
  docs: `
## What it does

Detects inconsistent dark mode theming in Tailwind CSS classes. Reports errors when
some color classes in an element have \`dark:\` variants but others don't, and optionally
warns when a file uses color classes without any dark mode theming.

## Why it's useful

- **Prevents broken dark mode**: Catches cases where some colors change in dark mode but others don't
- **Encourages completeness**: Prompts you to add dark mode support where it's missing
- **No false positives**: Only flags explicit Tailwind colors, not custom/CSS variable colors

## Examples

### ❌ Incorrect

\`\`\`tsx
// Some colors have dark variants, others don't
<div className="bg-white dark:bg-slate-900 text-black">
//                                          ^^^^^^^^^ missing dark: variant

// Mix of themed and unthemed
<button className="bg-blue-500 dark:bg-blue-600 border-gray-300">
//                                               ^^^^^^^^^^^^^^^ missing dark: variant
\`\`\`

### ✅ Correct

\`\`\`tsx
// All color classes have dark variants
<div className="bg-white dark:bg-slate-900 text-black dark:text-white">

// Using semantic/custom colors (automatically themed via CSS variables)
<div className="bg-background text-foreground">
<div className="bg-brand text-brand-foreground">
<div className="bg-primary text-primary-foreground">

// Consistent theming
<button className="bg-blue-500 dark:bg-blue-600 border-gray-300 dark:border-gray-600">
\`\`\`

## Configuration

\`\`\`js
// eslint.config.js
"uilint/consistent-dark-mode": ["error", {
  warnOnMissingDarkMode: true  // Warn if file uses colors without any dark mode
}]
\`\`\`

## Notes

- Only explicit Tailwind colors (like \`blue-500\`, \`white\`, \`slate-900\`) require dark variants
- Custom/semantic colors (\`background\`, \`foreground\`, \`brand\`, \`primary\`, etc.) are exempt
- These are assumed to be CSS variables that handle dark mode automatically
- Transparent, inherit, and current values are exempt
- Non-color utilities (like \`text-lg\`, \`border-2\`) are correctly ignored
`,
});

// Color-related class prefixes that should have dark mode variants
const COLOR_PREFIXES = [
  "bg-",
  "text-",
  "border-",
  "border-t-",
  "border-r-",
  "border-b-",
  "border-l-",
  "border-x-",
  "border-y-",
  "ring-",
  "ring-offset-",
  "divide-",
  "outline-",
  "shadow-",
  "accent-",
  "caret-",
  "fill-",
  "stroke-",
  "decoration-",
  "placeholder-",
  "from-",
  "via-",
  "to-",
];

// Values that don't need dark variants (colorless or inherited)
const EXEMPT_SUFFIXES = ["transparent", "inherit", "current", "auto", "none"];

// Built-in Tailwind CSS color palette names
// These are the ONLY colors that should trigger dark mode warnings.
// Custom colors (like 'brand', 'company-primary') are assumed to be
// CSS variables that handle dark mode automatically.
const TAILWIND_COLOR_NAMES = new Set([
  // Special colors
  "white",
  "black",
  // Gray scale palettes
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  // Warm colors
  "red",
  "orange",
  "amber",
  "yellow",
  // Green colors
  "lime",
  "green",
  "emerald",
  "teal",
  // Blue colors
  "cyan",
  "sky",
  "blue",
  "indigo",
  // Purple/Pink colors
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
]);

/**
 * Check if a class has 'dark' in its variant chain
 */
function hasDarkVariant(className: string): boolean {
  const parts = className.split(":");
  // All parts except the last are variants
  const variants = parts.slice(0, -1);
  return variants.includes("dark");
}

/**
 * Get the base class (without any variants like hover:, dark:, md:, etc.)
 */
function getBaseClass(className: string): string {
  const parts = className.split(":");
  return parts[parts.length - 1] || "";
}

/**
 * Find the color prefix this class uses, if any
 */
function getColorPrefix(baseClass: string): string | null {
  // Sort by length descending to match more specific prefixes first
  // (e.g., "border-t-" before "border-")
  const sortedPrefixes = [...COLOR_PREFIXES].sort(
    (a, b) => b.length - a.length
  );
  return sortedPrefixes.find((p) => baseClass.startsWith(p)) || null;
}

/**
 * Check if the value is an explicit Tailwind color.
 * Uses an allowlist approach: only built-in Tailwind color names trigger warnings.
 * Custom colors (like 'brand', 'primary', 'company-blue') are assumed to be
 * CSS variables that handle dark mode automatically and should NOT trigger.
 *
 * Matches patterns like:
 * - white, black (standalone colors)
 * - blue-500, slate-900 (color-scale)
 * - blue-500/50, gray-900/80 (with opacity modifier)
 */
function isTailwindColor(value: string): boolean {
  // Remove opacity modifier if present (e.g., "blue-500/50" -> "blue-500")
  const valueWithoutOpacity = value.split("/")[0] || value;

  // Check for standalone colors (white, black)
  if (TAILWIND_COLOR_NAMES.has(valueWithoutOpacity)) {
    return true;
  }

  // Check for color-scale pattern (e.g., "blue-500", "slate-900")
  // Pattern: colorName-number where number is 50, 100, 200, ..., 950
  const match = valueWithoutOpacity.match(/^([a-z]+)-(\d+)$/);
  if (match) {
    const colorName = match[1];
    const scale = match[2];
    // Valid Tailwind scales are: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950
    const validScales = [
      "50",
      "100",
      "200",
      "300",
      "400",
      "500",
      "600",
      "700",
      "800",
      "900",
      "950",
    ];
    if (colorName && TAILWIND_COLOR_NAMES.has(colorName) && validScales.includes(scale || "")) {
      return true;
    }
  }

  return false;
}

/**
 * Check if the value after the prefix looks like an explicit Tailwind color.
 * Uses allowlist approach: only built-in Tailwind colors should trigger dark mode warnings.
 * Custom/semantic colors (brand, primary, foreground, etc.) are NOT flagged.
 */
function isColorValue(baseClass: string, prefix: string): boolean {
  const value = baseClass.slice(prefix.length);

  // Empty value is not a color
  if (!value) {
    return false;
  }

  // Only flag explicit Tailwind colors
  // Custom colors, CSS variable colors, and semantic colors are exempt
  return isTailwindColor(value);
}

/**
 * Check if a class is exempt from dark mode requirements
 */
function isExempt(baseClass: string): boolean {
  return EXEMPT_SUFFIXES.some((suffix) => baseClass.endsWith(suffix));
}

export default createRule<Options, MessageIds>({
  name: "consistent-dark-mode",
  meta: {
    type: "problem",
    docs: {
      description: "Ensure consistent dark mode theming in Tailwind classes",
    },
    messages: {
      inconsistentDarkMode:
        "Inconsistent dark mode: '{{unthemed}}' lack dark: variants while other color classes have them.",
      missingDarkMode:
        "No dark mode theming detected. Consider adding dark: variants for color classes.",
    },
    schema: [
      {
        type: "object",
        properties: {
          warnOnMissingDarkMode: {
            type: "boolean",
            description:
              "Whether to warn when no dark mode classes are found in a file that uses Tailwind colors",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{ warnOnMissingDarkMode: true }],
  create(context) {
    const options = context.options[0] || {};
    const warnOnMissingDarkMode = options.warnOnMissingDarkMode ?? true;

    let fileHasColorClasses = false;
    let fileHasDarkMode = false;
    const reportedNodes = new Set<TSESTree.Node>();

    function checkClassString(node: TSESTree.Node, classString: string) {
      const classes = classString.split(/\s+/).filter(Boolean);
      if (classes.length === 0) return;

      // Track usage per color prefix: { hasLight, hasDark, lightClasses }
      const prefixUsage = new Map<
        string,
        { hasLight: boolean; hasDark: boolean; lightClasses: string[] }
      >();

      for (const cls of classes) {
        const baseClass = getBaseClass(cls);
        const prefix = getColorPrefix(baseClass);

        if (!prefix) continue;
        if (isExempt(baseClass)) continue;

        // Verify this is actually a color class, not something like text-lg
        if (!isColorValue(baseClass, prefix)) continue;

        if (!prefixUsage.has(prefix)) {
          prefixUsage.set(prefix, {
            hasLight: false,
            hasDark: false,
            lightClasses: [],
          });
        }

        const usage = prefixUsage.get(prefix)!;

        if (hasDarkVariant(cls)) {
          usage.hasDark = true;
          fileHasDarkMode = true;
        } else {
          usage.hasLight = true;
          usage.lightClasses.push(cls);
        }
      }

      // Track if file uses color classes
      if (prefixUsage.size > 0) {
        fileHasColorClasses = true;
      }

      // Check for inconsistency: some prefixes have dark variants, others don't
      const entries = Array.from(prefixUsage.entries());
      const hasSomeDark = entries.some(([_, u]) => u.hasDark);

      if (hasSomeDark) {
        const unthemedEntries = entries.filter(
          ([_, usage]) => usage.hasLight && !usage.hasDark
        );

        if (unthemedEntries.length > 0 && !reportedNodes.has(node)) {
          reportedNodes.add(node);
          // Collect the actual class names that lack dark variants
          const unthemedClasses = unthemedEntries.flatMap(
            ([_, u]) => u.lightClasses
          );

          context.report({
            node,
            messageId: "inconsistentDarkMode",
            data: { unthemed: unthemedClasses.join(", ") },
          });
        }
      }
    }

    function processStringValue(node: TSESTree.Node, value: string) {
      checkClassString(node, value);
    }

    function processTemplateLiteral(node: TSESTree.TemplateLiteral) {
      for (const quasi of node.quasis) {
        checkClassString(quasi, quasi.value.raw);
      }
    }

    return {
      // Check className attributes in JSX
      JSXAttribute(node) {
        if (
          node.name.type === "JSXIdentifier" &&
          (node.name.name === "className" || node.name.name === "class")
        ) {
          const value = node.value;

          // Handle string literal: className="..."
          if (value?.type === "Literal" && typeof value.value === "string") {
            processStringValue(value, value.value);
          }

          // Handle JSX expression: className={...}
          if (value?.type === "JSXExpressionContainer") {
            const expr = value.expression;

            // Direct string: className={"..."}
            if (expr.type === "Literal" && typeof expr.value === "string") {
              processStringValue(expr, expr.value);
            }

            // Template literal: className={`...`}
            if (expr.type === "TemplateLiteral") {
              processTemplateLiteral(expr);
            }
          }
        }
      },

      // Check cn(), clsx(), classnames(), cva() calls
      CallExpression(node) {
        if (node.callee.type !== "Identifier") return;
        const name = node.callee.name;

        if (
          name === "cn" ||
          name === "clsx" ||
          name === "classnames" ||
          name === "cva" ||
          name === "twMerge"
        ) {
          for (const arg of node.arguments) {
            if (arg.type === "Literal" && typeof arg.value === "string") {
              processStringValue(arg, arg.value);
            }
            if (arg.type === "TemplateLiteral") {
              processTemplateLiteral(arg);
            }
            // Handle arrays of class strings
            if (arg.type === "ArrayExpression") {
              for (const element of arg.elements) {
                if (
                  element?.type === "Literal" &&
                  typeof element.value === "string"
                ) {
                  processStringValue(element, element.value);
                }
                if (element?.type === "TemplateLiteral") {
                  processTemplateLiteral(element);
                }
              }
            }
          }
        }
      },

      // At the end of the file, check if Tailwind colors are used without any dark mode
      "Program:exit"(node) {
        if (warnOnMissingDarkMode && fileHasColorClasses && !fileHasDarkMode) {
          context.report({
            node,
            messageId: "missingDarkMode",
          });
        }
      },
    };
  },
});
