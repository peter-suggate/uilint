/**
 * Rule: consistent-dark-mode
 *
 * Ensures consistent dark mode theming in Tailwind CSS classes.
 * - Error: When some color classes have dark: variants but others don't within the same element
 * - Warning: When Tailwind color classes are used in a file but no dark: theming exists
 */

import { createRule } from "../utils/create-rule.js";
import type { TSESTree } from "@typescript-eslint/utils";

type MessageIds = "inconsistentDarkMode" | "missingDarkMode";
type Options = [
  {
    /** Whether to warn when no dark mode classes are found in a file that uses Tailwind colors. Default: true */
    warnOnMissingDarkMode?: boolean;
  }?
];

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

// Known non-color utilities that use color prefixes
// These are utilities like text-lg (font size), text-center (alignment), etc.
const NON_COLOR_UTILITIES = new Set([
  // Exempt values (colorless or inherited) - don't need dark variants
  "transparent",
  "inherit",
  "current",
  "auto",
  "none",
  // text- utilities that aren't colors
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
  "left",
  "center",
  "right",
  "justify",
  "start",
  "end",
  "wrap",
  "nowrap",
  "balance",
  "pretty",
  "ellipsis",
  "clip",
  // border- utilities that aren't colors
  "0",
  "2",
  "4",
  "8",
  "solid",
  "dashed",
  "dotted",
  "double",
  "hidden",
  "collapse",
  "separate",
  // shadow- utilities that aren't colors
  // Note: "sm", "lg", "xl", "2xl" already included above
  "md",
  "inner",
  // ring- utilities that aren't colors
  // Note: "0", "2", "4", "8" already included above
  "1",
  "inset",
  // outline- utilities that aren't colors
  // Note: numeric values already included
  "offset-0",
  "offset-1",
  "offset-2",
  "offset-4",
  "offset-8",
  // decoration- utilities that aren't colors
  // Note: "solid", "double", "dotted", "dashed" already included
  "wavy",
  "from-font",
  "clone",
  "slice",
  // divide- utilities that aren't colors
  "x",
  "y",
  "x-0",
  "x-2",
  "x-4",
  "x-8",
  "y-0",
  "y-2",
  "y-4",
  "y-8",
  "x-reverse",
  "y-reverse",
  // gradient direction utilities (from-, via-, to- prefixes)
  "t",
  "tr",
  "r",
  "br",
  "b",
  "bl",
  "l",
  "tl",
]);

// Semantic color names used by theming systems like shadcn
// These are CSS variable-based colors that handle dark mode automatically
const SEMANTIC_COLOR_NAMES = new Set([
  // Core shadcn colors
  "background",
  "foreground",
  // Component colors
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  // Form/UI colors
  "border",
  "input",
  "ring",
  // Sidebar colors (shadcn sidebar component)
  "sidebar",
  "sidebar-foreground",
  "sidebar-border",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-ring",
]);

// Pattern for semantic chart colors (chart-1, chart-2, etc.)
const CHART_COLOR_PATTERN = /^chart-\d+$/;

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
 * Check if the value is a semantic/themed color (e.g., shadcn)
 * These colors use CSS variables that automatically handle dark mode
 */
function isSemanticColor(value: string): boolean {
  // Check for exact semantic color names
  if (SEMANTIC_COLOR_NAMES.has(value)) {
    return true;
  }

  // Check for chart colors (chart-1, chart-2, etc.)
  if (CHART_COLOR_PATTERN.test(value)) {
    return true;
  }

  return false;
}

/**
 * Check if the value after the prefix looks like a color value
 * Uses an exclusion-based approach: anything that's not a known non-color utility
 * and not a semantic color is treated as a potential color.
 */
function isColorValue(baseClass: string, prefix: string): boolean {
  const value = baseClass.slice(prefix.length);

  // Empty value is not a color
  if (!value) {
    return false;
  }

  // Check if it's a semantic/themed color (exempt from dark mode requirements)
  if (isSemanticColor(value)) {
    return false;
  }

  // Check if it's a known non-color utility
  if (NON_COLOR_UTILITIES.has(value)) {
    return false;
  }

  // Treat everything else as a potential color
  // This catches:
  // - Standard Tailwind colors: blue-500, slate-900, white, black
  // - Custom colors defined in tailwind.config: brand, primary (non-shadcn), custom-blue
  // - Arbitrary values: [#fff], [rgb(255,0,0)], [var(--my-color)]
  // - Opacity modifiers: blue-500/50, white/80
  return true;
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
