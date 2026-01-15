/**
 * Rule: prefer-zustand-state-management
 *
 * Detects excessive use of React state hooks (useState, useReducer, useContext)
 * in components and suggests using Zustand stores for better state management.
 */

import { createRule, defineRuleMeta } from "../utils/create-rule.js";
import type { TSESTree } from "@typescript-eslint/utils";

type MessageIds = "excessiveStateHooks";
type Options = [
  {
    /** Maximum number of state hooks before warning. Default: 3 */
    maxStateHooks?: number;
    /** Whether to count useState calls. Default: true */
    countUseState?: boolean;
    /** Whether to count useReducer calls. Default: true */
    countUseReducer?: boolean;
    /** Whether to count useContext calls. Default: true */
    countUseContext?: boolean;
  }?
];

/**
 * Rule metadata - colocated with implementation for maintainability
 */
export const meta = defineRuleMeta({
  id: "prefer-zustand-state-management",
  name: "Prefer Zustand State Management",
  description: "Detect excessive useState/useReducer/useContext; suggest Zustand",
  defaultSeverity: "warn",
  category: "static",
  defaultOptions: [
    {
      maxStateHooks: 3,
      countUseState: true,
      countUseReducer: true,
      countUseContext: true,
    },
  ],
  optionSchema: {
    fields: [
      {
        key: "maxStateHooks",
        label: "Max state hooks before warning",
        type: "number",
        defaultValue: 3,
        placeholder: "3",
        description: "Maximum number of state hooks allowed before warning",
      },
      {
        key: "countUseState",
        label: "Count useState hooks",
        type: "boolean",
        defaultValue: true,
      },
      {
        key: "countUseReducer",
        label: "Count useReducer hooks",
        type: "boolean",
        defaultValue: true,
      },
      {
        key: "countUseContext",
        label: "Count useContext hooks",
        type: "boolean",
        defaultValue: true,
      },
    ],
  },
  docs: `
## What it does

Detects components that use many React state hooks (\`useState\`, \`useReducer\`, \`useContext\`)
and suggests consolidating state into a Zustand store for better maintainability.

## Why it's useful

- **Simplifies components**: Fewer hooks means less cognitive overhead
- **Centralizes state**: Related state lives together in a store
- **Better performance**: Zustand's selector pattern prevents unnecessary re-renders
- **Easier testing**: Store logic can be tested independently of components

## Examples

### ❌ Incorrect (with default maxStateHooks: 3)

\`\`\`tsx
function UserProfile() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [isLoading, setIsLoading] = useState(false);  // 4 hooks = warning
  // ...
}
\`\`\`

### ✅ Correct

\`\`\`tsx
// Using a Zustand store
const useUserStore = create((set) => ({
  name: '',
  email: '',
  avatar: null,
  isLoading: false,
  setName: (name) => set({ name }),
  // ...
}));

function UserProfile() {
  const { name, email, avatar, isLoading } = useUserStore();
  // Much cleaner!
}
\`\`\`

## Configuration

\`\`\`js
// eslint.config.js
"uilint/prefer-zustand-state-management": ["warn", {
  maxStateHooks: 3,        // Warn when exceeding this count
  countUseState: true,     // Include useState in count
  countUseReducer: true,   // Include useReducer in count
  countUseContext: true    // Include useContext in count
}]
\`\`\`

## Notes

- Custom hooks (starting with \`use\` lowercase) are exempt from this rule
- Only counts hooks at the top level of the component, not in nested functions
- Adjust \`maxStateHooks\` based on your team's preferences
`,
});

interface ComponentInfo {
  name: string;
  node: TSESTree.Node;
  hookCount: number;
  functionNode:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression;
}

const STATE_HOOKS = new Set(["useState", "useReducer", "useContext"]);

export default createRule<Options, MessageIds>({
  name: "prefer-zustand-state-management",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Detect excessive use of React state hooks and suggest Zustand stores",
    },
    messages: {
      excessiveStateHooks:
        "Component '{{component}}' has {{count}} state hooks (max: {{max}}). Consider using a Zustand store for state management.",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxStateHooks: {
            type: "number",
            minimum: 1,
            description: "Maximum number of state hooks before warning",
          },
          countUseState: {
            type: "boolean",
            description: "Whether to count useState calls",
          },
          countUseReducer: {
            type: "boolean",
            description: "Whether to count useReducer calls",
          },
          countUseContext: {
            type: "boolean",
            description: "Whether to count useContext calls",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [
    {
      maxStateHooks: 3,
      countUseState: true,
      countUseReducer: true,
      countUseContext: true,
    },
  ],
  create(context) {
    const options = context.options[0] || {};
    const maxStateHooks = options.maxStateHooks ?? 3;
    const countUseState = options.countUseState ?? true;
    const countUseReducer = options.countUseReducer ?? true;
    const countUseContext = options.countUseContext ?? true;

    // Stack to track current component context
    const componentStack: ComponentInfo[] = [];

    // Set of function nodes we've identified as components to check
    const componentFunctions = new Map<TSESTree.Node, ComponentInfo>();

    /**
     * Check if a function name indicates a React component (PascalCase)
     */
    function isComponentName(name: string | null | undefined): boolean {
      if (!name) return false;
      // Components start with uppercase, hooks start with lowercase "use"
      return /^[A-Z]/.test(name);
    }

    /**
     * Check if a function name indicates a custom hook (starts with "use")
     */
    function isCustomHookName(name: string | null | undefined): boolean {
      if (!name) return false;
      return /^use[A-Z]/.test(name);
    }

    /**
     * Get the name of a function from various declaration patterns
     */
    function getFunctionName(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression
    ): string | null {
      // Function declaration: function MyComponent() {}
      if (node.type === "FunctionDeclaration" && node.id) {
        return node.id.name;
      }

      // Check parent for variable declaration: const MyComponent = () => {}
      const parent = node.parent;

      if (
        parent?.type === "VariableDeclarator" &&
        parent.id.type === "Identifier"
      ) {
        return parent.id.name;
      }

      // Check for forwardRef/memo: const MyComponent = forwardRef(function MyComponent() {})
      // or const MyComponent = forwardRef(() => {})
      if (parent?.type === "CallExpression") {
        const callParent = parent.parent;
        if (
          callParent?.type === "VariableDeclarator" &&
          callParent.id.type === "Identifier"
        ) {
          return callParent.id.name;
        }
      }

      // Named function expression: const x = function MyComponent() {}
      if (node.type === "FunctionExpression" && node.id) {
        return node.id.name;
      }

      return null;
    }

    /**
     * Check if a hook call should be counted based on options
     */
    function shouldCountHook(hookName: string): boolean {
      switch (hookName) {
        case "useState":
          return countUseState;
        case "useReducer":
          return countUseReducer;
        case "useContext":
          return countUseContext;
        default:
          return false;
      }
    }

    /**
     * Get hook name from a call expression (handles both useState and React.useState)
     */
    function getHookName(callee: TSESTree.Expression): string | null {
      // Direct call: useState()
      if (callee.type === "Identifier" && STATE_HOOKS.has(callee.name)) {
        return callee.name;
      }

      // Member expression: React.useState()
      if (
        callee.type === "MemberExpression" &&
        callee.object.type === "Identifier" &&
        callee.object.name === "React" &&
        callee.property.type === "Identifier" &&
        STATE_HOOKS.has(callee.property.name)
      ) {
        return callee.property.name;
      }

      return null;
    }

    /**
     * Check if we're directly inside a component function (not in a nested function)
     */
    function isDirectChildOfComponent(
      node: TSESTree.Node,
      componentNode: TSESTree.Node
    ): boolean {
      let current: TSESTree.Node | undefined = node.parent;

      while (current) {
        // If we hit the component node, we're a direct child
        if (current === componentNode) {
          return true;
        }

        // If we hit another function first, we're nested
        if (
          current.type === "FunctionDeclaration" ||
          current.type === "FunctionExpression" ||
          current.type === "ArrowFunctionExpression"
        ) {
          return false;
        }

        current = current.parent;
      }

      return false;
    }

    /**
     * Enter a function that might be a component
     */
    function enterFunction(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression
    ) {
      const name = getFunctionName(node);

      // Skip custom hooks - they're allowed to have many state hooks
      if (isCustomHookName(name)) {
        return;
      }

      // Skip non-component functions (lowercase names that aren't anonymous)
      if (name && !isComponentName(name)) {
        return;
      }

      // Track this as a potential component
      const componentInfo: ComponentInfo = {
        name: name || "AnonymousComponent",
        node,
        hookCount: 0,
        functionNode: node,
      };

      componentStack.push(componentInfo);
      componentFunctions.set(node, componentInfo);
    }

    /**
     * Exit a function and report if it had too many hooks
     */
    function exitFunction(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression
    ) {
      const componentInfo = componentFunctions.get(node);

      if (!componentInfo) {
        return;
      }

      // Remove from stack
      const index = componentStack.findIndex((c) => c.functionNode === node);
      if (index !== -1) {
        componentStack.splice(index, 1);
      }

      // Check if exceeded threshold
      if (componentInfo.hookCount > maxStateHooks) {
        context.report({
          node: componentInfo.node,
          messageId: "excessiveStateHooks",
          data: {
            component: componentInfo.name,
            count: componentInfo.hookCount,
            max: maxStateHooks,
          },
        });
      }

      componentFunctions.delete(node);
    }

    return {
      FunctionDeclaration: enterFunction,
      FunctionExpression: enterFunction,
      ArrowFunctionExpression: enterFunction,
      "FunctionDeclaration:exit": exitFunction,
      "FunctionExpression:exit": exitFunction,
      "ArrowFunctionExpression:exit": exitFunction,

      CallExpression(node) {
        const hookName = getHookName(node.callee);

        if (!hookName || !shouldCountHook(hookName)) {
          return;
        }

        // Find the innermost component this hook belongs to
        // We iterate from the end to find the most recent (innermost) component
        for (let i = componentStack.length - 1; i >= 0; i--) {
          const component = componentStack[i];

          if (isDirectChildOfComponent(node, component.functionNode)) {
            component.hookCount++;
            break;
          }
        }
      },
    };
  },
});
