/**
 * Rule: zustand-use-selectors
 *
 * Requires selector functions when accessing Zustand store state to prevent
 * unnecessary re-renders.
 *
 * Examples:
 * - Bad: const state = useStore()
 * - Bad: const { count } = useStore()
 * - Good: const count = useStore((s) => s.count)
 * - Good: const count = useStore(selectCount)
 */

import { createRule, defineRuleMeta } from "../utils/create-rule.js";
import type { TSESTree } from "@typescript-eslint/utils";

type MessageIds = "missingSelector" | "useSelectorFunction";
type Options = [
  {
    /** Regex pattern for store hook names (default: "^use\\w*Store$") */
    storePattern?: string;
    /** Allow useShallow() wrapper without selector */
    allowShallow?: boolean;
    /** Require named selector functions instead of inline arrows */
    requireNamedSelectors?: boolean;
  }
];

/**
 * Rule metadata - colocated with implementation for maintainability
 */
export const meta = defineRuleMeta({
  id: "zustand-use-selectors",
  name: "Zustand Use Selectors",
  description: "Require selector functions when accessing Zustand store state",
  defaultSeverity: "warn",
  category: "static",
  defaultOptions: [
    { storePattern: "^use\\w*Store$", allowShallow: true, requireNamedSelectors: false },
  ],
  optionSchema: {
    fields: [
      {
        key: "storePattern",
        label: "Store hook pattern",
        type: "text",
        defaultValue: "^use\\w*Store$",
        description: "Regex pattern for identifying Zustand store hooks",
      },
      {
        key: "allowShallow",
        label: "Allow useShallow",
        type: "boolean",
        defaultValue: true,
        description: "Allow useShallow() wrapper without explicit selector",
      },
      {
        key: "requireNamedSelectors",
        label: "Require named selectors",
        type: "boolean",
        defaultValue: false,
        description: "Require named selector functions instead of inline arrows",
      },
    ],
  },
  docs: `
## What it does

Enforces the use of selector functions when accessing Zustand store state.
When you call a Zustand store without a selector, your component subscribes
to the entire store and re-renders on any state change.

## Why it's useful

- **Performance**: Prevents unnecessary re-renders
- **Optimization**: Components only update when selected state changes
- **Best Practice**: Follows Zustand's recommended patterns

## Examples

### ❌ Incorrect

\`\`\`tsx
// Subscribes to entire store - re-renders on any change
const state = useStore();
const { count, user } = useStore();

// Component re-renders when anything changes, not just count
function Counter() {
  const { count } = useStore();
  return <span>{count}</span>;
}
\`\`\`

### ✅ Correct

\`\`\`tsx
// Only re-renders when count changes
const count = useStore((state) => state.count);

// Named selector
const selectCount = (state) => state.count;
const count = useStore(selectCount);

// Multiple values with shallow
import { useShallow } from 'zustand/shallow';
const { count, user } = useStore(
  useShallow((state) => ({ count: state.count, user: state.user }))
);
\`\`\`

## Configuration

\`\`\`js
// eslint.config.js
"uilint/zustand-use-selectors": ["warn", {
  storePattern: "^use\\\\w*Store$",  // Match useXxxStore pattern
  allowShallow: true,                // Allow useShallow without inline selector
  requireNamedSelectors: false       // Allow inline arrow selectors
}]
\`\`\`
`,
});

/**
 * Check if a node is a Zustand store call based on the pattern
 */
function isZustandStoreCall(
  callee: TSESTree.Node,
  storePattern: RegExp
): boolean {
  if (callee.type === "Identifier") {
    return storePattern.test(callee.name);
  }
  return false;
}

/**
 * Check if the first argument is a selector function or reference
 */
function hasSelector(args: TSESTree.CallExpressionArgument[]): boolean {
  if (args.length === 0) {
    return false;
  }

  const firstArg = args[0];

  // Arrow function: (s) => s.count
  if (firstArg.type === "ArrowFunctionExpression") {
    return true;
  }

  // Function expression: function(s) { return s.count; }
  if (firstArg.type === "FunctionExpression") {
    return true;
  }

  // Named selector reference: selectCount
  if (firstArg.type === "Identifier") {
    return true;
  }

  // Member expression: selectors.count or module.selectCount
  if (firstArg.type === "MemberExpression") {
    return true;
  }

  // Call expression (might be useShallow or similar)
  if (firstArg.type === "CallExpression") {
    return true;
  }

  return false;
}

/**
 * Check if the selector is wrapped in useShallow
 */
function isShallowWrapped(args: TSESTree.CallExpressionArgument[]): boolean {
  if (args.length === 0) {
    return false;
  }

  const firstArg = args[0];

  if (firstArg.type === "CallExpression") {
    if (
      firstArg.callee.type === "Identifier" &&
      firstArg.callee.name === "useShallow"
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Check if the selector is an inline arrow function
 */
function isInlineSelector(args: TSESTree.CallExpressionArgument[]): boolean {
  if (args.length === 0) {
    return false;
  }

  const firstArg = args[0];
  return (
    firstArg.type === "ArrowFunctionExpression" ||
    firstArg.type === "FunctionExpression"
  );
}

/**
 * Get the store name from the call expression
 */
function getStoreName(callee: TSESTree.Node): string {
  if (callee.type === "Identifier") {
    return callee.name;
  }
  return "useStore";
}

export default createRule<Options, MessageIds>({
  name: "zustand-use-selectors",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require selector functions when accessing Zustand store state",
    },
    messages: {
      missingSelector:
        "Call to '{{storeName}}' is missing a selector. Use '{{storeName}}((state) => state.property)' to prevent unnecessary re-renders.",
      useSelectorFunction:
        "Consider using a named selector function instead of an inline arrow for '{{storeName}}'. Example: '{{storeName}}(selectProperty)'",
    },
    schema: [
      {
        type: "object",
        properties: {
          storePattern: {
            type: "string",
            description: "Regex pattern for store hook names",
          },
          allowShallow: {
            type: "boolean",
            description: "Allow useShallow() wrapper",
          },
          requireNamedSelectors: {
            type: "boolean",
            description: "Require named selector functions",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [
    {
      storePattern: "^use\\w*Store$",
      allowShallow: true,
      requireNamedSelectors: false,
    },
  ],
  create(context) {
    const options = context.options[0] || {};
    const storePatternStr = options.storePattern ?? "^use\\w*Store$";
    const allowShallow = options.allowShallow ?? true;
    const requireNamedSelectors = options.requireNamedSelectors ?? false;

    let storePattern: RegExp;
    try {
      storePattern = new RegExp(storePatternStr);
    } catch {
      // If invalid regex, use default
      storePattern = /^use\w*Store$/;
    }

    return {
      CallExpression(node) {
        // Check if this is a Zustand store call
        if (!isZustandStoreCall(node.callee, storePattern)) {
          return;
        }

        const storeName = getStoreName(node.callee);

        // Check for selector
        if (!hasSelector(node.arguments)) {
          context.report({
            node,
            messageId: "missingSelector",
            data: { storeName },
          });
          return;
        }

        // If useShallow is used and allowed, that's fine
        if (allowShallow && isShallowWrapped(node.arguments)) {
          return;
        }

        // Check for named selectors if required
        if (requireNamedSelectors && isInlineSelector(node.arguments)) {
          context.report({
            node,
            messageId: "useSelectorFunction",
            data: { storeName },
          });
        }
      },
    };
  },
});
