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

// Known Tailwind color names (not exhaustive, but covers common cases)
// This helps distinguish color classes from non-color classes like text-lg
const COLOR_NAMES = new Set([
  // Grayscale
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  // Colors
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
  // Special
  "black",
  "white",
]);

// Patterns that indicate a color value (after the prefix)
// e.g., "blue-500", "white", "black", "[#fff]", "slate-900/50"
const COLOR_VALUE_PATTERN =
  /^(?:(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{1,3}(?:\/\d+)?|black|white|inherit|current|transparent|\[.+\])$/;

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
 * Check if the value after the prefix looks like a color value
 * This helps avoid false positives like text-lg (font size) or text-center (alignment)
 */
function isColorValue(baseClass: string, prefix: string): boolean {
  const value = baseClass.slice(prefix.length);

  // Check for explicit color patterns
  if (COLOR_VALUE_PATTERN.test(value)) {
    return true;
  }

  // Check if it starts with a known color name (handles shades like blue-500)
  const firstPart = value.split("-")[0];
  if (COLOR_NAMES.has(firstPart)) {
    return true;
  }

  // Check for arbitrary values that might be colors
  if (value.startsWith("[") && value.endsWith("]")) {
    return true;
  }

  return false;
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
