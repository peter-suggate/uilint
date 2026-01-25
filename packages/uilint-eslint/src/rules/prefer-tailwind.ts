/**
 * Rule: prefer-tailwind
 *
 * Encourages using Tailwind className over inline style attributes.
 * - Detects files with a high ratio of inline `style` vs `className` usage
 * - Warns at each element using style without className when ratio exceeds threshold
 */

import { createRule, defineRuleMeta } from "../utils/create-rule.js";
import type { TSESTree } from "@typescript-eslint/utils";

type MessageIds = "preferTailwind";
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
  }?
];

/**
 * Rule metadata - colocated with implementation for maintainability
 */
export const meta = defineRuleMeta({
  id: "prefer-tailwind",
  version: "1.0.0",
  name: "Prefer Tailwind",
  description: "Encourage Tailwind className over inline style attributes",
  defaultSeverity: "warn",
  category: "static",
  icon: "🎨",
  hint: "Prefers className over inline styles",
  defaultEnabled: true,
  defaultOptions: [
    {
      styleRatioThreshold: 0.3,
      minElementsForAnalysis: 3,
      allowedStyleProperties: [],
      ignoreComponents: [],
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
        description: "Comma-separated component names to skip (e.g., motion.div,animated.View)",
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
  ignoreComponents: ["motion.div", "animated.View"]    // Skip animation libraries
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
      current = current.object as TSESTree.JSXMemberExpression | TSESTree.JSXIdentifier;
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
    },
  ],
  create(context) {
    const options = context.options[0] || {};
    const styleRatioThreshold = options.styleRatioThreshold ?? 0.3;
    const minElementsForAnalysis = options.minElementsForAnalysis ?? 3;
    const allowedStyleProperties = options.allowedStyleProperties ?? [];
    const ignoreComponents = options.ignoreComponents ?? [];

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
            }
          }
        }

        // Only track elements that have style OR className (or both)
        if (hasStyle || hasClassName) {
          styledElements.push({ node, hasStyle, hasClassName, styleProperties });
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
    };
  },
});
