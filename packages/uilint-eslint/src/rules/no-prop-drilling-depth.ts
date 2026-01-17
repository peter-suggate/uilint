/**
 * Rule: no-prop-drilling-depth
 *
 * Warns when a prop is passed through multiple intermediate components
 * without being used, indicating prop drilling that should be refactored
 * to context or state management.
 *
 * Examples:
 * - Bad: Prop passed through 3+ components without use
 * - Good: Prop used directly in receiving component
 * - Good: Using Context or Zustand instead of drilling
 */

import type { TSESTree } from "@typescript-eslint/utils";
import { createRule, defineRuleMeta } from "../utils/create-rule.js";
import {
  resolveImportPath,
  parseFile,
  clearResolverCaches,
} from "../utils/export-resolver.js";

type MessageIds = "propDrilling";
type Options = [
  {
    /** Maximum depth before warning (default: 2) */
    maxDepth?: number;
    /** Props to ignore (e.g., className, style, children) */
    ignoredProps?: string[];
    /** Component patterns to skip (regex strings) */
    ignoreComponents?: string[];
  }
];

/**
 * Rule metadata - colocated with implementation for maintainability
 */
export const meta = defineRuleMeta({
  id: "no-prop-drilling-depth",
  name: "No Prop Drilling Depth",
  description: "Warn when props are drilled through too many components",
  defaultSeverity: "warn",
  category: "static",
  defaultOptions: [
    {
      maxDepth: 2,
      ignoredProps: ["className", "style", "children", "key", "ref", "id"],
      ignoreComponents: [],
    },
  ],
  optionSchema: {
    fields: [
      {
        key: "maxDepth",
        label: "Maximum drilling depth",
        type: "number",
        defaultValue: 2,
        description:
          "Maximum number of components a prop can pass through without use",
      },
      {
        key: "ignoredProps",
        label: "Ignored props",
        type: "text",
        defaultValue: "className, style, children, key, ref, id",
        description: "Comma-separated prop names to ignore (common pass-through props)",
      },
    ],
  },
  docs: `
## What it does

Detects when props are passed through multiple intermediate components without
being used (prop drilling). This is often a sign that you should use React
Context, Zustand, or another state management solution.

## Why it's useful

- **Maintainability**: Deep prop drilling creates tight coupling
- **Refactoring**: Changes require updates in many files
- **Readability**: Hard to trace where props come from
- **Performance**: Unnecessary re-renders in intermediate components

## Examples

### ❌ Incorrect

\`\`\`tsx
// Grandparent passes user through Parent to Child
function Grandparent({ user }) {
  return <Parent user={user} />;
}

function Parent({ user }) {
  // Parent doesn't use 'user', just passes it along
  return <Child user={user} />;
}

function Child({ user }) {
  return <div>{user.name}</div>;
}
\`\`\`

### ✅ Correct

\`\`\`tsx
// Use Context instead
const UserContext = createContext();

function Grandparent({ user }) {
  return (
    <UserContext.Provider value={user}>
      <Parent />
    </UserContext.Provider>
  );
}

function Child() {
  const user = useContext(UserContext);
  return <div>{user.name}</div>;
}
\`\`\`

## Configuration

\`\`\`js
// eslint.config.js
"uilint/no-prop-drilling-depth": ["warn", {
  maxDepth: 2,                                    // Allow passing through 2 components
  ignoredProps: ["className", "style", "children"], // Common pass-through props
  ignoreComponents: ["^Layout", "^Wrapper"]       // Skip wrapper components
}]
\`\`\`
`,
});

/**
 * Information about a component's prop usage
 */
interface ComponentPropInfo {
  /** Props received by the component */
  receivedProps: Set<string>;
  /** Props passed to child components: propName -> childComponentNames[] */
  passedProps: Map<string, string[]>;
  /** Props actually used in the component (not just passed) */
  usedProps: Set<string>;
  /** Child components that receive props from this component */
  childComponents: string[];
}

/**
 * Cache for analyzed component prop information
 */
const componentPropCache = new Map<string, ComponentPropInfo>();

/**
 * Clear the prop analysis cache
 */
export function clearPropCache(): void {
  componentPropCache.clear();
  clearResolverCaches();
}

/**
 * Check if a name is a React component (PascalCase)
 */
function isComponentName(name: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name);
}

/**
 * Extract props from a function parameter
 */
function extractPropsFromParam(
  param: TSESTree.Parameter
): { propNames: Set<string>; isSpread: boolean } {
  const propNames = new Set<string>();
  let isSpread = false;

  if (param.type === "ObjectPattern") {
    for (const prop of param.properties) {
      if (prop.type === "RestElement") {
        isSpread = true;
      } else if (
        prop.type === "Property" &&
        prop.key.type === "Identifier"
      ) {
        propNames.add(prop.key.name);
      }
    }
  } else if (param.type === "Identifier") {
    // Single props parameter - assume all props accessed via props.x
    isSpread = true;
  }

  return { propNames, isSpread };
}

/**
 * Find all JSX elements in a function body and extract prop passing info
 */
function analyzeJSXPropPassing(
  body: TSESTree.Node,
  receivedProps: Set<string>
): { passedProps: Map<string, string[]>; usedProps: Set<string> } {
  const passedProps = new Map<string, string[]>();
  const usedProps = new Set<string>();

  function visit(node: TSESTree.Node): void {
    if (!node || typeof node !== "object") return;

    // Check JSX elements for prop passing
    if (node.type === "JSXOpeningElement") {
      const elementName = getJSXElementName(node.name);

      // Only care about component elements (PascalCase)
      if (elementName && isComponentName(elementName)) {
        for (const attr of node.attributes) {
          if (attr.type === "JSXAttribute" && attr.name.type === "JSXIdentifier") {
            const attrName = attr.name.name;
            const propValue = attr.value;

            // Check if the attribute value is a received prop
            if (propValue?.type === "JSXExpressionContainer") {
              const expr = propValue.expression;
              if (expr.type === "Identifier" && receivedProps.has(expr.name)) {
                // This prop is being passed to a child
                const existing = passedProps.get(expr.name) || [];
                existing.push(elementName);
                passedProps.set(expr.name, existing);
              } else if (
                expr.type === "MemberExpression" &&
                expr.object.type === "Identifier" &&
                expr.object.name === "props" &&
                expr.property.type === "Identifier"
              ) {
                // props.x pattern
                const propName = expr.property.name;
                if (receivedProps.has(propName) || receivedProps.size === 0) {
                  const existing = passedProps.get(propName) || [];
                  existing.push(elementName);
                  passedProps.set(propName, existing);
                }
              }
            }
          }

          // Check for spread props: {...props} or {...rest}
          if (attr.type === "JSXSpreadAttribute") {
            if (attr.argument.type === "Identifier") {
              const spreadName = attr.argument.name;
              if (spreadName === "props" || receivedProps.has(spreadName)) {
                // All props are being spread
                for (const prop of receivedProps) {
                  const existing = passedProps.get(prop) || [];
                  existing.push(elementName);
                  passedProps.set(prop, existing);
                }
              }
            }
          }
        }
      }
    }

    // Check for prop usage (not just passing)
    // e.g., {user.name} or {props.user.name} or just {user}
    if (
      node.type === "MemberExpression" &&
      node.object.type === "Identifier" &&
      receivedProps.has(node.object.name)
    ) {
      usedProps.add(node.object.name);
    }

    if (
      node.type === "Identifier" &&
      receivedProps.has(node.name) &&
      node.parent?.type !== "JSXExpressionContainer"
    ) {
      // Prop used in expression (but not directly passed to child)
      usedProps.add(node.name);
    }

    // Check for props.x.something usage
    if (
      node.type === "MemberExpression" &&
      node.object.type === "MemberExpression" &&
      node.object.object.type === "Identifier" &&
      node.object.object.name === "props" &&
      node.object.property.type === "Identifier"
    ) {
      usedProps.add(node.object.property.name);
    }

    // Recurse into children
    for (const key of Object.keys(node)) {
      if (key === "parent" || key === "loc" || key === "range") continue;
      const child = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === "object") {
            visit(item as TSESTree.Node);
          }
        }
      } else if (child && typeof child === "object") {
        visit(child as TSESTree.Node);
      }
    }
  }

  visit(body);
  return { passedProps, usedProps };
}

/**
 * Get the name of a JSX element
 */
function getJSXElementName(node: TSESTree.JSXTagNameExpression): string | null {
  if (node.type === "JSXIdentifier") {
    return node.name;
  }
  if (node.type === "JSXMemberExpression") {
    // Get the root object for namespace components
    let current = node.object;
    while (current.type === "JSXMemberExpression") {
      current = current.object;
    }
    return current.type === "JSXIdentifier" ? current.name : null;
  }
  return null;
}

/**
 * Track prop drilling within a single file
 */
interface PropDrillingInfo {
  propName: string;
  component: string;
  passedTo: string[];
  usedDirectly: boolean;
}

export default createRule<Options, MessageIds>({
  name: "no-prop-drilling-depth",
  meta: {
    type: "suggestion",
    docs: {
      description: "Warn when props are drilled through too many components",
    },
    messages: {
      propDrilling:
        "Prop '{{propName}}' is passed through {{depth}} component(s) without being used. Consider using Context or state management. Path: {{path}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxDepth: {
            type: "number",
            minimum: 1,
            description: "Maximum drilling depth before warning",
          },
          ignoredProps: {
            type: "array",
            items: { type: "string" },
            description: "Props to ignore",
          },
          ignoreComponents: {
            type: "array",
            items: { type: "string" },
            description: "Component patterns to skip (regex)",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [
    {
      maxDepth: 2,
      ignoredProps: ["className", "style", "children", "key", "ref", "id"],
      ignoreComponents: [],
    },
  ],
  create(context) {
    const options = context.options[0] || {};
    const maxDepth = options.maxDepth ?? 2;
    const ignoredProps = new Set(
      options.ignoredProps ?? [
        "className",
        "style",
        "children",
        "key",
        "ref",
        "id",
      ]
    );
    const ignoreComponentPatterns = (options.ignoreComponents ?? []).map(
      (p) => new RegExp(p)
    );

    // Track components and their prop flows within the file
    const componentProps = new Map<string, ComponentPropInfo>();
    const imports = new Map<string, string>(); // localName -> importSource
    const componentNodes = new Map<string, TSESTree.Node>(); // componentName -> node

    function shouldIgnoreComponent(name: string): boolean {
      return ignoreComponentPatterns.some((pattern) => pattern.test(name));
    }

    function shouldIgnoreProp(name: string): boolean {
      return ignoredProps.has(name);
    }

    /**
     * Analyze a component function for prop drilling
     */
    function analyzeComponent(
      name: string,
      node: TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
      reportNode: TSESTree.Node
    ): void {
      if (shouldIgnoreComponent(name)) return;

      const firstParam = node.params[0];
      if (!firstParam) return;

      const { propNames, isSpread } = extractPropsFromParam(firstParam);

      // If using spread without destructuring, we can't easily track props
      if (isSpread && propNames.size === 0) return;

      const body = node.body;
      if (!body) return;

      const { passedProps, usedProps } = analyzeJSXPropPassing(body, propNames);

      componentProps.set(name, {
        receivedProps: propNames,
        passedProps,
        usedProps,
        childComponents: [...new Set([...passedProps.values()].flat())],
      });

      componentNodes.set(name, reportNode);
    }

    return {
      // Track imports for cross-file analysis
      ImportDeclaration(node) {
        const source = node.source.value as string;
        for (const spec of node.specifiers) {
          if (spec.type === "ImportSpecifier" || spec.type === "ImportDefaultSpecifier") {
            imports.set(spec.local.name, source);
          }
        }
      },

      // Analyze function declarations
      FunctionDeclaration(node) {
        if (node.id && isComponentName(node.id.name)) {
          analyzeComponent(node.id.name, node, node);
        }
      },

      // Analyze arrow functions
      VariableDeclarator(node) {
        if (
          node.id.type === "Identifier" &&
          isComponentName(node.id.name) &&
          node.init?.type === "ArrowFunctionExpression"
        ) {
          analyzeComponent(node.id.name, node.init, node);
        }
      },

      // Analyze at the end of the file
      "Program:exit"() {
        // Find drilling chains within the file
        for (const [componentName, info] of componentProps) {
          for (const [propName, children] of info.passedProps) {
            if (shouldIgnoreProp(propName)) continue;

            // Check if prop is used directly
            if (info.usedProps.has(propName)) continue;

            // Track the drilling chain
            const chain: string[] = [componentName];
            let depth = 0;
            let current = children;

            while (current.length > 0 && depth < maxDepth + 1) {
              depth++;
              const nextChildren: string[] = [];

              for (const child of current) {
                chain.push(child);
                const childInfo = componentProps.get(child);

                if (childInfo) {
                  // Check if child uses the prop
                  if (childInfo.usedProps.has(propName)) {
                    // Prop is used here, drilling stops
                    break;
                  }

                  // Check if child passes the prop further
                  const childPasses = childInfo.passedProps.get(propName);
                  if (childPasses) {
                    nextChildren.push(...childPasses);
                  }
                }
              }

              current = nextChildren;
            }

            // Report if depth exceeds threshold
            if (depth > maxDepth) {
              const reportNode = componentNodes.get(componentName);
              if (reportNode) {
                context.report({
                  node: reportNode,
                  messageId: "propDrilling",
                  data: {
                    propName,
                    depth: String(depth),
                    path: chain.slice(0, maxDepth + 2).join(" → "),
                  },
                });
              }
            }
          }
        }
      },
    };
  },
});
