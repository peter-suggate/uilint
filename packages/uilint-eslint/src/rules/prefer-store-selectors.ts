/**
 * Rule: prefer-store-selectors
 *
 * Detects when derived state from Zustand stores should be moved to selectors
 * instead of computing it with useMemo in components.
 *
 * Examples:
 * - Bad: const items = useStore(s => s.items); const filtered = useMemo(() => items.filter(...), [items]);
 * - Bad: const data = useStore(s => s.data); const mapped = useMemo(() => data.map(...), [data]);
 * - Good: const filteredItems = useStore(selectFilteredItems);
 * - Good: const mappedData = useStore(selectMappedData);
 */

import { createRule, defineRuleMeta } from "../utils/create-rule.js";
import type { TSESTree } from "@typescript-eslint/utils";

type MessageIds = "useMemoWithStoreData" | "chainedDerivedState";
type Options = [
  {
    /** Regex pattern for store hook names (default: "^use.*Store$") */
    storeHookPattern?: string;
  }
];

/**
 * Rule metadata - colocated with implementation for maintainability
 */
export const meta = defineRuleMeta({
  id: "prefer-store-selectors",
  version: "1.0.0",
  name: "Prefer Store Selectors",
  description: "Derived state from store should use selectors, not useMemo",
  defaultSeverity: "warn",
  category: "static",
  icon: "🏪",
  hint: "Move derived state to store selectors",
  defaultEnabled: true,
  defaultOptions: [{ storeHookPattern: "^use.*Store$" }],
  optionSchema: {
    fields: [
      {
        key: "storeHookPattern",
        label: "Store hook pattern",
        type: "text",
        defaultValue: "^use.*Store$",
        description: "Regex pattern for identifying Zustand store hooks",
      },
    ],
  },
  docs: `
## What it does

Detects when derived state computed from Zustand store data using \`useMemo\`
should instead be moved to a store selector for better performance and cleaner code.

## Why it's useful

- **Performance**: Selectors are memoized at the store level, avoiding recomputation
- **Reusability**: Selectors can be shared across components
- **Testability**: Selectors are pure functions that are easy to unit test
- **Separation of concerns**: Keeps data transformation logic out of components

## Examples

### ❌ Incorrect

\`\`\`tsx
function ProductList() {
  const products = useStore((s) => s.products);

  // Derived state computed in component - should be a selector
  const activeProducts = useMemo(
    () => products.filter((p) => p.isActive),
    [products]
  );

  return <List items={activeProducts} />;
}

// Multiple chained useMemo calls
function Dashboard() {
  const data = useDataStore((s) => s.data);

  const filtered = useMemo(() => data.filter(isValid), [data]);
  const sorted = useMemo(() => filtered.sort(byDate), [filtered]);
  const mapped = useMemo(() => sorted.map(format), [sorted]);

  return <Table rows={mapped} />;
}
\`\`\`

### ✅ Correct

\`\`\`tsx
// Define selectors in the store file
const selectActiveProducts = (state) =>
  state.products.filter((p) => p.isActive);

function ProductList() {
  // Use selector for derived state
  const activeProducts = useStore(selectActiveProducts);

  return <List items={activeProducts} />;
}

// Combined selector for dashboard
const selectFormattedData = (state) =>
  state.data
    .filter(isValid)
    .sort(byDate)
    .map(format);

function Dashboard() {
  const formattedData = useDataStore(selectFormattedData);
  return <Table rows={formattedData} />;
}
\`\`\`

## Configuration

\`\`\`js
// eslint.config.js
"uilint/prefer-store-selectors": ["warn", {
  storeHookPattern: "^use.*Store$"  // Match useXxxStore pattern
}]
\`\`\`
`,
});

/**
 * Transformation methods that indicate derived state computation
 */
const TRANSFORMATION_METHODS = new Set([
  "filter",
  "map",
  "reduce",
  "sort",
  "flat",
  "flatMap",
  "slice",
  "concat",
  "find",
  "findIndex",
  "some",
  "every",
  "includes",
  "reverse",
  "join",
]);

/**
 * Global functions that transform arrays
 */
const ARRAY_TRANSFORMATION_FUNCTIONS = new Set([
  "Array.from",
  "Object.keys",
  "Object.values",
  "Object.entries",
]);

/**
 * Check if a node is a Zustand store call based on the pattern
 */
function isZustandStoreCall(
  node: TSESTree.CallExpression,
  storePattern: RegExp
): boolean {
  if (node.callee.type === "Identifier") {
    return storePattern.test(node.callee.name);
  }
  return false;
}

/**
 * Check if a node is a useMemo call
 */
function isUseMemoCall(node: TSESTree.CallExpression): boolean {
  return node.callee.type === "Identifier" && node.callee.name === "useMemo";
}

/**
 * Get the variable name from a variable declarator
 */
function getVariableName(
  node: TSESTree.VariableDeclarator
): string | null {
  if (node.id.type === "Identifier") {
    return node.id.name;
  }
  return null;
}

/**
 * Check if a call expression is a transformation method on an identifier
 */
function isTransformationCall(
  node: TSESTree.CallExpression,
  trackedVars: Set<string>
): { isTransform: boolean; varName: string | null } {
  // Check for method calls like items.filter(), items.map()
  if (node.callee.type === "MemberExpression") {
    const { object, property } = node.callee;

    if (
      object.type === "Identifier" &&
      property.type === "Identifier" &&
      trackedVars.has(object.name) &&
      TRANSFORMATION_METHODS.has(property.name)
    ) {
      return { isTransform: true, varName: object.name };
    }

    // Check for chained calls like items.filter().map()
    if (object.type === "CallExpression") {
      const nested = isTransformationCall(object, trackedVars);
      if (nested.isTransform) {
        return nested;
      }
    }
  }

  // Check for Array.from(items), Object.keys(items), etc.
  if (node.callee.type === "MemberExpression") {
    const { object, property } = node.callee;
    if (
      object.type === "Identifier" &&
      property.type === "Identifier"
    ) {
      const funcName = `${object.name}.${property.name}`;
      if (ARRAY_TRANSFORMATION_FUNCTIONS.has(funcName)) {
        // Check if the first argument is a tracked variable
        if (
          node.arguments.length > 0 &&
          node.arguments[0].type === "Identifier" &&
          trackedVars.has(node.arguments[0].name)
        ) {
          return { isTransform: true, varName: node.arguments[0].name };
        }
      }
    }
  }

  return { isTransform: false, varName: null };
}

/**
 * Check if a node references any of the tracked variables
 */
function referencesTrackedVar(
  node: TSESTree.Node,
  trackedVars: Set<string>
): string | null {
  if (node.type === "Identifier" && trackedVars.has(node.name)) {
    return node.name;
  }

  if (node.type === "MemberExpression") {
    return referencesTrackedVar(node.object, trackedVars);
  }

  if (node.type === "CallExpression") {
    // Check callee
    const calleeRef = referencesTrackedVar(node.callee, trackedVars);
    if (calleeRef) return calleeRef;

    // Check arguments
    for (const arg of node.arguments) {
      const argRef = referencesTrackedVar(arg, trackedVars);
      if (argRef) return argRef;
    }
  }

  if (node.type === "BinaryExpression" || node.type === "LogicalExpression") {
    const leftRef = referencesTrackedVar(node.left, trackedVars);
    if (leftRef) return leftRef;
    return referencesTrackedVar(node.right, trackedVars);
  }

  if (node.type === "ConditionalExpression") {
    const testRef = referencesTrackedVar(node.test, trackedVars);
    if (testRef) return testRef;
    const consequentRef = referencesTrackedVar(node.consequent, trackedVars);
    if (consequentRef) return consequentRef;
    return referencesTrackedVar(node.alternate, trackedVars);
  }

  if (node.type === "ArrayExpression") {
    for (const element of node.elements) {
      if (element) {
        const elemRef = referencesTrackedVar(element, trackedVars);
        if (elemRef) return elemRef;
      }
    }
  }

  if (node.type === "SpreadElement") {
    return referencesTrackedVar(node.argument, trackedVars);
  }

  return null;
}

/**
 * Analyze useMemo body to detect if it performs transformations on store data
 */
function analyzeUseMemoBody(
  body: TSESTree.Node,
  trackedVars: Set<string>
): { hasTransformation: boolean; varName: string | null } {
  // Handle arrow function with expression body: () => items.filter(...)
  if (body.type === "CallExpression") {
    const result = isTransformationCall(body, trackedVars);
    if (result.isTransform) {
      return { hasTransformation: true, varName: result.varName };
    }
  }

  // Handle arrow function with block body: () => { return items.filter(...); }
  if (body.type === "BlockStatement") {
    for (const statement of body.body) {
      if (statement.type === "ReturnStatement" && statement.argument) {
        if (statement.argument.type === "CallExpression") {
          const result = isTransformationCall(statement.argument, trackedVars);
          if (result.isTransform) {
            return { hasTransformation: true, varName: result.varName };
          }
        }

        // Check if return value references tracked vars with any transformation
        const varRef = referencesTrackedVar(statement.argument, trackedVars);
        if (varRef && statement.argument.type === "CallExpression") {
          return { hasTransformation: true, varName: varRef };
        }
      }

      // Check variable declarations inside useMemo
      if (statement.type === "VariableDeclaration") {
        for (const decl of statement.declarations) {
          if (decl.init && decl.init.type === "CallExpression") {
            const result = isTransformationCall(decl.init, trackedVars);
            if (result.isTransform) {
              return { hasTransformation: true, varName: result.varName };
            }
          }
        }
      }
    }
  }

  return { hasTransformation: false, varName: null };
}

/**
 * Get the callback body from useMemo arguments
 */
function getUseMemoCallback(
  node: TSESTree.CallExpression
): TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression | null {
  if (node.arguments.length === 0) return null;

  const callback = node.arguments[0];
  if (
    callback.type === "ArrowFunctionExpression" ||
    callback.type === "FunctionExpression"
  ) {
    return callback;
  }

  return null;
}

export default createRule<Options, MessageIds>({
  name: "prefer-store-selectors",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Derived state from store should use selectors, not useMemo",
    },
    messages: {
      useMemoWithStoreData:
        "useMemo derives state from '{{varName}}' which comes from store. Move this computation to a Zustand selector.",
      chainedDerivedState:
        "Multiple chained useMemo calls derive from store data. Consolidate into store selectors.",
    },
    schema: [
      {
        type: "object",
        properties: {
          storeHookPattern: {
            type: "string",
            description: "Regex pattern for store hook names",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [
    {
      storeHookPattern: "^use.*Store$",
    },
  ],
  create(context) {
    const options = context.options[0] || {};
    const storeHookPatternStr = options.storeHookPattern ?? "^use.*Store$";

    let storePattern: RegExp;
    try {
      storePattern = new RegExp(storeHookPatternStr);
    } catch {
      // If invalid regex, use default
      storePattern = /^use.*Store$/;
    }

    // Scope tracking - each function gets its own scope
    interface Scope {
      storeVars: Set<string>;
      derivedMemoVars: Set<string>;
      useMemoNodes: Array<{
        node: TSESTree.CallExpression;
        varName: string;
        sourceVar: string;
      }>;
    }

    const scopeStack: Scope[] = [];

    function currentScope(): Scope | undefined {
      return scopeStack[scopeStack.length - 1];
    }

    function pushScope(): void {
      scopeStack.push({
        storeVars: new Set(),
        derivedMemoVars: new Set(),
        useMemoNodes: [],
      });
    }

    function popScope(): Scope | undefined {
      return scopeStack.pop();
    }

    function reportScope(scope: Scope): void {
      const { useMemoNodes, derivedMemoVars } = scope;

      if (useMemoNodes.length === 1) {
        const { node, sourceVar } = useMemoNodes[0];
        context.report({
          node,
          messageId: "useMemoWithStoreData",
          data: { varName: sourceVar },
        });
      } else if (useMemoNodes.length > 1) {
        // Check if there's a chain (one useMemo depends on another)
        const hasChain = useMemoNodes.some(({ sourceVar }) =>
          derivedMemoVars.has(sourceVar)
        );

        if (hasChain) {
          // Report chained derived state on the first node
          context.report({
            node: useMemoNodes[0].node,
            messageId: "chainedDerivedState",
          });
        } else {
          // Report each useMemo individually
          for (const { node, sourceVar } of useMemoNodes) {
            context.report({
              node,
              messageId: "useMemoWithStoreData",
              data: { varName: sourceVar },
            });
          }
        }
      }
    }

    /**
     * Check if a function is likely a React component or hook (not an inline callback)
     */
    function isComponentOrHook(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression
    ): boolean {
      // Function declarations are typically components or hooks
      if (node.type === "FunctionDeclaration") {
        return true;
      }

      // Check if assigned to a PascalCase variable (component) or camelCase starting with "use" (hook)
      if (node.parent?.type === "VariableDeclarator") {
        const declarator = node.parent;
        if (declarator.id.type === "Identifier") {
          const name = declarator.id.name;
          // PascalCase (component) or useXxx (hook)
          return /^[A-Z]/.test(name) || /^use[A-Z]/.test(name);
        }
      }

      // Named function expression
      if (node.type === "FunctionExpression" && node.id) {
        const name = node.id.name;
        return /^[A-Z]/.test(name) || /^use[A-Z]/.test(name);
      }

      return false;
    }

    return {
      // Push scope for component/hook functions
      "FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(
        node:
          | TSESTree.FunctionDeclaration
          | TSESTree.FunctionExpression
          | TSESTree.ArrowFunctionExpression
      ) {
        if (isComponentOrHook(node)) {
          pushScope();
        }
      },

      // Pop scope and report when exiting component/hook functions
      "FunctionDeclaration:exit"(node: TSESTree.FunctionDeclaration) {
        if (isComponentOrHook(node)) {
          const scope = popScope();
          if (scope) {
            reportScope(scope);
          }
        }
      },

      "FunctionExpression:exit"(node: TSESTree.FunctionExpression) {
        if (isComponentOrHook(node)) {
          const scope = popScope();
          if (scope) {
            reportScope(scope);
          }
        }
      },

      "ArrowFunctionExpression:exit"(node: TSESTree.ArrowFunctionExpression) {
        if (isComponentOrHook(node)) {
          const scope = popScope();
          if (scope) {
            reportScope(scope);
          }
        }
      },

      // Also handle program-level code
      Program() {
        pushScope();
      },

      "Program:exit"() {
        const scope = popScope();
        if (scope) {
          reportScope(scope);
        }
      },

      // Track variable declarations from store hooks
      VariableDeclarator(node) {
        const scope = currentScope();
        if (!scope) return;

        if (!node.init || node.init.type !== "CallExpression") {
          return;
        }

        const varName = getVariableName(node);
        if (!varName) return;

        // Check if this is a store hook call
        if (isZustandStoreCall(node.init, storePattern)) {
          scope.storeVars.add(varName);
          return;
        }

        // Check if this is a useMemo call
        if (isUseMemoCall(node.init)) {
          const callback = getUseMemoCallback(node.init);
          if (!callback) return;

          const body = callback.body;

          // Check if useMemo uses store-derived variables
          const allTracked = new Set<string>();
          scope.storeVars.forEach((v) => allTracked.add(v));
          scope.derivedMemoVars.forEach((v) => allTracked.add(v));
          const analysis = analyzeUseMemoBody(body, allTracked);

          if (analysis.hasTransformation && analysis.varName) {
            // Track this useMemo result as derived from store
            scope.derivedMemoVars.add(varName);

            scope.useMemoNodes.push({
              node: node.init,
              varName,
              sourceVar: analysis.varName,
            });
          }
        }
      },
    };
  },
});
