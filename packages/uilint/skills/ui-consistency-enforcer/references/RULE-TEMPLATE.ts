/**
 * Rule: {rule-name}
 *
 * {Detailed description of what this rule enforces and why.
 * Include examples of patterns this catches and the preferred alternatives.}
 *
 * Examples:
 * - Bad: <button>Click</button>
 * - Good: <Button>Click</Button> (from @/components/ui/button)
 */

import { createRule } from "../utils/create-rule.js";
import type { TSESTree } from "@typescript-eslint/utils";

// Define all possible error message IDs as a union type
type MessageIds = "preferComponent" | "missingImport";

// Define the options schema as a tuple type
// The ? makes the entire options object optional
type Options = [
  {
    /** The preferred component to use */
    preferred?: string;
    /** Import source for the preferred component */
    importSource?: string;
    /** HTML elements to check (e.g., ["button", "input"]) */
    elements?: string[];
    /** Files/directories to ignore (glob patterns) */
    ignore?: string[];
  }?
];

// Track component state during file traversal
interface ComponentUsage {
  node: TSESTree.JSXOpeningElement;
  elementName: string;
  hasPreferredImport: boolean;
}

export default createRule<Options, MessageIds>({
  name: "{rule-name}",
  meta: {
    // "problem" = likely bug, "suggestion" = code improvement, "layout" = formatting
    type: "suggestion",
    docs: {
      description: "{Short description for docs}",
    },
    // Define all error messages with placeholders using {{name}} syntax
    messages: {
      preferComponent:
        "Use <{{preferred}}> from '{{source}}' instead of native <{{element}}>.",
      missingImport:
        "Import {{component}} from '{{source}}' to use the design system component.",
    },
    // JSON Schema for validating options
    schema: [
      {
        type: "object",
        properties: {
          preferred: {
            type: "string",
            description: "The preferred component name to use",
          },
          importSource: {
            type: "string",
            description: "The import path for the preferred component",
          },
          elements: {
            type: "array",
            items: { type: "string" },
            description: "HTML elements to check",
          },
          ignore: {
            type: "array",
            items: { type: "string" },
            description: "Glob patterns for files to ignore",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  // Default options - these are merged with user options
  defaultOptions: [
    {
      preferred: "Button",
      importSource: "@/components/ui/button",
      elements: ["button"],
      ignore: [],
    },
  ],
  // The create function receives context and returns AST visitor methods
  create(context) {
    // Get options with defaults
    const options = context.options[0] || {};
    const preferred = options.preferred ?? "Button";
    const importSource = options.importSource ?? "@/components/ui/button";
    const elements = new Set(options.elements ?? ["button"]);
    const ignorePatterns = options.ignore ?? [];

    // Track state during file traversal
    const imports = new Map<string, string>(); // localName -> source
    const usages: ComponentUsage[] = [];

    // Check if file should be ignored
    const filename = context.filename || context.getFilename?.() || "";
    if (ignorePatterns.some((pattern) => filename.includes(pattern))) {
      return {}; // Skip this file entirely
    }

    return {
      // ============================================
      // IMPORT TRACKING
      // ============================================
      ImportDeclaration(node) {
        const source = node.source.value as string;

        for (const spec of node.specifiers) {
          switch (spec.type) {
            case "ImportSpecifier":
              // import { Button } from "..."
              // import { Button as Btn } from "..."
              imports.set(spec.local.name, source);
              break;
            case "ImportDefaultSpecifier":
              // import Button from "..."
              imports.set(spec.local.name, source);
              break;
            case "ImportNamespaceSpecifier":
              // import * as UI from "..."
              imports.set(spec.local.name, source);
              break;
          }
        }
      },

      // ============================================
      // JSX ELEMENT ANALYSIS
      // ============================================
      JSXOpeningElement(node) {
        // Handle simple elements: <button>
        if (node.name.type === "JSXIdentifier") {
          const name = node.name.name;

          // Only check lowercase (HTML) elements in our target list
          if (elements.has(name)) {
            // Check if the preferred component is imported
            const hasPreferredImport =
              imports.has(preferred) &&
              imports.get(preferred) === importSource;

            usages.push({
              node,
              elementName: name,
              hasPreferredImport,
            });
          }
        }

        // Handle member expressions: <UI.Button>
        if (node.name.type === "JSXMemberExpression") {
          // Get the root object (e.g., "UI" from UI.Button)
          let current = node.name.object;
          while (current.type === "JSXMemberExpression") {
            current = current.object;
          }

          if (current.type === "JSXIdentifier") {
            // You can check namespace imports here if needed
          }
        }
      },

      // ============================================
      // FINAL ANALYSIS (after entire file parsed)
      // ============================================
      "Program:exit"() {
        for (const usage of usages) {
          // Report the violation
          context.report({
            node: usage.node,
            messageId: "preferComponent",
            data: {
              preferred,
              source: importSource,
              element: usage.elementName,
            },
          });
        }
      },
    };
  },
});

// ============================================
// UTILITY FUNCTIONS (if needed)
// ============================================

/**
 * Check if a name follows PascalCase (component naming convention)
 */
function isPascalCase(name: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name);
}

/**
 * Check if a name is a React hook (starts with "use")
 */
function isHookName(name: string): boolean {
  return /^use[A-Z]/.test(name);
}

/**
 * Get the name from various function declaration patterns
 */
function getFunctionName(
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression
): string | null {
  // Function declaration: function Foo() {}
  if (node.type === "FunctionDeclaration" && node.id) {
    return node.id.name;
  }

  // Variable declarator: const Foo = () => {}
  const parent = node.parent;
  if (
    parent?.type === "VariableDeclarator" &&
    parent.id.type === "Identifier"
  ) {
    return parent.id.name;
  }

  // forwardRef/memo wrapper: const Foo = forwardRef(() => {})
  if (parent?.type === "CallExpression") {
    const callParent = parent.parent;
    if (
      callParent?.type === "VariableDeclarator" &&
      callParent.id.type === "Identifier"
    ) {
      return callParent.id.name;
    }
  }

  // Named function expression: const x = function Foo() {}
  if (node.type === "FunctionExpression" && node.id) {
    return node.id.name;
  }

  return null;
}
