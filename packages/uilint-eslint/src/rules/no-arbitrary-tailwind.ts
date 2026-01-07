/**
 * Rule: no-arbitrary-tailwind
 *
 * Forbids arbitrary Tailwind values like w-[123px], bg-[#fff], etc.
 */

import { createRule } from "../utils/create-rule.js";
import type { TSESTree } from "@typescript-eslint/utils";

type MessageIds = "noArbitraryValue";
type Options = [];

// Regex to match arbitrary Tailwind values: word-[anything]
const ARBITRARY_VALUE_REGEX = /\b[\w-]+-\[[^\]]+\]/g;

export default createRule<Options, MessageIds>({
  name: "no-arbitrary-tailwind",
  meta: {
    type: "problem",
    docs: {
      description: "Forbid arbitrary Tailwind values like w-[123px]",
    },
    messages: {
      noArbitraryValue:
        "Avoid arbitrary Tailwind value '{{value}}'. Use the spacing/color scale instead.",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
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
            checkClassString(context, value, value.value);
          }

          // Handle JSX expression: className={...}
          if (value?.type === "JSXExpressionContainer") {
            const expr = value.expression;

            // Direct string: className={"..."}
            if (expr.type === "Literal" && typeof expr.value === "string") {
              checkClassString(context, expr, expr.value);
            }

            // Template literal: className={`...`}
            if (expr.type === "TemplateLiteral") {
              for (const quasi of expr.quasis) {
                checkClassString(context, quasi, quasi.value.raw);
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
              checkClassString(context, arg, arg.value);
            }
            if (arg.type === "TemplateLiteral") {
              for (const quasi of arg.quasis) {
                checkClassString(context, quasi, quasi.value.raw);
              }
            }
          }
        }
      },
    };
  },
});

function checkClassString(
  context: Parameters<
    ReturnType<typeof createRule<[], "noArbitraryValue">>["create"]
  >[0],
  node: TSESTree.Node,
  classString: string
) {
  const matches = classString.matchAll(ARBITRARY_VALUE_REGEX);

  for (const match of matches) {
    // Ignore data attributes (e.g., data-[value], data-test-[something])
    if (match[0].startsWith("data-")) {
      continue;
    }

    context.report({
      node,
      messageId: "noArbitraryValue",
      data: { value: match[0] },
    });
  }
}
