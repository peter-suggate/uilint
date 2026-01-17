/**
 * Rule: no-any-in-props
 *
 * Prevents React components from using `any` type in their props, ensuring
 * type safety at component boundaries.
 *
 * Examples:
 * - Bad: function Component(props: any) {}
 * - Bad: function Component({ x }: { x: any }) {}
 * - Bad: const Component: FC<any> = () => {}
 * - Good: function Component(props: { name: string }) {}
 */

import { createRule, defineRuleMeta } from "../utils/create-rule.js";
import type { TSESTree } from "@typescript-eslint/utils";

type MessageIds = "anyInProps" | "anyInPropsProperty";
type Options = [
  {
    /** Also check FC<any> and React.FC<any> patterns */
    checkFCGenerics?: boolean;
    /** Allow any in generic defaults (e.g., <T = any>) */
    allowInGenericDefaults?: boolean;
  }
];

/**
 * Rule metadata - colocated with implementation for maintainability
 */
export const meta = defineRuleMeta({
  id: "no-any-in-props",
  name: "No Any in Props",
  description: "Disallow 'any' type in React component props",
  defaultSeverity: "error",
  category: "static",
  defaultOptions: [{ checkFCGenerics: true, allowInGenericDefaults: false }],
  optionSchema: {
    fields: [
      {
        key: "checkFCGenerics",
        label: "Check FC generics",
        type: "boolean",
        defaultValue: true,
        description: "Check FC<any> and React.FC<any> patterns",
      },
      {
        key: "allowInGenericDefaults",
        label: "Allow in generic defaults",
        type: "boolean",
        defaultValue: false,
        description: "Allow any in generic type parameter defaults",
      },
    ],
  },
  docs: `
## What it does

Prevents the use of \`any\` type in React component props. This ensures type
safety at component boundaries, catching type errors at compile time rather
than runtime.

## Why it's useful

- **Type Safety**: Catches prop type errors at compile time
- **Documentation**: Props serve as self-documenting API
- **Refactoring**: IDE can track prop usage across codebase
- **Code Quality**: Encourages thoughtful API design

## Examples

### ❌ Incorrect

\`\`\`tsx
// Direct any annotation
function Component(props: any) {}

// Any in destructured props
function Component({ data }: { data: any }) {}

// FC with any generic
const Component: FC<any> = () => {};

// Any in props interface
interface Props { value: any }
function Component(props: Props) {}
\`\`\`

### ✅ Correct

\`\`\`tsx
// Properly typed props
function Component(props: { name: string }) {}

// Using unknown for truly unknown types
function Component({ data }: { data: unknown }) {}

// Typed FC
const Component: FC<{ count: number }> = () => {};

// Generic component with constraint
function List<T extends object>(props: { items: T[] }) {}
\`\`\`

## Configuration

\`\`\`js
// eslint.config.js
"uilint/no-any-in-props": ["error", {
  checkFCGenerics: true,        // Check FC<any> patterns
  allowInGenericDefaults: false // Disallow <T = any>
}]
\`\`\`
`,
});

/**
 * Check if a name is likely a React component (PascalCase, not a hook)
 */
function isComponentName(name: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name) && !name.startsWith("Use");
}

/**
 * Check if a type node contains 'any'
 */
function containsAnyType(
  node: TSESTree.TypeNode,
  allowInGenericDefaults: boolean
): { hasAny: boolean; location: string | null } {
  if (!node) {
    return { hasAny: false, location: null };
  }

  switch (node.type) {
    case "TSAnyKeyword":
      return { hasAny: true, location: null };

    case "TSTypeLiteral":
      // Check each property in { prop: any }
      for (const member of node.members) {
        if (
          member.type === "TSPropertySignature" &&
          member.typeAnnotation?.typeAnnotation
        ) {
          const result = containsAnyType(
            member.typeAnnotation.typeAnnotation,
            allowInGenericDefaults
          );
          if (result.hasAny) {
            const propName =
              member.key.type === "Identifier" ? member.key.name : "property";
            return { hasAny: true, location: `property '${propName}'` };
          }
        }
        // Index signature [key: string]: any
        if (
          member.type === "TSIndexSignature" &&
          member.typeAnnotation?.typeAnnotation
        ) {
          const result = containsAnyType(
            member.typeAnnotation.typeAnnotation,
            allowInGenericDefaults
          );
          if (result.hasAny) {
            return { hasAny: true, location: "index signature" };
          }
        }
      }
      return { hasAny: false, location: null };

    case "TSUnionType":
    case "TSIntersectionType":
      for (const typeNode of node.types) {
        const result = containsAnyType(typeNode, allowInGenericDefaults);
        if (result.hasAny) {
          return result;
        }
      }
      return { hasAny: false, location: null };

    case "TSArrayType":
      return containsAnyType(node.elementType, allowInGenericDefaults);

    case "TSTypeReference":
      // Check generic arguments like Array<any>, Record<string, any>
      if (node.typeArguments) {
        for (const param of node.typeArguments.params) {
          const result = containsAnyType(param, allowInGenericDefaults);
          if (result.hasAny) {
            return { hasAny: true, location: "generic argument" };
          }
        }
      }
      return { hasAny: false, location: null };

    case "TSFunctionType":
      // Check return type and parameters
      if (node.returnType?.typeAnnotation) {
        const result = containsAnyType(
          node.returnType.typeAnnotation,
          allowInGenericDefaults
        );
        if (result.hasAny) {
          return { hasAny: true, location: "function return type" };
        }
      }
      for (const param of node.params) {
        // Skip TSParameterProperty (doesn't have typeAnnotation) and RestElement
        if (
          param.type !== "RestElement" &&
          param.type !== "TSParameterProperty" &&
          "typeAnnotation" in param &&
          param.typeAnnotation?.typeAnnotation
        ) {
          const result = containsAnyType(
            param.typeAnnotation.typeAnnotation,
            allowInGenericDefaults
          );
          if (result.hasAny) {
            return { hasAny: true, location: "function parameter" };
          }
        }
      }
      return { hasAny: false, location: null };

    case "TSTupleType":
      for (const elementType of node.elementTypes) {
        // Handle both TSNamedTupleMember and regular type nodes
        const typeToCheck =
          elementType.type === "TSNamedTupleMember"
            ? elementType.elementType
            : elementType;
        const result = containsAnyType(typeToCheck, allowInGenericDefaults);
        if (result.hasAny) {
          return { hasAny: true, location: "tuple element" };
        }
      }
      return { hasAny: false, location: null };

    case "TSConditionalType":
      // Check all parts of conditional type
      const checkResult = containsAnyType(
        node.checkType,
        allowInGenericDefaults
      );
      if (checkResult.hasAny) return checkResult;
      const extendsResult = containsAnyType(
        node.extendsType,
        allowInGenericDefaults
      );
      if (extendsResult.hasAny) return extendsResult;
      const trueResult = containsAnyType(
        node.trueType,
        allowInGenericDefaults
      );
      if (trueResult.hasAny) return trueResult;
      const falseResult = containsAnyType(
        node.falseType,
        allowInGenericDefaults
      );
      if (falseResult.hasAny) return falseResult;
      return { hasAny: false, location: null };

    case "TSMappedType":
      if (node.typeAnnotation) {
        return containsAnyType(node.typeAnnotation, allowInGenericDefaults);
      }
      return { hasAny: false, location: null };

    default:
      return { hasAny: false, location: null };
  }
}

/**
 * Get the name of a function or component
 */
function getComponentName(
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.ArrowFunctionExpression
    | TSESTree.FunctionExpression
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

export default createRule<Options, MessageIds>({
  name: "no-any-in-props",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow 'any' type in React component props",
    },
    messages: {
      anyInProps:
        "Component '{{componentName}}' has 'any' type in props. Use a specific type or 'unknown' instead.",
      anyInPropsProperty:
        "Component '{{componentName}}' has 'any' type in {{location}}. Use a specific type or 'unknown' instead.",
    },
    schema: [
      {
        type: "object",
        properties: {
          checkFCGenerics: {
            type: "boolean",
            description: "Check FC<any> and React.FC<any> patterns",
          },
          allowInGenericDefaults: {
            type: "boolean",
            description: "Allow any in generic type parameter defaults",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [
    {
      checkFCGenerics: true,
      allowInGenericDefaults: false,
    },
  ],
  create(context) {
    const options = context.options[0] || {};
    const checkFCGenerics = options.checkFCGenerics ?? true;
    const allowInGenericDefaults = options.allowInGenericDefaults ?? false;

    /**
     * Check a function's first parameter for any type
     */
    function checkFunctionProps(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.ArrowFunctionExpression
        | TSESTree.FunctionExpression
    ): void {
      const componentName = getComponentName(node);

      // Skip if not a component (not PascalCase)
      if (!componentName || !isComponentName(componentName)) {
        return;
      }

      // Check first parameter (props)
      const firstParam = node.params[0];
      if (!firstParam) {
        return;
      }

      // Get type annotation
      let typeAnnotation: TSESTree.TypeNode | null = null;

      if (firstParam.type === "Identifier" && firstParam.typeAnnotation) {
        typeAnnotation = firstParam.typeAnnotation.typeAnnotation;
      } else if (
        firstParam.type === "ObjectPattern" &&
        firstParam.typeAnnotation
      ) {
        typeAnnotation = firstParam.typeAnnotation.typeAnnotation;
      }

      if (typeAnnotation) {
        const result = containsAnyType(typeAnnotation, allowInGenericDefaults);
        if (result.hasAny) {
          context.report({
            node: firstParam,
            messageId: result.location ? "anyInPropsProperty" : "anyInProps",
            data: {
              componentName,
              location: result.location || "props",
            },
          });
        }
      }
    }

    /**
     * Check FC<any> or React.FC<any> patterns
     */
    function checkFCGeneric(node: TSESTree.VariableDeclarator): void {
      if (!checkFCGenerics) {
        return;
      }

      // Get variable name
      if (node.id.type !== "Identifier") {
        return;
      }
      const componentName = node.id.name;

      // Skip if not a component name
      if (!isComponentName(componentName)) {
        return;
      }

      // Check type annotation
      const typeAnnotation = node.id.typeAnnotation?.typeAnnotation;
      if (!typeAnnotation || typeAnnotation.type !== "TSTypeReference") {
        return;
      }

      // Check if it's FC or React.FC
      let isFCType = false;
      if (
        typeAnnotation.typeName.type === "Identifier" &&
        ["FC", "FunctionComponent", "VFC"].includes(typeAnnotation.typeName.name)
      ) {
        isFCType = true;
      } else if (
        typeAnnotation.typeName.type === "TSQualifiedName" &&
        typeAnnotation.typeName.left.type === "Identifier" &&
        typeAnnotation.typeName.left.name === "React" &&
        ["FC", "FunctionComponent", "VFC"].includes(
          typeAnnotation.typeName.right.name
        )
      ) {
        isFCType = true;
      }

      if (!isFCType || !typeAnnotation.typeArguments) {
        return;
      }

      // Check the type argument
      const firstTypeArg = typeAnnotation.typeArguments.params[0];
      if (firstTypeArg) {
        const result = containsAnyType(firstTypeArg, allowInGenericDefaults);
        if (result.hasAny) {
          context.report({
            node: firstTypeArg,
            messageId: result.location ? "anyInPropsProperty" : "anyInProps",
            data: {
              componentName,
              location: result.location || "FC type parameter",
            },
          });
        }
      }
    }

    return {
      FunctionDeclaration(node) {
        checkFunctionProps(node);
      },

      ArrowFunctionExpression(node) {
        checkFunctionProps(node);
      },

      FunctionExpression(node) {
        checkFunctionProps(node);
      },

      VariableDeclarator(node) {
        checkFCGeneric(node);
      },
    };
  },
});
