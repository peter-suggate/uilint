/**
 * Rule: consistent-spacing
 *
 * Enforces use of spacing scale values in gap, padding, margin utilities.
 */

import { createRule, defineRuleMeta } from "../utils/create-rule.js";
import type { TSESTree } from "@typescript-eslint/utils";

type MessageIds = "invalidSpacing";
type Options = [
  {
    scale?: number[];
  }
];

/**
 * Rule metadata - colocated with implementation for maintainability
 */
export const meta = defineRuleMeta({
  id: "consistent-spacing",
  name: "Consistent Spacing",
  description: "Enforce spacing scale (no magic numbers in gap/padding)",
  defaultSeverity: "warn",
  category: "static",
  defaultOptions: [{ scale: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16] }],
  optionSchema: {
    fields: [
      {
        key: "scale",
        label: "Allowed spacing values",
        type: "text",
        defaultValue: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16],
        placeholder: "0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16",
        description: "Comma-separated list of allowed spacing values",
      },
    ],
  },
  docs: `
## What it does

Ensures all spacing utilities (padding, margin, gap, etc.) use values from a defined scale.
This prevents "magic number" spacing values that create visual inconsistency.

## Why it's useful

- **Visual rhythm**: Consistent spacing creates a professional, cohesive feel
- **Design system compliance**: Enforces your spacing tokens
- **Easier maintenance**: Spacing changes can be made systematically

## Examples

### ❌ Incorrect

\`\`\`tsx
<div className="p-7">         // 7 isn't in the default scale
<div className="gap-13">      // 13 isn't in the default scale
<div className="mt-9">        // 9 isn't in the default scale
\`\`\`

### ✅ Correct

\`\`\`tsx
<div className="p-8">         // 8 is in the scale
<div className="gap-12">      // 12 is in the scale
<div className="mt-10">       // 10 is in the scale
\`\`\`

## Configuration

\`\`\`js
// eslint.config.js
"uilint/consistent-spacing": ["warn", {
  scale: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24]
}]
\`\`\`

The default scale is Tailwind's standard spacing values. Customize it to match your design system.
`,
});

// Default Tailwind spacing scale
const DEFAULT_SCALE = [
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24,
  28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96,
];

// Spacing utilities that take numeric values
const SPACING_PREFIXES = [
  "p-",
  "px-",
  "py-",
  "pt-",
  "pr-",
  "pb-",
  "pl-",
  "ps-",
  "pe-",
  "m-",
  "mx-",
  "my-",
  "mt-",
  "mr-",
  "mb-",
  "ml-",
  "ms-",
  "me-",
  "gap-",
  "gap-x-",
  "gap-y-",
  "space-x-",
  "space-y-",
  "inset-",
  "inset-x-",
  "inset-y-",
  "top-",
  "right-",
  "bottom-",
  "left-",
  "w-",
  "h-",
  "min-w-",
  "min-h-",
  "max-w-",
  "max-h-",
  "size-",
];

// Build regex to match spacing utilities with numeric values
function buildSpacingRegex(): RegExp {
  const prefixes = SPACING_PREFIXES.map((p) => p.replace("-", "\\-")).join("|");
  // Match prefix followed by a number (possibly with decimal)
  return new RegExp(`\\b(${prefixes})(\\d+\\.?\\d*)\\b`, "g");
}

const SPACING_REGEX = buildSpacingRegex();

export default createRule<Options, MessageIds>({
  name: "consistent-spacing",
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce spacing scale (no magic numbers in gap/padding)",
    },
    messages: {
      invalidSpacing:
        "Spacing value '{{value}}' is not in the allowed scale. Use one of: {{allowed}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          scale: {
            type: "array",
            items: { type: "number" },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{ scale: DEFAULT_SCALE }],
  create(context) {
    const options = context.options[0] || {};
    const scale = new Set((options.scale || DEFAULT_SCALE).map(String));
    const scaleList = [...scale].slice(0, 10).join(", ") + "...";

    return {
      // Check className attributes in JSX
      JSXAttribute(node) {
        if (
          node.name.type === "JSXIdentifier" &&
          (node.name.name === "className" || node.name.name === "class")
        ) {
          const value = node.value;

          if (value?.type === "Literal" && typeof value.value === "string") {
            checkSpacing(context, node, value.value, scale, scaleList);
          }

          if (value?.type === "JSXExpressionContainer") {
            const expr = value.expression;
            if (expr.type === "Literal" && typeof expr.value === "string") {
              checkSpacing(context, node, expr.value, scale, scaleList);
            }
            if (expr.type === "TemplateLiteral") {
              for (const quasi of expr.quasis) {
                checkSpacing(context, node, quasi.value.raw, scale, scaleList);
              }
            }
          }
        }
      },

      // Check cn(), clsx(), classnames() calls
      CallExpression(node) {
        if (node.callee.type !== "Identifier") return;
        const name = node.callee.name;

        if (name === "cn" || name === "clsx" || name === "classnames") {
          for (const arg of node.arguments) {
            if (arg.type === "Literal" && typeof arg.value === "string") {
              checkSpacing(context, arg, arg.value, scale, scaleList);
            }
            if (arg.type === "TemplateLiteral") {
              for (const quasi of arg.quasis) {
                checkSpacing(context, quasi, quasi.value.raw, scale, scaleList);
              }
            }
          }
        }
      },
    };
  },
});

function checkSpacing(
  context: Parameters<
    ReturnType<typeof createRule<Options, "invalidSpacing">>["create"]
  >[0],
  node: TSESTree.Node,
  classString: string,
  scale: Set<string>,
  scaleList: string
) {
  // Reset regex state
  SPACING_REGEX.lastIndex = 0;

  let match;
  while ((match = SPACING_REGEX.exec(classString)) !== null) {
    const [, , value] = match;
    if (value && !scale.has(value)) {
      context.report({
        node,
        messageId: "invalidSpacing",
        data: { value, allowed: scaleList },
      });
    }
  }
}
